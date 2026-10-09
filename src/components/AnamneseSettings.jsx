import { useState } from 'react'
import { ArrowDown, ArrowUp, Eye, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useStore } from '../state/Store'
import { Button, Card, Field, Modal } from './ui'
import AnamneseForm from './AnamneseForm'
import { DEFAULT_EXAM, DEFAULT_SECTIONS, QTYPES, anamneseConfig, newId } from '../lib/anamnese'

const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return arr; const c = [...arr]; [c[i], c[j]] = [c[j], c[i]]; return c }

/** Ajustes → Ficha de anamnese: perguntas, exame clínico e dados do relatório (grava em settings.anamnese) */
export default function AnamneseSettings({ s, setS }) {
  const { actions } = useStore()
  const cfg = anamneseConfig(s)
  const set = (patch) => setS({ ...s, anamnese: { ...cfg, ...patch } })
  const setRep = (k, v) => set({ report: { ...cfg.report, [k]: v } })
  const [openSec, setOpenSec] = useState(null)
  const [preview, setPreview] = useState(false)
  const [pv, setPv] = useState({})

  const secs = cfg.sections
  const setSecs = (list) => set({ sections: list })
  const setSec = (i, patch) => setSecs(secs.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const setQ = (si, qi, patch) => setSec(si, { questions: secs[si].questions.map((x, j) => (j === qi ? { ...x, ...patch } : x)) })

  return (
    <>
      <Card title="Ficha de anamnese · agendamento">
        <div className="toggles">
          <label className="toggle-row"><span><b>Pedir a ficha no agendamento online</b><small>A ficha vira uma etapa do agendamento: o paciente preenche e envia junto com a reserva</small></span><span className="switch"><input type="checkbox" checked={cfg.enabled !== false} onChange={(e) => set({ enabled: e.target.checked })} /><span /></span></label>
          <label className="toggle-row"><span><b>Ficha obrigatória para agendar</b><small>Ligado: o paciente só conclui o agendamento enviando a ficha. Desligado: aparece o botão “Preencher depois”</small></span><span className="switch"><input type="checkbox" checked={cfg.required !== false} onChange={(e) => set({ required: e.target.checked })} /><span /></span></label>
          <label className="toggle-row"><span><b>Pedir também para quem já é paciente</b><small>Ligado: a cada agendamento o paciente atualiza a ficha. Desligado: só pacientes novos preenchem</small></span><span className="switch"><input type="checkbox" checked={cfg.askReturning !== false} onChange={(e) => set({ askReturning: e.target.checked })} /><span /></span></label>
          <Field label="Texto de apresentação da ficha"><textarea rows={3} value={cfg.intro || ''} onChange={(e) => set({ intro: e.target.value })} /></Field>
          <div className="foot-row mt-sm">
            <Button variant="ghost" size="sm" icon={Eye} onClick={() => { setPv({}); setPreview(true) }}>Ver como o paciente vê</Button>
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={async () => { if (await actions.confirm('Voltar às perguntas e aos campos do exame padrão? As suas alterações nas perguntas serão perdidas (as fichas já enviadas não mudam).', 'Restaurar padrão')) set({ sections: DEFAULT_SECTIONS, exam: DEFAULT_EXAM }) }}>Restaurar padrão</Button>
          </div>
        </div>
      </Card>
      <Card title="Relatório (cabeçalho e assinatura)">
        <div className="form-grid">
          <Field label="Título do relatório" className="span-2"><input value={cfg.report.title} onChange={(e) => setRep('title', e.target.value)} /></Field>
          <Field label="Nome na assinatura" className="span-2"><input value={cfg.report.professional} onChange={(e) => setRep('professional', e.target.value)} /></Field>
          <Field label="Especialidade" className="span-2"><input value={cfg.report.specialty} onChange={(e) => setRep('specialty', e.target.value)} /></Field>
          <Field label="Registro (CRO, RQE…)"><input value={cfg.report.registry} onChange={(e) => setRep('registry', e.target.value)} /></Field>
          <Field label="Cidade (data do relatório)"><input value={cfg.report.city} onChange={(e) => setRep('city', e.target.value)} /></Field>
        </div>
      </Card>

      <Card title="Perguntas da ficha" className="span-all">
        <p className="muted small mb-sm">Organize em partes (o paciente vê uma parte por vez). Perguntas com cadeado aparecem no cabeçalho do relatório: dá para mudar o texto, mas não excluir. Clique em <b>Salvar</b> no topo.</p>
        <div className="aq-secs">
          {secs.map((sec, si) => {
            const open = openSec === sec.id
            const locked = sec.questions.some((x) => x.lock)
            return (
              <div key={sec.id} className="aq-sec">
                <div className="aq-sec-head">
                  <button type="button" className="aq-toggle" onClick={() => setOpenSec(open ? null : sec.id)} aria-expanded={open}>{open ? '▾' : '▸'}</button>
                  <input value={sec.title} onChange={(e) => setSec(si, { title: e.target.value })} aria-label="Nome da parte" />
                  <small className="muted">{sec.questions.length} perg.</small>
                  <button type="button" className="icon-btn sm" aria-label="Subir parte" onClick={() => setSecs(move(secs, si, -1))}><ArrowUp size={15} /></button>
                  <button type="button" className="icon-btn sm" aria-label="Descer parte" onClick={() => setSecs(move(secs, si, 1))}><ArrowDown size={15} /></button>
                  {!locked && <button type="button" className="icon-btn sm" aria-label="Excluir parte" onClick={async () => { if (await actions.confirm(`Excluir a parte "${sec.title}" e as perguntas dela?`, 'Excluir')) setSecs(secs.filter((_, j) => j !== si)) }}><Trash2 size={15} /></button>}
                </div>
                {open && (
                  <div className="aq-qs">
                    {sec.questions.map((qq, qi) => (
                      <div key={qq.id} className="aq-q">
                        <div className="aq-q-top">
                          <input value={qq.label} onChange={(e) => setQ(si, qi, { label: e.target.value })} aria-label="Pergunta" placeholder="Texto da pergunta" />
                          <select value={qq.type} onChange={(e) => setQ(si, qi, { type: e.target.value, ...(['single', 'multi'].includes(e.target.value) && !qq.options?.length ? { options: ['Opção 1', 'Opção 2'] } : {}) })} disabled={qq.lock} aria-label="Tipo">
                            {QTYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </select>
                          <button type="button" className="icon-btn sm" aria-label="Subir" onClick={() => setSec(si, { questions: move(sec.questions, qi, -1) })}><ArrowUp size={14} /></button>
                          <button type="button" className="icon-btn sm" aria-label="Descer" onClick={() => setSec(si, { questions: move(sec.questions, qi, 1) })}><ArrowDown size={14} /></button>
                          {qq.lock ? <span className="aq-lock" title="Usada no relatório">🔒</span> : <button type="button" className="icon-btn sm" aria-label="Excluir pergunta" onClick={() => setSec(si, { questions: sec.questions.filter((_, j) => j !== qi) })}><Trash2 size={14} /></button>}
                        </div>
                        {['single', 'multi'].includes(qq.type) && (
                          <Field label="Opções (uma por linha)"><textarea rows={Math.min(8, (qq.options || []).length + 1)} value={(qq.options || []).join('\n')} onChange={(e) => setQ(si, qi, { options: e.target.value.split('\n') })} onBlur={(e) => setQ(si, qi, { options: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} /></Field>
                        )}
                        <div className="aq-q-opts">
                          <label><input type="checkbox" checked={!!qq.required} onChange={(e) => setQ(si, qi, { required: e.target.checked })} /> Obrigatória</label>
                          <label><input type="checkbox" checked={!!qq.alert} onChange={(e) => setQ(si, qi, { alert: e.target.checked })} /> Alerta na ficha</label>
                          {qq.type === 'yesno' && <label className="aq-detail">Se “Sim”, perguntar: <input value={qq.detail || ''} onChange={(e) => setQ(si, qi, { detail: e.target.value })} placeholder="(nada)" /></label>}
                          {sec.questions.some((o) => o.id !== qq.id && ['yesno', 'single'].includes(o.type)) && (
                            <label className="aq-detail">Mostrar só se: <select value={qq.showIf || ''} onChange={(e) => setQ(si, qi, { showIf: e.target.value || undefined })}>
                              <option value="">sempre</option>
                              {sec.questions.filter((o) => o.id !== qq.id && ['yesno', 'single'].includes(o.type)).map((o) => <option key={o.id} value={o.id}>“{o.label.slice(0, 40)}” = sim</option>)}
                            </select></label>
                          )}
                          {!['consent', 'date'].includes(qq.type) && <input className="aq-hint" value={qq.short || ''} onChange={(e) => setQ(si, qi, { short: e.target.value })} placeholder="Texto no relatório (ex.: Apneias presenciadas)" aria-label="Texto no relatório" />}
                          <input className="aq-hint" value={qq.hint || ''} onChange={(e) => setQ(si, qi, { hint: e.target.value })} placeholder="Dica abaixo da pergunta (opcional)" aria-label="Dica" />
                        </div>
                      </div>
                    ))}
                    <Button size="sm" variant="ghost" icon={Plus} onClick={() => setSec(si, { questions: [...sec.questions, { id: `p_${newId()}`, label: '', type: 'yesno' }] })}>Nova pergunta</Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <Button className="mt-sm" size="sm" variant="ghost" icon={Plus} onClick={() => { const id = `s_${newId()}`; setSecs([...secs.slice(0, -1), { id, title: 'Nova parte', questions: [] }, ...secs.slice(-1)]); setOpenSec(id) }}>Nova parte</Button>
      </Card>

      <Card title="Exame físico (campos da Dra.)">
        <p className="muted small mb-sm">Campos que você preenche na avaliação. Cada um vira uma linha do “Exame físico” no relatório.</p>
        <div className="aq-exam">
          {cfg.exam.map((x, i) => (
            <div key={x.id} className="aq-exam-row">
              <input value={x.label} onChange={(e) => set({ exam: cfg.exam.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)) })} aria-label="Campo" placeholder="Nome do campo" />
              <input value={x.hint || ''} onChange={(e) => set({ exam: cfg.exam.map((y, j) => (j === i ? { ...y, hint: e.target.value } : y)) })} aria-label="Dica" placeholder="Dica (opcional)" />
              <button type="button" className="icon-btn sm" aria-label="Subir" onClick={() => set({ exam: move(cfg.exam, i, -1) })}><ArrowUp size={14} /></button>
              <button type="button" className="icon-btn sm" aria-label="Excluir campo" onClick={() => set({ exam: cfg.exam.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <Button className="mt-sm" size="sm" variant="ghost" icon={Plus} onClick={() => set({ exam: [...cfg.exam, { id: `e_${newId()}`, label: '', hint: '' }] })}>Novo campo</Button>
      </Card>

      {preview && (
        <Modal open onClose={() => setPreview(false)} title="Ficha · como o paciente vê">
          {cfg.intro && <p className="muted small mb-sm">{cfg.intro}</p>}
          <AnamneseForm sections={secs.map((x) => ({ ...x, questions: x.questions.filter((qq) => qq.label.trim()) }))} answers={pv} onChange={setPv} paged onSubmit={() => { actions.notify('Pré-visualização: nada foi enviado'); setPreview(false) }} />
        </Modal>
      )}
    </>
  )
}
