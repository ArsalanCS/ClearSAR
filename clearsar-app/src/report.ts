// Client-side PDF report for one translated + described scene. Built in the browser so it
// works against both the local backend and the Colab server without extra server deps.
import type { jsPDF } from 'jspdf'
import {
  apiUrl, getDescription, getResult, JobResult, SceneDescription, PURPOSE_LABELS, Confidence, modelSummary,
} from './api'

export interface ReportData {
  result: JobResult
  desc: SceneDescription | null
  sarImg: string       // data URLs
  optImg: string
}

// ---------------------------------------------------------------- data
// The model works at 256 px; PDF viewers would render that blocky at ~85 mm, so upsample
// smoothly to print resolution before embedding.
const PRINT_PX = 768

async function toDataUrl(url: string): Promise<string> {
  // no-store: the same URL is usually already cached from an <img> tag, and that cached
  // response was fetched without CORS headers, so Chrome would block reusing it here.
  const res = await fetch(url, { cache: 'no-store', mode: 'cors' })
  if (!res.ok) throw new Error(`Image request failed (${res.status})`)
  const bmp = await createImageBitmap(await res.blob())
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = PRINT_PX
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, PRINT_PX, PRINT_PX)
  return canvas.toDataURL('image/jpeg', 0.92)
}

export async function loadReportData(jobId: string): Promise<ReportData> {
  const result = await getResult(jobId)
  const [desc, sarImg, optImg] = await Promise.all([
    getDescription(jobId).catch(() => null),   // older servers have no description endpoint
    toDataUrl(apiUrl(result.sar_url)),
    toDataUrl(apiUrl(result.optical_url)),
  ])
  return { result, desc, sarImg, optImg }
}

export const reportId = (jobId: string) => `CSR-${jobId.slice(0, 8).toUpperCase()}`
export const reportFilename = (r: JobResult) =>
  `ClearSAR_report_${r.filename.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_')}_${r.job_id.slice(0, 8)}.pdf`

// ---------------------------------------------------------------- style
const C = {
  ink: '#111827', ink2: '#374151', mute: '#6B7280', line: '#D9DEE5', soft: '#F4F6F9',
  band: '#0B1220', accent: '#FF6A2C', high: '#0E9F87', medium: '#B7791F', low: '#D64550',
  warnBg: '#FFF8E6', warn: '#D69E2E',
}
const TAG: Record<Confidence, string> = { high: C.high, medium: C.medium, low: C.low }
const PAGE_W = 210, PAGE_H = 297, M = 16, CW = PAGE_W - 2 * M, FOOT = 284
const PT = 0.3528   // mm per pt

// Standard PDF fonts are WinAnsi-encoded; map common Unicode the VLM may emit and drop the rest.
const UNI: Record<string, string> = {
  '→': '->', '←': '<-', '↔': '<->', '≈': '~', '≤': '<=', '≥': '>=', '↑': '', '↓': '', '−': '-',
  '‑': '-', '∼': '~', '✓': '', '\u00A0': ' ', '\u202F': ' ', '\u2009': ' ',
}
const CP1252 = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')
function clean(s: string | null | undefined): string {
  if (!s) return ''
  let out = ''
  for (const ch of s) {
    const m = UNI[ch]
    if (m !== undefined) out += m
    else if (ch.charCodeAt(0) < 256 || CP1252.has(ch)) out += ch
  }
  return out
}

const fmtDate = (iso: string | Date) => {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return isNaN(d.getTime()) ? String(iso)
    : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
const cap = (s?: string | null) => (s ? s[0].toUpperCase() + s.slice(1) : '—')

// ---------------------------------------------------------------- builder
class Writer {
  y = M
  constructor(public doc: jsPDF) {}

  ensure(h: number) {
    if (this.y + h > FOOT - 4) { this.doc.addPage(); this.y = M + 4 }
  }

  font(size: number, style: 'normal' | 'bold' | 'italic' = 'normal', color = C.ink, family = 'helvetica') {
    this.doc.setFont(family, style); this.doc.setFontSize(size); this.doc.setTextColor(color)
  }

  heading(num: string, title: string) {
    this.ensure(16)
    this.y += 4
    this.font(8, 'bold', C.accent); this.doc.text(num, M, this.y)
    this.font(11.5, 'bold', C.ink); this.doc.text(title, M + 8, this.y)
    this.y += 2.5
    this.doc.setDrawColor(C.line); this.doc.setLineWidth(0.3); this.doc.line(M, this.y, M + CW, this.y)
    this.y += 6
  }

  // wrapped paragraph; returns height used
  para(text: string, size = 9.5, color = C.ink2, width = CW, x = M, lead = 1.45) {
    this.font(size, 'normal', color)
    const lines = this.doc.splitTextToSize(clean(text), width) as string[]
    const lh = size * PT * lead
    for (const ln of lines) { this.ensure(lh); this.doc.text(ln, x, this.y); this.y += lh }
    return lines.length * lh
  }

  // inline flow of words with confidence pills
  claims(items: { text: string; confidence: Confidence | null }[], size = 10.5) {
    const doc = this.doc
    const lh = size * PT * 1.65
    let x = M
    this.ensure(lh)
    const advance = () => { x = M; this.y += lh; this.ensure(lh) }
    for (const it of items) {
      this.font(size, 'normal', C.ink)
      for (const w of clean(it.text).split(/\s+/).filter(Boolean)) {
        const ww = doc.getTextWidth(w + ' ')
        if (x + ww - doc.getTextWidth(' ') > M + CW) advance()
        this.font(size, 'normal', C.ink)
        doc.text(w, x, this.y); x += ww
      }
      if (it.confidence) {
        const label = it.confidence.toUpperCase()
        this.font(6.3, 'bold', TAG[it.confidence])
        const pw = doc.getTextWidth(label) + 3.2, ph = 3.9
        if (x + pw > M + CW) advance()
        doc.setDrawColor(TAG[it.confidence]); doc.setLineWidth(0.3)
        doc.roundedRect(x, this.y - ph + 0.8, pw, ph, 0.6, 0.6, 'S')
        doc.text(label, x + 1.6, this.y - 0.35)
        x += pw + 2
      }
    }
    this.y += lh * 0.35 + 3
  }
}

function header(w: Writer, data: ReportData) {
  const { doc } = w
  const { result } = data
  doc.setFillColor(C.band); doc.rect(0, 0, PAGE_W, 27, 'F')
  doc.setFillColor(C.accent); doc.rect(0, 27, PAGE_W, 0.9, 'F')
  // brand mark
  doc.setDrawColor(C.accent); doc.setLineWidth(0.45)
  doc.circle(M + 4.5, 13.5, 4.5, 'S'); doc.circle(M + 4.5, 13.5, 2.2, 'S')
  doc.setFillColor(C.accent); doc.circle(M + 4.5, 13.5, 0.7, 'F')
  w.font(15, 'bold', '#FFFFFF'); doc.text('ClearSAR', M + 12, 14.6)
  w.font(6.8, 'bold', C.accent); doc.text('SAR-TO-OPTICAL SCENE REPORT', M + 12.2, 19.6, { charSpace: 0.45 })
  w.font(6.8, 'bold', '#9AA4B2'); doc.text('REPORT NO.', PAGE_W - M, 11, { align: 'right', charSpace: 0.35 })
  w.font(10.5, 'bold', '#FFFFFF'); doc.text(reportId(result.job_id), PAGE_W - M, 16.2, { align: 'right' })
  w.font(7.5, 'normal', '#9AA4B2'); doc.text(`Issued ${fmtDate(new Date())}`, PAGE_W - M, 20.8, { align: 'right' })

  w.y = 39
  w.font(16, 'bold', C.ink)
  const title = doc.splitTextToSize(clean(result.filename), CW)[0] as string
  doc.text(title, M, w.y)
  w.y += 5.5
  w.font(9, 'normal', C.mute)
  doc.text('Synthetic-aperture radar scene translated to an optical estimate and described automatically.', M, w.y)
  w.y += 6
}

function details(w: Writer, data: ReportData) {
  const { doc } = w
  const { result, desc } = data
  const engine = !desc || desc.status === 'off' ? 'Not generated'
    : desc.engine === 'vlm' ? (desc.vlm ?? 'Vision-language model')
    : desc.engine === 'facts' ? 'Measured SAR statistics (no VLM)' : cap(desc.status)
  const rows: [string, string, string, string][] = [
    ['Scene ID', result.job_id, 'Processed', fmtDate(result.created_at)],
    ['Season / terrain', `${cap(result.season)} / ${cap(result.terrain)}`, 'Description type',
      PURPOSE_LABELS[(desc?.purpose ?? result.purpose) || 'general'] ?? '—'],
    ['Translation model', `${modelSummary(result)} · ${result.img_size}x${result.img_size} px`,
      'Description engine', engine],
    ['Translation time', result.elapsed_s != null ? `${result.elapsed_s} s` : '—',
      'Description time', desc?.elapsed_s != null ? `${desc.elapsed_s} s` : '—'],
  ]
  const rh = 10.5, colW = CW / 2
  doc.setFillColor(C.soft); doc.rect(M, w.y, CW, rh * rows.length, 'F')
  doc.setDrawColor(C.line); doc.setLineWidth(0.25)
  doc.rect(M, w.y, CW, rh * rows.length, 'S')
  doc.line(M + colW, w.y, M + colW, w.y + rh * rows.length)
  rows.forEach((r, i) => {
    const top = w.y + i * rh
    if (i) doc.line(M, top, M + CW, top)
    for (const k of [0, 1]) {
      const x = M + k * colW + 3.5
      w.font(6.3, 'bold', C.mute); doc.text(r[k * 2].toUpperCase(), x, top + 4, { charSpace: 0.3 })
      w.font(8.8, 'normal', C.ink)
      doc.text(doc.splitTextToSize(clean(r[k * 2 + 1]), colW - 7)[0] as string, x, top + 8.4)
    }
  })
  w.y += rh * rows.length + 2
}

function imagery(w: Writer, data: ReportData) {
  const { doc } = w
  w.heading('01', 'Imagery')
  const gap = 8, s = (CW - gap) / 2
  w.ensure(s + 14)
  const items: [string, string, string][] = [
    [data.sarImg, 'SAR INPUT', '(a) Input: Sentinel-1 SAR backscatter (grayscale)'],
    [data.optImg, 'OPTICAL OUTPUT', '(b) Output: translated optical estimate (synthetic)'],
  ]
  items.forEach(([img, tag, caption], i) => {
    const x = M + i * (s + gap)
    doc.addImage(img, 'JPEG', x, w.y, s, s)
    doc.setDrawColor(C.line); doc.setLineWidth(0.3); doc.rect(x, w.y, s, s, 'S')
    w.font(6.3, 'bold', '#FFFFFF')
    const tw = doc.getTextWidth(tag) + 0.3 * (tag.length - 1) + 4.5
    doc.setFillColor(i ? C.accent : C.band); doc.rect(x + 2.5, w.y + 2.5, tw, 4.8, 'F')
    doc.text(tag, x + 4.7, w.y + 5.8, { charSpace: 0.3 })
    w.font(8, 'normal', C.mute); doc.text(caption, x, w.y + s + 4.6)
  })
  w.y += s + 9
}

function description(w: Writer, data: ReportData) {
  const { doc } = w
  const { desc } = data
  w.heading('02', 'Scene description')
  if (!desc || desc.status !== 'completed') {
    const why = !desc ? 'This server does not provide scene descriptions.'
      : desc.status === 'failed' ? `Description failed: ${desc.error ?? 'unknown error'}.`
      : desc.status === 'off' ? 'Scene description is disabled on this server.'
      : 'The description was still being generated when this report was issued. Download the report again once it completes.'
    w.para(why, 9.5, C.mute)
    return
  }

  const summary = desc.sections.filter(s => s.name !== 'Reliability')
  for (const sec of summary) {
    if (summary.length > 1) { w.ensure(8); w.font(7, 'bold', C.mute); doc.text(sec.name.toUpperCase(), M, w.y, { charSpace: 0.35 }); w.y += 5 }
    w.claims(sec.claims)
  }

  // confidence legend
  w.y += 2.5
  w.ensure(8)
  let x = M
  w.font(7.2, 'bold', C.mute); doc.text('CLAIM CONFIDENCE', x, w.y, { charSpace: 0.3 }); x += doc.getTextWidth('CLAIM CONFIDENCE') + 6
  for (const k of ['high', 'medium', 'low'] as Confidence[]) {
    doc.setFillColor(TAG[k]); doc.rect(x, w.y - 2.4, 2.6, 2.6, 'F')
    w.font(8, 'normal', C.ink2); const t = `${desc.confidence[k] ?? 0} ${k}`; doc.text(t, x + 4, w.y)
    x += doc.getTextWidth(t) + 10
  }
  w.y += 6

  if (desc.reliability) {
    w.font(9.2, 'normal', C.ink2)
    const lines = doc.splitTextToSize(clean(desc.reliability), CW - 12) as string[]
    const h = 9 + lines.length * 9.2 * PT * 1.45
    w.ensure(h + 2)
    doc.setFillColor(C.warnBg); doc.rect(M, w.y, CW, h, 'F')
    doc.setFillColor(C.warn); doc.rect(M, w.y, 1.2, h, 'F')
    w.font(7, 'bold', C.warn); doc.text('RELIABILITY', M + 5.5, w.y + 5, { charSpace: 0.35 })
    w.font(9.2, 'normal', C.ink2)
    lines.forEach((ln, i) => doc.text(ln, M + 5.5, w.y + 9.6 + i * 9.2 * PT * 1.45))
    w.y += h + 4
  }
  if (desc.engine === 'facts' && desc.fallback_reason) {
    w.para('The vision-language model was unavailable, so this description was written from measured SAR statistics only.', 8, C.mute)
  }
  if (desc.truncated) w.para('The model reached its length limit; the last sentence may be incomplete.', 8, C.mute)
}

function facts(w: Writer, data: ReportData) {
  const { doc } = w
  const f = data.desc?.status === 'completed' ? data.desc.sar_facts : null
  if (!f) return
  const size = 7.4, lh = size * PT * 1.5
  w.font(size, 'normal', C.ink2, 'courier')
  const lines = clean(f).split('\n').flatMap(l => doc.splitTextToSize(l, CW - 8) as string[])
  const boxH = lines.length * lh + 6
  // heading + intro (~24 mm) + box stay together
  if (w.y + 24 + boxH > FOOT - 4) { doc.addPage(); w.y = M }
  w.heading('03', 'Measured SAR facts')
  w.para('Statistics computed from the despeckled SAR pixels and given to the description model. ' +
    'Levels are relative to this scene; region names follow a 3x3 grid.', 8.5, C.mute)
  w.y += 1.5
  doc.setFillColor(C.soft); doc.setDrawColor(C.line); doc.setLineWidth(0.25)
  doc.rect(M, w.y, CW, boxH, 'FD')
  w.font(size, 'normal', C.ink2, 'courier')
  lines.forEach((ln, i) => doc.text(ln, M + 4, w.y + 4.5 + i * lh))
  w.y += boxH + 3
}

const METHOD_TEXT: Record<string, (steps: number | null) => string> = {
  regressor: () => 'a deterministic one-step regressor on an adapted 16-channel Stable Diffusion 1.5 latent, ' +
    'distilled from the Schrödinger bridge, with a fine-tuned decoder and CLIP season/terrain conditioning. ' +
    'It predicts the optical image in a single UNet pass, so the same scene always gives the same result',
  bridge: steps => `an Image-to-Image Schrödinger Bridge on an adapted 16-channel Stable Diffusion 1.5 latent ` +
    `with CLIP season/terrain conditioning, sampled in ${steps ?? 15} steps`,
  mock: () => 'a placeholder generator used for interface testing (no trained model)',
}

function model(w: Writer, data: ReportData) {
  const { doc } = w
  const { result } = data
  const info = result.model
  w.heading(data.desc?.sar_facts ? '04' : '03', 'Model and evaluation')
  const how = info?.method && METHOD_TEXT[info.method] ? METHOD_TEXT[info.method](info.steps) : 'a latent SAR-to-optical model'
  w.para(`Translation: ${info?.name ?? 'SAR-to-optical model'}, ${how}. ` +
    'Description: a vision-language model reads the despeckled SAR, the translated image and the measured SAR facts, ' +
    'and tags each claim high, medium or low confidence.', 9, C.ink2)
  w.y += 2
  const m = result.metrics
  const f = (v: number | null | undefined, d: number, unit = '') => (v == null ? '—' : `${v.toFixed(d)}${unit}`)
  const cells: [string, string, string][] = [
    ['PSNR', f(m.psnr, 2, ' dB'), 'higher is better'],
    ['SSIM', f(m.ssim, 3), 'higher is better'],
    ['LPIPS', f(m.lpips, 3), 'lower is better'],
    ['FID', f(info?.fid, 1), 'lower is better'],
  ]
  const cw = CW / 4, h = 16
  w.ensure(h + 12)
  doc.setDrawColor(C.line); doc.setLineWidth(0.25); doc.setFillColor(C.soft)
  doc.rect(M, w.y, CW, h, 'FD')
  cells.forEach(([k, v, hint], i) => {
    const x = M + i * cw
    if (i) doc.line(x, w.y, x, w.y + h)
    w.font(6.5, 'bold', C.mute); doc.text(k, x + 4, w.y + 4.6, { charSpace: 0.3 })
    w.font(12.5, 'bold', C.ink); doc.text(v, x + 4, w.y + 10.4)
    w.font(6.5, 'normal', C.mute); doc.text(hint, x + 4, w.y + 14)
  })
  w.y += h + 4
  w.para(`Dataset-level scores of the deployed model on the held-out test set at 256 px` +
    (info?.repo ? ` (huggingface.co/${info.repo})` : '') +
    '. They are not a score for this scene: a live upload has no ground-truth optical image.', 8, C.mute)
}

function limitations(w: Writer) {
  const { doc } = w
  const text = 'This report is a preliminary decision-support aid on partly synthetic imagery, not verified ground truth. ' +
    'The optical image is generated by a neural network from radar data; its colours and fine textures are estimates. ' +
    'At 10 m per pixel, objects smaller than about 30 m (individual buildings, vehicles, people) are not resolvable. ' +
    'Confirm any finding against independent sources before acting on it.'
  w.font(8.2, 'normal', C.ink2)
  const lines = doc.splitTextToSize(text, CW - 10) as string[]
  const h = 10 + lines.length * 8.2 * PT * 1.45
  w.ensure(h + 6); w.y += 3
  doc.setDrawColor(C.line); doc.setLineWidth(0.3); doc.rect(M, w.y, CW, h, 'S')
  w.font(7, 'bold', C.ink); doc.text('LIMITATIONS AND INTENDED USE', M + 5, w.y + 5.4, { charSpace: 0.35 })
  w.font(8.2, 'normal', C.ink2)
  lines.forEach((ln, i) => doc.text(ln, M + 5, w.y + 10 + i * 8.2 * PT * 1.45))
  w.y += h
}

function footers(w: Writer, data: ReportData) {
  const { doc } = w
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setDrawColor(C.line); doc.setLineWidth(0.3); doc.line(M, FOOT + 2, PAGE_W - M, FOOT + 2)
    w.font(7, 'normal', C.mute)
    doc.text(`ClearSAR · ${reportId(data.result.job_id)} · ${clean(data.result.filename)}`, M, FOOT + 6.5)
    doc.text(`Page ${i} of ${n}`, PAGE_W - M, FOOT + 6.5, { align: 'right' })
  }
}

export async function buildReportPdf(data: ReportData): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  doc.setProperties({
    title: `ClearSAR scene report ${reportId(data.result.job_id)}`,
    subject: 'SAR-to-optical translation and scene description',
    author: 'ClearSAR', creator: 'ClearSAR',
  })
  const w = new Writer(doc)
  header(w, data)
  details(w, data)
  imagery(w, data)
  description(w, data)
  facts(w, data)
  model(w, data)
  limitations(w)
  footers(w, data)
  return doc.output('blob')
}

export async function downloadReport(jobId: string): Promise<void> {
  const data = await loadReportData(jobId)
  const blob = await buildReportPdf(data)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = reportFilename(data.result)
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
