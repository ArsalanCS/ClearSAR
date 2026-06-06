from enum import Enum
from typing import Optional
from pydantic import BaseModel


class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


class Stage(str, Enum):
    ingest = "ingest"
    encode = "encode"
    denoise = "denoise"
    decode = "decode"
    done = "done"


class Metrics(BaseModel):
    psnr: Optional[float] = None
    ssim: Optional[float] = None
    lpips: Optional[float] = None


class JobCreated(BaseModel):
    job_id: str
    status: JobStatus


class JobState(BaseModel):
    job_id: str
    status: JobStatus
    stage: Stage
    progress: float  # 0..100
    filename: str
    error: Optional[str] = None


class JobResult(BaseModel):
    job_id: str
    status: JobStatus
    filename: str
    sar_url: str          # original SAR (grayscale) served back
    optical_url: str      # generated optical PNG
    metrics: Metrics
    ddim_steps: int
    img_size: int
    created_at: str
    elapsed_s: Optional[float] = None


class SceneSummary(BaseModel):
    job_id: str
    filename: str
    optical_url: str
    created_at: str
    metrics: Metrics
