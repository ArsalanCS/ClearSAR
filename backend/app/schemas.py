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


class Purpose(str, Enum):
    general = "general"
    defense = "defense"
    flood = "flood"


class DescriptionStatus(str, Enum):
    off = "off"
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class Claim(BaseModel):
    text: str
    confidence: Optional[str] = None   # high | medium | low


class Section(BaseModel):
    name: str
    body: str
    claims: list[Claim]


class Description(BaseModel):
    job_id: str
    status: DescriptionStatus
    purpose: Purpose
    error: Optional[str] = None
    engine: Optional[str] = None         # vlm | facts
    vlm: Optional[str] = None
    text: Optional[str] = None
    sections: list[Section] = []
    reliability: Optional[str] = None
    confidence: dict[str, int] = {}
    warning: Optional[str] = None
    sar_facts: Optional[str] = None
    retried: bool = False
    truncated: bool = False
    fallback_reason: Optional[str] = None
    elapsed_s: Optional[float] = None


class Metrics(BaseModel):
    psnr: Optional[float] = None
    ssim: Optional[float] = None
    lpips: Optional[float] = None


class ModelInfo(BaseModel):
    name: str                       # checkpoint folder, e.g. regressor_v3_final
    repo: str
    method: Optional[str] = None    # regressor | bridge | mock
    steps: Optional[int] = None     # UNet passes per image
    label: Optional[str] = None
    fid: Optional[float] = None
    sam: Optional[float] = None
    cc: Optional[float] = None


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
    ddim_steps: Optional[int] = None   # UNet passes per image (1 for the regressor); kept for older clients
    model: Optional[ModelInfo] = None
    img_size: int
    created_at: str
    elapsed_s: Optional[float] = None
    purpose: Purpose = Purpose.general
    description_status: DescriptionStatus = DescriptionStatus.off
    season: Optional[str] = None
    terrain: Optional[str] = None


class SceneSummary(BaseModel):
    job_id: str
    filename: str
    sar_url: str
    optical_url: str
    created_at: str
    metrics: Metrics
    season: Optional[str] = None
    terrain: Optional[str] = None
    description_status: DescriptionStatus = DescriptionStatus.off
