"""
SAR -> Optical inference for the **bridge_final** model (Image-to-Image
Schrodinger Bridge on a 16-channel adapted latent).

Faithful port of the notebook's Stage-3 bridge script (SAR_to_Optic_3.ipynb,
cell 28: stage3_bridge_256.py) — the model Arsalan confirmed as final.

Architecture:
  * Adapted VAE (16ch latent): base SD-1.5 VAE + a DetailEncoder (3->12ch);
    latent = concat[ post_quant_conv(base_mode)[4ch], detail_enc(x)[12ch] ].
    Decoder conv_in widened 4->16. Weights: <vae_tag>/base_vae.pth + detail_encoder.pth.
  * UNet: conv_in widened to 32ch (concat of x and SAR latent y), conv_out -> 16ch.
    Full fine-tuned weights: <bridge_dir>/unet.safetensors.
  * CLIP text conditioning from a "a {season} satellite optical image of {terrain}
    terrain" prompt.
  * Bridge sampling: T=15 steps, kappa, eta schedule, latent_scale (bridge_config.json).

Heavy imports (torch/diffusers/transformers) are lazy so the API can run in
mock/hf mode without them.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image

BASE_CH, DETAIL_CH, TOTAL_CH = 4, 12, 16
SEASON_DESC = {"spring": "spring", "summer": "summer", "fall": "autumn", "winter": "winter"}


class SAROpticalPipeline:
    def __init__(
        self,
        repo: str,
        bridge_dir: str = "bridge_final",
        vae_tag: str = "adapted16_final",
        base_sd_model: str = "stable-diffusion-v1-5/stable-diffusion-v1-5",
        img_size: int = 256,
        cond_season: str = "summer",
        cond_terrain: str = "temperate",
        hf_token: Optional[str] = None,
    ):
        self.repo = repo
        self.bridge_dir = bridge_dir
        self.vae_tag = vae_tag
        self.base_sd_model = base_sd_model
        self.img_size = img_size
        self.cond_season = cond_season
        self.cond_terrain = cond_terrain
        self.hf_token = hf_token or None
        self._loaded = False

    # -------------------------------------------------------------- load
    def load(self):
        if self._loaded:
            return self

        import torch
        import torch.nn as nn
        from diffusers import AutoencoderKL, UNet2DConditionModel
        from transformers import CLIPTextModel, CLIPTokenizer
        from huggingface_hub import snapshot_download
        from safetensors.torch import load_file

        self.torch = torch
        if torch.cuda.is_available():
            self.device, self.dtype = "cuda", torch.float16
        elif getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
            os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
            self.device, self.dtype = "mps", torch.float32
        else:
            self.device, self.dtype = "cpu", torch.float32
        print(f"[clearsar] device={self.device} dtype={self.dtype}")

        local = snapshot_download(
            self.repo,
            allow_patterns=[f"{self.bridge_dir}/*",
                            f"{self.vae_tag}/base_vae.pth",
                            f"{self.vae_tag}/detail_encoder.pth"],
            token=self.hf_token,
        )
        root = Path(local)

        # --- bridge config ---
        cfg = json.loads((root / self.bridge_dir / "bridge_config.json").read_text())
        self.latent_scale = float(cfg["latent_scale"])
        self.T = int(cfg["T"])
        self.kappa = float(cfg["kappa"])
        eta_1, eta_T = float(cfg["eta_1"]), float(cfg["eta_T"])
        idx = np.arange(self.T)
        self.eta = torch.tensor(eta_1 * (eta_T / eta_1) ** (idx / (self.T - 1)), dtype=torch.float32).to(self.device)

        # --- DetailEncoder (exact copy from the notebook) ---
        class DetailEncoder(nn.Module):
            def __init__(self, in_ch=3, out_ch=DETAIL_CH, nf=64):
                super().__init__()
                self.net = nn.Sequential(
                    nn.Conv2d(in_ch, nf, 3, 2, 1),   nn.GroupNorm(8, nf),    nn.SiLU(),
                    nn.Conv2d(nf, nf * 2, 3, 2, 1),  nn.GroupNorm(8, nf * 2), nn.SiLU(),
                    nn.Conv2d(nf * 2, nf * 4, 3, 2, 1), nn.GroupNorm(8, nf * 4), nn.SiLU(),
                    nn.Conv2d(nf * 4, nf * 4, 3, 1, 1), nn.GroupNorm(8, nf * 4), nn.SiLU(),
                    nn.Conv2d(nf * 4, out_ch, 3, 1, 1))
            def forward(self, x):
                return self.net(x)

        # --- Adapted VAE: base SD vae with decoder.conv_in widened 4->16 ---
        base_vae = AutoencoderKL.from_pretrained(self.base_sd_model, subfolder="vae")
        old = base_vae.decoder.conv_in
        base_vae.decoder.conv_in = nn.Conv2d(TOTAL_CH, old.out_channels, old.kernel_size,
                                             old.stride, old.padding, bias=(old.bias is not None))
        base_vae.load_state_dict(torch.load(root / self.vae_tag / "base_vae.pth", map_location="cpu"))
        self.detail_enc = DetailEncoder()
        self.detail_enc.load_state_dict(torch.load(root / self.vae_tag / "detail_encoder.pth", map_location="cpu"))
        self.base_vae = base_vae.to(self.device).float().eval()
        self.detail_enc = self.detail_enc.to(self.device).float().eval()
        self.base_vae.requires_grad_(False)
        self.detail_enc.requires_grad_(False)

        # --- UNet: conv_in 32ch, conv_out 16ch, load fine-tuned weights ---
        unet = UNet2DConditionModel.from_pretrained(self.base_sd_model, subfolder="unet")
        oi = unet.conv_in
        ni = nn.Conv2d(2 * TOTAL_CH, oi.out_channels, oi.kernel_size, oi.stride, oi.padding)
        unet.conv_in = ni
        unet.config.in_channels = 2 * TOTAL_CH
        oo = unet.conv_out
        no = nn.Conv2d(oo.in_channels, TOTAL_CH, oo.kernel_size, oo.stride, oo.padding)
        unet.conv_out = no
        unet.config.out_channels = TOTAL_CH
        unet.load_state_dict(load_file(str(root / self.bridge_dir / "unet.safetensors")))
        self.unet = unet.to(self.device, dtype=self.dtype).eval()
        self.unet.requires_grad_(False)

        # --- CLIP text conditioning ---
        self.tokenizer = CLIPTokenizer.from_pretrained(self.base_sd_model, subfolder="tokenizer")
        self.text_encoder = CLIPTextModel.from_pretrained(self.base_sd_model, subfolder="text_encoder").to(self.device).eval()
        self.text_encoder.requires_grad_(False)

        self._loaded = True
        print(f"[clearsar] bridge model loaded (T={self.T}, latent_scale={self.latent_scale:.4f})")
        return self

    # ---------------------------------------------------------- helpers
    def _embed(self, prompt: str):
        torch = self.torch
        ids = self.tokenizer(prompt, padding="max_length", max_length=self.tokenizer.model_max_length,
                             truncation=True, return_tensors="pt").input_ids.to(self.device)
        with torch.no_grad():
            return self.text_encoder(ids)[0]  # (1, 77, 768)

    def _encode_scaled(self, x):
        """RGB image tensor (B,3,H,W) in [-1,1] -> scaled 16ch latent."""
        torch = self.torch
        with torch.no_grad():
            x = x.to(self.device).float()
            z_base = self.base_vae.encode(x).latent_dist.mode()
            z_base_pq = self.base_vae.post_quant_conv(z_base)
            z_detail = self.detail_enc(x)
            lat = torch.cat([z_base_pq, z_detail], dim=1)
        return lat * self.latent_scale

    def _decode(self, lat_scaled):
        torch = self.torch
        with torch.no_grad():
            rec = self.base_vae.decoder((lat_scaled / self.latent_scale).float())
        return rec.clamp(-1, 1)

    def _bridge_sample(self, y, cond):
        torch = self.torch
        B = y.shape[0]
        eta, kappa, T = self.eta, self.kappa, self.T
        x = y + kappa * torch.sqrt(eta[-1]) * torch.randn_like(y)
        for t in reversed(range(T)):
            tb = torch.full((B,), int(t * 1000 / T), device=self.device, dtype=torch.long)
            x0 = self.unet(torch.cat([x, y], 1).to(self.dtype), tb,
                           encoder_hidden_states=cond.to(self.dtype)).sample.float()
            if t > 0:
                ep = eta[t - 1]
                x = x0 + ep * (y - x0) + kappa * torch.sqrt(ep) * torch.randn_like(x)
            else:
                x = x0
        return x

    # ------------------------------------------------------------ infer
    def preprocess(self, image: Image.Image):
        torch = self.torch
        img = image.convert("RGB")
        if img.size != (self.img_size, self.img_size):
            img = img.resize((self.img_size, self.img_size), Image.BILINEAR)
        arr = np.array(img, dtype=np.float32) / 255.0
        t = torch.from_numpy(arr).permute(2, 0, 1)
        return (t * 2.0 - 1.0).unsqueeze(0)

    def translate(self, image: Image.Image, season: Optional[str] = None,
                  terrain: Optional[str] = None) -> Image.Image:
        if not self._loaded:
            self.load()
        torch = self.torch

        season = season or self.cond_season
        terrain = terrain or self.cond_terrain
        prompt = f"a {SEASON_DESC.get(season, season)} satellite optical image of {terrain} terrain"

        sar = self.preprocess(image)
        with torch.no_grad():
            y = self._encode_scaled(sar)
            cond = self._embed(prompt)
            x0 = self._bridge_sample(y, cond)
            rec = self._decode(x0).squeeze(0).float().cpu()

        arr = (((rec + 1) / 2).clamp(0, 1).permute(1, 2, 0).numpy() * 255).round().astype(np.uint8)
        return Image.fromarray(arr, mode="RGB")


_PIPELINE: Optional[SAROpticalPipeline] = None


def get_pipeline(**kwargs) -> SAROpticalPipeline:
    global _PIPELINE
    if _PIPELINE is None:
        _PIPELINE = SAROpticalPipeline(**kwargs)
    return _PIPELINE
