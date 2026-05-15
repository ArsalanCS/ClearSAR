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
          <div className="num">§ 04 · SCENE · 0x8F2A</div>
          <h1>Rann of Kutch · floodplain survey</h1>
          <p>Translation complete in 38.2 s · Confidence 0.82 · Acquired 2026-04-12 18:42 Z</p>
        </div>
        <div className="ph-aside">
          <span className="chip ok"><span className="d" />COMPLETED</span>
          <button className="btn ghost">Annotate</button>
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
            <div className="coords">
              34.128°N · 72.442°E · Sentinel-1 · 2026-04-12 18:42Z
            </div>
          </div>
          <div className="viewer-stage">
            <CompareSlider idleAnimate={activeTab === 0} />
          </div>
        </div>

        <div className="side-panel">
          <div className="caption-block">
            <div className="lbl hi">// BLIP-2 · Scene description</div>
            <div className="caption">
              <span className="q">&ldquo;</span>
              A wide floodplain with a meandering river cutting east to west, agricultural
              fields on the north bank, and scattered settlements to the southeast. Minor
              inundation visible along the northwest tributary.
              <span className="q">&rdquo;</span>
            </div>
            <div className="tags">
              <span className="t">floodplain</span>
              <span className="t">river</span>
              <span className="t">agriculture</span>
              <span className="t">settlement</span>
              <span className="t">flooding</span>
            </div>
          </div>

          <div className="caption-block">
            <div className="lbl">// Caption confidence</div>
            <div className="conf">
              <div className="bar"><div /></div>
              <div className="v">0.82</div>
            </div>
          </div>

          <div className="caption-block" style={{ padding: 14 }}>
            <div className="lbl" style={{ marginBottom: 10 }}>// Translation metrics</div>
            <div className="met-grid">
              <div className="mc">
                <div className="lbl">PSNR ↑</div>
                <div className="v">22.1</div>
                <div className="d">+3.4 Δ</div>
              </div>
              <div className="mc">
                <div className="lbl">SSIM ↑</div>
                <div className="v">0.64</div>
                <div className="d">+0.12 Δ</div>
              </div>
              <div className="mc">
                <div className="lbl">LPIPS ↓</div>
                <div className="v">0.19</div>
                <div className="d">−0.07 Δ</div>
              </div>
            </div>
          </div>

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
