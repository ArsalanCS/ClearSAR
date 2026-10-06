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
  ddim_steps: number | null
  img_size: number
  created_at: string
  elapsed_s: number | null
  purpose: Purpose
  description_status: DescriptionStatus
  season?: string | null
  terrain?: string | null
  model?: ModelInfo | null      // older servers omit it
}

export interface ModelInfo {
  name: string                  // checkpoint folder, e.g. regressor_v3_final
  repo: string
  method: 'regressor' | 'bridge' | 'mock' | null
  steps: number | null          // UNet passes per image
  label?: string | null
  fid?: number | null
  sam?: number | null
  cc?: number | null
}

export function modelSummary(r: Pick<JobResult, 'model' | 'ddim_steps'>): string {
  const m = r.model
  if (!m) return r.ddim_steps != null ? `${r.ddim_steps} steps` : 'SAR->optical model'
  const steps = m.steps ?? r.ddim_steps
  const how = m.method === 'regressor' ? `one-step regressor` : m.method === 'bridge' ? `${steps ?? 15}-step bridge`
    : m.method === 'mock' ? 'mock (no model)' : null
  return how ? `${m.name} · ${how}` : m.name
}

export type DescriptionStatus = 'off' | 'pending' | 'running' | 'completed' | 'failed'
export type Confidence = 'high' | 'medium' | 'low'

export interface Claim { text: string; confidence: Confidence | null }
export interface DescriptionSection { name: string; body: string; claims: Claim[] }

export interface SceneDescription {
  job_id: string
  status: DescriptionStatus
  purpose: Purpose
  error: string | null
  engine: 'vlm' | 'facts' | null   // facts = measured SAR statistics only, no VLM
  vlm: string | null
  text: string | null
  sections: DescriptionSection[]
  reliability: string | null
  confidence: Partial<Record<Confidence, number>>
  warning: string | null
  sar_facts: string | null
  retried: boolean
  truncated: boolean
  fallback_reason: string | null
  elapsed_s: number | null
}

export interface SceneSummary {
  job_id: string
  filename: string
  sar_url?: string            // older servers omit it; fall back to /api/images/{id}/sar
  optical_url: string
  created_at: string
  metrics: Metrics
  season?: string | null
  terrain?: string | null
  description_status?: DescriptionStatus
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

// Audience of the scene description written after translation.
export const PURPOSES = ['general', 'defense', 'flood'] as const
export type Purpose = typeof PURPOSES[number]
export const PURPOSE_LABELS: Record<Purpose, string> = {
  general: 'General',
  defense: 'Situational awareness',
  flood: 'Flood / disaster',
}

export async function uploadScene(file: File, season: Season, terrain: Terrain,
                                  purpose: Purpose = 'general'): Promise<JobCreated> {
  const form = new FormData()
  form.append('file', file)
  form.append('season', season)
  form.append('terrain', terrain)
  form.append('purpose', purpose)
  const res = await fetch(apiUrl('/api/translate'), { method: 'POST', body: form })
  return jsonOrThrow<JobCreated>(res)
}

export async function getJob(jobId: string): Promise<JobState> {
  return jsonOrThrow<JobState>(await fetch(apiUrl(`/api/jobs/${jobId}`)))
}

export async function getResult(jobId: string): Promise<JobResult> {
  return jsonOrThrow<JobResult>(await fetch(apiUrl(`/api/jobs/${jobId}/result`)))
}

export async function getDescription(jobId: string): Promise<SceneDescription> {
  return jsonOrThrow<SceneDescription>(await fetch(apiUrl(`/api/jobs/${jobId}/description`)))
}

export async function regenerateDescription(jobId: string, purpose: Purpose): Promise<SceneDescription> {
  const form = new FormData()
  form.append('purpose', purpose)
  const res = await fetch(apiUrl(`/api/jobs/${jobId}/description`), { method: 'POST', body: form })
  return jsonOrThrow<SceneDescription>(res)
}

export async function listScenes(): Promise<SceneSummary[]> {
  return jsonOrThrow<SceneSummary[]>(await fetch(apiUrl('/api/scenes')))
}
