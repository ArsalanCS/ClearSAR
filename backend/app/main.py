from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .config import get_settings
from .inference import model_info
from .jobs import store, model_metrics
from .schemas import (
    JobCreated, JobState, JobResult, SceneSummary, JobStatus, Metrics,
    Description, DescriptionStatus, Purpose,
)

settings = get_settings()
app = FastAPI(title="ClearSAR API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED = {".tif", ".tiff", ".png", ".jpg", ".jpeg"}
MAX_BYTES = 50 * 1024 * 1024  # 50 MB, matches the upload-page spec


@app.get("/api/health")
def health():
    return {"status": "ok", "mode": settings.inference_mode, "model": f"{settings.hf_model_repo}/{settings.model_dir}",
            "describe_mode": settings.resolved_describe_mode,
            "vlm": settings.vlm_model_id if settings.resolved_describe_mode == "vlm" else None}


@app.post("/api/translate", response_model=JobCreated, status_code=202)
async def translate(
    file: UploadFile = File(...),
    season: str = Form("summer"),
    terrain: str = Form("temperate"),
    purpose: Purpose = Form(Purpose.general),
):
    name = file.filename or "scene"
    ext = ("." + name.rsplit(".", 1)[-1].lower()) if "." in name else ""
    if ext and ext not in ALLOWED:
        raise HTTPException(415, f"Unsupported file type {ext}. Allowed: {sorted(ALLOWED)}")

    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file")
    if len(raw) > MAX_BYTES:
        raise HTTPException(413, "File exceeds 50 MB limit")

    job = store.create(name, raw, season, terrain, purpose.value)
    if job.status == JobStatus.failed:
        raise HTTPException(400, job.error or "Failed to ingest file")
    return JobCreated(job_id=job.job_id, status=job.status)


@app.get("/api/jobs/{job_id}", response_model=JobState)
def job_state(job_id: str):
    job = store.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return JobState(
        job_id=job.job_id, status=job.status, stage=job.stage,
        progress=job.progress, filename=job.filename, error=job.error,
    )


@app.get("/api/jobs/{job_id}/result", response_model=JobResult)
def job_result(job_id: str):
    job = store.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status != JobStatus.completed:
        raise HTTPException(409, f"Job is {job.status.value}, not completed")
    info = model_info()
    return JobResult(
        job_id=job.job_id,
        status=job.status,
        filename=job.filename,
        sar_url=f"/api/images/{job.job_id}/sar",
        optical_url=f"/api/images/{job.job_id}/optical",
        metrics=model_metrics(),
        ddim_steps=info["steps"],
        model=info,
        img_size=settings.img_size,
        created_at=job.created_at,
        elapsed_s=job.elapsed_s,
        purpose=job.purpose,
        description_status=job.desc_status,
        season=job.season,
        terrain=job.terrain,
    )


def _description(job) -> Description:
    d = job.desc or {}
    return Description(
        job_id=job.job_id, status=job.desc_status, purpose=job.purpose, error=job.desc_error,
        elapsed_s=job.desc_elapsed_s,
        **{k: d[k] for k in ("engine", "vlm", "text", "sections", "reliability", "confidence", "warning",
                             "sar_facts", "retried", "truncated", "fallback_reason") if k in d},
    )


@app.get("/api/jobs/{job_id}/description", response_model=Description)
def job_description(job_id: str):
    job = store.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return _description(job)


@app.post("/api/jobs/{job_id}/description", response_model=Description, status_code=202)
def regenerate_description(job_id: str, purpose: Purpose = Form(Purpose.general)):
    job = store.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status != JobStatus.completed:
        raise HTTPException(409, f"Job is {job.status.value}, not completed")
    if settings.resolved_describe_mode == "off":
        raise HTTPException(409, "Scene description is disabled (DESCRIBE_MODE=off)")
    return _description(store.redescribe(job_id, purpose.value))


@app.get("/api/images/{job_id}/{kind}")
def image(job_id: str, kind: str):
    path = store.sar_path(job_id) if kind == "sar" else store.optical_path(job_id)
    if kind not in {"sar", "optical"} or not path.exists():
        raise HTTPException(404, "Image not found")
    return FileResponse(path, media_type="image/png")


@app.get("/api/scenes", response_model=list[SceneSummary])
def scenes():
    return [
        SceneSummary(
            job_id=j.job_id,
            filename=j.filename,
            sar_url=f"/api/images/{j.job_id}/sar",
            optical_url=f"/api/images/{j.job_id}/optical",
            created_at=j.created_at,
            metrics=model_metrics(),
            season=j.season,
            terrain=j.terrain,
            description_status=j.desc_status,
        )
        for j in store.list()
    ]
