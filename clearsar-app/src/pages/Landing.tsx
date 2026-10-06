import { PageId } from '../types'
import RadarSVG from '../components/ui/RadarSVG'

interface Props {
  onNavigate: (page: PageId) => void
}

export default function Landing({ onNavigate }: Props) {
  return (
    <section className="page on landing-section" id="p-landing">
      {/* Landing nav */}
      <header className="lnav">
        <div className="lnav-brand">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#ff6a2c" strokeWidth="1.2"/>
            <circle cx="12" cy="12" r="5" stroke="#ff6a2c" strokeWidth="1.2"/>
            <circle cx="12" cy="12" r="1.5" fill="#ff6a2c"/>
            <line x1="2" y1="12" x2="22" y2="12" stroke="#ff6a2c" strokeWidth=".6" strokeDasharray="1 2"/>
            <line x1="12" y1="2" x2="12" y2="22" stroke="#ff6a2c" strokeWidth=".6" strokeDasharray="1 2"/>
          </svg>
          <b>ClearSAR</b>
        </div>
        <nav className="lnav-links">
          <a href="#capability">Capability</a>
          <a href="#use-cases">Use cases</a>
          <a href="#pipeline">Pipeline</a>
          <a href="#metrics">Performance</a>
          <a href="#team">Team</a>
        </nav>
        <div className="lnav-actions">
          <button className="btn primary" onClick={() => onNavigate('upload')}>
            Launch Console →
          </button>
        </div>
      </header>

      {/* Hero */}
      <div className="landing">
        <div className="landing-left">
          <div className="tag">
            <span className="pulse" />
            Capability brief · 2026 · defense &amp; intelligence
          </div>
          <h1>
            See the ground truth.{' '}
            <em>In any weather.<br/>Any time.</em>
          </h1>
          <p>
            ClearSAR translates raw Synthetic Aperture Radar into analysis-ready optical imagery
            with automated scene description — so operators, analysts, and disaster teams
            don&rsquo;t wait for clear skies to make decisions.
          </p>
          <div className="actions">
            <button className="btn primary" onClick={() => onNavigate('upload')}>
              Launch Console
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
            </button>
            <button className="btn" onClick={() => onNavigate('docs')}>Sample reports</button>
            <button className="btn ghost" onClick={() => onNavigate('admin')}>Model evaluation</button>
          </div>
          <div className="landing-metrics">
            <div className="m">
              <div className="v"><em>18.3</em> dB</div>
              <div className="lbl">PSNR · test</div>
            </div>
            <div className="m">
              <div className="v">0.306</div>
              <div className="lbl">SSIM</div>
            </div>
            <div className="m">
              <div className="v">~10s</div>
              <div className="lbl">image + summary</div>
            </div>
            <div className="m">
              <div className="v">1</div>
              <div className="lbl">UNet pass</div>
            </div>
          </div>
        </div>

        <div className="landing-right">
          <RadarSVG />
          <div className="radar-tags">
            <div className="t" style={{ left: '32%', top: '30%' }}>AOI · water body</div>
            <div className="t" style={{ right: '18%', top: '37%' }}>structure · concrete</div>
            <div className="t" style={{ left: '30%', bottom: '30%' }}>vegetation dense</div>
          </div>
        </div>
      </div>

      {/* Capability */}
      <section className="cap-strip" id="capability">
        <div className="cap-strip-inner">
          <div className="cs-head">
            <div className="num">§ 01 / CAPABILITY</div>
            <h2>All-weather. All-light. Any orbit.</h2>
          </div>
          <div className="cap-cards">
            <div className="cap">
              <div className="lbl hi">// Translate</div>
              <h3>SAR → Optical</h3>
              <p>A one-step regressor, distilled from a Schrödinger bridge on an adapted 16-channel SD-1.5 latent, turns radar backscatter into an optical estimate in a single deterministic pass.</p>
            </div>
            <div className="cap">
              <div className="lbl hi">// Describe</div>
              <h3>Scene summaries</h3>
              <p>Qwen2.5-VL reads the SAR, the translation and measured radar statistics, then writes a short summary with a confidence tag on every claim.</p>
            </div>
            <div className="cap">
              <div className="lbl hi">// Measure</div>
              <h3>Quantified quality</h3>
              <p>PSNR, SSIM, LPIPS, FID, SAM and CC on a held-out test set, broken down by season and terrain and compared with the bridge and earlier approaches.</p>
            </div>
            <div className="cap">
              <div className="lbl hi">// Deploy</div>
              <h3>Reports</h3>
              <p>React + FastAPI on a GPU backend. Drag and drop a scene, then download a PDF report with both images and the description — or integrate via REST.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="cap-strip alt" id="use-cases">
        <div className="cap-strip-inner">
          <div className="cs-head">
            <div className="num">§ 02 / OPERATIONS</div>
            <h2>Designed for decisions that can&rsquo;t wait for clear skies.</h2>
          </div>
          <div className="uc-grid">
            <div className="uc">
              <div className="uc-icon">⌾</div>
              <h4>Defense &amp; Intelligence</h4>
              <p>Persistent surveillance through cloud, smoke, and night. Identify structures, vessels, and change events.</p>
            </div>
            <div className="uc">
              <div className="uc-icon">⌘</div>
              <h4>Disaster Response</h4>
              <p>Map flood extent, earthquake damage, and landslide scars in the critical first hours.</p>
            </div>
            <div className="uc">
              <div className="uc-icon">◉</div>
              <h4>Environmental Monitoring</h4>
              <p>Deforestation, mangrove loss, glacier retreat — quantified over time.</p>
            </div>
            <div className="uc">
              <div className="uc-icon">⌗</div>
              <h4>Urban Planning</h4>
              <p>Track unauthorized construction and infrastructure growth across sprawling cities.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="cap-strip" id="pipeline">
        <div className="cap-strip-inner">
          <div className="cs-head">
            <div className="num">§ 03 / PIPELINE</div>
            <h2>Five stages. One request.</h2>
          </div>
          <div className="pipe">
            <div className="pstep">
              <div className="pn">01</div>
              <h4>Ingest</h4>
              <p>Upload single-band SAR (TIFF, PNG or JPEG) and validate it.</p>
              <span className="mono">~1 s</span>
            </div>
            <div className="pstep">
              <div className="pn">02</div>
              <h4>Encode</h4>
              <p>Resize to 256², encode into the adapted 16-channel VAE latent.</p>
              <span className="mono">&lt;1 s</span>
            </div>
            <div className="pstep">
              <div className="pn">03</div>
              <h4>Translate</h4>
              <p>One deterministic UNet pass predicts the optical latent, guided by season and terrain text.</p>
              <span className="mono">&lt;1 s</span>
            </div>
            <div className="pstep">
              <div className="pn">04</div>
              <h4>Decode</h4>
              <p>The fine-tuned 16-channel VAE decoder reconstructs the optical RGB image.</p>
              <span className="mono">&lt;1 s</span>
            </div>
            <div className="pstep">
              <div className="pn">05</div>
              <h4>Describe</h4>
              <p>Qwen2.5-VL writes a confidence-tagged summary; the PDF report is ready.</p>
              <span className="mono">~8 s</span>
            </div>
          </div>
        </div>
      </section>

      {/* Performance */}
      <section className="cap-strip alt" id="metrics">
        <div className="cap-strip-inner">
          <div className="cs-head">
            <div className="num">§ 04 / PERFORMANCE</div>
            <h2>Measured against the state of the art.</h2>
          </div>
          <div className="perf-grid">
            <div className="perf">
              <div className="lbl">PSNR ↑</div>
              <div className="pv">18.32 <small>dB</small></div>
              <div className="pd">vs 16.69 bridge · <b>+1.64</b></div>
            </div>
            <div className="perf">
              <div className="lbl">SSIM ↑</div>
              <div className="pv">0.306</div>
              <div className="pd">vs 0.257 bridge · <b>+0.048</b></div>
            </div>
            <div className="perf">
              <div className="lbl">SAM ↓</div>
              <div className="pv">6.27<small>°</small></div>
              <div className="pd">vs 7.59° bridge · <b>−1.32°</b></div>
            </div>
            <div className="perf">
              <div className="lbl">LPIPS ↓</div>
              <div className="pv">0.823</div>
              <div className="pd">vs 0.768 bridge · <b style={{ color: 'var(--warn)' }}>+0.056</b></div>
            </div>
          </div>
          <p className="perf-note">
            Regressor v3 and the 15-step bridge on the same held-out test set at 256 px. The regressor is more faithful per pixel and in colour; the bridge keeps finer texture (LPIPS, FID). Full breakdown on the Evaluation page.
          </p>
        </div>
      </section>

      {/* Team / CTA */}
      <section className="cap-strip" id="team">
        <div className="cap-strip-inner cta-wrap">
          <div className="cta-section">
            <div className="num">§ 05 / ENGAGE</div>
            <h2>Ready when you need ground truth.</h2>
            <p>
              Upload your first SAR scene and get an optical translation, a scene
              summary and a downloadable PDF report in about 10 seconds.
            </p>
            <div className="actions">
              <button className="btn primary" onClick={() => onNavigate('upload')}>
                Launch Console →
              </button>
              <button className="btn ghost" onClick={() => onNavigate('docs')}>Read the docs</button>
            </div>
          </div>
          <div className="team-card">
            <div className="lbl hi">// FYP TEAM · 2026</div>
            <div className="tm">
              <div className="tm-av">AH</div>
              <div><b>Arsalan Hassan</b><small>22F-3050 · ML &amp; Backend</small></div>
            </div>
            <div className="tm">
              <div className="tm-av">KS</div>
              <div><b>Khizra Shehzadi</b><small>22F-3592 · Research &amp; Eval</small></div>
            </div>
            <div className="tm">
              <div className="tm-av">MH</div>
              <div><b>Muhammad Hashir</b><small>22F-3294 · Frontend &amp; UX</small></div>
            </div>
            <div className="tm adv">
              <div className="tm-av sup">UG</div>
              <div><b>Dr Usman Ghous</b><small>Supervisor · FAST-NUCES</small></div>
            </div>
          </div>
        </div>
      </section>

    </section>
  )
}
