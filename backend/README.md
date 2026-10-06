# ClearSAR Backend

FastAPI service that turns a SAR scene into an optical image using the
**`regressor_v3_final`** model from
[`AliMusaRizvi/sar-to-optical-diffusion`](https://huggingface.co/AliMusaRizvi/sar-to-optical-diffusion/tree/main/regressor_v3_final),
then writes a scene description.

It drives the React frontend's **upload → processing → results** flow with an async
job pattern (upload returns a `job_id`; the UI polls progress; the result is the
generated optical PNG).

## Model

Both checkpoint families share one architecture on the adapted 16-channel latent:

- **16-channel adapted VAE** — base SD-1.5 VAE + a `DetailEncoder` (3→12ch); the
  latent is `concat[post_quant_conv(base)[4ch], detail(x)[12ch]] * latent_scale`, decoder
  widened to 16ch. Detail encoder: `adapted16_final/detail_encoder.pth`.
- **UNet** — `conv_in` widened to 32ch (state ⊕ SAR latent), `conv_out` → 16ch, fully
  fine-tuned (`<MODEL_DIR>/unet.safetensors`).
- **CLIP text conditioning** — `"a {season} satellite optical image of {terrain} terrain"`.

The method is read from `<MODEL_DIR>/bridge_config.json`:

| `MODEL_DIR` | method | per image | decoder |
|---|---|---|---|
| `regressor_v3_final` (default) | deterministic regressor: `unet([y, y], t=933)` | 1 UNet pass | fine-tuned (`base_vae_tuned.pth`) |
| `bridge_final` | I2SB bridge sampling (`T`, `kappa`, `eta`) | 15 UNet passes | `adapted16_final/base_vae.pth` |

On the same test set the regressor scores PSNR 18.32 / SSIM 0.306 / LPIPS 0.823 / FID 215.5
against the bridge's 16.69 / 0.257 / 0.768 / 128.1: more accurate per pixel and in colour,
smoother texture. The UNet and VAE are built from their config files and loaded strictly
from the checkpoint, so the base SD-1.5 UNet/VAE weights (~3.7 GB) are never downloaded.

The recipe lives once in [`model/pipeline.py`](model/pipeline.py).

## Two inference modes

Set `INFERENCE_MODE` in `.env`:

| mode    | what it does                       | needs |
|---------|------------------------------------|-------|
| `mock`  | synthetic placeholder image        | nothing — runs anywhere |
| `local` | loads the model in-process         | GPU + `requirements-local.txt` |

> For **free GPU** inference, use the self-contained server in
> [`colab/`](colab/) — it runs the same model on a Colab GPU and exposes the same API
> through a tunnel. See [`colab/README.md`](colab/README.md). This is the recommended
> path: the UNet is 3.4 GB and needs a real GPU.

## Scene description (after translation)

Once the optical image is saved, [`model/sar_describe.py`](model/sar_describe.py) writes a
short description of the scene: a 2–3 sentence **Summary** (≤ ~60 words) with only the crux,
plus one **Reliability** sentence. Method ported from `sar_describe_v2.ipynb`:

- The VLM (Qwen2.5-VL) sees **both** the despeckled SAR (Lee filter + contrast stretch)
  and the translated optical image, plus **measured SAR facts**: 3×3 region brightness and
  texture, dark smooth areas, extended bright areas, compact bright returns, and the
  dominant linear direction. It also gets the season/terrain conditioning and the ground
  scale (256 px = 2.56 km).
- Every claim ends in a `[high]/[medium]/[low]` confidence tag. Decoding is sampled with a per-job seed, with one
  retry if sections are missing or hedging dominates.
- Purpose picks what the summary focuses on: `general`, `defense` (situational awareness)
  or `flood`. The UI can regenerate with another purpose.
- The job is `completed` as soon as the image is ready. The description runs after that
  and is polled separately, so the viewer never waits on the VLM.

`DESCRIBE_MODE` in `.env`:

| mode    | what it does | needs |
|---------|--------------|-------|
| `auto`  | `vlm` when `INFERENCE_MODE=local`, else `facts` (default) | — |
| `vlm`   | Qwen2.5-VL on SAR + optical + facts; falls back to `facts` if it fails | GPU + `requirements-local.txt` |
| `facts` | text built from the measured SAR statistics only | nothing (scipy) |
| `off`   | no description | — |

## Run it

```bash
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # core API only
cp .env.example .env                      # INFERENCE_MODE=mock by default
uvicorn app.main:app --reload --port 8000
```

Then run the frontend (`cd ../clearsar-app && npm run dev`). With `mock` mode you get
the full end-to-end UX immediately, no GPU required.

### Local model mode (GPU)

```bash
pip install -r requirements-local.txt    # torch, diffusers, transformers, ...
# set INFERENCE_MODE=local in .env
```
First request downloads the 3.4 GB UNet, the tuned decoder, the detail encoder and the
CLIP text encoder. On a T4-class GPU a regressor translation is well under a second
(the bridge takes a few seconds); on CPU it's tens of seconds.

## API

| method | path                          | purpose |
|--------|-------------------------------|---------|
| GET    | `/api/health`                 | mode + model info |
| POST   | `/api/translate`              | multipart `file` + `season` + `terrain` + `purpose` → `{ job_id }` (202) |
| GET    | `/api/jobs/{id}`              | `{ status, stage, progress }` (poll this) |
| GET    | `/api/jobs/{id}/result`       | optical/SAR URLs + metadata + `description_status` |
| GET    | `/api/jobs/{id}/description`  | `{ status, sections[{name, claims[{text, confidence}]}], reliability, sar_facts, … }` (poll until `completed`) |
| POST   | `/api/jobs/{id}/description`  | form `purpose` → regenerate the description (202) |
| GET    | `/api/images/{id}/{sar\|optical}` | PNG bytes |
| GET    | `/api/scenes`                 | completed scenes (library + reports), with season/terrain and `description_status` |

## Notes

- Jobs and the loaded model live in process memory → run a **single** uvicorn worker.
- The training data was image pairs (grayscale SAR ↔ RGB optical), so the backend
  accepts `.png/.jpg` as well as `.tif/.tiff`.
- PDF scene reports are built in the browser (`clearsar-app/src/report.ts`, jsPDF) from
  `/result`, `/description` and the two images, so neither server needs a PDF dependency.
