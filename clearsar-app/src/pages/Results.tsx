import { useState } from 'react'
import CompareSlider from '../components/ui/CompareSlider'
import { PageId } from '../types'

interface Props {
  onNavigate: (page: PageId) => void
}

const TABS = ['Compare', 'SAR only', 'Optical only', 'Annotations']

export default function Results({ onNavigate }: Props) {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <section className="page on" id="p-results">
      <div className="ph">
        <div>
          <h1>Translation result</h1>
        </div>
        <div className="ph-aside">
          <button className="btn primary">Export PDF</button>
        </div>
      </div>

      <div className="results-grid">
        <div className="viewer">
          <div className="viewer-top">
            <div className="viewer-tabs">
              {TABS.map((tab, i) => (
                <span
                  key={tab}
                  className={i === activeTab ? 'on' : ''}
                  onClick={() => setActiveTab(i)}
                >
                  {tab}
                </span>
              ))}
            </div>
          </div>
          <div className="viewer-stage">
            <CompareSlider idleAnimate={activeTab === 0} />
          </div>
        </div>

        <div className="side-panel">
          <div className="caption-block">
            <div className="lbl" style={{ marginBottom: 10 }}>// Export</div>
            <div className="act-col">
              <button className="btn">
                <span>Download PNG</span>
                <span className="mono">256²</span>
              </button>
              <button className="btn">
                <span>Download JSON</span>
                <span className="mono">meta</span>
              </button>
              <button className="btn">
                <span>Download GeoTIFF</span>
                <span className="mono">georef</span>
              </button>
              <button className="btn primary">
                <span>Export PDF Report</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14"/>
                </svg>
              </button>
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
