import { useEffect, useState } from 'react'
import {
  getDescription, regenerateDescription, SceneDescription as Desc, Purpose, PURPOSES, PURPOSE_LABELS,
} from '../../api'

interface Props {
  jobId: string
  filename?: string
}

const POLL_MS = 1500

// SAR -> optical scene description, generated after the translation finishes.
export default function SceneDescription({ jobId, filename }: Props) {
  const [desc, setDesc] = useState<Desc | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [purpose, setPurpose] = useState<Purpose>('general')
  const [showFacts, setShowFacts] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tick, setTick] = useState(0)   // bump to restart polling after a regenerate

  const busy = desc?.status === 'pending' || desc?.status === 'running'

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const d = await getDescription(jobId)
        if (!active) return
        setDesc(d)
        setError(null)
        if (d.status === 'pending' || d.status === 'running') timer = setTimeout(poll, POLL_MS)
        else setPurpose(d.purpose)
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load description')
      }
    }
    poll()
    return () => { active = false; clearTimeout(timer) }
  }, [jobId, tick])

  const regenerate = async () => {
    try {
      setDesc(await regenerateDescription(jobId, purpose))
      setTick(t => t + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to regenerate')
    }
  }

  const copy = async () => {
    if (!desc?.text) return
    await navigator.clipboard.writeText(desc.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const downloadJson = () => {
    if (!desc) return
    const blob = new Blob([JSON.stringify(desc, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${filename ?? jobId}_description.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (desc?.status === 'off') return null

  const sections = (desc?.sections ?? []).filter(s => s.name !== 'Reliability')
  const c = desc?.confidence ?? {}

  return (
    <div className="desc-panel">
      <div className="desc-head">
        <div>
          <div className="lbl hi">// Scene description · SAR → optical</div>
          {desc?.status === 'completed' && (
            <div className="desc-meta">
              {desc.engine === 'vlm' ? (desc.vlm ?? 'VLM') : 'measured SAR statistics only'}
              {desc.elapsed_s != null && ` · ${desc.elapsed_s}s`}
              {desc.retried && ' · retried'}
            </div>
          )}
        </div>
        <div className="desc-actions">
          <select className="cond-select" value={purpose} disabled={busy}
                  onChange={e => setPurpose(e.target.value as Purpose)}>
            {PURPOSES.map(p => <option key={p} value={p}>{PURPOSE_LABELS[p]}</option>)}
          </select>
          <button className="btn" onClick={regenerate} disabled={busy}>
            {busy ? 'Describing…' : 'Regenerate'}
          </button>
          <button className="btn ghost" onClick={copy} disabled={!desc?.text}>{copied ? 'Copied' : 'Copy'}</button>
          <button className="btn ghost" onClick={downloadJson} disabled={desc?.status !== 'completed'}>JSON</button>
        </div>
      </div>

      {error && <div className="desc-error">⚠ {error}</div>}

      {(!desc || busy) && !error && (
        <div className="desc-loading">
          <span className="desc-pulse" />
          {desc?.status === 'running'
            ? 'Reading the SAR + translated optical and writing the description…'
            : 'Queued — the description starts once the optical image is ready…'}
        </div>
      )}

      {desc?.status === 'failed' && (
        <div className="desc-error">⚠ Description failed: {desc.error ?? 'unknown error'}</div>
      )}

      {desc?.status === 'completed' && (
        <>
          {desc.engine === 'facts' && desc.fallback_reason && (
            <div className="desc-note">
              The vision-language model was unavailable, so this description uses measured SAR statistics only.
            </div>
          )}

          <div className="desc-legend">
            <span className="conf-tag high">high {c.high ?? 0}</span>
            <span className="conf-tag medium">medium {c.medium ?? 0}</span>
            <span className="conf-tag low">low {c.low ?? 0}</span>
            <span className="desc-legend-hint">claim confidence</span>
          </div>

          <div className={`desc-sections${sections.length === 1 ? ' single' : ''}`}>
            {sections.map(s => (
              <div className="desc-sec" key={s.name}>
                <div className="lbl">{s.name}</div>
                <p>
                  {s.claims.map((cl, i) => (
                    <span key={i} className="claim">
                      {cl.text}
                      {cl.confidence && <span className={`conf-tag ${cl.confidence}`}>{cl.confidence}</span>}
                      {' '}
                    </span>
                  ))}
                </p>
              </div>
            ))}
          </div>

          {desc.reliability && (
            <div className="desc-reliability">
              <div className="lbl" style={{ color: 'var(--warn)' }}>Reliability</div>
              <p>{desc.reliability}</p>
            </div>
          )}

          {desc.truncated && (
            <div className="desc-note">The model hit its length limit; the last section may be cut short.</div>
          )}

          {desc.sar_facts && (
            <div className="desc-facts">
              <button className="desc-facts-toggle" onClick={() => setShowFacts(v => !v)}>
                {showFacts ? '▾' : '▸'} Measured SAR facts given to the model
              </button>
              {showFacts && <pre>{desc.sar_facts}</pre>}
            </div>
          )}

          {desc.warning && <div className="desc-warning">{desc.warning}</div>}
        </>
      )}
    </div>
  )
}
