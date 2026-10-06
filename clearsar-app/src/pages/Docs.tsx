import { useCallback, useEffect, useRef, useState } from 'react'
import { PageId } from '../types'
import { apiUrl, listScenes, SceneSummary, DescriptionStatus } from '../api'
import { buildReportPdf, loadReportData, reportFilename, reportId } from '../report'

interface Props {
  onNavigate: (page: PageId) => void
  onOpenScene: (jobId: string) => void
  query?: string
}

interface Preview { url: string; filename: string; descStatus: DescriptionStatus | null }

const STATUS: Record<DescriptionStatus, { label: string; cls: string }> = {
  completed: { label: 'Described', cls: 'ok' },
  pending: { label: 'Describing…', cls: '' },
  running: { label: 'Describing…', cls: '' },
  failed: { label: 'Description failed', cls: 'bad' },
  off: { label: 'No description', cls: '' },
}

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso
    : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function Docs({ onNavigate, onOpenScene, query = '' }: Props) {
  const [scenes, setScenes] = useState<SceneSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [building, setBuilding] = useState(false)
  const [buildError, setBuildError] = useState<string | null>(null)
  const urls = useRef<string[]>([])

  useEffect(() => {
    let active = true
    listScenes()
      .then(s => {
        if (!active) return
        setScenes(s)
        if (s.length) setSelected(cur => cur ?? s[0].job_id)
      })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Failed to load scenes') })
    return () => { active = false }
  }, [])

  useEffect(() => () => { urls.current.forEach(u => URL.revokeObjectURL(u)) }, [])

  const build = useCallback(async (jobId: string): Promise<Preview> => {
    const data = await loadReportData(jobId)
    const url = URL.createObjectURL(await buildReportPdf(data))
    urls.current.push(url)
    return { url, filename: reportFilename(data.result), descStatus: data.desc?.status ?? null }
  }, [])

  const renderPreview = useCallback(async (jobId: string) => {
    setBuilding(true); setBuildError(null)
    try {
      setPreview(await build(jobId))
    } catch (e) {
      setPreview(null)
      setBuildError(e instanceof Error ? e.message : 'Could not build the report')
    } finally {
      setBuilding(false)
    }
  }, [build])

  useEffect(() => { if (selected) renderPreview(selected) }, [selected, renderPreview])

  const download = async (jobId: string) => {
    try {
      const p = jobId === selected && preview ? preview : await build(jobId)
      const a = document.createElement('a')
      a.href = p.url; a.download = p.filename; a.click()
    } catch (e) {
      setBuildError(e instanceof Error ? e.message : 'Download failed')
    }
  }

  const q = query.trim().toLowerCase()
  const shown = (scenes ?? []).filter(s =>
    !q || s.filename.toLowerCase().includes(q) || s.job_id.includes(q) || reportId(s.job_id).toLowerCase().includes(q))

  return (
    <section className="page on" id="p-docs">
      <div className="ph">
        <div>
          <h1>Scene reports</h1>
          <p>Every translated scene has a PDF report: the SAR input and optical output side by side, the scene description, and the model's evaluation context.</p>
        </div>
        <div className="ph-aside">
          {scenes && <span className="chip"><span className="d" />{scenes.length} report{scenes.length === 1 ? '' : 's'}</span>}
          <button className="btn primary" onClick={() => onNavigate('upload')}>+ New translation</button>
        </div>
      </div>

      {error && <div className="docs-error">⚠ {error} — is the backend reachable?</div>}

      {scenes !== null && scenes.length === 0 ? (
        <div className="docs-empty">
          <div className="lbl">NO REPORTS YET</div>
          <p>Reports appear here once a SAR scene has been translated in this session.</p>
          <button className="btn primary" onClick={() => onNavigate('upload')}>Translate a scene →</button>
        </div>
      ) : (
        <div className="docs-grid">
          <div className="docs-list">
            {scenes === null && !error && <div className="docs-muted">Loading reports…</div>}
            {scenes !== null && shown.length === 0 && <div className="docs-muted">No reports match “{query}”.</div>}
            {shown.map(s => {
              const st = STATUS[s.description_status ?? 'off']
              return (
                <div key={s.job_id} className={`docs-row${selected === s.job_id ? ' on' : ''}`}
                     onClick={() => setSelected(s.job_id)}>
                  <div className="docs-thumbs">
                    <img src={apiUrl(s.sar_url ?? `/api/images/${s.job_id}/sar`)} alt="" style={{ filter: 'grayscale(1)' }} />
                    <img src={apiUrl(s.optical_url)} alt="" />
                  </div>
                  <div className="docs-info">
                    <div className="docs-id">{reportId(s.job_id)}</div>
                    <div className="docs-name" title={s.filename}>{s.filename}</div>
                    <div className="docs-meta">
                      {fmtDate(s.created_at)}
                      {s.season && ` · ${s.season}`}{s.terrain && ` · ${s.terrain}`}
                    </div>
                  </div>
                  <div className="docs-row-actions" onClick={e => e.stopPropagation()}>
                    <span className={`docs-status ${st.cls}`}>{st.label}</span>
                    <button className="btn" onClick={() => download(s.job_id)}>PDF ↓</button>
                    <button className="btn ghost" onClick={() => { onOpenScene(s.job_id); onNavigate('results') }}>Open</button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="docs-preview">
            <div className="docs-preview-top">
              <span className="lbl">// Report preview{selected && ` · ${reportId(selected)}`}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost" disabled={!selected || building} onClick={() => selected && renderPreview(selected)}>
                  Refresh
                </button>
                <button className="btn primary" disabled={!preview || building} onClick={() => selected && download(selected)}>
                  Download PDF
                </button>
              </div>
            </div>
            {preview && (preview.descStatus === 'pending' || preview.descStatus === 'running') && (
              <div className="docs-note">The description is still being generated. Refresh in a few seconds to include it.</div>
            )}
            <div className="docs-frame">
              {buildError ? <div className="docs-error">⚠ {buildError}</div>
                : building || !preview ? <div className="docs-muted">{selected ? 'Building report…' : 'Select a report'}</div>
                : <iframe title="Report preview" src={`${preview.url}#view=FitH&toolbar=0`} />}
            </div>
          </div>
        </div>
      )}

      <div className="docs-guide">
        <div className="lbl hi">// How to read a report</div>
        <div className="docs-guide-grid">
          <div>
            <h4>01 · Imagery</h4>
            <p>(a) is the Sentinel-1 SAR you uploaded. (b) is the optical estimate generated from it by the translation model. Image (b) is synthetic: its shapes follow the radar, but its colours are the model's best guess.</p>
          </div>
          <div>
            <h4>02 · Scene description</h4>
            <p>A short summary of the scene. Each claim carries a tag:
              <span className="conf-tag high">high</span> SAR facts and both images agree,
              <span className="conf-tag medium">medium</span> plausible,
              <span className="conf-tag low">low</span> best guess. The Reliability line names the least trustworthy part.</p>
          </div>
          <div>
            <h4>03 · Measured SAR facts</h4>
            <p>Statistics computed from the radar pixels: region brightness and texture, dark smooth areas (possible water), bright areas, and dominant line direction. These anchor the description to this scene.</p>
          </div>
          <div>
            <h4>04 · Model and evaluation</h4>
            <p>PSNR, SSIM, LPIPS and FID of the deployed model on held-out validation pairs. They describe the model in general, not this scene: an uploaded scene has no ground-truth optical image to compare with.</p>
          </div>
        </div>
        <p className="docs-disclaimer">
          Reports are decision-support aids on partly synthetic imagery, not verified ground truth. At 10 m per pixel, objects smaller than about 30 m are not resolvable. Reports exist only while the server session that processed the scene is running, so download the ones you need.
        </p>
      </div>
    </section>
  )
}
