import { useState } from 'react'
import { ArrowRight, Check, ChevronLeft } from 'lucide-react'
import { Button, Field } from './ui'
import { answerValue, missingRequired, visible } from '../lib/anamnese'
import { cls } from '../lib/utils'

/**
 * Formulário da ficha de anamnese.
 * - `paged`: uma seção por vez (site do paciente, no celular); sem ele mostra tudo (painel da Dra.).
 * - `onSubmit`: botão final (só no modo paginado).
 */
export default function AnamneseForm({ sections, answers, onChange, paged = false, onSubmit, sending = false, submitLabel = 'Enviar ficha', onSkip }) {
  const [page, setPage] = useState(0)
  const [err, setErr] = useState('')
  const set = (id, v) => { setErr(''); onChange({ ...answers, [id]: v }) }
  const list = paged ? [sections[page]] : sections
  const last = page === sections.length - 1

  const next = () => {
    const miss = missingRequired([sections[page]], answers)
    if (miss.length) return setErr(`Responda: ${miss.map((x) => x.label.replace(/\?$/, '')).join(' · ')}`)
    setErr('')
    if (last) {
      const all = missingRequired(sections, answers)
      if (all.length) return setErr(`Faltou responder: ${all.map((x) => x.label.replace(/\?$/, '')).join(' · ')}`)
      return onSubmit?.()
    }
    setPage(page + 1)
    document.querySelector('.an-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="an-form">
      {paged && (
        <div className="an-progress" aria-label={`Parte ${page + 1} de ${sections.length}`}>
          <div className="an-progress-bar"><i style={{ width: `${((page + 1) / sections.length) * 100}%` }} /></div>
          <small>Parte {page + 1} de {sections.length}</small>
        </div>
      )}
      {list.map((s) => (
        <fieldset key={s.id} className="an-sec">
          <legend>{s.title}</legend>
          {s.questions.filter((qq) => visible(qq, answers)).map((qq) => <Question key={qq.id} q={qq} value={answers[qq.id]} set={(v) => set(qq.id, v)} />)}
        </fieldset>
      ))}
      {err && <p className="form-err" role="alert">{err}</p>}
      {paged && (
        <div className="an-nav">
          {page > 0 ? <Button variant="ghost" icon={ChevronLeft} onClick={() => { setErr(''); setPage(page - 1) }}>Voltar</Button> : onSkip ? <Button variant="ghost" onClick={onSkip}>Preencher depois</Button> : <span />}
          <Button size="lg" disabled={sending} icon={last ? Check : undefined} onClick={next}>{last ? (sending ? 'Enviando…' : submitLabel) : <>Próxima <ArrowRight size={18} /></>}</Button>
        </div>
      )}
    </div>
  )
}

function Question({ q, value, set }) {
  const label = q.label
  switch (q.type) {
    case 'textarea':
      return <Field label={label} hint={q.hint} required={q.required}><textarea rows={3} value={value || ''} onChange={(e) => set(e.target.value)} /></Field>
    case 'date':
      return <Field label={label} hint={q.hint} required={q.required}><input type="date" value={value || ''} max="2100-12-31" onChange={(e) => set(e.target.value)} /></Field>
    case 'consent':
      return (
        <label className="toggle-row an-consent">
          <span><b>{label}{q.required && <b className="req"> *</b>}</b>{q.hint && <small>{q.hint}</small>}</span>
          <span className="switch"><input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} /><span /></span>
        </label>
      )
    case 'yesno': {
      const v = value && typeof value === 'object' ? value : { v: value || '' }
      return (
        <Field label={label} hint={q.hint} required={q.required}>
          <div className="an-pills" role="radiogroup" aria-label={label}>
            {['Sim', 'Não'].map((o) => <button key={o} type="button" role="radio" aria-checked={answerValue(v) === o} className={cls('pill', answerValue(v) === o && 'on')} onClick={() => set(answerValue(v) === o ? { v: '' } : { ...v, v: o })}>{o}</button>)}
          </div>
          {q.detail && v.v === 'Sim' && <input className="an-detail" value={v.d || ''} onChange={(e) => set({ ...v, d: e.target.value })} placeholder={q.detail} aria-label={q.detail} />}
        </Field>
      )
    }
    case 'single':
      return (
        <Field label={label} hint={q.hint} required={q.required}>
          <div className="an-pills" role="radiogroup" aria-label={label}>
            {(q.options || []).map((o) => <button key={o} type="button" role="radio" aria-checked={value === o} className={cls('pill', value === o && 'on')} onClick={() => set(value === o ? '' : o)}>{o}</button>)}
          </div>
        </Field>
      )
    case 'multi': {
      const arr = Array.isArray(value) ? value : []
      return (
        <Field label={label} hint={q.hint || 'Pode marcar mais de uma'} required={q.required}>
          <div className="an-pills" role="group" aria-label={label}>
            {(q.options || []).map((o) => { const on = arr.includes(o); return <button key={o} type="button" aria-pressed={on} className={cls('pill', on && 'on')} onClick={() => set(on ? arr.filter((x) => x !== o) : [...arr, o])}>{on && <Check size={13} strokeWidth={3} />} {o}</button> })}
          </div>
        </Field>
      )
    }
    case 'scale':
      return (
        <Field label={label} hint={q.hint || '0 = nada · 10 = máximo'} required={q.required}>
          <div className="an-scale" role="radiogroup" aria-label={label}>
            {Array.from({ length: 11 }, (_, n) => <button key={n} type="button" role="radio" aria-checked={value === n} className={cls(value === n && 'on', `lv${Math.min(3, Math.floor(n / 3))}`)} onClick={() => set(value === n ? '' : n)}>{n}</button>)}
          </div>
        </Field>
      )
    default:
      return <Field label={label} hint={q.hint} required={q.required}><input value={value || ''} onChange={(e) => set(e.target.value)} /></Field>
  }
}
