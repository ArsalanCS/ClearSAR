"""
SAR -> optical scene description (v2), ported from sar_describe_v2.ipynb for the website.

Runs AFTER the bridge translation. A vision-language model sees BOTH the despeckled SAR and the
translated optical image, plus measured SAR facts (3x3 region brightness/texture, dark-smooth areas,
bright returns, dominant linear direction), the season/terrain conditioning and the ground scale.
Claims carry [high]/[medium]/[low] confidence tags and the text ends with one Reliability section.

Two describers:
  vlm   - Qwen2.5-VL (sampled decoding, seeded per job, one retry on missing sections / heavy hedging)
  facts - deterministic text built only from the measured SAR facts. No GPU, no model download;
          used in mock mode and as the fallback when the VLM is unavailable or fails.

Self-contained on purpose (numpy / scipy / PIL; torch + transformers imported lazily) so the same
file serves the local backend (`from model.sar_describe import ...`) and the Colab server, where
it is uploaded next to clearsar_colab.py (`from sar_describe import ...`).

Everything here is a decision-support aid on partly synthetic imagery, not verified ground truth.
"""
from __future__ import annotations

import os
import re
import threading
import zlib
from typing import Optional

import numpy as np
from PIL import Image

PATCH_PX, PATCH_KM = 256, 2.56            # SEN1-2 patches: 256x256 px at 10 m/px
GRID = [["top-left", "top-centre", "top-right"],
        ["middle-left", "centre", "middle-right"],
        ["bottom-left", "bottom-centre", "bottom-right"]]
# Dataset classes (notebook) + the website's terrain conditioning options.
TERRAIN_TEXT = {"agri": "agricultural land", "barrenland": "barren / sparsely vegetated land",
                "grassland": "grassland", "urban": "urban / built-up area",
                "temperate": "temperate land (mixed fields, vegetation and settlements)",
                "tropical": "tropical land (dense vegetation likely)",
                "arctic": "arctic / snow and ice land", "arid": "arid / desert land",
                "coastal": "coastal land (shoreline and open water likely)"}
SEASON_TEXT = {"fall": "autumn"}
WARNING = ("Partly synthetic: the optical image is a neural SAR-to-optical translation, not a photograph. "
           "Preliminary decision-support description, not verified ground truth.")
DEFAULT_VLM = "Qwen/Qwen2.5-VL-3B-Instruct"


# ───────────────────────────── SAR preprocessing + measured facts ─────────────────────────────
def load_sar_gray(src) -> np.ndarray:
    img = src if isinstance(src, Image.Image) else Image.open(src)
    return np.asarray(img.convert("L").resize((PATCH_PX, PATCH_PX), Image.BILINEAR), np.float32) / 255.


def lee_filter(x, size=5):
    """Classic Lee despeckle (approximation: data are already log-scaled 8-bit)."""
    from scipy.ndimage import uniform_filter
    m = uniform_filter(x, size); m2 = uniform_filter(x * x, size)
    v = np.maximum(m2 - m * m, 0)
    noise = float(np.median(v)) + 1e-8
    return m + (v / (v + noise)) * (x - m)


def sar_for_vlm(gray, out=512) -> Image.Image:
    """Despeckled, percentile-stretched, upsampled RGB-ified SAR for the vision tower."""
    g = lee_filter(gray, 5)
    lo, hi = np.percentile(g, [2, 98])
    g = np.clip((g - lo) / max(hi - lo, 1e-6), 0, 1)
    return Image.fromarray((g * 255).astype(np.uint8)).convert("RGB").resize((out, out), Image.BICUBIC)


def _cell(y, x, H, W):
    return GRID[min(2, int(3 * y / H))][min(2, int(3 * x / W))]


def _span(mask):
    ys, xs = np.nonzero(mask); H, W = mask.shape
    a, b = _cell(ys.min(), xs.min(), H, W), _cell(ys.max(), xs.max(), H, W)
    return a if a == b else f"{a} to {b}"


def _largest(mask):
    from scipy.ndimage import label
    lab, n = label(mask)
    if n == 0:
        return None
    sizes = np.bincount(lab.ravel())[1:]
    return lab == (1 + int(np.argmax(sizes)))


def _direction_words(theta_deg):
    t = theta_deg % 180
    if t < 20 or t >= 160: return "roughly horizontal (left-right)"
    if 70 <= t < 110: return "roughly vertical (top-bottom)"
    if t < 70: return "running from top-left to bottom-right"
    return "running from top-right to bottom-left"


def sar_stats(gray):
    """Returns (facts_text, facts_dict). Levels are RELATIVE to this image (z-scores / ranks), which
    is what differentiates one patch from another; absolute DN is given once for context."""
    from scipy.ndimage import (uniform_filter, gaussian_filter, sobel, binary_opening, label,
                               center_of_mass)
    H, W = gray.shape
    g = lee_filter(gray, 5)
    gm, gs = float(g.mean()), float(g.std()) + 1e-6
    cv = gs / max(gm, 1e-6)
    hetero = "highly" if cv > 0.35 else "moderately" if cv > 0.18 else "weakly"
    d = {"mean_dn": int(round(gm * 255)), "std_dn": int(round(gs * 255)), "heterogeneity": hetero}
    lines = [f"- Patch = {PATCH_KM} km x {PATCH_KM} km (10 m/px). Mean backscatter {d['mean_dn']}/255, "
             f"spread {d['std_dn']}/255 ({hetero} heterogeneous scene)."]

    # 3x3 regions
    ys, xs = np.linspace(0, H, 4).astype(int), np.linspace(0, W, 4).astype(int)
    cells = []
    for r in range(3):
        for c in range(3):
            blk = g[ys[r]:ys[r + 1], xs[c]:xs[c + 1]]
            cells.append((GRID[r][c], (float(blk.mean()) - gm) / gs, float(blk.std())))
    sd_rank = np.argsort(np.argsort([c[2] for c in cells]))          # 0..8, high = rough/varied texture
    reg = []
    for (name, z, _), rk in zip(cells, sd_rank):
        lvl = ("much darker than the scene average" if z < -1.0 else "darker than average" if z < -0.4 else
               "about average brightness" if z < 0.4 else "brighter than average" if z < 1.0 else
               "much brighter than the scene average")
        tex = "varied/rough texture" if rk >= 6 else "smooth/homogeneous texture" if rk <= 2 else "moderate texture"
        reg.append(f"  {name}: {lvl} (z={z:+.1f}), {tex}")
    lines.append("- Regions (relative to this image):\n" + "\n".join(reg))
    d["regions"] = [{"name": n, "z": round(z, 2), "texture_rank": int(rk)}
                    for (n, z, _), rk in zip(cells, sd_rank)]

    # dark smooth areas (water / tarmac / bare flat ground / radar shadow candidates)
    loc_sd = np.sqrt(np.maximum(uniform_filter(g * g, 7) - uniform_filter(g, 7) ** 2, 0))
    dark = (g < gm - 0.9 * gs) & (loc_sd < np.median(loc_sd) * 1.2)
    dark = binary_opening(dark, structure=np.ones((3, 3)), iterations=2)
    big = _largest(dark)
    d["dark_frac"] = round(float(dark.mean()), 3)
    d["dark_largest"] = None
    if big is not None and big.mean() > 0.004:
        yy, xx = np.nonzero(big); h, w = np.ptp(yy) + 1, np.ptp(xx) + 1
        shape = "elongated, river/road-like" if max(h, w) / max(1, min(h, w)) > 2.5 else "compact / blob-like"
        d["dark_largest"] = {"frac": round(float(big.mean()), 3), "shape": shape, "span": _span(big)}
        lines.append(f"- Dark smooth areas (water / tarmac / bare flat ground / radar-shadow candidates): "
                     f"{100 * dark.mean():.0f}% of frame; largest patch {100 * big.mean():.0f}% of frame, "
                     f"{shape}, spanning {_span(big)}.")
    else:
        lines.append("- Dark smooth areas: essentially none detected.")

    # extended bright/rough areas
    br = binary_opening(g > gm + 1.2 * gs, structure=np.ones((3, 3)), iterations=2)
    bb = _largest(br)
    d["bright_frac"] = round(float(br.mean()), 3)
    d["bright_largest"] = ({"frac": round(float(bb.mean()), 3), "span": _span(bb)}
                           if bb is not None and bb.mean() > 0.004 else None)
    lines.append(f"- Extended bright/rough areas (built-up, dense/tall vegetation or steep relief): "
                 f"{100 * br.mean():.0f}% of frame" +
                 (f"; largest {100 * bb.mean():.0f}% spanning {_span(bb)}." if d["bright_largest"] else "."))

    # compact very bright returns (candidate strong scatterers: metal, corner reflectors, building edges)
    s3 = uniform_filter(gray, 3)
    lab, n = label(s3 > s3.mean() + 3.5 * s3.std())
    if n:
        sizes = np.bincount(lab.ravel())[1:]
        keep = [i + 1 for i, s in enumerate(sizes) if 2 <= s <= 80]
    else:
        keep = []
    d["n_bright_returns"] = len(keep)
    d["bright_return_cells"] = []
    if len(keep) >= 3:
        cnt = {}
        for i in keep:
            cy, cx = center_of_mass(lab == i); k = _cell(cy, cx, H, W); cnt[k] = cnt.get(k, 0) + 1
        top = sorted(cnt.items(), key=lambda kv: -kv[1])[:3]
        d["bright_return_cells"] = [k for k, _ in top]
        lines.append(f"- Compact very bright returns: {len(keep)} (measurement of bright pixel clusters, NOT object "
                     f"counts); most in " + ", ".join(f"{k} ({v})" for k, v in top) + ".")
    else:
        lines.append(f"- Compact very bright returns: {'a few' if keep else 'none'}; no strong point scatterers.")

    # dominant linear / directional texture (structure tensor on smoothed image)
    sg = gaussian_filter(g, 1.5)
    gx, gy = sobel(sg, axis=1), sobel(sg, axis=0)
    Jxx, Jyy, Jxy = float((gx * gx).sum()), float((gy * gy).sum()), float((gx * gy).sum())
    coh = float(np.sqrt((Jxx - Jyy) ** 2 + 4 * Jxy ** 2) / (Jxx + Jyy + 1e-9))
    edge_deg = (np.degrees(0.5 * np.arctan2(2 * Jxy, Jxx - Jyy)) + 90) % 180   # edge direction, y axis points down
    d["linear_coherence"], d["linear_deg"] = round(coh, 2), round(float(edge_deg), 1)
    d["linear_words"] = _direction_words(edge_deg)
    if coh > 0.35:
        lines.append(f"- Dominant linear/directional structure: {_direction_words(edge_deg)}, "
                     f"coherence {coh:.2f} (strong: likely field rows, roads, ridges or a river).")
    elif coh > 0.18:
        lines.append(f"- Directional structure: weak, tendency {_direction_words(edge_deg)} (coherence {coh:.2f}).")
    else:
        lines.append(f"- Directional structure: none dominant (coherence {coh:.2f}); texture is isotropic/patchy.")
    return "\n".join(lines), d


# ───────────────────────────── prompts ─────────────────────────────
_SYSTEM = f"""You are an experienced remote-sensing image analyst writing a caption for ONE specific {PATCH_KM} km x {PATCH_KM} km patch (256x256 px, 10 m per pixel).

You receive two images of the SAME patch plus measured statistics.
- Image 1: Sentinel-1 SAR backscatter, despeckled and contrast-stretched. This is a real observation. Dark = smooth surfaces (calm water, tarmac, bare flat ground) or radar shadow; mid-grey = fields/vegetation; bright = rough ground, dense or tall vegetation, buildings, metal and corner-reflecting structures. Remaining grain is noise, not ground texture.
- Image 2: an optical-looking image generated from Image 1 by a neural network. It is NOT a photograph: colours and brightness are largely guesses. Use it only as a hint for what materials/classes the shapes might be. Where it disagrees with the SAR, believe the SAR for geometry and texture.
- 'Measured SAR facts' are computed from the pixels and are reliable. Use them to anchor WHERE things are.

Scale limits at 10 m: fields, roads, rivers, lakes, settlements and large industrial buildings are resolvable; individual houses, cars, people and small objects are not. Never claim them and never give counts of them.

Style rules:
1. Be brief: give only the crux of THIS patch, its 2-3 most important observations. Anchor them with the 3x3 position words (top-left ... bottom-right) and rough fractions of the frame. Skip minor details.
2. No generic filler. Do not mention that the image is low-resolution, blurry, grainy, noisy or artificial anywhere except the Reliability section.
3. Instead of hedging every sentence, end each substantive claim with a confidence tag: [high], [medium] or [low]. Use [high] only when the SAR facts and both images agree. If unsure, give your best interpretation tagged [low]; do not refuse to describe.
4. Never state identities, intent, affiliations or exact measurements you cannot see.
5. Finish with a Reliability section of ONE short sentence naming what is least trustworthy in THIS patch (a specific region, colour, or an ambiguous feature).
This is a preliminary decision-support description of partly synthetic imagery, not verified ground truth."""

SECTIONS = ["Summary", "Reliability"]
PURPOSES = {
    "general": dict(
        sections=SECTIONS,
        task=("Give the crux of the scene for a general reader: the dominant land cover and its rough share of "
              "the frame, the single most notable feature (water body, settlement, road or river) and where it "
              "is, and the apparent season if it is visible.")),
    "defense": dict(
        sections=SECTIONS,
        task=("Give the crux for a situational-awareness reader: the main built-up area or infrastructure and "
              "where it is, the main access routes, and any feature that contrasts with its surroundings "
              "(e.g. compact very bright returns or a large cleared/paved surface). Describe only what is "
              "visible; do not infer identity, ownership or intent.")),
    "flood": dict(
        sections=SECTIONS,
        task=("Give the crux for a flood / disaster-impact reader: whether dark smooth areas that may be water "
              "are present, how much of the frame they cover and where, and which land or roads border them. "
              "This is a single date with no pre-flood reference, so permanent water, flooded fields and other "
              "smooth dark surfaces cannot be separated with certainty; say which is more plausible here.")),
}


def build_prompt(purpose, terrain, season, facts):
    assert purpose in PURPOSES, f"unknown purpose {purpose!r}; choices: {list(PURPOSES)}"
    p = PURPOSES[purpose]
    meta = (f"Scene conditioning chosen by the user (coarse; may not describe the whole patch): terrain = "
            f"{TERRAIN_TEXT.get(terrain, terrain or 'unknown')}; season = "
            f"{SEASON_TEXT.get(season, season) or 'unknown'}.")
    user = (f"{meta}\n\nMeasured SAR facts:\n{facts}\n\nTask: {p['task']}\n\n"
            f"Write exactly two labelled sections and nothing else:\n"
            f"Summary: 2-3 sentences, at most 60 words in total, covering only the most important observations.\n"
            f"Reliability: one sentence of at most 20 words.\n"
            f"No lists, no headings other than these two.")
    return _SYSTEM, user


# ───────────────────────────── parsing / quality checks ─────────────────────────────
_HEDGE = re.compile(r"cannot be confirmed|synthesis artifact|appears? to show|low[- ]resolution|blur|ambiguous|"
                    r"indistinct|unverif|cannot be determined|impossible to", re.I)
_TAG = re.compile(r"\[(high|medium|low)\]", re.I)


def _hedge_share(text):
    # The Reliability sentence is supposed to hedge; with a 3-4 sentence crux it would
    # otherwise dominate the share, so only the Summary is scored.
    m = _section_re("Reliability").search(text)
    body = text[:m.start()] if m else text
    sents = [s for s in re.split(r"(?<=[.!?\]])\s+", body) if s.strip()]
    return sum(bool(_HEDGE.search(s)) for s in sents) / max(1, len(sents))


def _section_re(name):
    # tolerate markdown decoration ("**Summary:**", "### Summary:", "- Summary:") and a label
    # that follows the previous sentence on the same line ("... [high]. Reliability: ...")
    return re.compile(rf"(?im)(?:^|(?<=[.!?\]])[ \t]+)[\s#*\-_>]*{re.escape(name)}[\s*_]*:[\s*_]*")


def _missing_sections(text, purpose):
    return [s for s in PURPOSES[purpose]["sections"] if not _section_re(s).search(text)]


def parse_sections(text, purpose):
    """Split the description into its labelled sections. Each claim keeps its confidence tag so the
    UI can render it. Unlabelled text before the first section is attached to the first section."""
    names = PURPOSES[purpose]["sections"]
    hits = []
    for nm in names:
        m = _section_re(nm).search(text)
        if m:
            hits.append((m.start(), m.end(), nm))
    hits.sort()
    if not hits:
        return [{"name": names[0], "body": text.strip(), "claims": _claims(text)}]
    out = []
    for i, (_, body_start, nm) in enumerate(hits):
        end = hits[i + 1][0] if i + 1 < len(hits) else len(text)
        body = text[body_start:end].strip()
        if i == 0 and text[:hits[0][0]].strip():
            body = text[:hits[0][0]].strip() + " " + body
        out.append({"name": nm, "body": body, "claims": _claims(body)})
    return out


def _claims(body):
    """Sentence-level split; each claim -> {text, confidence|None}."""
    body = re.sub(r"\s+", " ", body.replace("**", "")).strip()
    # sentence ends, plus "... [high]; ..." where one sentence carries two differently-tagged claims
    parts = [s.strip() for s in re.split(r"(?<=[.!?\]])\s+(?=[A-Z0-9(\"'])|(?<=\])\s*;\s+", body) if s.strip()]
    claims = []
    for s in parts:
        tags = _TAG.findall(s)
        s = re.sub(r"\s+([.,;])", r"\1", _TAG.sub("", s)).strip().rstrip(";")
        if s and s[-1] not in ".!?:":
            s += "."
        claims.append({"text": s[:1].upper() + s[1:], "confidence": tags[-1].lower() if tags else None})
    return claims


def confidence_summary(sections):
    c = {"high": 0, "medium": 0, "low": 0}
    for s in sections:
        for cl in s["claims"]:
            if cl["confidence"]:
                c[cl["confidence"]] += 1
    return c


# ───────────────────────────── facts-only describer (no model) ─────────────────────────────
def _pct(x):
    return f"{100 * x:.0f}%"


def _join(names):
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


def describe_from_facts(fd, purpose, terrain, season):
    """Short deterministic crux built only from measured SAR statistics. Interpretations of what a
    brightness pattern *is* are tagged [low]/[medium]; measurements are tagged [high]."""
    terr = TERRAIN_TEXT.get(terrain, terrain or "unspecified terrain").split(" (")[0]
    seas = SEASON_TEXT.get(season, season) or "an unspecified season"
    dl, bl = fd["dark_largest"], fd["bright_largest"]
    coh = fd["linear_coherence"]
    points = fd["n_bright_returns"] >= 3

    lead = (f"A {terr} patch in {seas}, mostly mid-grey radar texture typical of fields or low "
            f"vegetation [low].")
    water = (f"A {dl['shape'].split()[0].rstrip(',')} dark smooth area ({_pct(dl['frac'])} of the frame) in the "
             f"{dl['span']} may be water or bare flat ground [low]." if dl else None)
    built = (f"A bright area ({_pct(bl['frac'])}) in the {bl['span']} suggests built-up land or dense "
             f"vegetation [low]." if bl else None)
    linear = (f"A strong linear structure runs {fd['linear_words']} [high]." if coh > 0.35 else None)
    scatter = (f"Compact very bright returns cluster in the {_join(fd['bright_return_cells'])} [high]."
               if points else None)

    if purpose == "flood":
        main = [water or "No dark smooth area that could be water was detected [medium].",
                "Being a single date, permanent water and flooding cannot be told apart [high]." if dl else None]
    elif purpose == "defense":
        main = [built or "No extended bright area that would indicate a settlement stands out [medium].",
                scatter or linear]
    else:
        main = [water or built or linear or "No distinct water, settlement or linear feature stands out [medium].",
                (built if water else linear if (water or built) else None)]
    summary = " ".join([lead] + [s for s in main if s])
    return (f"Summary: {summary}\n\n"
            f"Reliability: Based on radar statistics only, without a vision-language model, so land-cover "
            f"labels are guesses.")


# ───────────────────────────── VLM ─────────────────────────────
_VLM = {"model": None, "proc": None, "id": None}
_VLM_LOCK = threading.Lock()


def _load_vlm(model_id=None):
    import torch
    from transformers import AutoModelForImageTextToText, AutoProcessor
    model_id = model_id or os.environ.get("VLM_MODEL_ID") or DEFAULT_VLM
    if _VLM["model"] is not None and _VLM["id"] == model_id:
        return _VLM["model"], _VLM["proc"], model_id
    if torch.cuda.is_available():
        # T4 (sm_75) has no native bf16; fp16 there, bf16 on Ampere+.
        dtype = torch.bfloat16 if torch.cuda.get_device_capability()[0] >= 8 else torch.float16
        device_map = "cuda"
    elif getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
        dtype, device_map = torch.float16, "mps"
    else:
        dtype, device_map = torch.float32, "cpu"
    print(f"[clearsar] loading VLM {model_id} ({dtype}, {device_map})")
    model = AutoModelForImageTextToText.from_pretrained(model_id, torch_dtype=dtype, device_map=device_map,
                                                        attn_implementation="sdpa").eval()
    # 512x512 images -> ~334 visual tokens each; bound it so odd sizes can't explode memory.
    proc = AutoProcessor.from_pretrained(model_id, min_pixels=256 * 28 * 28, max_pixels=400 * 28 * 28)
    _VLM.update(model=model, proc=proc, id=model_id)
    print(f"[clearsar] VLM ready")
    return model, proc, model_id


def _vlm_generate(sar_gray, optical_img, system, user, seed, max_new_tokens, temperature, model_id,
                  top_p=0.8, top_k=20):
    import torch
    model, proc, used = _load_vlm(model_id)
    opt = optical_img.convert("RGB").resize((512, 512), Image.BICUBIC)
    messages = [
        {"role": "system", "content": [{"type": "text", "text": system}]},
        {"role": "user", "content": [
            {"type": "text", "text": "Image 1 - Sentinel-1 SAR:"}, {"type": "image", "image": sar_for_vlm(sar_gray)},
            {"type": "text", "text": "Image 2 - machine-generated optical estimate:"}, {"type": "image", "image": opt},
            {"type": "text", "text": user}]}]
    inputs = proc.apply_chat_template(messages, tokenize=True, add_generation_prompt=True,
                                      return_dict=True, return_tensors="pt").to(model.device)
    n_in = inputs["input_ids"].shape[1]

    def _gen(sd, temp):
        torch.manual_seed(sd)
        with torch.no_grad():
            ids = model.generate(**inputs, max_new_tokens=max_new_tokens, do_sample=True, temperature=temp,
                                 top_p=top_p, top_k=top_k, repetition_penalty=1.05)
        return proc.batch_decode(ids[:, n_in:], skip_special_tokens=True)[0].strip(), int(ids.shape[1] - n_in)
    return _gen, used


# ───────────────────────────── entry point ─────────────────────────────
def seed_for(key: str) -> int:
    return zlib.crc32(key.encode()) % (2 ** 31)


def describe_scene(sar_image, optical_img, purpose="general", terrain=None, season=None, mode="vlm",
                   model_id=None, seed=0, max_new_tokens=256, temperature=0.7):
    """Describe one translated scene. mode: 'vlm' (falls back to 'facts' on any VLM error) or 'facts'.
    Returns a JSON-serialisable dict."""
    if purpose not in PURPOSES:
        raise ValueError(f"unknown purpose {purpose!r}; choices: {list(PURPOSES)}")
    gray = load_sar_gray(sar_image)
    facts, fd = sar_stats(gray)
    meta = {"engine": "facts", "vlm": None, "retried": False, "truncated": False, "fallback_reason": None}

    text = None
    if mode == "vlm":
        try:
            system, user = build_prompt(purpose, terrain, season, facts)
            with _VLM_LOCK:   # one generation at a time on the shared GPU
                gen, used = _vlm_generate(gray, optical_img, system, user, seed, max_new_tokens,
                                          temperature, model_id)
                text, n_new = gen(seed, temperature)
                if _missing_sections(text, purpose) or _hedge_share(text) > 0.35:
                    text, n_new = gen(seed + 1, min(temperature + 0.15, 0.95)); meta["retried"] = True
            meta.update(engine="vlm", vlm=used,
                        truncated=n_new >= max_new_tokens or not re.search(r"[.!?\]]\s*$", text))
        except Exception as e:  # noqa: BLE001 - never lose the description because the VLM failed
            if not isinstance(e, ImportError):
                import traceback; traceback.print_exc()
            text = None
            meta["fallback_reason"] = f"{type(e).__name__}: {e}"[:300]

    if text is None:
        text = describe_from_facts(fd, purpose, terrain, season)

    sections = parse_sections(text, purpose)
    reliability = next((s["body"] for s in sections if s["name"] == "Reliability"), None)
    return {
        "purpose": purpose, "text": text, "sections": sections, "reliability": reliability,
        "confidence": confidence_summary(sections), "warning": WARNING,
        "missing_sections": _missing_sections(text, purpose), "hedge_share": round(_hedge_share(text), 2),
        "sar_facts": facts, "sar_stats": fd, "prompt_version": "v2", **meta,
    }
