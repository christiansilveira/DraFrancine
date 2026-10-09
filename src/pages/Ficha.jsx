import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, CalendarDays } from 'lucide-react'
import { useStore } from '../state/Store'
import { Button, Field, Logo, ThemeToggle } from '../components/ui'
import PatientFicha from '../components/PatientFicha'
import { fmtDateLong, maskPhone, onlyDigits, safeLS } from '../lib/utils'

/** Link que a clínica envia pelo WhatsApp: /ficha/:idDoAgendamento — o paciente confirma o WhatsApp e preenche */
export default function Ficha() {
  const { id } = useParams()
  const { pub, actions } = useStore()
  const [phone, setPhone] = useState(() => onlyDigits(safeLS.get('dcb:me', {})?.phone || ''))
  const [info, setInfo] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const check = async (e) => {
    e.preventDefault(); setErr('')
    if (phone.length < 10) return setErr('Informe o WhatsApp com DDD.')
    setBusy(true)
    try {
      const r = await actions.checkAnamnese(id, phone)
      if (!r) return setErr('Não encontramos a consulta com este WhatsApp. Confira o número usado no agendamento.')
      if (r.cancelled) return setErr('Esta consulta foi cancelada. Fale com a clínica pelo WhatsApp.')
      setInfo(r)
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }

  if (!pub) return <div className="center-screen"><Logo size={72} /></div>
  const settings = pub.settings

  return (
    <div className="ficha-page">
      <header className="ficha-top">
        <Link to="/" className="ficha-brand"><Logo size={40} withText sub="Ficha de saúde" /></Link>
        <ThemeToggle />
      </header>
      <main className="ficha-main">
        {!info ? (
          <form className="card ficha-check" onSubmit={check}>
            <h1 className="bk-title">Ficha de saúde</h1>
            <p className="bk-sub">Para sua segurança, confirme o WhatsApp usado no agendamento.</p>
            <Field label="Seu WhatsApp" required><input inputMode="tel" autoComplete="tel" value={maskPhone(phone)} onChange={(e) => setPhone(onlyDigits(e.target.value).slice(0, 11))} placeholder="(31) 99999-9999" /></Field>
            {err && <p className="form-err" role="alert">{err}</p>}
            <Button type="submit" size="lg" block disabled={busy}>{busy ? 'Conferindo…' : <>Continuar <ArrowRight size={18} /></>}</Button>
          </form>
        ) : info.status && info.status !== 'nova' ? (
          <section className="ficha-done"><h2>Ficha já recebida</h2><p>A Dra. já está analisando sua ficha, {info.firstName}. Para mudar alguma resposta, fale com a clínica pelo WhatsApp.</p><Link className="btn btn-ghost" to="/">Voltar ao início</Link></section>
        ) : (
          <>
            <p className="ficha-when"><CalendarDays size={16} /> Consulta de {info.firstName}: {fmtDateLong(String(info.date).slice(0, 10))} às {info.time}{info.status === 'nova' ? ' · você já enviou; enviar de novo substitui as respostas' : ''}</p>
            <PatientFicha appointmentId={id} phone={phone} settings={settings} firstName={info.firstName} />
          </>
        )}
      </main>
    </div>
  )
}
