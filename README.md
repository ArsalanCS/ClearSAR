# ClearSAR

Translate Synthetic Aperture Radar (SAR) imagery into analysis-ready **optical**
imagery with a fine-tuned diffusion model — see the ground through clouds and darkness.

Final-year project · Department of Computer Science, FAST-NUCES.

## What's here

| Path | What it is |
|------|------------|
| [`clearsar-app/`](clearsar-app/) | React + TypeScript + Vite frontend (the console UI) |
| [`backend/`](backend/) | FastAPI service: async job API + the model pipeline |
| [`backend/colab/`](backend/colab/) | Self-contained server to run the model on a **free Colab GPU** |
| `SAR_to_Optic_3.ipynb` | Training / research notebook |

## The model

`bridge_final` — an **Image-to-Image Schrödinger Bridge** built on Stable Diffusion
v1.5: a 16-channel adapted VAE, a UNet conditioned on the SAR latent, CLIP text
conditioning (season + terrain), and bridge sampling. Weights live on
[Hugging Face](https://huggingface.co/Arsalan90/sar-to-optical-diffusion).

## Quick start

**1. Backend** (mock mode — no GPU, instant):
```bash
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

**2. Frontend:**
```bash
cd clearsar-app
npm install
cp .env.example .env          # points at http://localhost:8000
npm run dev                   # http://localhost:5173
```

Upload a SAR scene, pick a season/terrain, and watch the translation. `mock` mode
returns a placeholder so you can exercise the whole flow with no model.

## Running the real model (free GPU)

The bridge UNet is 3.4 GB and needs a real GPU. The easiest free path is Google Colab:
follow [`backend/colab/README.md`](backend/colab/README.md) to launch the model on a
Colab GPU, get a public tunnel URL, and point the frontend at it via
`clearsar-app/.env` (`VITE_API_URL=…`).

## Frontend views

Landing · Upload · Processing · Results · Library · Evaluation — navigation is
component-driven from `src/App.tsx` with keyboard shortcuts for quick switching.

## Team

Arsalan Hassan · Khizra Shehzadi · Muhammad Hashir — Supervisor: Dr. Usman Ghous.
