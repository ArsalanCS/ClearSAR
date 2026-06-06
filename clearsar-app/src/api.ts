// API client for the ClearSAR FastAPI backend.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const apiUrl = (path: string) => `${API_BASE}${path}`

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed'
export type Stage = 'ingest' | 'encode' | 'denoise' | 'decode' | 'done'

export interface JobCreated { job_id: string; status: JobStatus }

export interface JobState {
  job_id: string
  status: JobStatus
  stage: Stage
  progress: number
  filename: string
  error: string | null
}

export interface Metrics { psnr: number | null; ssim: number | null; lpips: number | null }

export interface JobResult {
  job_id: string
  status: JobStatus
  filename: string
  sar_url: string
  optical_url: string
  metrics: Metrics
  ddim_steps: number
  img_size: number
  created_at: string
  elapsed_s: number | null
}

export interface SceneSummary {
  job_id: string
  filename: string
  optical_url: string
  created_at: string
  metrics: Metrics
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText
    try { detail = (await res.json()).detail ?? detail } catch { /* ignore */ }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export const SEASONS = ['spring', 'summer', 'fall', 'winter'] as const
export const TERRAINS = ['temperate', 'tropical', 'arctic', 'arid', 'coastal', 'urban'] as const
export type Season = typeof SEASONS[number]
export type Terrain = typeof TERRAINS[number]

export async function uploadScene(file: File, season: Season, terrain: Terrain): Promise<JobCreated> {
  const form = new FormData()
  form.append('file', file)
  form.append('season', season)
  form.append('terrain', terrain)
  const res = await fetch(apiUrl('/api/translate'), { method: 'POST', body: form })
  return jsonOrThrow<JobCreated>(res)
}

export async function getJob(jobId: string): Promise<JobState> {
  return jsonOrThrow<JobState>(await fetch(apiUrl(`/api/jobs/${jobId}`)))
}

export async function getResult(jobId: string): Promise<JobResult> {
  return jsonOrThrow<JobResult>(await fetch(apiUrl(`/api/jobs/${jobId}/result`)))
}

export async function listScenes(): Promise<SceneSummary[]> {
  return jsonOrThrow<SceneSummary[]>(await fetch(apiUrl('/api/scenes')))
}
