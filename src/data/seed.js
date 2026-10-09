import { addDays, today, toHHMM, uid, weekday, round2 } from '../lib/utils'
import { commissionRate } from '../lib/commission'

/** PRNG determinístico para dados de demonstração estáveis */
function rng(seed) {
  let a = seed >>> 0
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

export function buildSeed() {
  const r = rng(20260924)
  const pick = (arr) => arr[Math.floor(r() * arr.length)]

  const settings = {
    id: 'main',
    shopName: 'Dra. Francine',
    whatsapp: '31999990000',
    address: 'Endereço do consultório — Congonhas/MG',
    instagram: '@drafrancine',
    messages: {},
    notify: { newBooking: true, reminderMinutes: 15, dailySummary: true, browser: true, pollSeconds: 60 },
    privacy: { hideContacts: true },
    page: { heroText: '', notice: '' },
    slotStep: 30,
    bookingDaysAhead: 30,
    hours: { 0: null, 1: ['08:00', '18:00'], 2: ['08:00', '18:00'], 3: ['08:00', '18:00'], 4: ['08:00', '18:00'], 5: ['08:00', '17:00'], 6: null },
    breakTime: ['12:00', '13:30'],
    loyalty: { enabled: false, goal: 10, rewardServiceId: 's7' },
    birthdayDiscount: 0,
    googleReviewUrl: '',
    clubEnabled: false,
    waitlistEnabled: true,
    anamnese: null, // null = perguntas padrão (lib/anamnese.js); editáveis em Ajustes
  }

  const services = [
    { id: 's1', name: 'Avaliação de DTM e Dor Orofacial', description: 'Avaliação · Consulta inicial com exame da ATM, músculos e oclusão', duration: 60, price: 400, commission: 0, active: true, order: 1 },
    { id: 's2', name: 'Avaliação de Ronco e Apneia', description: 'Avaliação · Sono, via aérea e indicação de aparelho intraoral', duration: 60, price: 400, commission: 0, active: true, order: 2 },
    { id: 's3', name: 'Consulta de Retorno', description: 'Retorno · Acompanhamento do tratamento', duration: 30, price: 200, commission: 0, active: true, order: 3 },
    { id: 's4', name: 'Placa Oclusal Miorrelaxante', description: 'Tratamento · Moldagem/escaneamento e instalação da placa', duration: 60, price: 1200, commission: 0, active: true, order: 4 },
    { id: 's5', name: 'Aparelho Intraoral para Ronco e Apneia', description: 'Tratamento · Aparelho de avanço mandibular', duration: 60, price: 3500, commission: 0, active: true, order: 5 },
    { id: 's6', name: 'Laserterapia', description: 'Tratamento · Fotobiomodulação para dor e inflamação', duration: 30, price: 150, commission: 0, active: true, order: 6 },
    { id: 's7', name: 'Agulhamento Seco', description: 'Tratamento · Pontos-gatilho miofasciais', duration: 30, price: 200, commission: 0, active: true, order: 7 },
    { id: 's8', name: 'Toxina Botulínica para Bruxismo', description: 'Tratamento · Masseter e temporal', duration: 45, price: 1500, commission: 0, active: true, order: 8 },
    { id: 's9', name: 'Ajuste de Placa', description: 'Retorno · Controle e ajuste oclusal', duration: 30, price: 150, commission: 0, active: true, order: 9 },
  ]

  const products = [
    { id: 'p1', name: 'Estojo para placa', price: 35, stock: 20, commission: 0, active: true },
    { id: 'p2', name: 'Pastilha de limpeza para placa (30 un.)', price: 59, stock: 12, commission: 0, active: true },
    { id: 'p3', name: 'Bolsa térmica facial', price: 69, stock: 8, commission: 0, active: true },
  ]

  const barbers = [
    { id: 'b1', goal: 60000, name: 'Dra. Francine', phone: '31988881111', pin: '1111', color: '#F5A800', serviceRate: 0, productRate: 0, daysOff: [0, 6], active: true, bio: 'DTM, dor orofacial e sono' },
    { id: 'b2', goal: 0, name: 'Laura Mendes', phone: '31988882222', pin: '2222', color: '#D9202B', serviceRate: 0, productRate: 0, daysOff: [0, 6], active: true, bio: 'Fisioterapeuta · ATM e cervical', serviceIds: ['s6', 's7'] },
  ]
  const first = ['Mariana', 'Fernanda', 'Beatriz', 'Larissa', 'Gabriela', 'Isabela', 'Letícia', 'Carolina', 'Patrícia', 'Renata', 'João', 'Aline', 'Marcos', 'Débora', 'Natália', 'Helena', 'Roberto', 'Tatiane', 'Sofia', 'Paulo', 'Cristina', 'Eduardo', 'Paula', 'Ricardo']
  const last = ['Silva', 'Souza', 'Oliveira', 'Pereira', 'Rocha', 'Carvalho', 'Ferreira', 'Ribeiro', 'Gomes', 'Barbosa', 'Moraes', 'Teixeira']
  const clients = Array.from({ length: 42 }, (_, i) => ({
    id: `c${i + 1}`,
    name: `${pick(first)} ${pick(last)}`,
    phone: `3199${String(1000000 + Math.floor(r() * 8999999)).slice(0, 7)}`,
    notes: i % 7 === 0 ? 'Prefere horários pela manhã' : '',
    createdAt: addDays(today(), -120 + Math.floor(r() * 40)),
    birthday: r() < 0.7 ? (i % 8 === 0 ? today().slice(5, 8) : String(1 + Math.floor(r() * 12)).padStart(2, '0') + '-') + String(1 + Math.floor(r() * 28)).padStart(2, '0') : '',
  }))
  clients.forEach((c) => { c.anamnese = { prontuario: [] } })
  // cliente de teste para "Meus horários"
  clients[0].name = 'Mariana Silva'; clients[0].phone = '31999990001'; clients[0].birthday = today().slice(5, 8) + '12'

  const appointments = []
  const sales = []
  const t = today()
  const weighted = ['s1', 's1', 's2', 's3', 's3', 's3', 's4', 's6', 's6', 's7', 's9', 's9']

  for (let d = -70; d <= 6; d++) {
    const date = addDays(t, d)
    const wd = weekday(date)
    const hours = settings.hours[wd]
    if (!hours) continue
    for (const b of barbers) {
      if (b.daysOff.includes(wd)) continue
      const [oh] = hours[0].split(':').map(Number)
      const [ch] = hours[1].split(':').map(Number)
      let m = oh * 60
      const fill = (b.serviceIds ? 0.25 : 1) * (d < 0 ? 0.45 : d === 0 ? 0.55 : Math.max(0.12, 0.5 - d * 0.06))
      while (m < ch * 60 - 30) {
        const sid = b.serviceIds ? pick(b.serviceIds) : pick(weighted)
        const svc = services.find((s) => s.id === sid)
        const extra = !b.serviceIds && sid === 's3' && r() < 0.25 ? services.find((s) => s.id === 's6') : null // retorno + laser
        const picked = extra ? [svc, extra] : [svc]
        const totalDur = picked.reduce((a, x) => a + x.duration, 0)
        const dur = Math.ceil(totalDur / 30) * 30
        if (m + dur > ch * 60) break
        if (r() < fill) {
          const c = d > -45 ? pick(clients.slice(0, 35)) : pick(clients) // 7 clientes "sumidos" para a campanha
          const time = toHHMM(m)
          let status = 'agendado'
          if (d < 0) status = r() < 0.06 ? 'faltou' : r() < 0.04 ? 'cancelado' : 'concluido'
          else if (d === 0) status = m < 12 * 60 ? 'concluido' : r() < 0.5 ? 'confirmado' : 'agendado'
          else status = r() < 0.4 ? 'confirmado' : 'agendado'
          const appt = {
            id: uid(), date, time, duration: totalDur, barberId: b.id, serviceIds: picked.map((x) => x.id),
            clientId: c.id, clientName: c.name, clientPhone: c.phone, total: picked.reduce((a, x) => a + x.price, 0),
            status, source: r() < 0.72 ? 'online' : 'balcao', notes: '', saleId: null,
            createdAt: addDays(date, -Math.floor(r() * 5)),
          }
          if (status === 'concluido') {
            const items = picked.map((x) => ({ type: 'service', refId: x.id, name: x.name, price: x.price, qty: 1 }))
            if (r() < 0.28) { const p = pick(products); items.push({ type: 'product', refId: p.id, name: p.name, price: p.price, qty: 1 }) }
            const full = items.map((it) => {
              const src = it.type === 'service' ? services.find((s) => s.id === it.refId) : products.find((p) => p.id === it.refId)
              const rate = commissionRate(it.type, src, b)
              return { ...it, commissionRate: rate, commission: round2(it.price * it.qty * rate / 100) }
            })
            const total = full.reduce((a, x) => a + x.price * x.qty, 0)
            const sale = {
              id: uid(), date, time: toHHMM(m + dur), barberId: b.id, clientId: c.id, clientName: c.name,
              appointmentId: appt.id, items: full, subtotal: total, discount: 0, total,
              payment: pick(['pix', 'pix', 'pix', 'credito', 'debito', 'dinheiro']),
              commissionTotal: round2(full.reduce((a, x) => a + x.commission, 0)),
              createdAt: `${date}T${toHHMM(m + dur)}:00`,
            }
            appt.saleId = sale.id
            sales.push(sale)
          }
          appointments.push(appt)
        }
        m += dur
      }
    }
  }

  // Pagamentos de comissão já realizados (semanas anteriores)
  const payouts = []
  for (let w = 9; w >= 2; w--) {
    const from = addDays(t, -w * 7)
    const to = addDays(from, 6)
    for (const b of barbers) {
      const amount = round2(sales.filter((s) => s.barberId === b.id && s.date >= from && s.date <= to).reduce((a, s) => a + s.commissionTotal, 0))
      if (amount > 0) payouts.push({ id: uid(), barberId: b.id, from, to, amount, paidAt: addDays(to, 1), note: 'Acerto semanal' })
    }
  }

  // ---------- Runas: resgates já feitos (cada cliente fica com 0 ou 1 prêmio disponível) ----------
  const goalR = settings.loyalty.goal
  clients.forEach((c, idx) => {
    const mine = sales.filter((sa) => sa.clientId === c.id).sort((a, b) => a.date.localeCompare(b.date))
    let visits = mine.length; let redeemed = 0
    const desired = idx % 3 === 0 ? 1 : 0
    for (const sa of mine) {
      if (Math.floor(visits / goalR) - redeemed <= desired) break
      sa.loyaltyRedeemed = true; sa.benefit = { kind: 'runas', label: 'Fidelidade: procedimento de presente', amount: 0 }
      visits--; redeemed++
    }
  })

  // ---------- Clube (assinaturas) — desligado por padrão (Ajustes) ----------
  const plans = [
    { id: 'pl1', name: 'Acompanhamento DTM', price: 290, description: '1 retorno + 1 laserterapia por mês', serviceIds: ['s3', 's6'], limit: 2, productDiscount: 10, active: true, order: 1 },
  ]
  const subscriptions = []

  // ---------- Lista de espera ----------
  const waitlist = [
    { id: uid(), date: addDays(t, 1), barberId: 'b1', period: 'tarde', clientName: 'Juliana Tavares', phone: '31991234567', serviceIds: ['s1'], status: 'aguardando', createdAt: t },
    { id: uid(), date: addDays(t, 2), barberId: null, period: 'qualquer', clientName: 'Paulo Henriques', phone: '31997654321', serviceIds: ['s2'], status: 'aguardando', createdAt: t },
  ]

  // ---------- Folgas / bloqueios de horário ----------
  const blocks = [
    { id: uid(), barberId: 'b1', date: addDays(t, 1), start: '14:00', end: '16:00', reason: 'Curso de odontologia do sono' },
  ]

  // ---------- Avaliações pós-atendimento ----------
  const comments = ['Depois da placa voltei a dormir sem dor!', 'Atendimento atencioso, explicou tudo com calma.', 'Minha dor de cabeça diminuiu muito.', 'Pontual e muito profissional.', '', '', 'Excelente, recomendo.']
  const reviews = sales.filter(() => r() < 0.25).map((sa) => {
    const x = r()
    return { id: uid(), saleId: sa.id, barberId: sa.barberId, clientName: sa.clientName, stars: x < 0.78 ? 5 : x < 0.95 ? 4 : 3, comment: pick(comments), createdAt: sa.date }
  })

  const promos = []

  // ---------- Despesas (Lucro real) ----------
  const curMonth = t.slice(0, 7)
  const prevMonth = addDays(t.slice(0, 8) + '01', -1).slice(0, 7)
  const expenses = []
  for (const m of [addDays(t.slice(0, 8) + '01', -40).slice(0, 7), prevMonth, curMonth]) {
    for (const [category, description, amount] of [['Aluguel', 'Aluguel do consultório', 3200], ['Energia', 'Cemig', 380], ['Água', 'Copasa', 110], ['Internet', 'Fibra', 120], ['Produtos', 'Laboratório de placas e materiais', 2400], ['Marketing', 'Anúncios Instagram', 300]]) {
      expenses.push({ id: uid(), month: m, category, description, amount })
    }
  }

  const cash = [{ id: uid(), openedAt: `${t}T07:45:00`, openingAmount: 100, closedAt: null, closingAmount: null, note: '' }]

  // ---------- Avisos da gestão para a equipe ----------
  const announcements = [
    { id: uid(), title: 'Bem-vinda ao novo sistema!', message: 'Os agendamentos e as fichas de anamnese dos pacientes chegam por aqui. Toque em "Ciente" nos avisos.', audience: 'all', important: true, expiresAt: null, active: true, createdAt: `${t}T08:00:00`, reads: {} },
  ]

  // ---------- Fichas de anamnese de exemplo ----------
  const future = appointments.filter((a) => a.date >= t && a.barberId === 'b1' && ['agendado', 'confirmado'].includes(a.status)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const past = appointments.filter((a) => a.date < t && a.barberId === 'b1' && a.status === 'concluido').sort((a, b) => b.date.localeCompare(a.date))
  const ago = (days, h = '10:00') => `${addDays(t, -days)}T${h}:00`
  const anamneses = []
  const sample1 = {
    nascimento: '1978-04-12', sexo: 'Feminino', convenio: '', profissao: 'Professora', indicacao: 'Dr. Hudson (otorrino)',
    queixa: 'Dor no lado direito do rosto e perto do ouvido, pior de manhã. Estalo ao abrir a boca.', inicio: '6 meses a 1 ano', dor_hoje: 6, dor_pior: 8,
    dor_local: ['ATM / mandíbula direita', 'Têmporas', 'Ouvido'], dor_tipo: ['Peso / pressão', 'Cansaço muscular'], dor_freq: 'Todos os dias', dor_piora: ['Mastigar', 'Ao acordar', 'Estresse'],
    estalo: { v: 'Sim' }, crepitacao: { v: 'Não' }, travou_fechada: { v: 'Não' }, travou_aberta: { v: 'Não' }, limitacao: { v: 'Sim' }, cansaco_mastigar: { v: 'Sim' }, lado_mastigar: 'Esquerdo',
    range_noite: { v: 'Sim' }, aperta_dia: { v: 'Sim' }, acorda_dor: { v: 'Sim' }, desgaste: { v: 'Sim' }, habitos: ['Roer unhas', 'Apoiar a mão no queixo'],
    cefaleia: { v: 'Sim' }, cef_freq: '2 a 3 vezes por semana', cef_local: ['Têmporas'], enxaqueca: { v: 'Não' }, cef_remedio: '8',
    zumbido: { v: 'Sim' }, zumbido_lado: 'Direito', ouvido_tampado: { v: 'Sim' }, otalgia: { v: 'Sim' }, tontura: { v: 'Não' }, audicao: { v: 'Não' },
    ronco: 'Às vezes', apneia_vista: { v: 'Não' }, cansaco: { v: 'Sim' }, sonolencia: 'Raramente', horas_sono: '6', polissono: { v: 'Não' }, cpap: 'Nunca usei',
    doencas: ['Ansiedade', 'Refluxo / gastrite'], medicamentos: 'Escitalopram 10 mg; Pantoprazol 20 mg', alergias: 'Dipirona', estresse: 8, atividade: 'Não pratico',
    ultimo_dentista: '6 meses a 1 ano', protese: 'Não', sensibilidade: { v: 'Sim' }, ferida: { v: 'Não' }, ardencia: { v: 'Não' }, consentimento: true,
  }
  const sample2 = {
    nascimento: '1961-03-05', sexo: 'Masculino', convenio: 'Asapec', profissao: 'Aposentado', indicacao: 'Otorrino',
    queixa: 'Ronco alto e cansaço durante o dia. Fez polissonografia e não se adaptou ao CPAP.', inicio: 'Mais de 5 anos', dor_hoje: 0, dor_pior: 2,
    ronco: 'Todas as noites', apneia_vista: { v: 'Sim' }, engasgo: { v: 'Sim' }, cansaco: { v: 'Sim' }, sonolencia: 'Frequentemente', horas_sono: '7', boca_seca: { v: 'Sim' }, nariz: { v: 'Sim' },
    polissono: { v: 'Sim', d: '2025, IAH 28 (moderada)' }, cpap: 'Tentei e não me adaptei', peso: '92', altura: '1,74',
    range_noite: { v: 'Sim' }, otalgia: { v: 'Sim' }, doencas: ['Pressão alta', 'Refluxo / gastrite'], medicamentos: 'Olmesartana + anlodipino; Pantoprazol 20 mg; AAS 100 mg', alergias: '',
    protese: 'Prótese fixa', consentimento: true,
  }
  if (future[0]) anamneses.push({ id: uid(), clientId: future[0].clientId, appointmentId: future[0].id, source: 'online', status: 'nova', answers: sample1, questions: [], evaluation: {}, createdAt: ago(1, '21:14'), updatedAt: ago(1, '21:14') })
  if (future[2]) anamneses.push({ id: uid(), clientId: future[2].clientId, appointmentId: future[2].id, source: 'online', status: 'nova', answers: sample2, questions: [], evaluation: {}, createdAt: ago(0, '07:40'), updatedAt: ago(0, '07:40') })
  if (past[3]) anamneses.push({
    id: uid(), clientId: past[3].clientId, appointmentId: past[3].id, source: 'online', status: 'concluida', answers: { ...sample1, nascimento: '1990-09-21', dor_hoje: 7, zumbido: { v: 'Não' }, otalgia: { v: 'Não' }, medicamentos: '', alergias: '' }, questions: [],
    evaluation: {
      date: past[3].date,
      history: [
        { label: 'Queixa', text: 'Dor na região da ATM direita e têmporas há 1 ano, pior ao acordar, com estalo à abertura.' },
        { label: 'Bruxismo', text: 'Range os dentes dormindo e aperta durante o dia. Desgaste relatado pelo dentista.' },
        { label: 'Cefaleia', text: 'Dor de cabeça temporal 2 a 3 vezes por semana, analgésico 8 dias/mês.' },
      ],
      exam: { abertura: 'Sem dor 32 mm · ativa máx. 38 mm · passiva 42 mm', movimentos: 'Lateralidade D 8 mm, E 6 mm; protrusão 6 mm; desvio para a direita na abertura', atm: 'Estalo recíproco à direita; dor à palpação lateral da ATM D', musculos: 'Dor familiar em masseter e temporal anterior bilateral, maior à direita', intraoral: 'Linha alba e endentação lingual; facetas de desgaste em caninos' },
      diagnosis: 'Mialgia mastigatória local (DC/TMD)\nDeslocamento de disco com redução à direita\nBruxismo do sono e de vigília prováveis\nCefaleia atribuída à DTM',
      conduct: 'Placa estabilizadora miorrelaxante superior\nLaserterapia em masseter e ATM (4 sessões)\nOrientações de autocuidado, compressa morna e higiene do sono\nRetorno em 15 dias para ajuste da placa',
    },
    createdAt: ago(Math.max(1, (new Date(t) - new Date(past[3].date)) / 86400000 + 1)), updatedAt: ago(1),
  })

  return { settings, services, products, barbers, clients, appointments, sales, payouts, cash, expenses, plans, subscriptions, waitlist, blocks, reviews, promos, announcements, anamneses, photos: [], seedDate: today(), touched: false }
}