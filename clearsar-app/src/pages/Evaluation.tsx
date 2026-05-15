const METRICS = [
  { label: 'PSNR ↑',  ours: 22.4, base: 18.7, delta: '+3.7',  ousPct: 90, basePct: 70 },
  { label: 'SSIM ↑',  ours: 0.63, base: 0.51, delta: '+0.12', ousPct: 63, basePct: 51 },
  { label: 'LPIPS ↓', ours: 0.21, base: 0.32, delta: '−0.11', ousPct: 42, basePct: 64 },
  { label: 'FID ↓',   ours: 31.2, base: 64.1, delta: '−32.9', ousPct: 31, basePct: 64 },
]

export default function Evaluation() {
  return (
    <section className="page on" id="p-admin">
      <div className="ph">
        <div>
          <h1>SD-v1.5-SAR-FT · v0.4.2</h1>
          <p>Test set 2,040 scenes from SEN12MS holdout · Baseline Pix2Pix trained on identical split.</p>
        </div>
        <div className="ph-aside">
          <span className="chip ok"><span className="d" />DEPLOYED</span>
          <button className="btn ghost">Re-run eval</button>
          <button className="btn primary">Export report</button>
        </div>
      </div>

      {/* Model selector */}
      <div className="admin-head">
        <div className="model-sel">
          <span className="lbl">ACTIVE</span>
          <b>SD-v1.5-SAR-FT v0.4.2</b>
          <span style={{ color: 'var(--ink-3)' }}>▾</span>
        </div>
        <span className="chip">TRAIN · 150K</span>
        <span className="chip">VAL · 15K</span>
        <span className="chip">TEST · 2040</span>
        <span className="chip hi">FINE-TUNE · EPOCH 20</span>
        <div style={{ flex: 1 }} />
        <span className="lbl">LAST EVAL · 2 H AGO</span>
      </div>

      {/* KPIs */}
      <div className="kpis">
        <div className="kpi">
          <div className="lbl">PSNR ↑</div>
          <div className="v"><em>22.4</em></div>
          <div className="d">▲ vs 18.7 pix2pix</div>
        </div>
        <div className="kpi">
          <div className="lbl">SSIM ↑</div>
          <div className="v">0.63</div>
          <div className="d">▲ vs 0.51</div>
        </div>
        <div className="kpi">
          <div className="lbl">LPIPS ↓</div>
          <div className="v">0.21</div>
          <div className="d" style={{ color: 'var(--accent-2)' }}>▼ vs 0.32</div>
        </div>
        <div className="kpi">
          <div className="lbl">FID ↓</div>
          <div className="v">31.2</div>
          <div className="d" style={{ color: 'var(--accent-2)' }}>▼ vs 64.1</div>
        </div>
      </div>

      {/* Charts */}
      <div className="admin-grid">
        {/* PSNR trajectory chart */}
        <div className="chart-card">
          <h4>PSNR trajectory · last 10 epochs</h4>
          <div className="chart-legend">
            <div className="l"><span className="sw" style={{ background: '#ff6a2c' }} />ClearSAR (ours)</div>
            <div className="l"><span className="sw" style={{ background: '#5b6472' }} />Pix2Pix baseline</div>
          </div>
          <svg viewBox="0 0 400 220" style={{ width: '100%', height: 'auto' }}>
            <defs>
              <linearGradient id="psnr-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff6a2c" stopOpacity=".35"/>
                <stop offset="100%" stopColor="#ff6a2c" stopOpacity="0"/>
              </linearGradient>
            </defs>
            {/* Grid lines */}
            <g stroke="#1e232d" strokeWidth="1">
              <line x1="40" y1="30"  x2="390" y2="30"/>
              <line x1="40" y1="90"  x2="390" y2="90"/>
              <line x1="40" y1="150" x2="390" y2="150"/>
              <line x1="40" y1="210" x2="390" y2="210"/>
              <line x1="40" y1="30"  x2="40"  y2="210"/>
            </g>
            {/* Y-axis labels */}
            <g fontFamily="JetBrains Mono" fontSize="9" fill="#5b6472">
              <text x="8"  y="34">24</text>
              <text x="8"  y="94">22</text>
              <text x="8"  y="154">20</text>
              <text x="8"  y="214">18</text>
              <text x="40" y="225">E1</text>
              <text x="215" y="225" textAnchor="middle">E5</text>
              <text x="390" y="225" textAnchor="end">E10</text>
            </g>
            {/* Baseline */}
            <polyline fill="none" stroke="#5b6472" strokeWidth="1.5" strokeDasharray="4 4"
              points="40,190 75,182 110,175 145,170 180,166 215,163 250,161 285,160 320,160 355,159 390,159"/>
            {/* Ours filled */}
            <polyline fill="url(#psnr-grad)" stroke="none"
              points="40,170 75,140 110,120 145,100 180,85 215,72 250,62 285,54 320,48 355,42 390,38 390,210 40,210"/>
            {/* Ours line */}
            <polyline fill="none" stroke="#ff6a2c" strokeWidth="2"
              points="40,170 75,140 110,120 145,100 180,85 215,72 250,62 285,54 320,48 355,42 390,38"/>
            {/* Endpoint */}
            <circle cx="390" cy="38" r="4" fill="#ff6a2c"/>
            <text x="390" y="32" textAnchor="end" fontFamily="JetBrains Mono" fontSize="10" fill="#ff6a2c">
              22.4 dB
            </text>
          </svg>
        </div>

        {/* Metric comparison bars */}
        <div className="chart-card">
          <h4>Metric comparison · ours vs baseline</h4>
          <div className="bench-rows">
            {METRICS.map(m => (
              <div className="br" key={m.label}>
                <div className="nm">{m.label}</div>
                <div className="bars">
                  <div className="bar">
                    <div className="fill us" style={{ width: `${m.ousPct}%` }} />
                    <div className="lbl" style={{ position: 'absolute', right: 6, top: -2, fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--ink)' }}>
                      {m.ours}
                    </div>
                  </div>
                  <div className="bar">
                    <div className="fill base" style={{ width: `${m.basePct}%` }} />
                    <div className="lbl" style={{ position: 'absolute', right: 6, top: -2, fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--ink)' }}>
                      {m.base}
                    </div>
                  </div>
                </div>
                <div className="delta">{m.delta}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </section>
  )
}
