import { useEffect, useRef, useState } from 'react'
import { PageId } from '../types'

interface Props {
  onNavigate: (page: PageId) => void
  onComplete?: () => void
}

const CIRC = 2 * Math.PI * 140

type StageStatus = 'done' | 'active' | 'pending'

interface Stage {
  label: string
  time: string
  status: StageStatus
}

export default function Processing({ onNavigate, onComplete }: Props) {
  const [pct, setPct] = useState(0)
  const [step, setStep] = useState(0)
  const [eta, setEta] = useState(30)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setPct(0)
    setStep(0)
    setEta(30)

    timerRef.current = setInterval(() => {
      setPct(prev => {
        const next = prev + 0.8
        if (next >= 100) {
          clearInterval(timerRef.current!)
          onComplete?.()
          setTimeout(() => onNavigate('results'), 1200)
          return 100
        }
        return next
      })
    }, 180)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [onNavigate, onComplete])

  useEffect(() => {
    setStep(Math.min(50, Math.floor(pct * 0.5)))
    setEta(Math.max(1, Math.floor((100 - pct) * 0.3)))
  }, [pct])

  const dashArray = `${(pct / 100) * CIRC} ${CIRC}`

  const stages: Stage[] = [
    { label: '✓ 01 · INGEST', time: '1.2 s',  status: pct > 5  ? 'done' : pct > 0 ? 'active' : 'pending' },
    { label: '✓ 02 · ENCODE', time: '0.4 s',  status: pct > 15 ? 'done' : pct > 5  ? 'active' : 'pending' },
    { label: '◉ 03 · DENOISE', time: '~12 s', status: pct > 80 ? 'done' : pct > 15 ? 'active' : 'pending' },
    { label: '04 · DECODE',    time: '~0.3 s', status: pct > 90 ? 'done' : pct > 80 ? 'active' : 'pending' },
    { label: '05 · CAPTION',   time: '~5 s',  status: pct >= 100 ? 'done' : pct > 90 ? 'active' : 'pending' },
  ]

  return (
    <section className="page on" id="p-processing">
      <div className="ph">
        <div>
          <h1>Translating scene…</h1>
          <p>Latent diffusion inference in progress. Results will appear in Scene Viewer on completion.</p>
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
              fill="none" stroke="#ff6a2c" strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={dashArray}
              style={{ filter: 'drop-shadow(0 0 8px #ff6a2c)' }}
            />
            <circle cx="160" cy="160" r="110" fill="none" stroke="#2a313d" strokeWidth="1" strokeDasharray="2 6"/>
            <g fill="#5b6472" fontFamily="JetBrains Mono" fontSize="9">
              <text x="160" y="22" textAnchor="middle">◆</text>
              <text x="160" y="308" textAnchor="middle">◆</text>
              <text x="22" y="163" textAnchor="middle">◆</text>
              <text x="298" y="163" textAnchor="middle">◆</text>
            </g>
          </svg>
          <div className="proc-center">
            <div className="st">DIFFUSING</div>
            <div className="pct">
              <em>{Math.floor(pct)}</em>%
            </div>
          </div>
        </div>

        <div className="proc-stage">
          Stage {pct < 15 ? 1 : pct < 80 ? 3 : pct < 90 ? 4 : 5} / 5 ·{' '}
          {pct < 5 ? 'Ingest & validate' : pct < 15 ? 'Encode' : pct < 80 ? `Latent denoise (step ${step} / 50)` : pct < 90 ? 'Decode optical' : 'Generating caption'}
        </div>
        <div className="proc-eta">ETA · {eta}s remaining</div>

        <div className="proc-file">
          <span>RANN_20260412.tif</span>
          <span className="sep" />
          <span>28.4 MB</span>
          <span className="sep" />
          <span>Sentinel-1 · VV + VH</span>
          <span className="sep" />
          <span>256²</span>
        </div>

        <div className="proc-steps">
          {stages.map(s => (
            <div key={s.label} className={`s ${s.status}`}>
              <div className="sn">{s.label}</div>
              <div className="sv">{s.time}</div>
            </div>
          ))}
        </div>

        <button className="btn ghost" onClick={() => onNavigate('upload')}>
          Abort run
        </button>
      </div>
    </section>
  )
}
