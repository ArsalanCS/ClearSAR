"""
ClearSAR — Colab/Kaggle GPU server.

Runs the SAR->optical model on a FREE Colab GPU and exposes the SAME async job API the React
frontend speaks, so the frontend works unchanged — just point VITE_API_URL at the tunnel URL.

Model code lives in model/pipeline.py (shared with the local backend). The default is the
deterministic regressor AliMusaRizvi/sar-to-optical-diffusion/regressor_v3_final (one UNet
pass per image); set MODEL_DIR=bridge_final for the 15-step I2SB bridge instead.

After translation, a scene description is written by Qwen2.5-VL from the SAR + translated
optical + measured SAR facts (model/sar_describe.py).

Run from backend/ (git clone) or with pipeline.py + sar_describe.py uploaded next to this
file. See colab/README.md.
"""
from __future__ import annotations

import io
import os
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

# ---------------------------------------------------------------- config
HF_MODEL_REPO = os.environ.get("HF_MODEL_REPO", "AliMusaRizvi/sar-to-optical-diffusion")
MODEL_DIR = os.environ.get("MODEL_DIR") or os.environ.get("BRIDGE_DIR") or "regressor_v3_final"
VAE_TAG = os.environ.get("VAE_TAG", "adapted16_final")
BASE_SD_MODEL = os.environ.get("BASE_SD_MODEL", "stable-diffusion-v1-5/stable-diffusion-v1-5")
IMG_SIZE = int(os.environ.get("IMG_SIZE", "256"))
COND_SEASON = os.environ.get("COND_SEASON", "summer")
COND_TERRAIN = os.environ.get("COND_TERRAIN", "temperate")
STORAGE = Path(os.environ.get("STORAGE_DIR", "/content/clearsar_storage"))
STORAGE.mkdir(parents=True, exist_ok=True)
DESCRIBE_MODE = os.environ.get("DESCRIBE_MODE", "vlm")          # vlm | facts | off
VLM_MODEL_ID = os.environ.get("VLM_MODEL_ID", "Qwen/Qwen2.5-VL-3B-Instruct")
DESCRIBE_MAX_NEW_TOKENS = int(os.environ.get("DESCRIBE_MAX_NEW_TOKENS", "256"))
PURPOSES = ("general", "defense", "flood")

try:  # files uploaded next to this one
    import pipeline
    import sar_describe
except ImportError:  # running from backend/ (git clone)
    from model import pipeline, sar_describe

model = pipeline.SAROpticalPipeline(
    repo=HF_MODEL_REPO, model_dir=MODEL_DIR, vae_tag=VAE_TAG, base_sd_model=BASE_SD_MODEL,
    img_size=IMG_SIZE, cond_season=COND_SEASON, cond_terrain=COND_TERRAIN,
    hf_token=os.environ.get("HF_TOKEN") or None,
)
CARD = pipeline.model_card(MODEL_DIR)
# Dataset-level scores of the active model. Not a per-image score: a live upload has no
# ground-truth optical pair.
METRICS = {"psnr": CARD.get("psnr"), "ssim": CARD.get("ssim"), "lpips": CARD.get("lpips")}


def model_info():
    method = model.method or ("regressor" if MODEL_DIR.startswith("regressor") else None)
    steps = model.T or (1 if method == "regressor" else None)
    return {"name": MODEL_DIR, "repo": HF_MODEL_REPO, "method": method, "steps": steps, **CARD}
_jobs: dict[str, dict] = {}
_lock = threading.Lock()


def _set(jid, **kw):
    with _lock:
        _jobs[jid].update(kw)


def _run(jid, raw, season, terrain):
    try:
        _set(jid, status="running", stage="denoise", progress=40)
        out = model.translate(Image.open(io.BytesIO(raw)), season, terrain)
        out.save(STORAGE / f"{jid}_optical.png")
        _set(jid, status="completed", stage="done", progress=100,
             elapsed_s=round(time.time() - _jobs[jid]["started"], 2))
    except Exception as e:  # noqa: BLE001
        import traceback; traceback.print_exc()
        _set(jid, status="failed", stage="ingest", progress=0, error=str(e), desc_status="off")
        return
    _describe(jid)


def _describe(jid):
    """Runs after the job is `completed`, so the optical image is viewable meanwhile."""
    j = _jobs[jid]
    if j["desc_status"] == "off":
        return
    _set(jid, desc_status="running", desc_error=None)
    t0 = time.time()
    try:
        rec = sar_describe.describe_scene(
            STORAGE / f"{jid}_sar.png", Image.open(STORAGE / f"{jid}_optical.png"),
            purpose=j["purpose"], terrain=j["terrain"], season=j["season"], mode=DESCRIBE_MODE,
            model_id=VLM_MODEL_ID, seed=sar_describe.seed_for(jid), max_new_tokens=DESCRIBE_MAX_NEW_TOKENS)
        _set(jid, desc=rec, desc_status="completed", desc_elapsed_s=round(time.time() - t0, 2))
    except Exception as e:  # noqa: BLE001
        import traceback; traceback.print_exc()
        _set(jid, desc_status="failed", desc_error=str(e))


# ------------------------------------------------------------------ API
app = FastAPI(title="ClearSAR Colab API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    return {"status": "ok", "mode": "colab", "model": f"{HF_MODEL_REPO}/{MODEL_DIR}",
            "describe_mode": DESCRIBE_MODE, "vlm": VLM_MODEL_ID if DESCRIBE_MODE == "vlm" else None}


@app.post("/api/translate", status_code=202)
async def translate(file: UploadFile = File(...),
                    season: str = Form("summer"), terrain: str = Form("temperate"),
                    purpose: str = Form("general")):
    if purpose not in PURPOSES:
        raise HTTPException(422, f"purpose must be one of {list(PURPOSES)}")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file")
    jid = uuid.uuid4().hex[:12]
    with _lock:
        _jobs[jid] = {"job_id": jid, "filename": file.filename or "scene", "status": "queued",
                      "stage": "ingest", "progress": 0.0, "error": None, "started": time.time(),
                      "created_at": datetime.now(timezone.utc).isoformat(), "elapsed_s": None,
                      "season": season, "terrain": terrain, "purpose": purpose,
                      "desc_status": "off" if DESCRIBE_MODE == "off" else "pending",
                      "desc": None, "desc_error": None, "desc_elapsed_s": None}
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
            "metrics": METRICS, "ddim_steps": model_info()["steps"], "model": model_info(), "img_size": IMG_SIZE,
            "created_at": j["created_at"], "elapsed_s": j["elapsed_s"],
            "purpose": j["purpose"], "description_status": j["desc_status"],
            "season": j["season"], "terrain": j["terrain"]}


_DESC_KEYS = ("engine", "vlm", "text", "sections", "reliability", "confidence", "warning",
              "sar_facts", "retried", "truncated", "fallback_reason")


def _description(j):
    d = j["desc"] or {}
    return {"job_id": j["job_id"], "status": j["desc_status"], "purpose": j["purpose"],
            "error": j["desc_error"], "elapsed_s": j["desc_elapsed_s"],
            "sections": [], "confidence": {}, "retried": False, "truncated": False,
            **{k: d[k] for k in _DESC_KEYS if k in d}}


@app.get("/api/jobs/{jid}/description")
def description(jid: str):
    j = _jobs.get(jid)
    if not j:
        raise HTTPException(404, "Job not found")
    return _description(j)


@app.post("/api/jobs/{jid}/description", status_code=202)
def regenerate_description(jid: str, purpose: str = Form("general")):
    j = _jobs.get(jid)
    if not j:
        raise HTTPException(404, "Job not found")
    if purpose not in PURPOSES:
        raise HTTPException(422, f"purpose must be one of {list(PURPOSES)}")
    if j["status"] != "completed":
        raise HTTPException(409, f"Job is {j['status']}")
    if DESCRIBE_MODE == "off":
        raise HTTPException(409, "Scene description is disabled (DESCRIBE_MODE=off)")
    with _lock:
        if j["desc_status"] in ("pending", "running"):
            return _description(j)
        j.update(purpose=purpose, desc_status="pending", desc=None)
    threading.Thread(target=_describe, args=(jid,), daemon=True).start()
    return _description(j)


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
             "sar_url": f"/api/images/{j['job_id']}/sar",
             "optical_url": f"/api/images/{j['job_id']}/optical",
             "created_at": j["created_at"], "metrics": METRICS,
             "season": j["season"], "terrain": j["terrain"],
             "description_status": j["desc_status"]} for j in done]
