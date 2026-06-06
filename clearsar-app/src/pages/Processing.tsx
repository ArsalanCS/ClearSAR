import { useEffect, useRef, useState } from 'react'
import { PageId } from '../types'
import { getJob, JobState, Stage } from '../api'

interface Props {
  onNavigate: (page: PageId) => void
  onComplete?: () => void
  jobId: string | null
}

const CIRC = 2 * Math.PI * 140

const STAGE_ORDER: Stage[] = ['ingest', 'encode', 'denoise', 'decode', 'done']
const STAGE_LABELS: { stage: Stage; label: string; time: string }[] = [
  { stage: 'ingest',  label: '01 · INGEST',  time: 'validate' },
  { stage: 'encode',  label: '02 · ENCODE',  time: 'VAE enc' },
  { stage: 'denoise', label: '03 · DENOISE', time: '50 steps' },
  { stage: 'decode',  label: '04 · DECODE',  time: 'VAE dec' },
  { stage: 'done',    label: '05 · OUTPUT',  time: 'PNG' },
]
const STAGE_TITLE: Record<Stage, string> = {
  ingest: 'Ingest & validate',
  encode: 'VAE latent encode',
  denoise: 'Latent diffusion · DDIM denoise',
  decode: 'VAE decode → optical RGB',
  done: 'Finalizing',
}

export default function Processing({ onNavigate, onComplete, jobId }: Props) {
  const [job, setJob] = useState<JobState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const firedRef = useRef(false)

  useEffect(() => {
    if (!jobId) return
    let active = true
    const poll = async () => {
      try {
        const state = await getJob(jobId)
        if (!active) return
        setJob(state)
        if (state.status === 'completed' && !firedRef.current) {
          firedRef.current = true
          onComplete?.()
          setTimeout(() => onNavigate('results'), 900)
        } else if (state.status === 'failed') {
          setError(state.error || 'Translation failed')
        } else if (state.status === 'running' || state.status === 'queued') {
          timer = setTimeout(poll, 500)
        }
      } catch (e) {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Lost connection to backend')
      }
    }
    let timer: ReturnType<typeof setTimeout>
    poll()
    return () => { active = false; clearTimeout(timer) }
  }, [jobId, onNavigate, onComplete])

  const pct = job?.progress ?? 0
  const currentStage: Stage = job?.stage ?? 'ingest'
  const stageIdx = STAGE_ORDER.indexOf(currentStage)
  const dashArray = `${(pct / 100) * CIRC} ${CIRC}`

  if (!jobId) {
    return (
      <section className="page on" id="p-processing">
        <div className="processing-wrap">
          <div className="proc-stage">No active run.</div>
          <button className="btn primary" onClick={() => onNavigate('upload')}>Start a translation →</button>
        </div>
      </section>
    )
  }

  return (
    <section className="page on" id="p-processing">
      <div className="ph">
        <div>
          <h1>{error ? 'Translation failed' : 'Translating scene…'}</h1>
          <p>{error
            ? 'The backend reported an error during inference.'
            : 'Latent diffusion inference in progress. Results appear in Scene Viewer on completion.'}</p>
        </div>
        <div className="ph-aside">
          <button className="btn ghost" onClick={() => onNavigate('upload')}>Cancel</button>
        </div>
      </div>

      <div className="processing-wrap">
        <div className="proc-ring">
          <svg viewBox="0 0 320 320">
            <circle cx="160" cy="160" r="140" fill="none" stroke="#1e232d" strokeWidth="3"/>
            <circle
              cx="160" cy="160" r="140"
              fill="none" stroke={error ? '#ff4d5a' : '#ff6a2c'} strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={dashArray}
              style={{ filter: `drop-shadow(0 0 8px ${error ? '#ff4d5a' : '#ff6a2c'})`, transition: 'stroke-dasharray .4s' }}
            />
            <circle cx="160" cy="160" r="110" fill="none" stroke="#2a313d" strokeWidth="1" strokeDasharray="2 6"/>
          </svg>
          <div className="proc-center">
            <div className="st">{error ? 'ERROR' : currentStage.toUpperCase()}</div>
            <div className="pct"><em>{Math.floor(pct)}</em>%</div>
          </div>
        </div>

        {error ? (
          <div className="proc-stage" style={{ color: 'var(--danger)' }}>{error}</div>
        ) : (
          <div className="proc-stage">
            Stage {Math.max(1, stageIdx + 1)} / 5 · {STAGE_TITLE[currentStage]}
          </div>
        )}
        <div className="proc-file">
          <span>{job?.filename ?? '—'}</span>
        </div>

        <div className="proc-steps">
          {STAGE_LABELS.map((s, i) => {
            const cls = i < stageIdx ? 'done' : i === stageIdx ? 'active' : 'pending'
            return (
              <div key={s.stage} className={`s ${error ? 'pending' : cls}`}>
                <div className="sn">{i < stageIdx ? '✓ ' : ''}{s.label}</div>
                <div className="sv">{s.time}</div>
              </div>
            )
          })}
        </div>

        <button className="btn ghost" onClick={() => onNavigate('upload')}>
          {error ? 'Try another scene' : 'Abort run'}
        </button>
      </div>
    </section>
  )
}
