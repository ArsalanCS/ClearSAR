import { useState, useCallback } from 'react'
import { PageId } from '../types'

interface Props {
  onNavigate: (page: PageId) => void
}

export default function Upload({ onNavigate }: Props) {
  const [hover, setHover] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setHover(false)
    onNavigate('processing')
  }, [onNavigate])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setHover(true)
  }, [])

  return (
    <section className="page on" id="p-upload">
      <div className="ph">
        <div>
          <h1>Drop a SAR scene to begin.</h1>
          <p>Giant target, minimal friction. Supports Sentinel-1, Capella, and ICEYE GeoTIFFs. Max 50 MB per file.</p>
        </div>
        <div className="ph-aside">
          <button className="btn ghost">Switch to batch</button>
          <button className="btn primary" onClick={() => onNavigate('processing')}>
            Translate →
          </button>
        </div>
      </div>

      <div className="dropzone-wrap">
        <div
          className={`dropzone${hover ? ' hover' : ''}`}
          onDragEnter={handleDragOver}
          onDragOver={handleDragOver}
          onDragLeave={() => setHover(false)}
          onDrop={handleDrop}
          onClick={() => onNavigate('processing')}
        >
          {/* Decorative rings */}
          <svg
            className="rings"
            viewBox="0 0 500 500"
            preserveAspectRatio="xMidYMid slice"
          >
            <g fill="none" stroke="#2a313d" strokeWidth="1">
              <circle cx="250" cy="250" r="220" strokeDasharray="3 6"/>
              <circle cx="250" cy="250" r="160" strokeDasharray="3 6"/>
              <circle cx="250" cy="250" r="100"/>
            </g>
          </svg>

          <div className="plus">＋</div>
          <h3>Drop SAR file here</h3>
          <div className="sub">or click to browse</div>
          <div className="specs">
            <span className="chip"><span className="d" />GEOTIFF</span>
            <span className="chip">VV + VH</span>
            <span className="chip">≥ 256²</span>
            <span className="chip">≤ 50 MB</span>
          </div>
          <button
            className="btn browse"
            onClick={e => { e.stopPropagation(); onNavigate('processing') }}
          >
            Browse files
          </button>
        </div>

        <div className="upload-side">
          <div className="panel-card">
            <h4>File requirements</h4>
            <div className="help-row">
              <span>Format</span>
              <span className="mono">.tif / .tiff</span>
            </div>
            <div className="help-row">
              <span>Min resolution</span>
              <span className="mono">256 × 256</span>
            </div>
            <div className="help-row">
              <span>Polarization</span>
              <span className="mono">VV + VH</span>
            </div>
            <div className="help-row">
              <span>Max size</span>
              <span className="mono">50 MB</span>
            </div>
            <div className="help-row">
              <span>Projection</span>
              <span className="mono">EPSG:4326</span>
            </div>
          </div>

          <div
            className="panel-card"
            style={{ background: 'linear-gradient(135deg, rgba(255,106,44,.08), var(--panel))', borderColor: 'var(--line-2)' }}
          >
            <h4 style={{ color: 'var(--accent)' }}>// Processing SLA</h4>
            <div className="help-row">
              <span>Preprocess</span>
              <span className="mono">~1 s</span>
            </div>
            <div className="help-row">
              <span>Diffusion (50 steps)</span>
              <span className="mono">~25 s</span>
            </div>
            <div className="help-row">
              <span>BLIP-2 caption</span>
              <span className="mono">~5 s</span>
            </div>
            <div className="help-row" style={{ color: 'var(--accent)' }}>
              <span><b>End-to-end</b></span>
              <span className="mono">&lt; 40 s</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
