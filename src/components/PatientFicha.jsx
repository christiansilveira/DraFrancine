import { useState } from 'react'
import { CheckCircle2, ClipboardList, Lock } from 'lucide-react'
import { useStore } from '../state/Store'
import AnamneseForm from './AnamneseForm'
import { anamneseConfig } from '../lib/anamnese'
import { safeLS } from '../lib/utils'

/**
 * Ficha de anamnese do lado do paciente: preenche por partes e envia.
 * O rascunho fica salvo neste aparelho (se fechar a página no meio, continua de onde parou).
 */
export default function PatientFicha({ appointmentId, phone, settings, firstName, onSkip, onSent, initial }) {
  const { actions } = useStore()
  const cfg = anamneseConfig(settings)
  const KEY = `dcb:ficha:${appointmentId}`
  const [answers, setAnswers] = useState(() => safeLS.get(KEY, null) || initial || {})
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const [sent, setSent] = useState(false)
  const change = (a) => { setAnswers(a); safeLS.set(KEY, a) }

  const submit = async () => {
    setSending(true); setErr('')
    try {
      await actions.submitAnamnese({ appointmentId, phone, answers, questions: cfg.sections })
      safeLS.del(KEY); setSent(true); onSent?.()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) { setErr(e.message || 'Não foi possível enviar. Tente de novo.') } finally { setSending(false) }
  }

  if (sent) return (
    <section className="ficha-done fade-in">
      <CheckCircle2 size={44} />
      <h2>Ficha enviada!</h2>
      <p>Obrigado{firstName ? `, ${firstName}` : ''}. A Dra. vai ler suas respostas antes da consulta.</p>
    </section>
  )

  return (
    <section className="patient-ficha fade-in">
      <div className="pf-head">
        <span className="pf-ico"><ClipboardList size={22} /></span>
        <div>
          <h2 className="bk-title">Ficha de saúde</h2>
          <p className="bk-sub">{cfg.intro}</p>
        </div>
      </div>
      <AnamneseForm sections={cfg.sections} answers={answers} onChange={change} paged onSubmit={submit} sending={sending} onSkip={onSkip} />
      {err && <p className="form-err" role="alert">{err}</p>}
      <p className="pf-lock"><Lock size={13} /> Suas respostas vão direto para a Dra. e ficam em sigilo.</p>
    </section>
  )
}
