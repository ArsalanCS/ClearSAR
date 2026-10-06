# Run ClearSAR on a FREE Colab GPU

Runs the SAR→optical model on a real GPU for **$0** — no HF billing, no token. Google
Colab runs the model; a cloudflared tunnel exposes it with a public
`https://…trycloudflare.com` URL that your local frontend calls exactly like an endpoint.

**Default model:** [`AliMusaRizvi/sar-to-optical-diffusion/regressor_v3_final`](https://huggingface.co/AliMusaRizvi/sar-to-optical-diffusion/tree/main/regressor_v3_final)
— a deterministic one-step regressor (one UNet pass per image) on the adapted 16-channel
latent, with a fine-tuned decoder. To use the 15-step Schrödinger bridge instead, set
`MODEL_DIR=bridge_final` before starting the server (see Cell 2).

> **Why not local?** The UNet is 3.4 GB and needs ~5 GB VRAM/RAM. On a Mac
> with a throttled anonymous HF connection the download alone takes hours. Colab pulls
> it in seconds and has a real GPU — this is the practical free path for this model.

**Tradeoff vs paid endpoint:** the Colab session is temporary — it sleeps after
~90 min idle (max ~12 h), and the tunnel URL changes each time you restart. Perfect
for development and live demos; not for an always-on public service.

---

## One-time: open a GPU notebook
1. Go to **https://colab.research.google.com** → **New notebook**
2. **Runtime ▸ Change runtime type ▸ Hardware accelerator = T4 GPU** ▸ Save

## Cell 1 — install dependencies
```python
!pip install -q fastapi "uvicorn[standard]" python-multipart pydantic nest_asyncio \
    diffusers "transformers>=4.51" accelerate peft safetensors huggingface_hub pillow numpy scipy
```

## Cell 2 — get the server code
Clone the repo (always the latest pushed version, no manual uploads):
```python
!rm -rf /content/ClearSAR && git clone -q https://github.com/ArsalanCS/ClearSAR.git /content/ClearSAR
import os, sys
os.chdir("/content/ClearSAR/backend"); sys.path.insert(0, "/content/ClearSAR/backend")

# Optional settings (defaults shown)
os.environ["MODEL_DIR"] = "regressor_v3_final"               # or "bridge_final"
os.environ["DESCRIBE_MODE"] = "vlm"                          # vlm | facts | off
os.environ["VLM_MODEL_ID"] = "Qwen/Qwen2.5-VL-3B-Instruct"   # fits a T4 next to the translation model
```
*Alternative without git:* upload `backend/colab/clearsar_colab.py`, `backend/model/pipeline.py`
and `backend/model/sar_describe.py` to `/content` with the 📁 Files panel, and in Cell 3 use
`"clearsar_colab:app"` instead of `"colab.clearsar_colab:app"`.
The 7B model (`Qwen/Qwen2.5-VL-7B-Instruct`) writes better descriptions but needs ~17 GB
VRAM, so it only fits on an L4/A100 runtime, not a free T4.

## Cell 3 — start the server + public tunnel
```python
import threading, subprocess, re, uvicorn, nest_asyncio
nest_asyncio.apply()

# 1) start the API in a background thread
threading.Thread(
    target=lambda: uvicorn.run("colab.clearsar_colab:app", host="0.0.0.0", port=8000, log_level="warning"),
    daemon=True,
).start()

# 2) download cloudflared (no signup needed) and open a quick tunnel
!wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O cloudflared && chmod +x cloudflared

proc = subprocess.Popen(["./cloudflared", "tunnel", "--url", "http://localhost:8000"],
                        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
public_url = None
for line in proc.stdout:
    print(line, end="")
    m = re.search(r"https://[-\w]+\.trycloudflare\.com", line)
    if m:
        public_url = m.group(0)
        break
print("\n\n==========================================")
print("  PUBLIC API URL:", public_url)
print("==========================================")
```
Copy the printed **PUBLIC API URL**.

## Cell 4 — warm up the model (recommended)
The first translation downloads the 3.4 GB UNet, the 335 MB tuned decoder, the detail
encoder and the CLIP text encoder, then loads them (~1–2 min on Colab's fast network, one
time). The base SD-1.5 UNet/VAE weights are not downloaded — only their config files.
Trigger it now with a dummy image so the first request from the UI is instant:
```python
import requests, io
from PIL import Image
print(requests.get("http://localhost:8000/api/health").json())
buf = io.BytesIO(); Image.new("L", (256, 256), 128).save(buf, "PNG"); buf.seek(0)
jid = requests.post("http://localhost:8000/api/translate",
                    files={"file": ("warmup.png", buf, "image/png")}).json()["job_id"]
import time
for _ in range(120):
    st = requests.get(f"http://localhost:8000/api/jobs/{jid}").json()
    print(st["status"], st["stage"], st["progress"])
    if st["status"] in ("completed", "failed"): break
    time.sleep(2)
```
Watch the cell logs — the model prints `[clearsar] regressor loaded (regressor_v3_final,
steps=1, …)` once ready. After warm-up a translation takes well under a second on a T4
(the bridge takes ~3–5 s).

The scene description starts as soon as the optical image is saved. The first one downloads
Qwen2.5-VL-3B (~7.5 GB, ~1–2 min) and prints `[clearsar] VLM ready`; wait for it too:
```python
for _ in range(300):
    d = requests.get(f"http://localhost:8000/api/jobs/{jid}/description").json()
    if d["status"] in ("completed", "failed"): break
    time.sleep(2)
print(d["engine"], d.get("fallback_reason")); print(d["text"])
```
`engine` should be `vlm`. If it says `facts`, the VLM failed to load (see `fallback_reason`)
and the site shows the statistics-only description instead. After warm-up a description
takes ~5–10 s on a T4; the UI shows the optical image straight away and fills the
description in when it is ready.

---

## Point the frontend at it
On your machine, create `clearsar-app/.env`:
```
VITE_API_URL=https://<the-trycloudflare-url>
```
Then restart the dev server:
```bash
cd clearsar-app && npm run dev
```
Upload a SAR scene in the UI — it now runs on the Colab GPU. Under a second per image
once the model is warm, plus ~5–10 s for the scene description.

## When you restart Colab later
The tunnel URL changes. Just re-run cells 1–3 and update `VITE_API_URL` with the new
URL (and restart `npm run dev`). Cell 2 re-clones, so it picks up anything you pushed.

## Kaggle instead of Colab?
The same cells work on Kaggle Notebooks (free GPU, 30 h/week, longer
sessions). Enable GPU in the notebook settings and use the same cells.
