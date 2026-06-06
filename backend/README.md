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
| POST   | `/api/translate`              | multipart `file` + `season` + `terrain` → `{ job_id }` (202) |
| GET    | `/api/jobs/{id}`              | `{ status, stage, progress }` (poll this) |
| GET    | `/api/jobs/{id}/result`       | optical/SAR URLs + metadata |
| GET    | `/api/images/{id}/{sar\|optical}` | PNG bytes |
| GET    | `/api/scenes`                 | completed scenes (library) |

## Notes

- Jobs and the loaded model live in process memory → run a **single** uvicorn worker.
- The training data was image pairs (grayscale SAR ↔ RGB optical), so the backend
  accepts `.png/.jpg` as well as `.tif/.tiff`.
