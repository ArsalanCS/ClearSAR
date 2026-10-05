"""
In-memory job store with background processing. Drives the frontend's
upload -> processing -> results flow.

Single-process / single-worker by design (jobs and the loaded model live in
process memory). For multi-worker production, swap this for Redis/RQ + shared
object storage, but for an FYP demo this is the right amount of machinery.
"""
from __future__ import annotations

import io
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from PIL import Image

from .config import get_settings
from .inference import translate, describe
from .schemas import JobStatus, Stage, Metrics, DescriptionStatus

# Static eval-set metrics from the model card (eval_results/results.json, 256px).
# These describe the model, not a per-image score (real per-image metrics need a
# ground-truth optical pair, which a live SAR upload does not have).
MODEL_METRICS = Metrics(psnr=16.66, ssim=0.256, lpips=0.769)


@dataclass
class Job:
    job_id: str
    filename: str
    season: str = "summer"
    terrain: str = "temperate"
    status: JobStatus = JobStatus.queued
    stage: Stage = Stage.ingest
    progress: float = 0.0
    error: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started: float = field(default_factory=time.time)
    elapsed_s: Optional[float] = None
    # Scene description runs after the optical image is ready, so the job is already
    # `completed` (and viewable) while this is pending/running.
    purpose: str = "general"
    desc_status: DescriptionStatus = DescriptionStatus.off
    desc: Optional[dict] = None
    desc_error: Optional[str] = None
    desc_elapsed_s: Optional[float] = None


class JobStore:
    def __init__(self):
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self.storage = Path(get_settings().storage_dir)
        self.storage.mkdir(parents=True, exist_ok=True)

    # ----------------------------------------------------------- paths
    def sar_path(self, job_id: str) -> Path:
        return self.storage / f"{job_id}_sar.png"

    def optical_path(self, job_id: str) -> Path:
        return self.storage / f"{job_id}_optical.png"

    # ------------------------------------------------------------ crud
    def get(self, job_id: str) -> Optional[Job]:
        with self._lock:
            return self._jobs.get(job_id)

    def list(self) -> list[Job]:
        with self._lock:
            done = [j for j in self._jobs.values() if j.status == JobStatus.completed]
        return sorted(done, key=lambda j: j.created_at, reverse=True)

    def _set(self, job_id: str, **kw):
        with self._lock:
            job = self._jobs[job_id]
            for k, v in kw.items():
                setattr(job, k, v)

    # --------------------------------------------------------- create
    def create(self, filename: str, raw: bytes, season: str = "summer",
               terrain: str = "temperate", purpose: str = "general") -> Job:
        job_id = uuid.uuid4().hex[:12]
        job = Job(job_id=job_id, filename=filename, season=season, terrain=terrain, purpose=purpose)
        if get_settings().resolved_describe_mode != "off":
            job.desc_status = DescriptionStatus.pending
        with self._lock:
            self._jobs[job_id] = job

        # Persist a normalized grayscale copy of the SAR input for the viewer.
        try:
            sar = Image.open(io.BytesIO(raw)).convert("L")
            sar.save(self.sar_path(job_id))
        except Exception as e:  # noqa: BLE001
            self._set(job_id, status=JobStatus.failed, error=f"Bad image: {e}")
            return job

        threading.Thread(target=self._run, args=(job_id, raw), daemon=True).start()
        return job

    # ----------------------------------------------------------- work
    def _run(self, job_id: str, raw: bytes):
        try:
            self._set(job_id, status=JobStatus.running, stage=Stage.ingest, progress=8)
            image = Image.open(io.BytesIO(raw))

            self._set(job_id, stage=Stage.encode, progress=20)
            # `translate` is the slow call (diffusion). Mark denoise around it.
            self._set(job_id, stage=Stage.denoise, progress=40)
            job = self.get(job_id)
            optical = translate(image, job.season, job.terrain)

            self._set(job_id, stage=Stage.decode, progress=92)
            optical.save(self.optical_path(job_id))

            self._set(
                job_id,
                status=JobStatus.completed,
                stage=Stage.done,
                progress=100,
                elapsed_s=round(time.time() - self.get(job_id).started, 2),
            )
        except Exception as e:  # noqa: BLE001
            self._set(job_id, status=JobStatus.failed, error=str(e),
                      desc_status=DescriptionStatus.off)
            return
        self._describe(job_id)

    def _describe(self, job_id: str):
        job = self.get(job_id)
        if job.desc_status == DescriptionStatus.off:
            return
        self._set(job_id, desc_status=DescriptionStatus.running, desc_error=None)
        t0 = time.time()
        try:
            rec = describe(self.sar_path(job_id), Image.open(self.optical_path(job_id)),
                           job.purpose, job.terrain, job.season, seed_key=job_id)
            self._set(job_id, desc=rec, desc_status=DescriptionStatus.completed,
                      desc_elapsed_s=round(time.time() - t0, 2))
        except Exception as e:  # noqa: BLE001
            self._set(job_id, desc_status=DescriptionStatus.failed, desc_error=str(e))

    def redescribe(self, job_id: str, purpose: str) -> Job:
        """Regenerate the description (e.g. with another purpose) for a completed job."""
        with self._lock:
            job = self._jobs[job_id]
            if job.desc_status in (DescriptionStatus.pending, DescriptionStatus.running):
                return job
            job.purpose, job.desc_status, job.desc = purpose, DescriptionStatus.pending, None
        threading.Thread(target=self._describe, args=(job_id,), daemon=True).start()
        return job


store = JobStore()
