import { PageId, SceneCard } from '../types'

interface Props {
  onNavigate: (page: PageId) => void
}

const CARDS: SceneCard[] = [
  { id: '#8F2A', title: 'Rann of Kutch',    caption: 'Wide floodplain with a meandering river and agricultural fields.', psnr: 22.1, ssim: .64, sensor: 'S-1',    date: '2h ago',   pinned: true },
  { id: '#7A11', title: 'Arabian Sea coast', caption: 'Coastal waters with a small vessel moving NW at 8 knots.',         psnr: 21.4, ssim: .61, sensor: 'S-1',    date: '5h ago'   },
  { id: '#72C3', title: 'Swat Valley',       caption: 'Mountain terrain with mixed forest cover and glacial streams.',     psnr: 23.6, ssim: .68, sensor: 'Capella', date: 'yesterday' },
  { id: '#62B9', title: 'Karachi metro',     caption: 'Dense urban blocks, highway grid, and port infrastructure.',       psnr: 20.8, ssim: .59, sensor: 'S-1',    date: 'Apr 19'   },
  { id: '#5E4C', title: 'Thar desert',       caption: 'Desert with aeolian dune patterns and minimal vegetation.',        psnr: 24.3, ssim: .71, sensor: 'ICEYE',  date: 'Apr 18'   },
  { id: '#4D01', title: 'Gwadar port',       caption: 'Active port with container yards, jetties, and anchored cargo ships.', psnr: 19.9, ssim: .56, sensor: 'S-1', date: 'Apr 17'  },
  { id: '#44A7', title: 'Indus delta',       caption: 'Delta distributaries with mangrove patches and tidal flats.',      psnr: 22.7, ssim: .66, sensor: 'S-1',    date: 'Apr 16'   },
  { id: '#3B22', title: 'Nanga Parbat',      caption: 'Rugged peaks with snow cover and glacial valleys.',                psnr: 23.1, ssim: .67, sensor: 'Capella', date: 'Apr 15'  },
  { id: '#2F18', title: 'Sundarbans',        caption: 'Dense tidal mangrove forest cut by countless channels.',           psnr: 21.8, ssim: .62, sensor: 'S-1',    date: 'Apr 14'   },
]

export default function Library({ onNavigate }: Props) {
  return (
    <section className="page on" id="p-dashboard">
      <div className="ph">
        <div>
          <div className="num">§ 05 · LIBRARY</div>
          <h1>Your translated scenes</h1>
          <p>42 scenes processed across 7 days · Sort by recent or filter by sensor, confidence, or AOI.</p>
        </div>
        <div className="ph-aside">
          <button className="btn ghost">Export CSV</button>
          <button className="btn primary" onClick={() => onNavigate('upload')}>+ New scene</button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="kpis">
        <div className="kpi">
          <div className="lbl">Scenes processed</div>
          <div className="v"><em>42</em></div>
          <div className="d">▲ 18 vs last week</div>
          <svg className="spark" viewBox="0 0 60 20">
            <polyline fill="none" stroke="#ff6a2c" strokeWidth="1.5" points="0,15 10,12 20,14 30,10 40,8 50,5 60,3"/>
          </svg>
        </div>
        <div className="kpi">
          <div className="lbl">Avg confidence</div>
          <div className="v">0.79</div>
          <div className="d">▲ +0.04 Δ</div>
          <svg className="spark" viewBox="0 0 60 20">
            <polyline fill="none" stroke="#2ad3b5" strokeWidth="1.5" points="0,14 10,13 20,11 30,12 40,9 50,8 60,6"/>
          </svg>
        </div>
        <div className="kpi">
          <div className="lbl">Avg latency</div>
          <div className="v">37.8s</div>
          <div className="d" style={{ color: 'var(--accent-2)' }}>▼ −1.4s</div>
          <svg className="spark" viewBox="0 0 60 20">
            <polyline fill="none" stroke="#2ad3b5" strokeWidth="1.5" points="0,5 10,7 20,6 30,9 40,10 50,11 60,13"/>
          </svg>
        </div>
        <div className="kpi">
          <div className="lbl">Storage used</div>
          <div className="v">1.2 GB</div>
          <div className="d">of 10 GB</div>
          <svg className="spark" viewBox="0 0 60 20">
            <rect x="0" y="14" width="60" height="3" fill="#1e232d"/>
            <rect x="0" y="14" width="14" height="3" fill="#ff6a2c"/>
          </svg>
        </div>
      </div>

      {/* Filter tools */}
      <div className="dash-tools">
        <button className="btn ghost">All sensors ▾</button>
        <button className="btn ghost">All AOIs ▾</button>
        <button className="btn ghost">Last 7 days ▾</button>
        <button className="btn ghost">Confidence ≥ 0.5 ▾</button>
        <div className="dash-tools-spacer" />
        <button className="btn ghost">Cards</button>
        <button className="btn ghost" style={{ opacity: .5 }}>Table</button>
        <button className="btn ghost" style={{ opacity: .5 }}>Map</button>
      </div>

      {/* Scene grid */}
      <div className="dash-grid">
        {CARDS.map(card => (
          <div key={card.id} className="card" onClick={() => onNavigate('results')}>
            <div className="thumb">
              <div className="sar-mini" />
              <div className="opt-mini" />
              <div className="div" />
              <span className="badge">{card.id}</span>
              {card.pinned && <span className="pin" />}
            </div>
            <h5>{card.title}</h5>
            <div className="cap">{card.caption}</div>
            <div className="row">
              <span>{card.sensor} · {card.date}</span>
              <span>PSNR <b>{card.psnr}</b> · SSIM <b>{card.ssim}</b></span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
