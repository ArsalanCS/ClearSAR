import { PageId } from '../types'

interface Props {
  onNavigate: (page: PageId) => void
}

export default function Library({ onNavigate }: Props) {
  return (
    <section className="page on" id="p-dashboard">
      <div className="ph">
        <div>
          <h1>Your translated scenes</h1>
          <p>No scenes yet. Upload a SAR file to generate your first translation.</p>
        </div>
        <div className="ph-aside">
          <button className="btn primary" onClick={() => onNavigate('upload')}>+ New scene</button>
        </div>
      </div>

      {/* Empty state */}
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
        <button className="btn primary" onClick={() => onNavigate('upload')}>
          Upload first scene →
        </button>
      </div>
    </section>
  )
}
