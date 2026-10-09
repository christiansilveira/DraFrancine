import { useState } from 'react'
import { AlertTriangle, ClipboardList, Download, FilePlus2, FileText, MessageCircle, Plus, RefreshCw, Search, Share2, Trash2 } from 'lucide-react'
import { useStore } from '../../state/Store'
import { Badge, Button, Card, Empty, Field, Modal, Segmented } from '../../components/ui'
import AnamneseForm from '../../components/AnamneseForm'
import { STATUS_ANAMNESE, anamneseAlertsFrom, anamneseConfig, ageOf, brDate, historyFromAnswers } from '../../lib/anamnese'
import { clinicReport } from '../../lib/report'
import { cls, fmtDate, onlyDigits, today, waLink } from '../../lib/utils'
import { norm } from '../../components/CatalogFilter'

const when = (f) => (f.createdAt || '').slice(0, 10)
export const fichaQuestions = (f, cfg) => (f.questions?.length ? f.questions : cfg.sections)
/** link que o paciente abre para preencher/enviar a ficha de um agendamento */
export const fichaLink = (apptId) => `${location.origin}${location.pathname}#/ficha/${apptId}`

/* ============================== LISTA (menu Anamneses) ============================== */
export default function Anamneses() {
  const { data } = useStore()
  const [st, setSt] = useState('pendentes')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const [pick, setPick] = useState(false)
  const all = data.anamneses || []
  const name = (f) => data.clients.find((c) => c.id === f.clientId)?.name || 'Paciente'
  const list = all
    .filter((f) => (st === 'todas' ? true : st === 'pendentes' ? f.status !== 'concluida' : f.status === st))
    .filter((f) => !q.trim() || norm(name(f)).includes(norm(q)))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  const n = (s) => all.filter((f) => (s === 'pendentes' ? f.status !== 'concluida' : f.status === s)).length
  const cur = open && (all.find((f) => f.id === open.id) || open)

  return (
    <div>
      <div className="page-head">
        <div><p className="eyebrow">{n('nova')} {n('nova') === 1 ? 'ficha nova' : 'fichas novas'} para analisar</p><h1 className="page-title">Anamneses</h1></div>
        <div className="head-actions">
          <div className="search"><Search size={16} /><input placeholder="Buscar paciente" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Button icon={FilePlus2} onClick={() => setPick(true)}>Nova ficha</Button>
        </div>
      </div>
      <Segmented value={st} onChange={setSt} options={[{ value: 'pendentes', label: `A analisar (${n('pendentes')})` }, { value: 'nova', label: `Novas (${n('nova')})` }, { value: 'em_analise', label: `Em análise (${n('em_analise')})` }, { value: 'concluida', label: `Concluídas (${n('concluida')})` }, { value: 'todas', label: 'Todas' }]} />
      <Card pad={false} className="mt">
        <div className="list">
          {list.map((f) => <FichaRow key={f.id} f={f} name={name(f)} onOpen={() => setOpen(f)} />)}
          {!list.length && <Empty icon={ClipboardList} title="Nenhuma ficha aqui" text="As fichas enviadas pelos pacientes no agendamento aparecem nesta lista. Você também pode criar uma ficha na consulta." />}
        </div>
      </Card>
      {pick && <PickClient onClose={() => setPick(false)} onPick={(c) => { setPick(false); setOpen(blankFicha(c.id)) }} />}
      {cur && <AnamneseEditor ficha={cur} onClose={() => setOpen(null)} />}
    </div>
  )
}

function FichaRow({ f, name, onOpen }) {
  const { data } = useStore()
  const cfg = anamneseConfig(data.settings)
  const a = f.appointmentId && data.appointments.find((x) => x.id === f.appointmentId)
  const alerts = anamneseAlertsFrom(fichaQuestions(f, cfg), f.answers)
  const s = STATUS_ANAMNESE[f.status] || STATUS_ANAMNESE.nova
  return (
    <button type="button" className="sale-row ficha-row" onClick={onOpen}>
      <span className="appt-time">{when(f) ? fmtDate(when(f)) : '—'}</span>
      <span className="appt-info">
        <b>{name}</b>
        <small>{f.source === 'online' ? 'Enviada pelo paciente' : 'Preenchida na clínica'}{a ? ` · consulta ${fmtDate(a.date)} às ${a.time}` : ''}{f.answers?.queixa ? ` · ${String(f.answers.queixa).slice(0, 70)}` : ''}</small>
        {alerts.length > 0 && <small className="ficha-alert"><AlertTriangle size={12} /> {alerts.slice(0, 3).join(' · ')}{alerts.length > 3 ? ` +${alerts.length - 3}` : ''}</small>}
      </span>
      <Badge tone={s.tone}>{s.label}</Badge>
    </button>
  )
}

/** alertas da ficha mais recente do paciente (alergia, medicação, doenças, apneia observada…) */
export function clinicalAlerts(clientId, data) {
  const f = (data.anamneses || []).filter((x) => x.clientId === clientId).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0]
  return f ? anamneseAlertsFrom(fichaQuestions(f, anamneseConfig(data.settings)), f.answers) : []
}

export const blankFicha =(clientId, appointmentId = null) => ({ clientId, appointmentId, source: 'clinica', status: 'em_analise', answers: {}, questions: [], evaluation: { date: today() } })

function PickClient({ onClose, onPick }) {
  const { data } = useStore()
  const [q, setQ] = useState('')
  const hits = data.clients.filter((c) => !q.trim() || norm(c.name).includes(norm(q)) || onlyDigits(c.phone).includes(onlyDigits(q) || '###')).slice(0, 30)
  return (
    <Modal open onClose={onClose} title="Nova ficha · escolha o paciente">
      <div className="search mb-sm"><Search size={16} /><input autoFocus placeholder="Nome ou WhatsApp" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="list compact">
        {hits.map((c) => <button key={c.id} type="button" className="sale-row ficha-row" onClick={() => onPick(c)}><span className="appt-info"><b>{c.name}</b><small>{c.phone}</small></span><Plus size={16} /></button>)}
        {!hits.length && <p className="muted small">Ninguém encontrado. O paciente é cadastrado ao agendar.</p>}
      </div>
    </Modal>
  )
}

/* ============================== FICHAS NA FICHA DO PACIENTE ============================== */
export function ClientAnamneses({ client }) {
  const { data } = useStore()
  const [open, setOpen] = useState(null)
  const mine = (data.anamneses || []).filter((f) => f.clientId === client.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  const cur = open && ((data.anamneses || []).find((f) => f.id === open.id) || open)
  return (
    <>
      <div className="foot-row mb-sm"><span className="muted small">{mine.length ? `${mine.length} ficha${mine.length > 1 ? 's' : ''}` : 'Nenhuma ficha ainda'}</span><Button size="sm" variant="ghost" icon={FilePlus2} onClick={() => setOpen(blankFicha(client.id))}>Nova ficha</Button></div>
      <div className="list compact">
        {mine.map((f) => <FichaRow key={f.id} f={f} name={`Ficha de ${brDate(when(f))}`} onOpen={() => setOpen(f)} />)}
      </div>
      {cur && <AnamneseEditor ficha={cur} onClose={() => setOpen(null)} />}
    </>
  )
}

/** status da ficha no detalhe do agendamento (abre a ficha ou envia o link pelo WhatsApp) */
export function AppointmentFicha({ appt }) {
  const { data } = useStore()
  const [open, setOpen] = useState(null)
  const f = (data.anamneses || []).filter((x) => x.appointmentId === appt.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0]
  const last = !f && (data.anamneses || []).filter((x) => x.clientId === appt.clientId).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0]
  const cur = open && ((data.anamneses || []).find((x) => x.id === open.id) || open)
  const first = (appt.clientName || '').split(' ')[0]
  const phone = appt.clientPhone || data.clients.find((c) => c.id === appt.clientId)?.phone
  const msg = `Olá, ${first}! Para a sua consulta com a ${data.settings.shopName || 'Dra.'} em ${fmtDate(appt.date)} às ${appt.time}, preencha a ficha de saúde (leva uns 5 minutos): ${fichaLink(appt.id)}`
  return (
    <div className={cls('appt-ficha', f ? `st-${f.status}` : 'st-none')}>
      <ClipboardList size={18} />
      <span>
        <b>{f ? `Ficha de anamnese · ${(STATUS_ANAMNESE[f.status] || STATUS_ANAMNESE.nova).label}` : 'Ficha de anamnese não enviada'}</b>
        <small>{f ? (f.source === 'online' ? 'Preenchida pelo paciente' : 'Preenchida na clínica') : last ? `Última ficha em ${brDate(when(last))}` : 'Envie o link para o paciente preencher antes da consulta'}</small>
      </span>
      <span className="appt-ficha-acts">
        {f ? <Button size="sm" icon={FileText} onClick={() => setOpen(f)}>Abrir</Button> : <>
          {onlyDigits(phone).length >= 10 && <a className="btn btn-wa btn-sm" href={waLink(phone, msg)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> Enviar link</a>}
          <Button size="sm" variant="ghost" icon={FilePlus2} onClick={() => setOpen(blankFicha(appt.clientId, appt.id))}>Preencher aqui</Button>
          {last && <Button size="sm" variant="ghost" onClick={() => setOpen(last)}>Ver última</Button>}
        </>}
      </span>
      {cur && <AnamneseEditor ficha={cur} onClose={() => setOpen(null)} />}
    </div>
  )
}

/* ============================== EDITOR: respostas + avaliação + relatório ============================== */
export function AnamneseEditor({ ficha, onClose }) {
  const { data, actions } = useStore()
  const cfg = anamneseConfig(data.settings)
  const sections = fichaQuestions(ficha, cfg)
  const client = data.clients.find((c) => c.id === ficha.clientId)
  const appt = ficha.appointmentId && data.appointments.find((a) => a.id === ficha.appointmentId)
  const [f, setF] = useState(() => ({ ...ficha, answers: { ...(ficha.answers || {}) }, evaluation: { date: appt?.date || today(), history: [], exam: {}, ...(ficha.evaluation || {}) } }))
  const [tab, setTab] = useState(ficha.status === 'nova' || ficha.source === 'clinica' && !Object.keys(ficha.answers || {}).length ? 'respostas' : 'avaliacao')
  const [saving, setSaving] = useState(false)
  const [withAnswers, setWithAnswers] = useState(true)
  const [dirty, setDirty] = useState(false)
  const ev = f.evaluation
  const setEv = (k, v) => { setDirty(true); setF((x) => ({ ...x, evaluation: { ...x.evaluation, [k]: v } })) }
  const alerts = anamneseAlertsFrom(sections, f.answers)
  const idade = ageOf(f.answers.nascimento)

  const save = async (patch = {}, msg = 'Ficha salva') => {
    setSaving(true)
    try {
      const { updatedAt: _u, ...row } = { ...f, ...patch }
      if (!row.questions?.length) row.questions = cfg.sections // guarda as perguntas usadas
      if (row.status === 'nova') row.status = 'em_analise'
      const saved = await actions.upsert('anamneses', row, msg)
      if (saved) setF((x) => ({ ...x, ...patch, id: saved.id, status: saved.status || row.status, questions: row.questions }))
      setDirty(false)
      return saved
    } finally { setSaving(false) }
  }
  const genHistory = () => {
    const rows = historyFromAnswers(sections, f.answers)
    if (!rows.length) return actions.notify('Ainda não há respostas para resumir', 'bad')
    setEv('history', rows)
  }
  const report = async (output) => {
    try {
      if (dirty || !f.id) await save({}, null)
      await clinicReport({ client, ficha: f, cfg, appointment: appt, includeAnswers: withAnswers, output })
    } catch (e) { if (e?.name !== 'AbortError') actions.notify(e.message || 'Não foi possível gerar o relatório', 'bad') }
  }
  const remove = async () => {
    if (!(await actions.confirm('Excluir esta ficha de anamnese e a avaliação? Não dá para desfazer.', 'Excluir'))) return
    if (f.id) await actions.remove('anamneses', f.id, 'Ficha excluída')
    onClose()
  }
  const close = async () => { if (dirty && !(await actions.confirm('Sair sem salvar as alterações?', 'Sair sem salvar'))) return; onClose() }

  const hist = ev.history || []
  const setRow = (i, k, v) => setEv('history', hist.map((r, j) => (j === i ? { ...r, [k]: v } : r)))

  return (
    <Modal open wide onClose={close} title={`Anamnese · ${client?.name || 'Paciente'}`} footer={
      <div className="foot-row">
        {f.id ? <Button variant="ghost" icon={Trash2} onClick={remove}>Excluir</Button> : <span />}
        <div className="foot-row">
          <select className="ficha-status" value={f.status === 'nova' ? 'em_analise' : f.status} onChange={(e) => { setDirty(true); setF((x) => ({ ...x, status: e.target.value })) }} aria-label="Situação da ficha">
            <option value="em_analise">Em análise</option><option value="concluida">Concluída</option>
          </select>
          <Button disabled={saving} onClick={() => save()}>{saving ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </div>
    }>
      <div className="ficha-head">
        <span><b>{client?.name}</b>{idade !== null && ` · ${idade} anos`}{f.answers.sexo ? ` · ${f.answers.sexo}` : ''}{f.answers.convenio ? ` · ${f.answers.convenio}` : ''}</span>
        <small className="muted">{f.source === 'online' ? `Enviada pelo paciente em ${brDate(when(f))}` : f.id ? `Criada na clínica em ${brDate(when(f))}` : 'Nova ficha (preenchida na clínica)'}{appt ? ` · consulta ${fmtDate(appt.date)} às ${appt.time}` : ''}</small>
      </div>
      {alerts.length > 0 && <div className="an-alerts mt-sm"><b>Atenção</b>{alerts.map((t) => <span key={t} className="badge badge-warn">{t}</span>)}</div>}
      <div className="ficha-tabs" role="tablist">
        {[['respostas', 'Respostas do paciente'], ['avaliacao', 'Avaliação clínica'], ['relatorio', 'Relatório']].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={cls(tab === k && 'on')} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'respostas' && <>
        <p className="muted small mb-sm">Você pode completar ou corrigir as respostas do paciente. As alterações valem para esta ficha.</p>
        <AnamneseForm sections={sections} answers={f.answers} onChange={(a) => { setDirty(true); setF((x) => ({ ...x, answers: a })) }} />
      </>}

      {tab === 'avaliacao' && <div className="eval">
        <div className="form-grid">
          <Field label="Data da consulta"><input type="date" value={ev.date || ''} onChange={(e) => setEv('date', e.target.value)} /></Field>
        </div>
        <div className="eval-head mt"><h4 className="sub-title">História clínica</h4><Button size="sm" variant="ghost" icon={RefreshCw} onClick={genHistory}>{hist.length ? 'Gerar de novo das respostas' : 'Gerar das respostas'}</Button></div>
        <p className="muted small">Um resumo por tema, como no relatório. Edite à vontade.</p>
        <div className="eval-rows">
          {hist.map((r, i) => (
            <div key={i} className="eval-row">
              <input value={r.label} onChange={(e) => setRow(i, 'label', e.target.value)} aria-label="Tema" />
              <textarea rows={Math.min(8, Math.max(2, Math.ceil((r.text || '').length / 70)))} value={r.text} onChange={(e) => setRow(i, 'text', e.target.value)} aria-label={`Texto de ${r.label}`} />
              <button type="button" className="icon-btn sm" aria-label="Remover linha" onClick={() => setEv('history', hist.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
            </div>
          ))}
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => setEv('history', [...hist, { label: '', text: '' }])}>Adicionar linha</Button>
        </div>

        <h4 className="sub-title mt">Exame físico</h4>
        <div className="eval-rows">
          {cfg.exam.map((x) => (
            <Field key={x.id} label={x.label} hint={x.hint}><textarea rows={2} value={ev.exam?.[x.id] || ''} onChange={(e) => setEv('exam', { ...(ev.exam || {}), [x.id]: e.target.value })} /></Field>
          ))}
        </div>

        <h4 className="sub-title mt">Hipótese diagnóstica</h4>
        <Field hint="Uma hipótese por linha"><textarea rows={4} value={ev.diagnosis || ''} onChange={(e) => setEv('diagnosis', e.target.value)} placeholder={'Ex.: Mialgia mastigatória local (DC/TMD)\nDeslocamento de disco com redução à direita\nBruxismo do sono provável'} /></Field>
        <h4 className="sub-title mt">Conduta</h4>
        <Field hint="Um item por linha"><textarea rows={5} value={ev.conduct || ''} onChange={(e) => setEv('conduct', e.target.value)} placeholder={'Ex.: Placa estabilizadora miorrelaxante superior\nOrientações de autocuidado e higiene do sono\nSolicitada polissonografia\nRetorno em 15 dias'} /></Field>
        <Field label="Observações (opcional)" className="mt"><textarea rows={2} value={ev.notes || ''} onChange={(e) => setEv('notes', e.target.value)} /></Field>
      </div>}

      {tab === 'relatorio' && <div className="report-tab">
        <p className="muted">O relatório sai em PDF no modelo da clínica: dados do paciente, história clínica, exame físico, hipótese diagnóstica, conduta e assinatura.</p>
        <ul className="report-check">
          <li className={cls(hist.some((r) => r.text?.trim()) && 'ok')}>História clínica {hist.some((r) => r.text?.trim()) ? '✓' : '— gere na aba Avaliação'}</li>
          <li className={cls(Object.values(ev.exam || {}).some((v) => String(v).trim()) && 'ok')}>Exame físico {Object.values(ev.exam || {}).some((v) => String(v).trim()) ? '✓' : '— vazio'}</li>
          <li className={cls(ev.diagnosis?.trim() && 'ok')}>Hipótese diagnóstica {ev.diagnosis?.trim() ? '✓' : '— vazio'}</li>
          <li className={cls(ev.conduct?.trim() && 'ok')}>Conduta {ev.conduct?.trim() ? '✓' : '— vazio'}</li>
        </ul>
        <label className="toggle-row"><span><b>Anexar as respostas da ficha</b><small>Inclui uma página com todas as respostas do paciente</small></span><span className="switch"><input type="checkbox" checked={withAnswers} onChange={(e) => setWithAnswers(e.target.checked)} /><span /></span></label>
        <div className="foot-row mt">
          <Button icon={Download} onClick={() => report('save')}>Baixar PDF</Button>
          {typeof navigator !== 'undefined' && navigator.canShare && <Button variant="ghost" icon={Share2} onClick={() => report('share')}>Compartilhar (WhatsApp, e-mail…)</Button>}
        </div>
        <p className="muted small mt-sm">Assinatura e registro: {cfg.report.professional} · {cfg.report.registry}. Altere em Ajustes → Ficha de anamnese.</p>
      </div>}
    </Modal>
  )
}
