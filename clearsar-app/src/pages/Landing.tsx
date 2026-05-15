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
            <button className="btn">Request Briefing</button>
            <button className="btn ghost">Watch 60s Demo</button>
          </div>
          <div className="landing-metrics">
            <div className="m">
              <div className="v"><em>22.4</em> dB</div>
              <div className="lbl">PSNR · test</div>
            </div>
            <div className="m">
              <div className="v">0.63</div>
              <div className="lbl">SSIM</div>
            </div>
            <div className="m">
              <div className="v">&lt;40s</div>
              <div className="lbl">latency</div>
            </div>
            <div className="m">
              <div className="v">180k</div>
              <div className="lbl">train pairs</div>
            </div>
          </div>
        </div>

        <div className="landing-right">
          <RadarSVG />
          <div className="radar-tags">
            <div className="t" style={{ left: '32%', top: '30%' }}>AOI · vessel 12m</div>
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
              <p>Fine-tuned Latent Diffusion (SD v1.5) converts raw radar backscatter to analysis-ready optical imagery in under 30 seconds.</p>
            </div>
            <div className="cap">
              <div className="lbl hi">// Describe</div>
              <h3>Automated captions</h3>
              <p>BLIP-2 vision-language model generates natural-language scene descriptions so non-experts can act on intelligence.</p>
            </div>
            <div className="cap">
              <div className="lbl hi">// Measure</div>
              <h3>Quantified quality</h3>
              <p>PSNR, SSIM, LPIPS, FID — every translation is scored against ground truth and compared to Pix2Pix baseline.</p>
            </div>
            <div className="cap">
              <div className="lbl hi">// Deploy</div>
              <h3>Production web</h3>
              <p>React + FastAPI, containerized, GPU-accelerated. Drag, drop, download — or integrate via REST.</p>
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
              <p>GeoTIFF upload, validate format, projection, polarization.</p>
              <span className="mono">~1.2 s</span>
            </div>
            <div className="pstep">
              <div className="pn">02</div>
              <h4>Encode</h4>
              <p>Convert to dB, normalize, tile to 256². VAE latent encoding.</p>
              <span className="mono">~0.4 s</span>
            </div>
            <div className="pstep">
              <div className="pn">03</div>
              <h4>Denoise</h4>
              <p>50-step latent diffusion guided by SAR conditioning.</p>
              <span className="mono">~25 s</span>
            </div>
            <div className="pstep">
              <div className="pn">04</div>
              <h4>Decode</h4>
              <p>VAE decoder reconstructs RGB. Color-grade pass.</p>
              <span className="mono">~0.3 s</span>
            </div>
            <div className="pstep">
              <div className="pn">05</div>
              <h4>Caption</h4>
              <p>BLIP-2 generates 10-50 word scene description with tags.</p>
              <span className="mono">~5 s</span>
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
              <div className="pv">22.4 <small>dB</small></div>
              <div className="pd">vs 18.7 Pix2Pix · <b>+3.7</b></div>
            </div>
            <div className="perf">
              <div className="lbl">SSIM ↑</div>
              <div className="pv">0.63</div>
              <div className="pd">vs 0.51 Pix2Pix · <b>+0.12</b></div>
            </div>
            <div className="perf">
              <div className="lbl">LPIPS ↓</div>
              <div className="pv">0.21</div>
              <div className="pd">vs 0.32 Pix2Pix · <b>−0.11</b></div>
            </div>
            <div className="perf">
              <div className="lbl">FID ↓</div>
              <div className="pv">31.2</div>
              <div className="pd">vs 64.1 Pix2Pix · <b>−32.9</b></div>
            </div>
          </div>
          <p className="perf-note">
            Evaluated on 2,040-scene holdout from SEN12MS · Sentinel-1 VV+VH · trained on 150K paired patches.
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
              Upload your first SAR scene and receive an analyzed, captioned optical
              translation in under 40 seconds.
            </p>
            <div className="actions">
              <button className="btn primary" onClick={() => onNavigate('upload')}>
                Launch Console →
              </button>
              <button className="btn ghost">Contact the team</button>
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
