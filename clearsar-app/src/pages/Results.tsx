import { useState, useEffect } from 'react'
import CompareSlider from '../components/ui/CompareSlider'
import { PageId } from '../types'
import { getResult, JobResult, apiUrl } from '../api'

interface Props {
  onNavigate: (page: PageId) => void
  jobId: string | null
}

const TABS = ['Compare', 'SAR only', 'Optical only']

export default function Results({ onNavigate, jobId }: Props) {
  const [activeTab, setActiveTab] = useState(0)
  const [result, setResult] = useState<JobResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId) return
    let active = true
    getResult(jobId)
      .then(r => { if (active) setResult(r) })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Failed to load result') })
    return () => { active = false }
  }, [jobId])

  const sarUrl = result ? apiUrl(result.sar_url) : undefined
  const optUrl = result ? apiUrl(result.optical_url) : undefined
  const fmt = (n: number | null, d = 2) => (n == null ? '—' : n.toFixed(d))

  if (!jobId) {
    return (
      <section className="page on" id="p-results">
        <div className="ph"><div><h1>No scene selected</h1><p>Translate a SAR scene or open one from your library.</p></div></div>
        <button className="btn primary" onClick={() => onNavigate('upload')}>New translation →</button>
      </section>
    )
  }

  return (
    <section className="page on" id="p-results">
      <div className="ph">
        <div>
          <h1>Translation result</h1>
          {result && (
            <p>
              {result.filename} · {result.img_size}²
              {result.ddim_steps != null && ` · ${result.ddim_steps} bridge steps`}
              {result.elapsed_s != null && ` · ${result.elapsed_s}s`}
            </p>
          )}
        </div>
        <div className="ph-aside">
          <span className="chip ok"><span className="d" />COMPLETED</span>
          <a className="btn primary" href={optUrl} download={result ? `${result.filename}_optical.png` : undefined}>
            Download PNG
          </a>
        </div>
      </div>

      {error && (
        <div style={{ border: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px 14px', marginBottom: 16, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
          ⚠ {error}
        </div>
      )}

      <div className="results-grid">
        <div className="viewer">
          <div className="viewer-top">
            <div className="viewer-tabs">
              {TABS.map((tab, i) => (
                <span key={tab} className={i === activeTab ? 'on' : ''} onClick={() => setActiveTab(i)}>
                  {tab}
                </span>
              ))}
            </div>
          </div>
          <div className="viewer-stage">
            {!result ? (
              <div style={{ color: 'var(--ink-3)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '.2em' }}>
                LOADING SCENE…
              </div>
            ) : activeTab === 1 ? (
              <div className="image-stage">
                <img className="single-view" src={sarUrl} alt="SAR input" style={{ filter: 'grayscale(1) contrast(1.05)' }} />
              </div>
            ) : activeTab === 2 ? (
              <div className="image-stage">
                <img className="single-view" src={optUrl} alt="Optical output" />
              </div>
            ) : (
              <CompareSlider idleAnimate sarUrl={sarUrl} optUrl={optUrl} />
            )}
          </div>
        </div>

        <div className="side-panel">
          <div className="caption-block" style={{ padding: 14 }}>
            <div className="lbl" style={{ marginBottom: 10 }}>// Model eval metrics · SEN12MS 256px</div>
            <div className="met-grid">
              <div className="mc">
                <div className="lbl">PSNR ↑</div>
                <div className="v">{fmt(result?.metrics.psnr ?? null, 1)}</div>
                <div className="d">dB</div>
              </div>
              <div className="mc">
                <div className="lbl">SSIM ↑</div>
                <div className="v">{fmt(result?.metrics.ssim ?? null, 3)}</div>
                <div className="d">struct</div>
              </div>
              <div className="mc">
                <div className="lbl">LPIPS ↓</div>
                <div className="v">{fmt(result?.metrics.lpips ?? null, 3)}</div>
                <div className="d">percept</div>
              </div>
            </div>
            <p style={{ color: 'var(--ink-3)', fontSize: 11, lineHeight: 1.5, marginTop: 10, marginBottom: 0 }}>
              Dataset-level scores for the deployed model — per-image scoring needs a ground-truth optical pair.
            </p>
          </div>

          <div className="caption-block">
            <div className="lbl" style={{ marginBottom: 10 }}>// Export</div>
            <div className="act-col">
              <a className="btn" href={optUrl} download>
                <span>Download Optical PNG</span>
                <span className="mono">{result?.img_size ?? 256}²</span>
              </a>
              <a className="btn" href={sarUrl} download>
                <span>Download SAR input</span>
                <span className="mono">gray</span>
              </a>
            </div>
          </div>

          <button className="btn ghost" style={{ width: '100%' }} onClick={() => onNavigate('dashboard')}>
            ← Back to library
          </button>
        </div>
      </div>
    </section>
  )
}
