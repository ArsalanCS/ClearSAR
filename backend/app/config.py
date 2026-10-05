from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Inference backend: "mock" | "local"
    inference_mode: str = "mock"

    # Shared model settings (bridge / I2SB model)
    hf_model_repo: str = "Arsalan90/sar-to-optical-diffusion"
    bridge_dir: str = "bridge_final"      # holds unet.safetensors + bridge_config.json
    vae_tag: str = "adapted16_final"      # holds base_vae.pth + detail_encoder.pth
    base_sd_model: str = "stable-diffusion-v1-5/stable-diffusion-v1-5"
    img_size: int = 256
    # Default scene conditioning prompt (model was trained on season+terrain text).
    cond_season: str = "summer"
    cond_terrain: str = "temperate"

    # Optional HF token — only for higher download rate limits / private repos.
    hf_token: str = ""

    # Scene description after translation (model/sar_describe.py):
    #   auto  - "vlm" when inference_mode=local, else "facts"
    #   vlm   - vision-language model on SAR + translated optical (falls back to facts on error)
    #   facts - text from measured SAR statistics only (no GPU / model download)
    #   off   - no description
    describe_mode: str = "auto"
    vlm_model_id: str = "Qwen/Qwen2.5-VL-3B-Instruct"
    describe_max_new_tokens: int = 256   # Summary + Reliability is ~100 tokens

    @property
    def resolved_describe_mode(self) -> str:
        m = self.describe_mode.lower()
        if m == "auto":
            return "vlm" if self.inference_mode.lower() == "local" else "facts"
        return m

    # Server
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    storage_dir: str = "./storage"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
