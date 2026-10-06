import { PageId } from '../types'
import {
  HEADLINE, BRIDGE, BY_SEASON, BY_TERRAIN, MODEL_HISTORY, REGRESSOR_LINEAGE, SOTA_REF, Scores,
  MODEL_NAME, MODEL_LABEL, MODEL_SUMMARY, RESULTS_URL, MODEL_URL, TRAIN_STEPS, UNET_PASSES, FIXED_TIMESTEP,
} from '../evalResults'

interface Props {
  onNavigate: (page: PageId) => void
}

const sign = (n: number, d: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(d)}`

// Two stacked bars per row: PSNR (accent) and SSIM (grey), scaled to the published reference.
function Rows({ rows }: { rows: { name: string; note?: string; s: Scores; current?: boolean }[] }) {
  return (
    <div className="bench-rows">
      {rows.map(r => (
        <div className="br" key={r.name}>
          <div className="nm" style={r.current ? { color: 'var(--accent)' } : undefined}>
            {r.name}
            {r.note && <div className="eval-note">{r.note}</div>}
          </div>
          <div className="bars">
            <div className="bar"><div className="fill us" style={{ width: `${(r.s.psnr / SOTA_REF.psnr) * 100}%` }} /></div>
            <div className="bar"><div className="fill base" style={{ width: `${(r.s.ssim / SOTA_REF.ssim) * 100}%` }} /></div>
          </div>
          <div className="delta eval-val">
            {r.s.psnr.toFixed(2)} dB
            <span>{r.s.ssim.toFixed(3)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

const Legend = () => (
  <div className="chart-legend">
    <div className="l"><span className="sw" style={{ background: 'var(--accent)' }} />PSNR (dB) ↑</div>
    <div className="l"><span className="sw" style={{ background: 'var(--ink-3)' }} />SSIM ↑</div>
  </div>
)

// metric, higher-is-better, decimals, unit
const COMPARE: [keyof Scores, string, boolean, number, string][] = [
  ['psnr', 'PSNR', true, 2, ' dB'],
  ['ssim', 'SSIM', true, 3, ''],
  ['cc', 'CC', true, 3, ''],
  ['sam', 'SAM', false, 2, '°'],
  ['lpips', 'LPIPS', false, 3, ''],
  ['fid', 'FID', false, 1, ''],
]

export default function Evaluation({ onNavigate }: Props) {
  return (
    <section className="page on" id="p-admin">
      <div className="ph">
        <div>
          <h1>{MODEL_LABEL} · model evaluation</h1>
          <p>{MODEL_SUMMARY}. Scored on the held-out test set against the real optical images, alongside the bridge model on the same set.</p>
        </div>
        <div className="ph-aside">
          <span className="chip ok"><span className="d" />DEPLOYED</span>
          <a className="btn ghost" href={RESULTS_URL} target="_blank" rel="noreferrer">eval results ↗</a>
          <button className="btn primary" onClick={() => onNavigate('docs')}>Scene reports →</button>
        </div>
      </div>

      <div className="admin-head">
        <a className="model-sel" href={MODEL_URL} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
          <span className="lbl">ACTIVE</span>
          <b>{MODEL_NAME}</b>
          <span style={{ color: 'var(--ink-3)' }}>↗</span>
        </a>
        <span className="chip">{UNET_PASSES} UNET PASS · t = {FIXED_TIMESTEP}</span>
        <span className="chip">TRAIN · {TRAIN_STEPS / 1000}K STEPS</span>
        <span className="chip">16-CH LATENT · TUNED DECODER</span>
        <span className="chip hi">DETERMINISTIC</span>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="lbl">PSNR ↑</div>
          <div className="v"><em>{HEADLINE.psnr.toFixed(2)}</em> <small className="eval-unit">dB</small></div>
          <div className="d">▲ {sign(HEADLINE.psnr - BRIDGE.psnr, 2)} dB vs bridge</div>
        </div>
        <div className="kpi">
          <div className="lbl">SSIM ↑</div>
          <div className="v">{HEADLINE.ssim.toFixed(3)}</div>
          <div className="d">▲ {sign(HEADLINE.ssim - BRIDGE.ssim, 3)} vs bridge</div>
        </div>
        <div className="kpi">
          <div className="lbl">LPIPS ↓</div>
          <div className="v">{HEADLINE.lpips.toFixed(3)}</div>
          <div className="d" style={{ color: 'var(--warn)' }}>{sign(HEADLINE.lpips - BRIDGE.lpips, 3)} vs bridge</div>
        </div>
        <div className="kpi">
          <div className="lbl">FID ↓</div>
          <div className="v">{HEADLINE.fid!.toFixed(1)}</div>
          <div className="d" style={{ color: 'var(--warn)' }}>{sign(HEADLINE.fid! - BRIDGE.fid!, 1)} vs bridge</div>
        </div>
      </div>

      <div className="admin-grid eval-grid">
        <div className="chart-card">
          <h4>{MODEL_LABEL} vs bridge · same test set</h4>
          <table className="eval-table">
            <thead><tr><th>Metric</th><th>{MODEL_LABEL}</th><th>Bridge (15 steps)</th><th>Δ</th></tr></thead>
            <tbody>
              {COMPARE.map(([k, name, higher, d, unit]) => {
                const a = HEADLINE[k] as number, b = BRIDGE[k] as number
                const better = higher ? a > b : a < b
                return (
                  <tr key={k}>
                    <td>{name} {higher ? '↑' : '↓'}</td>
                    <td className={better ? 'eval-win' : ''}>{a.toFixed(d)}{unit}</td>
                    <td className={!better ? 'eval-win' : ''}>{b.toFixed(d)}{unit}</td>
                    <td style={{ color: better ? 'var(--accent-2)' : 'var(--warn)' }}>{sign(a - b, d)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="eval-foot">
            Green marks the better model per metric. The regressor wins every pixel- and colour-fidelity metric
            (PSNR, SSIM, CC, SAM); the bridge wins the perceptual ones (LPIPS, FID).
          </p>
        </div>

        <div className="chart-card">
          <h4>Regressor training lineage</h4>
          <table className="eval-table">
            <thead><tr><th>Version</th><th>Steps</th><th>PSNR ↑</th><th>SSIM ↑</th></tr></thead>
            <tbody>
              {REGRESSOR_LINEAGE.map(r => (
                <tr key={r.name} className={r.name === 'v3' ? 'on' : ''}>
                  <td>{r.name}{r.name === 'v3' && <span className="eval-tag">deployed</span>}
                    <div className="eval-note">{r.note}</div></td>
                  <td>{r.steps / 1000}k</td>
                  <td>{r.s.psnr.toFixed(2)}</td>
                  <td>{r.s.ssim.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="eval-foot">Validation scores logged at the end of each run; each version is fine-tuned from the previous one.</p>
        </div>
      </div>

      <div className="admin-grid eval-grid two">
        <div className="chart-card">
          <h4>By season · {MODEL_LABEL}</h4>
          <Legend />
          <Rows rows={BY_SEASON.map(r => ({ name: r.name, note: `bridge ${r.b.psnr.toFixed(2)} dB`, s: r.s }))} />
        </div>
        <div className="chart-card">
          <h4>By terrain · {MODEL_LABEL}</h4>
          <Legend />
          <Rows rows={BY_TERRAIN.map(r => ({ name: r.name, note: `bridge ${r.b.psnr.toFixed(2)} dB`, s: r.s }))} />
        </div>
      </div>

      <div className="admin-grid eval-grid">
        <div className="chart-card">
          <h4>Progress across approaches</h4>
          <Legend />
          <Rows rows={[...MODEL_HISTORY, { name: 'Reference', note: 'colour-supervised diffusion (published)', s: SOTA_REF }]} />
          <p className="eval-foot">Phase A and ResShift scores come from the training notebook; bridge and regressor from the shared test-set evaluation. Bars are scaled to the published reference.</p>
        </div>
        <div className="chart-card eval-reading">
          <h4>Reading these numbers</h4>
          <p>
            SAR records surface roughness and geometry, not colour, so SAR-to-optical translation is under-determined
            and pixel metrics stay modest even for strong models. The deployed regressor predicts the optical latent in
            a single deterministic pass. That makes it the most accurate model per pixel and in colour
            ({sign(HEADLINE.psnr - BRIDGE.psnr, 2)} dB PSNR, {sign(HEADLINE.ssim - BRIDGE.ssim, 3)} SSIM over the bridge),
            fast, and repeatable: the same scene always gives the same image.
          </p>
          <p>
            The cost is texture. A regressor predicts the average of plausible images, so fine detail is smoother,
            which is why LPIPS and FID favour the 15-step bridge. For decision support, where geometry and colour
            fidelity matter more than photographic texture, the regressor is the better default; the bridge is still
            available on the backend (MODEL_DIR=bridge_final). These scores describe the model in general; an uploaded
            scene has no ground-truth optical image.
          </p>
        </div>
      </div>
    </section>
  )
}
