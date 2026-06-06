# Run ClearSAR on a FREE Colab GPU

Runs your **`bridge_final`** model (Image-to-Image Schrödinger Bridge, 16ch adapted
VAE + 3.4 GB UNet + CLIP conditioning) on a real GPU for **$0** — no HF billing, no
token. Google Colab runs the model; a cloudflared tunnel exposes it with a public
`https://…trycloudflare.com` URL that your local frontend calls exactly like an endpoint.

> **Why not local?** The bridge UNet is 3.4 GB and needs ~5 GB VRAM/RAM. On a Mac
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
    diffusers transformers accelerate peft safetensors huggingface_hub pillow numpy
```

## Cell 2 — add the server file
Click the **📁 Files** panel on the left ▸ **Upload** ▸ pick
`backend/colab/clearsar_colab.py` from your machine.
(You re-upload this once per fresh session.)

## Cell 3 — start the server + public tunnel
```python
import threading, subprocess, re, uvicorn, nest_asyncio
nest_asyncio.apply()

# 1) start the API in a background thread
threading.Thread(
    target=lambda: uvicorn.run("clearsar_colab:app", host="0.0.0.0", port=8000, log_level="warning"),
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
The first translation downloads the 3.4 GB bridge UNet + adapted VAE + base SD-1.5 and
loads them (~1–2 min on Colab's fast network, one time). Trigger it now with a dummy
image so the first request from the UI is instant:
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
Watch the cell logs — the bridge model prints `[clearsar] bridge loaded (T=15, …)` once
ready. ~3–5 s per image after warm-up.

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
Upload a SAR scene in the UI — it now runs on the Colab GPU. ~3–5 s per image once
the model is warm.

## When you restart Colab later
The tunnel URL changes. Just re-run cells 2–3 and update `VITE_API_URL` with the new
URL (and restart `npm run dev`).

## Kaggle instead of Colab?
Same `clearsar_colab.py` works on Kaggle Notebooks (free GPU, 30 h/week, longer
sessions). Enable GPU in the notebook settings and use the same cells.
