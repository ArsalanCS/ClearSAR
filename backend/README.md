# ClearSAR Backend

FastAPI service that turns a SAR scene into an optical image using the
**`bridge_final`** model from
[`Arsalan90/sar-to-optical-diffusion`](https://huggingface.co/Arsalan90/sar-to-optical-diffusion).

It drives the React frontend's **upload → processing → results** flow with an async
job pattern (upload returns a `job_id`; the UI polls progress; the result is the
generated optical PNG).

## Model: Image-to-Image Schrödinger Bridge

Port of the notebook's Stage-3 bridge (`SAR_to_Optic_3.ipynb`):

- **16-channel adapted VAE** — base SD-1.5 VAE + a `DetailEncoder` (3→12ch); the
  latent is `concat[post_quant_conv(base)[4ch], detail(x)[12ch]]`, decoder widened to 16ch.
  Weights: `adapted16_final/{base_vae.pth, detail_encoder.pth}`.
- **UNet** — `conv_in` widened to 32ch (noisy latent ⊕ SAR latent), `conv_out` → 16ch.
  Full fine-tuned weights: `bridge_final/unet.safetensors`.
- **CLIP text conditioning** — `"a {season} satellite optical image of {terrain} terrain"`.
- **Bridge sampling** — `T`, `kappa`, `eta` schedule, `latent_scale` from `bridge_config.json`.

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
> path: the bridge UNet is 3.4 GB and needs a real GPU.

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
First request downloads the adapted VAE + 3.4 GB bridge UNet + base SD-1.5. On a
T4-class GPU a translation is a few seconds; on CPU it's minutes.

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
| GET    | `/api/scenes`                 | completed scenes (library) |

## Notes

- Jobs and the loaded model live in process memory → run a **single** uvicorn worker.
- The training data was image pairs (grayscale SAR ↔ RGB optical), so the backend
  accepts `.png/.jpg` as well as `.tif/.tiff`.
