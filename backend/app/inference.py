"""
Dispatches a SAR image to an inference backend and returns an optical PIL image:
  mock  - synthetic placeholder (no torch, no GPU) for UI development
  local - loads the bridge diffusion model in-process via model/pipeline.py

For free GPU inference, run the self-contained server in backend/colab/ instead and
point the frontend at its tunnel URL.
"""
from __future__ import annotations

import math

from PIL import Image

from .config import get_settings


# ----------------------------------------------------------------- mock
def _mock_translate(image: Image.Image, img_size: int) -> Image.Image:
    """A deterministic, SAR-tinted gradient so the full pipeline is exercisable
    with zero model dependencies. NOT a real translation."""
    src = image.convert("L").resize((img_size, img_size), Image.BILINEAR)
    px = src.load()
    out = Image.new("RGB", (img_size, img_size))
    op = out.load()
    for y in range(img_size):
        for x in range(img_size):
            v = px[x, y] / 255.0
            # Fake "optical" palette: green vegetation -> sandy -> blue water.
            r = int(60 + 140 * v + 30 * math.sin(x / 24))
            g = int(90 + 110 * v)
            b = int(70 + 90 * (1 - v) + 30 * math.cos(y / 24))
            op[x, y] = (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))
    return out


# ---------------------------------------------------------------- local
def _local_translate(image: Image.Image, season: str, terrain: str) -> Image.Image:
    from model.pipeline import get_pipeline

    s = get_settings()
    pipe = get_pipeline(
        repo=s.hf_model_repo,
        bridge_dir=s.bridge_dir,
        vae_tag=s.vae_tag,
        base_sd_model=s.base_sd_model,
        img_size=s.img_size,
        cond_season=s.cond_season,
        cond_terrain=s.cond_terrain,
        hf_token=s.hf_token or None,
    )
    return pipe.translate(image, season=season, terrain=terrain)


def translate(image: Image.Image, season: str = "summer", terrain: str = "temperate") -> Image.Image:
    s = get_settings()
    mode = s.inference_mode.lower()
    if mode == "mock":
        return _mock_translate(image, s.img_size)
    if mode == "local":
        return _local_translate(image, season, terrain)
    raise ValueError(f"Unknown INFERENCE_MODE: {s.inference_mode!r} (use 'mock' or 'local')")
