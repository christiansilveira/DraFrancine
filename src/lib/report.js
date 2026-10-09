/**
 * Relatório clínico em PDF (no navegador, sem servidor) — mesmo desenho do relatório de exemplo:
 * cabeçalho com a logo, faixa colorida, cartão do paciente, História clínica, Exame físico,
 * Hipótese diagnóstica, Conduta, assinatura e rodapé com a página. Opcional: anexo com as respostas da ficha.
 */
import { jsPDF } from 'jspdf'
import { BRAND } from '../config/brand'
import { ageOf, answeredList, brDate } from './anamnese'
import { today } from './utils'

const AMBER = [245, 168, 0]
const AMBER_D = [168, 102, 0]
const RED = [217, 32, 43]
const INK = [40, 44, 54]
const MUTED = [112, 116, 128]
const LINE = [234, 228, 216]
const CARD = [255, 248, 233]
const MIST = [240, 242, 249]
const M = 18 // margem lateral (mm)

async function toDataUrl(url) {
  if (!url) return null
  if (url.startsWith('data:')) return url
  try {
    const blob = await (await fetch(url)).blob()
    return await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob) })
  } catch { return null }
}

const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t))
function gradientBar(doc, x, y, w, h) {
  const n = 60
  for (let i = 0; i < n; i++) { doc.setFillColor(...mix(AMBER, RED, i / (n - 1))); doc.rect(x + (w / n) * i, y, w / n + 0.2, h, 'F') }
}

/** linhas com o que a Dra. escreveu: uma por linha, sem marcadores repetidos */
const lines = (txt) => String(txt || '').split('\n').map((l) => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean)

export async function clinicReport({ client, ficha, cfg, appointment, includeAnswers = false, output = 'save' }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight()
  const rep = cfg.report || {}
  const ev = ficha.evaluation || {}
  const ans = ficha.answers || {}
  const logo = await toDataUrl(BRAND.logo) // JPEG com fundo branco: leve e igual no papel branco
  const BOTTOM = H - 26

  const chrome = () => {
    // marca d'água
    if (logo) { try { doc.saveGraphicsState(); doc.setGState(new doc.GState({ opacity: 0.06 })); doc.addImage(logo, 'JPEG', W - 92, H - 128, 104, 104, 'logo'); doc.restoreGraphicsState() } catch { /* sem transparência */ } }
    // cabeçalho
    if (logo) { try { doc.addImage(logo, 'JPEG', M, 9, 20, 20, 'logo') } catch { /* imagem inválida */ } }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13.5); doc.setTextColor(...INK)
    doc.text(String(rep.professional || BRAND.shopName).toUpperCase(), M + 24, 18)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6); doc.setTextColor(...MUTED)
    doc.text(doc.splitTextToSize(rep.specialty || '', 86), M + 24, 22.5)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...AMBER_D)
    doc.text(rep.title || 'Relatório Clínico', W - M, 20, { align: 'right' })
    gradientBar(doc, 0, 33, W, 1.6)
  }
  const footer = () => {
    const n = doc.getNumberOfPages()
    for (let i = 1; i <= n; i++) {
      doc.setPage(i)
      gradientBar(doc, 0, H - 11, W, 11)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(255, 255, 255)
      doc.text([rep.professional, rep.specialty].filter(Boolean).join(' · ').slice(0, 110), M, H - 4.4)
      doc.text(`Página ${i} de ${n}`, W - M, H - 4.4, { align: 'right' })
    }
  }

  let y = 44
  chrome()
  const ensure = (h) => { if (y + h > BOTTOM) { doc.addPage(); chrome(); y = 44 } }

  // ---------- cartão do paciente ----------
  const nasc = ans.nascimento
  const idade = ageOf(nasc)
  const consult = ev.date || appointment?.date || (ficha.createdAt || today()).slice(0, 10)
  const sexo = ans.sexo && ans.sexo !== 'Prefiro não informar' ? ans.sexo : ''
  const left = [['PACIENTE', client?.name || '—'], ['DATA DE NASCIMENTO', nasc ? `${brDate(nasc)}${idade !== null ? ` (${idade} anos)` : ''}` : '—'], ['CONVÊNIO', ans.convenio || 'Particular']]
  const right = [['SEXO', sexo || '—'], ['DATA DA CONSULTA', brDate(consult)]]
  const cardH = 38
  doc.setFillColor(...CARD); doc.roundedRect(M, y, W - 2 * M, cardH, 3, 3, 'F')
  doc.setFillColor(...AMBER); doc.roundedRect(M, y, 2.2, cardH, 1, 1, 'F')
  const field = (x, yy, [k, v], big) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2); doc.setTextColor(...AMBER_D); doc.text(k, x, yy)
    doc.setFont('helvetica', big ? 'bold' : 'normal'); doc.setFontSize(big ? 11 : 10); doc.setTextColor(...INK)
    doc.text(doc.splitTextToSize(String(v), 80)[0], x, yy + 4.6)
  }
  left.forEach((f, i) => field(M + 8, y + 7 + i * 11, f, i === 0))
  right.forEach((f, i) => field(W / 2 + 10, y + 12 + i * 11, f, false))
  y += cardH + 10

  // título junto com o começo do conteúdo (need = altura mínima que precisa vir logo abaixo)
  const section = (title, need = 10) => {
    ensure(8 + need)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...AMBER_D)
    doc.text(title, M, y)
    doc.setDrawColor(...INK); doc.setLineWidth(0.35); doc.line(M, y + 2.4, W - M, y + 2.4)
    y += 8
  }
  const rows = (list) => {
    const TX = M + 44; const TW = W - M - TX
    list.filter((r) => String(r.text || '').trim()).forEach((r) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.6)
      const tl = doc.splitTextToSize(String(r.text).trim(), TW)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
      const ll = doc.splitTextToSize(r.label, 38)
      const h = Math.max(tl.length * 4.6, ll.length * 4.2) + 3.4
      ensure(h + 1)
      doc.setFillColor(...AMBER); doc.circle(M + 1.6, y + 1.9, 1.1, 'F')
      doc.setTextColor(...AMBER_D); doc.text(ll, M + 5, y + 3)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.6); doc.setTextColor(...INK); doc.text(tl, TX, y + 3, { lineHeightFactor: 1.35 })
      y += h
      doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, y - 1.2, W - M, y - 1.2)
      y += 1.4
    })
    y += 4
  }
  const boxBlocks = (items) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(9.8); return items.map((t) => doc.splitTextToSize(t, W - 2 * M - 16)) }
  const boxHeight = (items) => boxBlocks(items).reduce((a, b) => a + b.length * 4.8 + 2, 8)
  const box = (items, fill, border, bulletColor) => {
    const blocks = boxBlocks(items)
    let i = 0
    while (i < blocks.length) {
      // quantas linhas cabem nesta página
      let h = 8; let j = i
      while (j < blocks.length && y + h + blocks[j].length * 4.8 + 2 <= BOTTOM) { h += blocks[j].length * 4.8 + 2; j++ }
      if (j === i) { doc.addPage(); chrome(); y = 44; continue }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.8)
      doc.setFillColor(...fill); doc.setDrawColor(...border); doc.setLineWidth(0.35); doc.roundedRect(M, y, W - 2 * M, h, 3, 3, 'FD')
      let yy = y + 6.5
      for (let k = i; k < j; k++) {
        doc.setFillColor(...bulletColor); doc.circle(M + 7, yy - 1.2, 0.9, 'F')
        doc.setTextColor(...INK); doc.text(blocks[k], M + 11, yy, { lineHeightFactor: 1.35 })
        yy += blocks[k].length * 4.8 + 2
      }
      y += h + 6; i = j
      if (i < blocks.length) { doc.addPage(); chrome(); y = 44 }
    }
  }

  const hist = (ev.history || []).filter((r) => String(r.text || '').trim())
  if (hist.length) { section('História clínica', 14); rows(hist) }
  const exam = (cfg.exam || []).map((f) => ({ label: f.label, text: ev.exam?.[f.id] || '' }))
    .concat((ev.examExtra || []).map((r) => ({ label: r.label, text: r.text })))
  if (exam.some((r) => String(r.text).trim())) { section('Exame físico', 14); rows(exam) }
  const dx = lines(ev.diagnosis)
  // caixa pequena não é partida entre páginas: vai inteira para a próxima
  if (dx.length) { section('Hipótese diagnóstica', Math.min(boxHeight(dx), 90)); box(dx, [255, 251, 240], [240, 205, 130], AMBER) }
  const cd = lines(ev.conduct)
  if (cd.length) { section('Conduta', Math.min(boxHeight(cd), 90)); box(cd, [247, 248, 252], [205, 210, 228], RED) }
  if (String(ev.notes || '').trim()) { section('Observações'); rows([{ label: 'Obs.', text: ev.notes }]) }

  // ---------- assinatura ----------
  ensure(40)
  y = Math.max(y + 10, Math.min(BOTTOM - 34, y + 22))
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...MUTED)
  doc.text(`${rep.city ? `${rep.city}, ` : ''}${brDate(consult)}`, W / 2, y, { align: 'center' })
  y += 14
  gradientBar(doc, W / 2 - 34, y, 68, 0.7)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...INK)
  doc.text(rep.professional || '', W / 2, y + 6, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.6); doc.setTextColor(...MUTED)
  doc.text(doc.splitTextToSize([rep.specialty, rep.registry].filter(Boolean).join(' · '), 120), W / 2, y + 10.5, { align: 'center' })
  y += 22

  // ---------- anexo: respostas da ficha ----------
  if (includeAnswers) {
    const groups = answeredList(ficha.questions?.length ? ficha.questions : cfg.sections, ans)
    if (groups.length) {
      doc.addPage(); chrome(); y = 44
      section(`Ficha de anamnese · respostas do paciente${ficha.createdAt ? ` (${brDate(ficha.createdAt.slice(0, 10))})` : ''}`)
      for (const g of groups) {
        ensure(12)
        doc.setFillColor(...MIST); doc.roundedRect(M, y - 3.6, W - 2 * M, 6, 1.5, 1.5, 'F')
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...INK); doc.text(g.title.toUpperCase(), M + 2.5, y + 0.6)
        y += 6
        const QW = 78; const AX = M + QW + 4; const AW = W - M - AX
        for (const it of g.items) {
          doc.setFontSize(8.6)
          const ql = doc.splitTextToSize(it.q.label, QW); const al = doc.splitTextToSize(it.text, AW)
          const h = Math.max(ql.length, al.length) * 3.9 + 2.2
          ensure(h)
          doc.setFontSize(8.6); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED); doc.text(ql, M + 2.5, y + 2.4)
          doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK); doc.text(al, AX, y + 2.4)
          y += h
          doc.setDrawColor(...LINE); doc.setLineWidth(0.15); doc.line(M, y - 0.6, W - M, y - 0.6)
        }
        y += 4
      }
    }
  }

  footer()
  const safe = (client?.name || 'paciente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-')
  const file = `Relatorio-${safe}-${consult}.pdf`
  if (output === 'blob') return { blob: doc.output('blob'), file }
  if (output === 'share') {
    const blob = doc.output('blob'); const f = new File([blob], file, { type: 'application/pdf' })
    if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: rep.title || 'Relatório' }); return { shared: true } }
  }
  doc.save(file)
  return { saved: true }
}
