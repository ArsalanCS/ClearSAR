import { useEffect, useState } from 'react'
import { PageId } from '../types'
import { listScenes, SceneSummary, apiUrl } from '../api'

interface Props {
  onNavigate: (page: PageId) => void
  onOpenScene: (jobId: string) => void
}

export default function Library({ onNavigate, onOpenScene }: Props) {
  const [scenes, setScenes] = useState<SceneSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    listScenes()
      .then(s => { if (active) setScenes(s) })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Failed to load library') })
    return () => { active = false }
  }, [])

  const openScene = (jobId: string) => {
    onOpenScene(jobId)
    onNavigate('results')
  }

  const empty = scenes !== null && scenes.length === 0
  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return isNaN(d.getTime()) ? iso : d.toLocaleString()
  }

  return (
    <section className="page on" id="p-dashboard">
      <div className="ph">
        <div>
          <h1>Your translated scenes</h1>
          <p>{scenes === null ? 'Loading…' : `${scenes.length} scene${scenes.length === 1 ? '' : 's'} translated this session.`}</p>
        </div>
        <div className="ph-aside">
          <button className="btn primary" onClick={() => onNavigate('upload')}>+ New scene</button>
        </div>
      </div>

      {error && (
        <div style={{ border: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px 14px', marginBottom: 16, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
          ⚠ {error} — is the backend running on :8000?
        </div>
      )}

      {empty ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: 360, gap: 16,
          border: '1px dashed var(--line-2)', background: 'var(--panel)',
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.2">
            <rect x="3" y="4" width="18" height="16" rx="1"/>
            <line x1="12" y1="4" x2="12" y2="20"/>
          </svg>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
            NO SCENES PROCESSED
          </div>
          <button className="btn primary" onClick={() => onNavigate('upload')}>Upload first scene →</button>
        </div>
      ) : (
        <div className="dash-grid">
          {(scenes ?? []).map(scene => (
            <div key={scene.job_id} className="card" onClick={() => openScene(scene.job_id)}>
              <div className="thumb">
                <img
                  src={apiUrl(scene.optical_url)}
                  alt={scene.filename}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <span className="badge">#{scene.job_id.slice(0, 4).toUpperCase()}</span>
              </div>
              <h5 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{scene.filename}</h5>
              <div className="row">
                <span>{fmtDate(scene.created_at)}</span>
                <span>PSNR <b>{scene.metrics.psnr ?? '—'}</b></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
