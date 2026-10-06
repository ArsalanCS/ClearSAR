"""
SAR -> optical inference on the adapted 16-channel SD-1.5 latent. Supports both checkpoint
families in the sar-to-optical-diffusion repos; the method is read from the folder's
bridge_config.json:

  * deterministic regressor (default: AliMusaRizvi/.../regressor_v3_final)
      "method": "deterministic_regressor[_v2|_v3]", "fixed_tb": 933
      One UNet pass at the fixed timestep with the SAR latent in place of the noisy state:
      x0 = unet(concat[y, y], t=fixed_tb, text). 933 is the bridge's first step (T=15), so the
      regressor is the bridge distilled into a single deterministic step. v3 also fine-tuned the
      VAE decoder (base_vae_tuned.pth).
  * I2SB bridge (bridge_final): T-step stochastic sampling with kappa / eta schedule.

Shared architecture:
  * Adapted VAE (16ch latent): base SD-1.5 VAE + DetailEncoder (3->12ch);
    latent = concat[ post_quant_conv(base_mode)[4ch], detail_enc(x)[12ch] ] * latent_scale.
    Decoder conv_in widened 4->16.
  * UNet: conv_in 32ch (concat of state and SAR latent y), conv_out 16ch, fully fine-tuned.
  * CLIP text conditioning: "a {season} satellite optical image of {terrain} terrain".

The UNet and VAE are built from their config files and then loaded strictly from the
checkpoint, so the base SD-1.5 weights (~3.7 GB) are never downloaded. Heavy imports are lazy
so the API can run in mock mode without torch.

Self-contained (no package-relative imports) so the Colab server can import it too.
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


# Dataset-level scores of known checkpoints (not per-image: a live upload has no ground-truth
# optical pair). Source: final_eval_results/full_eval_results.json in the AliMusaRizvi repo,
# where "v3" is regressor_v3_final and "champion" is bridge_final, on the same test set.
MODEL_CARDS = {
    "regressor_v3_final": {"label": "Regressor v3", "psnr": 18.32, "ssim": 0.306, "lpips": 0.823,
                           "fid": 215.5, "sam": 6.27, "cc": 0.390},
    "bridge_final": {"label": "Bridge", "psnr": 16.69, "ssim": 0.257, "lpips": 0.768,
                     "fid": 128.1, "sam": 7.59, "cc": 0.265},
}


def model_card(model_dir: str) -> dict:
    return MODEL_CARDS.get(model_dir, {})


def build_prompt(season: str, terrain: str) -> str:
    return f"a {SEASON_DESC.get(season, season)} satellite optical image of {terrain} terrain"


class SAROpticalPipeline:
    def __init__(
        self,
        repo: str = "AliMusaRizvi/sar-to-optical-diffusion",
        model_dir: str = "regressor_v3_final",
        vae_tag: str = "adapted16_final",
        base_sd_model: str = "stable-diffusion-v1-5/stable-diffusion-v1-5",
        img_size: int = 256,
        cond_season: str = "summer",
        cond_terrain: str = "temperate",
        hf_token: Optional[str] = None,
    ):
        self.repo = repo
        self.model_dir = model_dir
        self.vae_tag = vae_tag
        self.base_sd_model = base_sd_model
        self.img_size = img_size
        self.cond_season = cond_season
        self.cond_terrain = cond_terrain
        self.hf_token = hf_token or None
        self._loaded = False
        self.method: Optional[str] = None     # "regressor" | "bridge"
        self.T: Optional[int] = None          # sampling steps actually run per image

    # -------------------------------------------------------------- load
    def _file(self, path: str) -> Path:
        from huggingface_hub import hf_hub_download
        return Path(hf_hub_download(self.repo, path, token=self.hf_token))

    def _has(self, path: str) -> bool:
        from huggingface_hub import file_exists
        try:
            return file_exists(self.repo, path, token=self.hf_token)
        except Exception:  # noqa: BLE001 - offline / cached: fall back to trying the download
            try:
                self._file(path); return True
            except Exception:  # noqa: BLE001
                return False

    def load(self):
        if self._loaded:
            return self

        import torch
        import torch.nn as nn
        from diffusers import AutoencoderKL, UNet2DConditionModel
        from transformers import CLIPTextModel, CLIPTokenizer
        from safetensors.torch import load_file

        self.torch = torch
        if torch.cuda.is_available():
            self.device, self.dtype = "cuda", torch.float16
        elif getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
            os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
            self.device, self.dtype = "mps", torch.float32
        else:
            self.device, self.dtype = "cpu", torch.float32
        print(f"[clearsar] device={self.device} dtype={self.dtype} model={self.repo}/{self.model_dir}")

        # --- method + schedule ---
        cfg = json.loads(self._file(f"{self.model_dir}/bridge_config.json").read_text())
        self.cfg = cfg
        self.latent_scale = float(cfg["latent_scale"])
        if str(cfg.get("method", "")).startswith("deterministic_regressor"):
            self.method = "regressor"
            self.fixed_tb = int(cfg["fixed_tb"])
            self.T = 1
        elif "T" in cfg:
            self.method = "bridge"
            self.T = int(cfg["T"])
            self.kappa = float(cfg["kappa"])
            eta_1, eta_T = float(cfg["eta_1"]), float(cfg["eta_T"])
            idx = np.arange(self.T)
            self.eta = torch.tensor(eta_1 * (eta_T / eta_1) ** (idx / (self.T - 1)),
                                    dtype=torch.float32).to(self.device)
        else:
            raise ValueError(f"Unsupported checkpoint {self.model_dir!r}: method={cfg.get('method')!r} "
                             "(expected deterministic_regressor* or a bridge config with T/kappa/eta)")

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

        # --- Adapted VAE: decoder.conv_in widened 4->16; tuned decoder when the checkpoint has one ---
        vae_path = (f"{self.model_dir}/base_vae_tuned.pth" if self._has(f"{self.model_dir}/base_vae_tuned.pth")
                    else f"{self.vae_tag}/base_vae.pth")
        base_vae = AutoencoderKL.from_config(AutoencoderKL.load_config(self.base_sd_model, subfolder="vae"))
        old = base_vae.decoder.conv_in
        base_vae.decoder.conv_in = nn.Conv2d(TOTAL_CH, old.out_channels, old.kernel_size,
                                             old.stride, old.padding, bias=(old.bias is not None))
        base_vae.load_state_dict(torch.load(self._file(vae_path), map_location="cpu"))
        self.detail_enc = DetailEncoder()
        self.detail_enc.load_state_dict(torch.load(self._file(f"{self.vae_tag}/detail_encoder.pth"), map_location="cpu"))
        self.base_vae = base_vae.to(self.device).float().eval()
        self.detail_enc = self.detail_enc.to(self.device).float().eval()
        self.base_vae.requires_grad_(False)
        self.detail_enc.requires_grad_(False)
        self.vae_path = vae_path

        # --- UNet: conv_in 32ch, conv_out 16ch, full fine-tuned weights ---
        unet = UNet2DConditionModel.from_config(UNet2DConditionModel.load_config(self.base_sd_model, subfolder="unet"))
        oi = unet.conv_in
        unet.conv_in = nn.Conv2d(2 * TOTAL_CH, oi.out_channels, oi.kernel_size, oi.stride, oi.padding)
        unet.register_to_config(in_channels=2 * TOTAL_CH)
        oo = unet.conv_out
        unet.conv_out = nn.Conv2d(oo.in_channels, TOTAL_CH, oo.kernel_size, oo.stride, oo.padding)
        unet.register_to_config(out_channels=TOTAL_CH)
        unet.load_state_dict(load_file(str(self._file(f"{self.model_dir}/unet.safetensors"))))
        self.unet = unet.to(self.device, dtype=self.dtype).eval()
        self.unet.requires_grad_(False)

        # --- CLIP text conditioning ---
        self.tokenizer = CLIPTokenizer.from_pretrained(self.base_sd_model, subfolder="tokenizer")
        self.text_encoder = CLIPTextModel.from_pretrained(self.base_sd_model, subfolder="text_encoder").to(self.device).eval()
        self.text_encoder.requires_grad_(False)

        self._loaded = True
        print(f"[clearsar] {self.method} loaded ({self.model_dir}, steps={self.T}, "
              f"latent_scale={self.latent_scale:.4f}, vae={vae_path})")
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

    def _unet(self, state, y, t: int, cond):
        torch = self.torch
        tb = torch.full((y.shape[0],), t, device=self.device, dtype=torch.long)
        return self.unet(torch.cat([state, y], 1).to(self.dtype), tb,
                         encoder_hidden_states=cond.to(self.dtype)).sample.float()

    def _regress(self, y, cond):
        # deterministic: the SAR latent stands in for the bridge's noisy start state
        return self._unet(y, y, self.fixed_tb, cond)

    def _bridge_sample(self, y, cond):
        torch = self.torch
        eta, kappa, T = self.eta, self.kappa, self.T
        x = y + kappa * torch.sqrt(eta[-1]) * torch.randn_like(y)
        for t in reversed(range(T)):
            x0 = self._unet(x, y, int(t * 1000 / T), cond)
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

        sar = self.preprocess(image)
        with torch.no_grad():
            y = self._encode_scaled(sar)
            cond = self._embed(build_prompt(season, terrain))
            x0 = self._regress(y, cond) if self.method == "regressor" else self._bridge_sample(y, cond)
            rec = self._decode(x0).squeeze(0).float().cpu()

        arr = (((rec + 1) / 2).clamp(0, 1).permute(1, 2, 0).numpy() * 255).round().astype(np.uint8)
        return Image.fromarray(arr, mode="RGB")


_PIPELINE: Optional[SAROpticalPipeline] = None


def get_pipeline(**kwargs) -> SAROpticalPipeline:
    global _PIPELINE
    if _PIPELINE is None:
        _PIPELINE = SAROpticalPipeline(**kwargs)
    return _PIPELINE
