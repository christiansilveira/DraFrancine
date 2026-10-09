/**
 * Ficha de anamnese (DTM, dor orofacial, sono, cefaleia, zumbido e patologias orais).
 * - O paciente preenche no agendamento (ou pelo link /ficha/:id) e envia.
 * - A Dra. complementa com a avaliação clínica (exame, hipótese, conduta) e gera o relatório.
 * - Perguntas, campos do exame e dados do relatório ficam em settings.anamnese (Ajustes → Ficha de anamnese).
 *
 * Tipos de pergunta: text, textarea, date, yesno (com `detail` = pergunta extra quando "Sim"),
 * single (opções), multi (várias opções), scale (0 a 10), consent (caixa de aceite).
 * `showIf: 'idDaPergunta'` = só aparece quando aquela resposta é positiva.
 * `alert: true` = resposta positiva vira alerta na ficha do paciente.
 * `lock: true` = usada no relatório (cabeçalho); pode mudar o texto, mas não excluir.
 */
import { today } from './utils'

/** AAAA-MM-DD → DD/MM/AAAA */
export const brDate = (s) => (/^\d{4}-\d{2}-\d{2}/.test(s || '') ? s.slice(0, 10).split('-').reverse().join('/') : s || '')

export const QTYPES = [
  ['text', 'Texto curto'], ['textarea', 'Texto longo'], ['yesno', 'Sim / Não'], ['single', 'Uma opção'],
  ['multi', 'Várias opções'], ['scale', 'Escala 0 a 10'], ['date', 'Data'], ['consent', 'Aceite (caixa)'],
]

const NEG = ['', 'Não', 'Nunca', 'Não sei', 'Nenhum', 'Nenhuma']

const q = (id, label, type = 'text', extra = {}) => ({ id, label, type, ...extra })

export const DEFAULT_SECTIONS = [
  { id: 'ident', title: 'Identificação', questions: [
    q('nascimento', 'Data de nascimento', 'date', { required: true, lock: true }),
    q('sexo', 'Sexo', 'single', { options: ['Feminino', 'Masculino', 'Prefiro não informar'], lock: true }),
    q('convenio', 'Convênio / plano (se houver)', 'text', { lock: true }),
    q('profissao', 'Profissão'),
    q('email', 'E-mail'),
    q('indicacao', 'Quem indicou ou encaminhou? (médico, dentista, amigo…)'),
  ] },
  { id: 'queixa', title: 'Queixa principal', questions: [
    q('queixa', 'Qual o principal motivo da consulta?', 'textarea', { required: true, hint: 'Conte com suas palavras o que sente.' }),
    q('inicio', 'Há quanto tempo?', 'single', { options: ['Menos de 1 mês', '1 a 6 meses', '6 meses a 1 ano', '1 a 5 anos', 'Mais de 5 anos'] }),
    q('dor_hoje', 'Intensidade da dor hoje', 'scale', { hint: '0 = sem dor · 10 = pior dor imaginável' }),
    q('dor_pior', 'Pior dor no último mês', 'scale'),
    q('dor_local', 'Onde dói?', 'multi', { options: ['ATM / mandíbula direita', 'ATM / mandíbula esquerda', 'Rosto / bochecha', 'Têmporas', 'Ouvido', 'Dentes', 'Cabeça', 'Pescoço / nuca', 'Ombros', 'Atrás dos olhos'] }),
    q('dor_tipo', 'Como é a dor?', 'multi', { options: ['Peso / pressão', 'Pontada', 'Latejante', 'Queimação', 'Choque', 'Cansaço muscular'] }),
    q('dor_freq', 'Com que frequência?', 'single', { options: ['Todos os dias', 'Algumas vezes por semana', 'Algumas vezes por mês', 'Raramente'] }),
    q('dor_piora', 'O que piora?', 'multi', { options: ['Mastigar', 'Falar', 'Bocejar / abrir muito a boca', 'Ao acordar', 'No fim do dia', 'Estresse', 'Frio'] }),
  ] },
  { id: 'atm', title: 'ATM e mandíbula', questions: [
    q('estalo', 'Sente estalos na articulação ao abrir ou fechar a boca?', 'yesno'),
    q('crepitacao', 'Ouve ruído de “areia” (crepitação) na articulação?', 'yesno'),
    q('travou_fechada', 'A boca já travou sem conseguir abrir totalmente?', 'yesno', { alert: true }),
    q('travou_aberta', 'A boca já travou aberta, sem conseguir fechar?', 'yesno', { alert: true }),
    q('limitacao', 'Tem dificuldade para abrir a boca?', 'yesno'),
    q('cansaco_mastigar', 'Sente cansaço ou dor ao mastigar?', 'yesno'),
    q('lado_mastigar', 'Lado que mais usa para mastigar', 'single', { options: ['Direito', 'Esquerdo', 'Os dois', 'Não sei'] }),
    q('trauma', 'Já teve pancada no rosto/queixo, acidente ou intubação?', 'yesno', { detail: 'Quando e como foi?' }),
    q('ortodontia', 'Já usou aparelho ortodôntico?', 'yesno'),
    q('placa', 'Já usou placa de mordida?', 'yesno', { detail: 'Como foi? Ajudou?' }),
  ] },
  { id: 'bruxismo', title: 'Bruxismo e hábitos', questions: [
    q('range_noite', 'Range os dentes dormindo (alguém já ouviu)?', 'yesno'),
    q('aperta_dia', 'Aperta os dentes durante o dia?', 'yesno'),
    q('acorda_dor', 'Acorda com dor ou cansaço no rosto, mandíbula ou têmporas?', 'yesno'),
    q('desgaste', 'Algum dentista já falou em desgaste ou dentes trincados?', 'yesno'),
    q('habitos', 'Hábitos', 'multi', { options: ['Roer unhas', 'Morder bochecha / lábio', 'Mascar chiclete', 'Morder objetos (caneta, tampa)', 'Apoiar a mão no queixo', 'Dormir de bruços', 'Celular apoiado no ombro'] }),
  ] },
  { id: 'cefaleia', title: 'Dor de cabeça', questions: [
    q('cefaleia', 'Tem dor de cabeça com frequência?', 'yesno'),
    q('cef_freq', 'Com que frequência?', 'single', { showIf: 'cefaleia', options: ['Todos os dias', '2 a 3 vezes por semana', '1 vez por semana', 'Algumas vezes por mês'] }),
    q('cef_local', 'Onde?', 'multi', { showIf: 'cefaleia', options: ['Testa', 'Têmporas', 'Nuca', 'Topo da cabeça', 'Um lado só', 'Atrás dos olhos'] }),
    q('enxaqueca', 'Tem diagnóstico de enxaqueca?', 'yesno', { showIf: 'cefaleia' }),
    q('cef_remedio', 'Quantos dias por mês toma remédio para dor de cabeça?', 'text', { showIf: 'cefaleia' }),
  ] },
  { id: 'ouvido', title: 'Ouvido e zumbido', questions: [
    q('zumbido', 'Tem zumbido no ouvido?', 'yesno'),
    q('zumbido_lado', 'Em qual ouvido?', 'single', { showIf: 'zumbido', options: ['Direito', 'Esquerdo', 'Os dois'] }),
    q('ouvido_tampado', 'Sensação de ouvido tampado ou pressão?', 'yesno'),
    q('otalgia', 'Dor no ouvido sem infecção?', 'yesno'),
    q('tontura', 'Tontura ou vertigem?', 'yesno'),
    q('audicao', 'Percebe perda de audição?', 'yesno'),
  ] },
  { id: 'sono', title: 'Sono, ronco e apneia', questions: [
    q('ronco', 'Você ronca?', 'single', { options: ['Não', 'Às vezes', 'Frequentemente', 'Todas as noites', 'Não sei'] }),
    q('apneia_vista', 'Alguém já viu você parar de respirar dormindo?', 'yesno', { alert: true }),
    q('engasgo', 'Acorda engasgado(a), sufocado(a) ou com falta de ar?', 'yesno'),
    q('cansaco', 'Acorda cansado(a) mesmo depois de dormir?', 'yesno'),
    q('sonolencia', 'Cochila sem querer durante o dia (TV, leitura, dirigindo)?', 'single', { options: ['Nunca', 'Raramente', 'Às vezes', 'Frequentemente'] }),
    q('horas_sono', 'Quantas horas dorme por noite?'),
    q('boca_seca', 'Acorda com a boca seca?', 'yesno'),
    q('nariz', 'Nariz entupido ou respira pela boca?', 'yesno'),
    q('polissono', 'Já fez polissonografia (exame do sono)?', 'yesno', { detail: 'Quando? Resultado (IAH), se souber' }),
    q('cpap', 'CPAP', 'single', { options: ['Nunca usei', 'Uso CPAP', 'Tentei e não me adaptei'] }),
    q('peso', 'Peso (kg)'),
    q('altura', 'Altura (m)'),
  ] },
  { id: 'saude', title: 'Saúde geral', questions: [
    q('doencas', 'Marque o que se aplica', 'multi', { alert: true, options: ['Pressão alta', 'Diabetes', 'Problema cardíaco', 'Marca-passo', 'Refluxo / gastrite', 'Ansiedade', 'Depressão', 'Fibromialgia', 'Artrite / artrose', 'Tireoide', 'Asma / bronquite', 'Rinite / sinusite', 'Problema de coagulação', 'Osteoporose', 'Gestante', 'Fumante'] }),
    q('medicamentos', 'Medicamentos em uso (nome e dose)', 'textarea', { alert: true }),
    q('alergias', 'Alergias (remédios, látex, anestésico…)', 'text', { alert: true }),
    q('cirurgias', 'Cirurgias ou internações'),
    q('tratamentos', 'Já tratou essa dor antes? Com quem ou com o quê?', 'textarea'),
    q('estresse', 'Nível de estresse / ansiedade hoje', 'scale'),
    q('atividade', 'Atividade física', 'single', { options: ['Não pratico', '1 a 2 vezes por semana', '3 vezes ou mais por semana'] }),
  ] },
  { id: 'boca', title: 'Saúde bucal', questions: [
    q('ultimo_dentista', 'Última consulta com dentista', 'single', { options: ['Menos de 6 meses', '6 meses a 1 ano', 'Mais de 1 ano', 'Não lembro'] }),
    q('protese', 'Usa prótese ou implante?', 'single', { options: ['Não', 'Prótese fixa', 'Prótese removível', 'Implante'] }),
    q('sensibilidade', 'Tem dentes sensíveis?', 'yesno'),
    q('ferida', 'Tem feridas, manchas ou caroços na boca?', 'yesno', { alert: true, detail: 'Onde e há quanto tempo?' }),
    q('ardencia', 'Sente ardência ou queimação na boca ou língua?', 'yesno'),
  ] },
  { id: 'final', title: 'Para finalizar', questions: [
    q('obs', 'Algo mais que a Dra. deveria saber?', 'textarea'),
    q('consentimento', 'Declaro que as informações são verdadeiras e autorizo o uso delas no meu tratamento, com sigilo (LGPD).', 'consent', { required: true }),
  ] },
]

/** como cada pergunta aparece no resumo/relatório (a Dra. pode mudar em Ajustes: "Texto no relatório") */
const SHORT = {
  inicio: 'Início', dor_hoje: 'Dor hoje', dor_pior: 'Pior dor no último mês', dor_local: 'Local da dor', dor_tipo: 'Tipo de dor', dor_freq: 'Frequência', dor_piora: 'Piora com',
  estalo: 'Estalos na ATM', crepitacao: 'Crepitação na ATM', travou_fechada: 'Histórico de travamento fechado', travou_aberta: 'Histórico de travamento aberto', limitacao: 'Limitação de abertura bucal',
  cansaco_mastigar: 'Dor/cansaço ao mastigar', lado_mastigar: 'Lado de mastigação', trauma: 'Trauma facial/intubação', ortodontia: 'Tratamento ortodôntico prévio', placa: 'Uso prévio de placa',
  range_noite: 'Range os dentes dormindo', aperta_dia: 'Apertamento diurno', acorda_dor: 'Acorda com dor/cansaço facial', desgaste: 'Desgaste dentário relatado', habitos: 'Hábitos',
  cefaleia: 'Cefaleia frequente', cef_freq: 'Frequência', cef_local: 'Local', enxaqueca: 'Diagnóstico de enxaqueca', cef_remedio: 'Dias/mês com analgésico',
  zumbido: 'Zumbido', zumbido_lado: 'Lado', ouvido_tampado: 'Plenitude auricular', otalgia: 'Otalgia sem infecção', tontura: 'Tontura/vertigem', audicao: 'Perda auditiva percebida',
  ronco: 'Ronco', apneia_vista: 'Apneias presenciadas', engasgo: 'Despertares com engasgo/sufocação', cansaco: 'Sono não reparador', sonolencia: 'Sonolência diurna', horas_sono: 'Horas de sono',
  boca_seca: 'Boca seca ao acordar', nariz: 'Obstrução nasal/respiração oral', polissono: 'Polissonografia prévia', cpap: 'CPAP', peso: 'Peso (kg)', altura: 'Altura (m)',
  doencas: 'Condições', medicamentos: 'Medicações', alergias: 'Alergias', cirurgias: 'Cirurgias/internações', tratamentos: 'Tratamentos anteriores', estresse: 'Estresse/ansiedade', atividade: 'Atividade física',
  ultimo_dentista: 'Última consulta odontológica', protese: 'Prótese/implante', sensibilidade: 'Sensibilidade dentária', ferida: 'Lesão em boca relatada', ardencia: 'Ardência bucal',
}
DEFAULT_SECTIONS.forEach((s) => s.questions.forEach((qq) => { if (SHORT[qq.id]) qq.short = SHORT[qq.id] }))

export const DEFAULT_EXAM = [
  { id: 'abertura', label: 'Abertura bucal', hint: 'Sem dor / máxima ativa / máxima passiva (mm)' },
  { id: 'movimentos', label: 'Movimentos', hint: 'Lateralidade D/E, protrusão (mm), desvio ou deflexão' },
  { id: 'atm', label: 'ATM', hint: 'Ruídos (estalo, crepitação), dor à palpação, travamento' },
  { id: 'musculos', label: 'Palpação muscular', hint: 'Masseter, temporal, pterigoideos, ECOM, trapézio — dor familiar/referida' },
  { id: 'oclusao', label: 'Oclusão', hint: 'Classe, guias, contatos, desgastes' },
  { id: 'intraoral', label: 'Exame intraoral', hint: 'Mucosa, língua, linha alba, endentações, lesões' },
  { id: 'via_aerea', label: 'Via aérea', hint: 'Mallampati, amígdalas, palato, língua, respiração nasal' },
  { id: 'postura', label: 'Postura / cervical', hint: '' },
  { id: 'exames', label: 'Exames complementares', hint: 'Polissonografia, tomografia, ressonância, audiometria' },
]

export const DEFAULT_REPORT = {
  title: 'Relatório Clínico',
  professional: 'Dra. Francine',
  specialty: 'Cirurgiã-Dentista · DTM, Dor Orofacial e Odontologia do Sono',
  registry: 'CRO-MG 00000',
  city: 'Congonhas',
}

export const DEFAULT_ANAMNESE = {
  enabled: true,
  required: true,      // a ficha faz parte do agendamento (sem ela não conclui)
  askReturning: true,  // paciente que já tem cadastro também preenche (atualiza a ficha a cada consulta)
  intro: 'Esta ficha ajuda a Dra. a entender seu caso antes da consulta. Leva cerca de 5 minutos e tudo fica em sigilo.',
  sections: DEFAULT_SECTIONS,
  exam: DEFAULT_EXAM,
  report: DEFAULT_REPORT,
}

/** configuração atual (Ajustes) com os padrões para o que ainda não foi editado */
export function anamneseConfig(settings) {
  const a = settings?.anamnese || {}
  return {
    ...DEFAULT_ANAMNESE, ...a,
    sections: a.sections?.length ? a.sections : DEFAULT_SECTIONS,
    exam: a.exam?.length ? a.exam : DEFAULT_EXAM,
    report: { ...DEFAULT_REPORT, ...(a.report || {}) },
  }
}

export const isPositive = (v) => {
  if (Array.isArray(v)) return v.length > 0
  if (v && typeof v === 'object') return isPositive(v.v)
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v > 0
  return !NEG.includes(String(v ?? '').trim())
}
/** yesno guarda { v: 'Sim'|'Não', d: 'detalhe' } */
export const answerValue = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v.v : v)

export const visible = (qq, answers) => !qq.showIf || isPositive(answers?.[qq.showIf])

/** texto legível de uma resposta (vazio = não respondida) */
export function answerText(qq, v) {
  if (v === undefined || v === null || v === '') return ''
  switch (qq.type) {
    case 'multi': return (v || []).join(', ')
    case 'scale': return v === '' ? '' : `${v}/10`
    case 'date': return /^\d{4}-\d{2}-\d{2}$/.test(v) ? brDate(v) : String(v)
    case 'consent': return v ? 'Aceito' : ''
    case 'yesno': { const x = typeof v === 'object' ? v : { v }; return x.v ? `${x.v}${x.d ? ` — ${x.d}` : ''}` : '' }
    default: return String(v).trim()
  }
}

/** perguntas obrigatórias sem resposta (só as visíveis) */
export function missingRequired(sections, answers) {
  const out = []
  for (const s of sections) for (const qq of s.questions) {
    if (!qq.required || !visible(qq, answers)) continue
    const v = answers?.[qq.id]
    const empty = qq.type === 'consent' ? !v : qq.type === 'multi' ? !(v || []).length : qq.type === 'yesno' ? !answerValue(v) : String(v ?? '').trim() === ''
    if (empty) out.push(qq)
  }
  return out
}

/** alertas para a ficha (alergia, medicação, doenças, apneia observada…) */
export function anamneseAlertsFrom(sections, answers) {
  const out = []
  if (!answers) return out
  for (const s of sections) for (const qq of s.questions) {
    if (!qq.alert || !visible(qq, answers)) continue
    const v = answers[qq.id]
    if (!isPositive(v)) continue
    if (qq.type === 'multi') (v || []).forEach((x) => out.push(x))
    else if (qq.type === 'yesno') out.push(labelOf(qq) + (v?.d ? `: ${v.d}` : ''))
    else out.push(`${labelOf(qq)}: ${answerText(qq, v)}`)
  }
  return out
}
const labelOf = (qq) => (qq.short || '').trim() || qq.label.replace(/\?$/, '').replace(/\((a|o|s)\)/g, '').replace(/\s*\([^)]*\)/g, '').replace(/^(Tem|Você|Já|Sente|Alguém já viu você)\s+/i, '').trim().replace(/^\w/, (c) => c.toUpperCase())

/** idade a partir de AAAA-MM-DD */
export function ageOf(iso, ref = today()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null
  const [y, m, d] = iso.split('-').map(Number); const [ry, rm, rd] = ref.split('-').map(Number)
  return ry - y - (rm < m || (rm === m && rd < d) ? 1 : 0)
}

/**
 * História clínica gerada das respostas: uma linha por seção (como no relatório de exemplo),
 * só com o que foi respondido de forma positiva. A Dra. pode editar antes de gerar o relatório.
 */
export function historyFromAnswers(sections, answers = {}) {
  const rows = []
  for (const s of sections) {
    if (s.id === 'ident' || s.id === 'final') continue
    const parts = []
    for (const qq of s.questions) {
      if (!visible(qq, answers) || qq.type === 'consent') continue
      const v = answers[qq.id]
      const t = answerText(qq, v)
      if (!t) continue
      if (qq.type === 'yesno') { if (answerValue(v) === 'Sim') parts.push(`${labelOf(qq)}${v?.d ? `: ${v.d}` : ''}`); continue }
      if (qq.type === 'scale' && Number(v) === 0) continue
      if (!isPositive(v)) continue
      parts.push(qq.type === 'textarea' && (qq.id === 'queixa' || qq.id === 'obs') ? t : `${labelOf(qq)}: ${t}`)
    }
    if (parts.length) rows.push({ label: s.title, text: joinSentences(parts) })
  }
  const obs = answers.obs && String(answers.obs).trim()
  if (obs) rows.push({ label: 'Observações', text: obs })
  return rows
}
const joinSentences = (parts) => parts.map((p) => p.trim().replace(/[.;]$/, '')).join('. ') + '.'

/** respostas completas, para o anexo do relatório e a tela da Dra. */
export function answeredList(sections, answers = {}) {
  return sections.map((s) => ({
    title: s.title,
    items: s.questions.filter((qq) => visible(qq, answers)).map((qq) => ({ q: qq, text: answerText(qq, answers[qq.id]) })).filter((x) => x.text),
  })).filter((s) => s.items.length)
}

export const STATUS_ANAMNESE = {
  nova: { label: 'Nova', tone: 'warn' },
  em_analise: { label: 'Em análise', tone: 'info' },
  concluida: { label: 'Concluída', tone: 'good' },
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
