"""
ClearSAR — self-contained Colab/Kaggle GPU server for the BRIDGE model.

Runs the SAR->optical Image-to-Image Schrodinger Bridge model (bridge_final) on a
FREE Colab GPU and exposes the SAME async job API the React frontend speaks, so the
frontend works unchanged — just point VITE_API_URL at the tunnel URL.

Port of the notebook's Stage-3 bridge (cell 28): 16ch adapted VAE (base SD vae +
DetailEncoder), UNet conv_in 32ch / conv_out 16ch, CLIP text conditioning, and
I2SB bridge sampling (T steps, kappa, eta schedule, latent_scale).

See colab/README.md for the 3-cell recipe.
"""
from __future__ import annotations

import io
import json
import os
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

# ---------------------------------------------------------------- config
HF_MODEL_REPO = os.environ.get("HF_MODEL_REPO", "Arsalan90/sar-to-optical-diffusion")
BRIDGE_DIR = os.environ.get("BRIDGE_DIR", "bridge_final")
VAE_TAG = os.environ.get("VAE_TAG", "adapted16_final")
BASE_SD_MODEL = os.environ.get("BASE_SD_MODEL", "stable-diffusion-v1-5/stable-diffusion-v1-5")
IMG_SIZE = int(os.environ.get("IMG_SIZE", "256"))
COND_SEASON = os.environ.get("COND_SEASON", "summer")
COND_TERRAIN = os.environ.get("COND_TERRAIN", "temperate")
STORAGE = Path(os.environ.get("STORAGE_DIR", "/content/clearsar_storage"))
STORAGE.mkdir(parents=True, exist_ok=True)

METRICS = {"psnr": None, "ssim": None, "lpips": None}
BASE_CH, DETAIL_CH, TOTAL_CH = 4, 12, 16
SEASON_DESC = {"spring": "spring", "summer": "summer", "fall": "autumn", "winter": "winter"}


# ---------------------------------------------------------------- model
class Bridge:
    def __init__(self):
        self._loaded = False

    def load(self):
        if self._loaded:
            return
        import torch
        import torch.nn as nn
        from diffusers import AutoencoderKL, UNet2DConditionModel
        from transformers import CLIPTextModel, CLIPTokenizer
        from huggingface_hub import snapshot_download
        from safetensors.torch import load_file

        self.torch = torch
        self.device = "cuda" if torch.cuda.is_available() else (
            "mps" if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available() else "cpu")
        self.dtype = torch.float16 if self.device == "cuda" else torch.float32
        if self.device == "mps":
            os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
        print(f"[clearsar] device={self.device} dtype={self.dtype}")

        root = Path(snapshot_download(HF_MODEL_REPO, allow_patterns=[
            f"{BRIDGE_DIR}/*", f"{VAE_TAG}/base_vae.pth", f"{VAE_TAG}/detail_encoder.pth"]))

        cfg = json.loads((root / BRIDGE_DIR / "bridge_config.json").read_text())
        self.latent_scale = float(cfg["latent_scale"]); self.T = int(cfg["T"])
        self.kappa = float(cfg["kappa"])
        idx = np.arange(self.T)
        self.eta = torch.tensor(cfg["eta_1"] * (cfg["eta_T"] / cfg["eta_1"]) ** (idx / (self.T - 1)),
                                dtype=torch.float32).to(self.device)

        class DetailEncoder(nn.Module):
            def __init__(self, in_ch=3, out_ch=DETAIL_CH, nf=64):
                super().__init__()
                self.net = nn.Sequential(
                    nn.Conv2d(in_ch, nf, 3, 2, 1), nn.GroupNorm(8, nf), nn.SiLU(),
                    nn.Conv2d(nf, nf * 2, 3, 2, 1), nn.GroupNorm(8, nf * 2), nn.SiLU(),
                    nn.Conv2d(nf * 2, nf * 4, 3, 2, 1), nn.GroupNorm(8, nf * 4), nn.SiLU(),
                    nn.Conv2d(nf * 4, nf * 4, 3, 1, 1), nn.GroupNorm(8, nf * 4), nn.SiLU(),
                    nn.Conv2d(nf * 4, out_ch, 3, 1, 1))
            def forward(self, x): return self.net(x)

        base_vae = AutoencoderKL.from_pretrained(BASE_SD_MODEL, subfolder="vae")
        old = base_vae.decoder.conv_in
        base_vae.decoder.conv_in = nn.Conv2d(TOTAL_CH, old.out_channels, old.kernel_size,
                                             old.stride, old.padding, bias=(old.bias is not None))
        base_vae.load_state_dict(torch.load(root / VAE_TAG / "base_vae.pth", map_location="cpu"))
        self.detail = DetailEncoder()
        self.detail.load_state_dict(torch.load(root / VAE_TAG / "detail_encoder.pth", map_location="cpu"))
        self.vae = base_vae.to(self.device).float().eval(); self.vae.requires_grad_(False)
        self.detail = self.detail.to(self.device).float().eval(); self.detail.requires_grad_(False)

        unet = UNet2DConditionModel.from_pretrained(BASE_SD_MODEL, subfolder="unet")
        oi = unet.conv_in
        unet.conv_in = nn.Conv2d(2 * TOTAL_CH, oi.out_channels, oi.kernel_size, oi.stride, oi.padding)
        unet.config.in_channels = 2 * TOTAL_CH
        oo = unet.conv_out
        unet.conv_out = nn.Conv2d(oo.in_channels, TOTAL_CH, oo.kernel_size, oo.stride, oo.padding)
        unet.config.out_channels = TOTAL_CH
        unet.load_state_dict(load_file(str(root / BRIDGE_DIR / "unet.safetensors")))
        self.unet = unet.to(self.device, dtype=self.dtype).eval(); self.unet.requires_grad_(False)

        self.tok = CLIPTokenizer.from_pretrained(BASE_SD_MODEL, subfolder="tokenizer")
        self.txt = CLIPTextModel.from_pretrained(BASE_SD_MODEL, subfolder="text_encoder").to(self.device).eval()
        self.txt.requires_grad_(False)
        self._loaded = True
        print(f"[clearsar] bridge loaded (T={self.T}, latent_scale={self.latent_scale:.4f})")

    def translate(self, image: Image.Image, season: str = None, terrain: str = None) -> Image.Image:
        self.load()
        torch = self.torch
        season = season or COND_SEASON
        terrain = terrain or COND_TERRAIN
        img = image.convert("RGB")
        if img.size != (IMG_SIZE, IMG_SIZE):
            img = img.resize((IMG_SIZE, IMG_SIZE), Image.BILINEAR)
        arr = np.array(img, dtype=np.float32) / 255.0
        x = (torch.from_numpy(arr).permute(2, 0, 1) * 2 - 1).unsqueeze(0).to(self.device).float()

        prompt = f"a {SEASON_DESC.get(season, season)} satellite optical image of {terrain} terrain"
        with torch.no_grad():
            z_base = self.vae.encode(x).latent_dist.mode()
            y = torch.cat([self.vae.post_quant_conv(z_base), self.detail(x)], 1) * self.latent_scale
            ids = self.tok(prompt, padding="max_length", max_length=self.tok.model_max_length,
                           truncation=True, return_tensors="pt").input_ids.to(self.device)
            cond = self.txt(ids)[0]

            xt = y + self.kappa * torch.sqrt(self.eta[-1]) * torch.randn_like(y)
            for t in reversed(range(self.T)):
                tb = torch.full((1,), int(t * 1000 / self.T), device=self.device, dtype=torch.long)
                x0 = self.unet(torch.cat([xt, y], 1).to(self.dtype), tb,
                               encoder_hidden_states=cond.to(self.dtype)).sample.float()
                if t > 0:
                    ep = self.eta[t - 1]
                    xt = x0 + ep * (y - x0) + self.kappa * torch.sqrt(ep) * torch.randn_like(xt)
                else:
                    xt = x0
            rec = self.vae.decoder((xt / self.latent_scale).float()).clamp(-1, 1).squeeze(0).cpu()

        out = (((rec + 1) / 2).clamp(0, 1).permute(1, 2, 0).numpy() * 255).round().astype(np.uint8)
        return Image.fromarray(out, mode="RGB")


bridge = Bridge()
_jobs: dict[str, dict] = {}
_lock = threading.Lock()


def _set(jid, **kw):
    with _lock:
        _jobs[jid].update(kw)


def _run(jid, raw, season, terrain):
    try:
        _set(jid, status="running", stage="denoise", progress=40)
        out = bridge.translate(Image.open(io.BytesIO(raw)), season, terrain)
        out.save(STORAGE / f"{jid}_optical.png")
        _set(jid, status="completed", stage="done", progress=100,
             elapsed_s=round(time.time() - _jobs[jid]["started"], 2))
    except Exception as e:  # noqa: BLE001
        import traceback; traceback.print_exc()
        _set(jid, status="failed", stage="ingest", progress=0, error=str(e))


# ------------------------------------------------------------------ API
app = FastAPI(title="ClearSAR Colab API (bridge)")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    return {"status": "ok", "mode": "colab-bridge", "model": f"{HF_MODEL_REPO}/{BRIDGE_DIR}"}


@app.post("/api/translate", status_code=202)
async def translate(file: UploadFile = File(...),
                    season: str = Form("summer"), terrain: str = Form("temperate")):
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file")
    jid = uuid.uuid4().hex[:12]
    with _lock:
        _jobs[jid] = {"job_id": jid, "filename": file.filename or "scene", "status": "queued",
                      "stage": "ingest", "progress": 0.0, "error": None, "started": time.time(),
                      "created_at": datetime.now(timezone.utc).isoformat(), "elapsed_s": None,
                      "season": season, "terrain": terrain}
    try:
        Image.open(io.BytesIO(raw)).convert("L").save(STORAGE / f"{jid}_sar.png")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Bad image: {e}")
    threading.Thread(target=_run, args=(jid, raw, season, terrain), daemon=True).start()
    return {"job_id": jid, "status": "queued"}


@app.get("/api/jobs/{jid}")
def job(jid: str):
    j = _jobs.get(jid)
    if not j:
        raise HTTPException(404, "Job not found")
    return {k: j[k] for k in ("job_id", "status", "stage", "progress", "filename", "error")}


@app.get("/api/jobs/{jid}/result")
def result(jid: str):
    j = _jobs.get(jid)
    if not j:
        raise HTTPException(404, "Job not found")
    if j["status"] != "completed":
        raise HTTPException(409, f"Job is {j['status']}")
    return {"job_id": jid, "status": "completed", "filename": j["filename"],
            "sar_url": f"/api/images/{jid}/sar", "optical_url": f"/api/images/{jid}/optical",
            "metrics": METRICS, "ddim_steps": bridge.T if bridge._loaded else None, "img_size": IMG_SIZE,
            "created_at": j["created_at"], "elapsed_s": j["elapsed_s"]}


@app.get("/api/images/{jid}/{kind}")
def image(jid: str, kind: str):
    path = STORAGE / f"{jid}_{'sar' if kind == 'sar' else 'optical'}.png"
    if kind not in {"sar", "optical"} or not path.exists():
        raise HTTPException(404, "Image not found")
    return FileResponse(path, media_type="image/png")


@app.get("/api/scenes")
def scenes():
    done = [j for j in _jobs.values() if j["status"] == "completed"]
    done.sort(key=lambda j: j["created_at"], reverse=True)
    return [{"job_id": j["job_id"], "filename": j["filename"],
             "optical_url": f"/api/images/{j['job_id']}/optical",
             "created_at": j["created_at"], "metrics": METRICS} for j in done]
