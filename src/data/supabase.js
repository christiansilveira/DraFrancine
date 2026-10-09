import { createClient } from '@supabase/supabase-js'
import { onlyDigits, today } from '../lib/utils'
import { clubOf, isBirthdayMonth, loyaltyOf } from '../lib/loyalty'

/**
 * Adaptador SUPABASE — produção.
 * Tabelas em snake_case (ver supabase/schema.sql); as telas usam camelCase.
 */
const snake = (s) => s.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())
const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
const toDb = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [snake(k), v]))
const fromDb = (o) => {
  const r = Object.fromEntries(Object.entries(o).map(([k, v]) => [camel(k), v]))
  if (typeof r.time === 'string') r.time = r.time.slice(0, 5)
  for (const k of ['price', 'total', 'subtotal', 'discount', 'commissionTotal', 'amount', 'openingAmount', 'closingAmount', 'commission', 'serviceRate', 'productRate', 'goal', 'pct', 'birthdayDiscount', 'productDiscount', 'cardFee', 'cost'])
    if (r[k] !== null && r[k] !== undefined && typeof r[k] === 'string') r[k] = Number(r[k])
  return r
}

export function createSupabaseDB(url, key) {
  const sb = createClient(url, key)
  const must = ({ data, error }) => { if (error) throw new Error(error.message); return data }
  const all = async (t, q = (x) => x) => must(await q(sb.from(t).select('*'))).map(fromDb)
  // tabelas grandes: o Supabase entrega no máximo 1000 linhas por vez, então busca em páginas
  const allPaged = async (t, q = (x) => x) => {
    const out = []
    for (let i = 0; ; i += 1000) {
      const rows = must(await q(sb.from(t).select('*')).order('id').range(i, i + 999))
      out.push(...rows)
      if (rows.length < 1000) break
    }
    return out.map(fromDb)
  }
  // pacotes de sessões (vazio enquanto supabase/PACOTES-E-CORRECAO.sql não foi rodado)
  const pkgs = () => allPaged('packages').catch(() => [])
  // fichas de anamnese (vazio enquanto supabase/ANAMNESE.sql não foi rodado); só a gestão lê
  const anams = (q = (x) => x) => all('anamneses', (x) => q(x.order('created_at', { ascending: false })).limit(1000)).catch(() => [])
  let role = null // 'admin' | 'barber' — define o caminho de leitura/escrita
  /*
   * Configuração financeira (maquininhas, taxas, contas fixas, Pix, custo de material) fica na tabela
   * finance_config, que só a equipe lê. A tabela settings é pública (a página de agendamento lê),
   * então nada disso pode ir para lá. Se o SQL ainda não rodou, cai para o jeito antigo (dentro de settings).
   */
  /*
   * Fotos privadas (ficha da cliente): ficam no local fechado "fotos-privadas" e a url guardada é "priv:caminho".
   * Na hora de mostrar, viram link assinado que expira (6 h). As antigas, que estavam no local público,
   * são movidas uma vez quando a gestão abre o painel.
   */
  const PRIV = 'fotos-privadas'
  const signPhotos = async (list) => {
    const priv = list.filter((p) => String(p.url || '').startsWith('priv:'))
    if (!priv.length) return list
    const r = await sb.storage.from(PRIV).createSignedUrls(priv.map((p) => p.url.slice(5)), 6 * 3600)
    if (r.error) return list
    const byPath = Object.fromEntries((r.data || []).map((x) => [x.path, x.signedUrl]))
    return list.map((p) => (String(p.url || '').startsWith('priv:') ? { ...p, path: p.url.slice(5), url: byPath[p.url.slice(5)] || '' } : p))
  }
  let movedPrivate = false
  const movePrivatePhotos = async (photos) => {
    if (movedPrivate) return; movedPrivate = true
    for (const p of photos.filter((x) => x.private && String(x.url || '').includes('/portfolio/'))) {
      try {
        const path = decodeURIComponent(p.url.split('/portfolio/')[1].split('?')[0])
        const dl = await sb.storage.from('portfolio').download(path); if (dl.error) continue
        const up = await sb.storage.from(PRIV).upload(path, dl.data, { contentType: 'image/jpeg', upsert: true }); if (up.error) return // local fechado ainda não existe (SQL pendente)
        must(await sb.from('photos').update({ url: `priv:${path}` }).eq('id', p.id))
        await sb.storage.from('portfolio').remove([path])
      } catch (e) { console.warn('Não foi possível proteger a foto', p.id, e) }
    }
  }
  let finCache = null // último finance_config lido (null = tabela ainda não existe)
  const loadFinance = () => all('finance_config').then((r) => (finCache = r.find((x) => x.id === 'main')?.data || {})).catch(() => (finCache = null))
  const withFinance = (settings, services) => {
    if (finCache === null) return { settings, services }
    const { materials = {}, ...fin } = finCache
    return {
      settings: settings && { ...settings, privacy: { ...(settings.privacy || {}), finance: { ...(settings.privacy?.finance || {}), ...fin } } },
      services: services.map((s) => (materials[s.id] !== undefined ? { ...s, materialCost: Number(materials[s.id]) } : s)),
    }
  }
  const saveFinance = async (patch) => {
    const data = { ...(finCache || {}), ...patch }
    must(await sb.from('finance_config').upsert({ id: 'main', data }))
    finCache = data
  }

  return {
    mode: 'supabase',
    client: sb,

    async loadPublic() {
      const [settings] = await all('settings')
      const services = await all('services', (q) => q.eq('active', true).order('order'))
      const [barbers, plans, promos, photos] = await Promise.all([
        all('barbers_public'), all('plans', (q) => q.eq('active', true).order('order')), all('promos', (q) => q.eq('active', true)),
        all('photos', (q) => q.eq('private', false).order('created_at', { ascending: false }).limit(60)),
      ])
      return { settings, services, barbers: barbers.map((b) => ({ ...b, rating: { avg: Number(b.ratingAvg || 0), count: Number(b.ratingCount || 0) } })), plans, promos, photos: photos.reverse() }
    },

    async loadAll(session) {
      const since = new Date(); since.setDate(since.getDate() - 120)
      const from = since.toISOString().slice(0, 10)
      const pro = (session?.role || role) === 'barber'
      const [settingsRows, services, products, barbers, sales, payouts, cash, plans, subscriptions, blocks, reviews, promos, photos, announcements] = await Promise.all([
        all('settings'), all('services', (q) => q.order('order')), all('products', (q) => q.order('name')), all('barbers', (q) => q.order('sort').order('name')),
        allPaged('sales', (q) => q.gte('date', from)), all('payouts'), all('cash', (q) => q.order('opened_at', { ascending: false }).limit(60)),
        all('plans', (q) => q.order('order')), all('subscriptions'), allPaged('blocks', (q) => q.gte('date', from)),
        all('reviews'), all('promos'), all('photos', (q) => q.order('created_at', { ascending: false }).limit(400)), all('announcements', (q) => q.order('created_at', { ascending: false }).limit(100)),
      ])
      let clients; let appointments; let waitlist = []; let expenses = []; let staff = []
      if (pro) {
        // profissional: só a agenda dela e, com a privacidade ligada, sem contato das clientes (regra no banco)
        const r = must(await sb.rpc('pro_data'))
        appointments = (r.appointments || []).map(fromDb); clients = (r.clients || []).map(fromDb)
      } else {
        ;[clients, appointments, waitlist, expenses, staff] = await Promise.all([
          allPaged('clients', (q) => q.order('name')), allPaged('appointments', (q) => q.gte('date', from)), all('waitlist', (q) => q.gte('date', today())), all('expenses'), all('staff'),
        ])
      }
      const [packages, recebimentos, anamneses] = await Promise.all([pkgs(), pro ? [] : all('recebimentos', (q) => q.gte('date', from)).catch(() => []), pro ? [] : anams(), loadFinance()])
      const fin = withFinance(settingsRows[0], services)
      if (!pro) movePrivatePhotos(photos) // em segundo plano: protege fotos privadas antigas (uma vez por sessão)
      return { settings: fin.settings, services: fin.services, products, barbers, clients, appointments, sales, payouts, cash, plans, subscriptions, waitlist, blocks, reviews, promos, photos: await signPhotos(photos), expenses, announcements, staff, packages, recebimentos, anamneses }
    },

    // ---- sincronização leve (economiza tráfego do plano gratuito) ----
    /** tabelas pequenas, recarregadas depois de cada ação */
    async loadSmall(session) {
      const since = new Date(); since.setDate(since.getDate() - 120)
      const from = since.toISOString().slice(0, 10)
      const pro = (session?.role || role) === 'barber'
      const [settingsRows, services, products, barbers, payouts, cash, plans, subscriptions, blocks, reviews, promos, announcements] = await Promise.all([
        all('settings'), all('services', (q) => q.order('order')), all('products', (q) => q.order('name')), all('barbers', (q) => q.order('sort').order('name')),
        all('payouts'), all('cash', (q) => q.order('opened_at', { ascending: false }).limit(60)), all('plans', (q) => q.order('order')), all('subscriptions'),
        allPaged('blocks', (q) => q.gte('date', from)), all('reviews'), all('promos'), all('announcements', (q) => q.order('created_at', { ascending: false }).limit(100)),
      ])
      await loadFinance()
      const fin = withFinance(settingsRows[0], services)
      const out = { settings: fin.settings, services: fin.services, products, barbers, payouts, cash, plans, subscriptions, blocks, reviews, promos, announcements, packages: await pkgs() }
      if (!pro) [out.waitlist, out.expenses, out.staff, out.recebimentos, out.anamneses] = await Promise.all([all('waitlist', (q) => q.gte('date', today())), all('expenses'), all('staff'), all('recebimentos', (q) => q.gte('date', from)).catch(() => []), anams()])
      return out
    },
    /** só o que mudou desde a última sincronização (agendamentos, clientes, vendas e avisos) */
    async loadChanges(sinceISO, session) {
      const pro = (session?.role || role) === 'barber'
      const [sales, announcements] = await Promise.all([
        allPaged('sales', (q) => q.gt('created_at', sinceISO)),
        all('announcements', (q) => q.order('created_at', { ascending: false }).limit(100)),
      ])
      if (pro) {
        const r = must(await sb.rpc('pro_data', { p_since: sinceISO }))
        return { appointments: (r.appointments || []).map(fromDb), clients: (r.clients || []).map(fromDb), sales, announcements }
      }
      const [appointments, clients, anamneses] = await Promise.all([
        allPaged('appointments', (q) => q.gt('updated_at', sinceISO)), allPaged('clients', (q) => q.gt('updated_at', sinceISO)), anams((q) => q.gt('updated_at', sinceISO)),
      ])
      return { appointments, clients, sales, announcements, anamneses }
    },

    async busy(date) {
      return must(await sb.rpc('get_busy', { p_date: date })).map(fromDb)
    },

    async book(p) {
      // encaixe da gestão: grava direto, sem a trava de horário ocupado (o site da cliente continua com a trava)
      if (p.force && role === 'admin') {
        const clientId = p.clientId || (await this.upsertClient({ name: p.clientName, phone: p.clientPhone })).id
        const row = fromDb(must(await sb.from('appointments').insert(toDb({ date: p.date, time: p.time, duration: p.duration, barberId: p.barberId, serviceIds: p.serviceIds, clientId, clientName: p.clientName, clientPhone: onlyDigits(p.clientPhone) || p.clientPhone, total: p.total, status: 'agendado', source: 'balcao', notes: p.notes || '' })).select().single()))
        return row
      }
      if (p.clientId && onlyDigits(p.clientPhone).length < 10) {
        const id = must(await sb.rpc('staff_book_client', { p_client_id: p.clientId, p_barber_id: p.barberId, p_service_ids: p.serviceIds, p_date: p.date, p_time: p.time, p_duration: p.duration, p_total: p.total, p_notes: p.notes || '' }))
        return { ...p, id, status: 'agendado' }
      }
      const id = must(await sb.rpc('book_appointment', {
        p_client_name: p.clientName, p_client_phone: onlyDigits(p.clientPhone), p_barber_id: p.barberId,
        p_service_ids: p.serviceIds, p_date: p.date, p_time: p.time, p_duration: p.duration, p_total: p.total,
        p_source: p.source || 'online', p_notes: p.notes || '', p_birthday: p.birthday || null, p_promo: p.promo || null,
      }))
      return { ...p, id, status: 'agendado' }
    },

    async updateAppointment(id, { force: _force, ...patch }) {
      if (role === 'barber') { must(await sb.rpc('pro_update_appointment', { p_id: id, p_patch: toDb(patch) })); return { id, ...patch } }
      return fromDb(must(await sb.from('appointments').update(toDb(patch)).eq('id', id).select().single()))
    },

    async upsert(table, row) {
      if (table === 'clients' && role === 'barber') {
        // fiado/saldo cobrado pela profissional: o banco só aceita DIMINUIR o saldo (dívida nova ou uso de crédito)
        if ('credit' in row) {
          const r = await sb.rpc('staff_set_credit', { p_id: row.id, p_credit: row.credit, p_debt_due: row.debtDue || null })
          if (r.error && !/staff_set_credit|schema cache|function/i.test(r.error.message)) throw new Error(r.error.message)
          if (r.error) console.warn('Rode o SQL FINANCEIRO-AJUSTES.sql: sem ele o fiado lançado pela profissional não grava.')
        }
        if (row.notes !== undefined || row.anamnese !== undefined || row.birthday !== undefined) must(await sb.rpc('pro_update_client', { p_id: row.id, p_patch: { notes: row.notes, anamnese: row.anamnese, birthday: row.birthday } }))
        return row
      }
      // recebimento de fiado: se a tabela ainda não existe (SQL pendente), não atrapalha o abatimento da dívida
      if (table === 'recebimentos') {
        const r = await sb.from(table).upsert(toDb(row)).select().single()
        if (r.error) { console.warn('Recebimento não registrado (rode FINANCEIRO-AJUSTES.sql):', r.error.message); return row }
        return fromDb(r.data)
      }
      // custo de material do procedimento: privado (finance_config), nunca na tabela services (que é pública)
      if (table === 'services' && 'materialCost' in row) {
        const { materialCost, ...svc } = row
        const saved = await this.upsert('services', svc)
        if (finCache !== null && saved?.id) await saveFinance({ materials: { ...(finCache.materials || {}), [saved.id]: Number(materialCost || 0) } })
        return { ...saved, materialCost: Number(materialCost || 0) }
      }
      // colunas novas e opcionais: se o SQL ainda não rodou no banco ("schema cache"), salva sem elas em vez de travar
      const OPTIONAL = ['appointment_id', 'category', 'installments', 'card_fee', 'card_machine', 'cost', 'material_cost', 'debt_due']
      const out = toDb(row)
      for (let i = 0; i < OPTIONAL.length + 1; i++) {
        const res = await sb.from(table).upsert(out).select().single()
        const col = res.error && /schema cache/i.test(res.error.message || '') && /'([^']+)' column/.exec(res.error.message)?.[1]
        if (col && OPTIONAL.includes(col) && col in out) { console.warn(`Coluna ${table}.${col} não existe no banco; salvando sem ela. Rode o SQL pendente.`); delete out[col]; continue }
        return fromDb(must(res))
      }
    },
    async markRead(id) { must(await sb.rpc('mark_announcement_read', { p_id: id })) },
    async linkStaff(email, barberId) { must(await sb.rpc('link_staff', { p_email: email, p_barber_id: barberId })) },

    /** altera só os campos informados (não sobrescreve o resto da linha) */
    async patch(table, id, fields) {
      // mesma tolerância do upsert: coluna nova que ainda não existe no banco é ignorada
      const out = toDb(fields)
      for (;;) {
        const res = await sb.from(table).update(out).eq('id', id).select().single()
        const col = res.error && /schema cache/i.test(res.error.message || '') && /'([^']+)' column/.exec(res.error.message)?.[1]
        if (col && ['appointment_id', 'category', 'installments', 'card_fee', 'card_machine', 'cost', 'material_cost', 'debt_due'].includes(col) && col in out) { delete out[col]; if (!Object.keys(out).length) return null; continue }
        return fromDb(must(res))
      }
    },
    async remove(table, id) { must(await sb.from(table).delete().eq('id', id)) },
    /** vendas de qualquer período (o app só carrega ~120 dias; períodos antigos buscam aqui) */
    async salesRange(from, to) { return allPaged('sales', (q) => q.gte('date', from).lte('date', to)) },

    async saveSettings(s) {
      try { return await this._saveSettings(s) } catch (e) {
        // coluna settings.anamnese ainda não existe (ANAMNESE.sql pendente): salva o resto e avisa
        if (!('anamnese' in s) || !/anamnese/i.test(e.message || '')) throw e
        const { anamnese: _a, ...rest } = s
        await this._saveSettings(rest)
        throw new Error('Ajustes salvos, mas a ficha de anamnese não: rode o arquivo supabase/ANAMNESE.sql no Supabase.')
      }
    },
    async _saveSettings(s) {
      // financeiro vai para a tabela privada; settings (pública) fica sem ele
      const finance = s.privacy?.finance
      if (finance && finCache !== null) {
        await saveFinance({ ...finance, materials: finCache.materials || {} })
        const { finance: _f, ...privacy } = s.privacy
        const saved = fromDb(must(await sb.from('settings').upsert(toDb({ ...s, privacy, id: 'main' })).select().single()))
        return withFinance(saved, []).settings
      }
      return fromDb(must(await sb.from('settings').upsert(toDb({ ...s, id: 'main' })).select().single()))
    },

    async upsertClient(c) {
      return fromDb(must(await sb.rpc('staff_upsert_client', { p_name: c.name, p_phone: onlyDigits(c.phone) })))
    },

    async createSale(sale) {
      // transação no banco: grava venda, baixa estoque e conclui o agendamento
      const id = must(await sb.rpc('create_sale', { p_sale: toDb(sale) }))
      return { ...sale, id }
    },

    async adjustSale(id, a, payment) { must(await sb.rpc('adjust_sale', { p_id: id, p_items: a.items, p_discount: a.discount, p_total: a.total, p_commission_total: a.commissionTotal, p_payment: payment })) },
    async deleteSale(id) { must(await sb.rpc('delete_sale', { p_id: id })) },
    // ---- Importação em lote ----
    async bulkUpsert(table, rows) { for (let i = 0; i < rows.length; i += 500) must(await sb.from(table).upsert(rows.slice(i, i + 500).map(toDb))) },
    async replaceAvecHistory(rows) {
      must(await sb.from('avec_history').delete().gte('id', 0)) // reimportar não duplica
      for (let i = 0; i < rows.length; i += 1000) must(await sb.from('avec_history').insert(rows.slice(i, i + 1000).map(toDb)))
    },
    // ---- Anexos da cliente (bucket privado "anexos") ----
    async clientFiles(clientId) { return all('client_files', (q) => q.eq('client_id', clientId).order('created_at', { ascending: false })).catch(() => []) },
    async uploadClientFile(clientId, file, by) {
      const path = `${clientId}/${Date.now()}-${file.name.normalize('NFD').replace(/[^\w.-]+/g, '_')}`
      must(await sb.storage.from('anexos').upload(path, file, { contentType: file.type || 'application/octet-stream' }))
      return fromDb(must(await sb.from('client_files').insert(toDb({ clientId, name: file.name, path, mime: file.type, size: file.size, createdBy: by })).select().single()))
    },
    async clientFileUrl(f) { return must(await sb.storage.from('anexos').createSignedUrl(f.path, 300)).signedUrl },
    async deleteClientFile(f) { must(await sb.storage.from('anexos').remove([f.path])); must(await sb.from('client_files').delete().eq('id', f.id)) },
    async avecHistory(clientId) { return all('avec_history', (q) => q.eq('client_id', clientId).order('date', { ascending: false }).order('comanda')).catch(() => []) },
    async editSale(id, sale) { must(await sb.rpc('edit_sale', { p_id: id, p_sale: toDb(sale) })) },

    // ---- Portal do cliente ----
    /** "Meus horários": entra pelo link pessoal (token) OU celular + aniversário (dd/mm). Erros: link | dados | semaniversario | bloqueado */
    async clientAccess({ token, phone, birthday }) {
      const r = must(await sb.rpc('client_access', { p_token: token || null, p_phone: onlyDigits(phone), p_birthday: onlyDigits(birthday) }))
      if (!r || r.error) return { error: r?.error || 'dados' }
      const sales = (r.sales || []).map(fromDb)
      const settings = fromDb(r.settings || {})
      const ctx = { subscriptions: (r.subscriptions || []).map(fromDb), plans: (r.plans || []).map(fromDb), sales }
      return {
        token: r.token, client: fromDb(r.client), upcoming: (r.upcoming || []).map(fromDb), last: r.last ? fromDb(r.last) : null,
        loyalty: loyaltyOf(r.client.id, sales, settings), club: clubOf(r.client.id, ctx),
        birthdayMonth: isBirthdayMonth(r.client.birthday), toReview: r.to_review ? fromDb(r.to_review) : null,
      }
    },
    /** Agendar: só saudação e benefícios pelo celular (sem histórico, horários nem cancelamento) */
    async bookingProfile(phone) {
      const r = must(await sb.rpc('booking_profile', { p_phone: onlyDigits(phone) }))
      if (!r) return null
      // vendas resumidas (sem nomes nem valores): só o que a fidelidade e o Clube precisam contar
      const sales = (r.sales || []).map((s) => ({ clientId: 'me', date: s.date, items: s.svc ? [{ type: 'service' }] : [], loyaltyRedeemed: !!s.redeemed, benefit: s.club ? { kind: 'club' } : null }))
      const ctx = { subscriptions: (r.subscriptions || []).map((x) => ({ ...fromDb(x), clientId: 'me' })), plans: (r.plans || []).map(fromDb), sales }
      return {
        client: { name: r.first_name, hasBirthday: !!r.has_birthday }, last: r.last ? fromDb(r.last) : null,
        loyalty: loyaltyOf('me', sales, fromDb(r.settings || {})), club: clubOf('me', ctx), birthdayMonth: !!r.birthday_month,
      }
    },
    /** paciente envia a ficha de anamnese (o banco confere o WhatsApp do agendamento) */
    async submitAnamnese({ appointmentId, phone, answers, questions }) {
      return must(await sb.rpc('submit_anamnese', { p_appointment_id: appointmentId, p_phone: onlyDigits(phone), p_answers: answers, p_questions: questions }))
    },
    async checkAnamnese(appointmentId, phone) {
      const r = must(await sb.rpc('check_anamnese', { p_appointment_id: appointmentId, p_phone: onlyDigits(phone) }))
      return r ? { firstName: r.first_name, date: r.date, time: r.time, cancelled: r.cancelled, status: r.status } : null
    },
    async clientCancel(id, token) { must(await sb.rpc('client_cancel_v2', { p_id: id, p_token: token })) },
    async joinWaitlist(w) {
      must(await sb.rpc('join_waitlist', { p_date: w.date, p_barber_id: w.barberId, p_period: w.period, p_name: w.clientName, p_phone: onlyDigits(w.phone), p_service_ids: w.serviceIds || [] }))
    },
    async reviewTarget(saleId) { const r = must(await sb.rpc('review_target', { p_sale_id: saleId })); return r ? fromDb(r) : null },
    async submitReview({ saleId, stars, comment }) { must(await sb.rpc('submit_review', { p_sale_id: saleId, p_stars: stars, p_comment: comment || '' })) },
    async uploadAvatar(barberId, dataUrl) {
      const blob = await (await fetch(dataUrl)).blob()
      const path = `${barberId || 'equipe'}/avatar-${Date.now()}.jpg`
      must(await sb.storage.from('portfolio').upload(path, blob, { contentType: 'image/jpeg' }))
      return sb.storage.from('portfolio').getPublicUrl(path).data.publicUrl
    },
    async savePhoto({ barberId, clientId, appointmentId, dataUrl, caption, isPrivate = false }) {
      const blob = await (await fetch(dataUrl)).blob()
      const path = `${barberId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
      // foto privada: local fechado (só a equipe, com link que expira); se o SQL ainda não criou o local, usa o antigo
      if (isPrivate) {
        const up = await sb.storage.from(PRIV).upload(path, blob, { contentType: 'image/jpeg' })
        if (!up.error) return (await signPhotos([fromDb(must(await sb.from('photos').insert(toDb({ barberId, clientId, appointmentId, url: `priv:${path}`, caption, private: true })).select().single()))]))[0]
      }
      must(await sb.storage.from('portfolio').upload(path, blob, { contentType: 'image/jpeg' }))
      const url = sb.storage.from('portfolio').getPublicUrl(path).data.publicUrl
      return fromDb(must(await sb.from('photos').insert(toDb({ barberId, clientId, appointmentId, url, caption, private: isPrivate })).select().single()))
    },
    async backup() {
      const T = ['settings', 'services', 'products', 'barbers', 'clients', 'appointments', 'sales', 'payouts', 'cash', 'plans', 'subscriptions', 'waitlist', 'blocks', 'reviews', 'promos', 'photos', 'expenses', 'announcements', 'packages', 'client_files', 'anamneses']
      const out = {}
      // tabelas novas podem não existir se o SQL ainda não rodou: viram lista vazia
      for (const t of T) out[t] = ['packages', 'client_files', 'anamneses'].includes(t) ? await allPaged(t).catch(() => []) : await allPaged(t)
      return out
    },
    async deletePhoto(id) {
      const row = (await sb.from('photos').select('url').eq('id', id).maybeSingle()).data
      const path = must(await sb.rpc('delete_photo', { p_id: id }))
      if (row?.url?.startsWith('priv:')) await sb.storage.from(PRIV).remove([row.url.slice(5)])
      else if (path) await sb.storage.from('portfolio').remove([decodeURIComponent(path)])
    },
    async bulkImport({ services = [], products = [], clients = [] }) {
      const [sv, pr] = await Promise.all([all('services'), all('products')])
      const byName = (list, n) => list.find((x) => x.name.toLowerCase() === n.toLowerCase())
      for (const x of services) must(await sb.from('services').upsert(toDb({ ...(byName(sv, x.name) || { active: true }), ...x })))
      for (const x of products) must(await sb.from('products').upsert(toDb({ ...(byName(pr, x.name) || { active: true }), ...x })))
      if (clients.length) must(await sb.from('clients').upsert(clients.map((c) => toDb({ ...c, birthday: c.birthday || null })), { onConflict: 'phone' }))
      return services.length + products.length + clients.length
    },

    async login({ email, password }) {
      must(await sb.auth.signInWithPassword({ email, password }))
      return this.session()
    },
    async logout() { role = null; await sb.auth.signOut() },

    // ---- Notificações push ----
    async savePush(sub, ua) { must(await sb.rpc('save_push_subscription', { p_endpoint: sub.endpoint, p_keys: sub.keys, p_user_agent: (ua || '').slice(0, 300) })) },
    async saveClientPush(sub, phone, ua, token) {
      const r = await sb.rpc('save_client_push_v2', { p_endpoint: sub.endpoint, p_keys: sub.keys, p_phone: onlyDigits(phone), p_token: token || null, p_user_agent: (ua || '').slice(0, 300) })
      // SQL novo ainda não rodou: usa a função antiga
      if (r.error && /save_client_push_v2|schema cache|function/i.test(r.error.message)) return must(await sb.rpc('save_client_push', { p_endpoint: sub.endpoint, p_keys: sub.keys, p_phone: onlyDigits(phone), p_user_agent: (ua || '').slice(0, 300) }))
      must(r)
    },
    async notifyAppointment(id) {
      const { data, error } = await sb.functions.invoke('send-push', { body: { type: 'manual', id } })
      if (error) throw new Error('A função de envio não respondeu. Tente de novo em instantes.')
      return data
    },
    async confirmInfo(id, token) { return must(await sb.rpc('confirm_info', { p_id: id, p_token: token })) },
    async confirmAppointment(id, token) { return must(await sb.rpc('client_confirm', { p_id: id, p_token: token })) },
    async createStaffLogin(email, password, barberId) {
      const { data, error } = await sb.functions.invoke('send-push', { body: { type: 'create_staff', email, password, barber_id: barberId } })
      if (error) { let m = ''; try { m = (await error.context.json()).error } catch { /* sem detalhe */ } throw new Error(m || 'Não foi possível criar o acesso. Confira se a função send-push foi atualizada.') }
      return data
    },
    async removePush(endpoint) { must(await sb.rpc('delete_push_subscription', { p_endpoint: endpoint })) },
    async testPush() {
      const { data, error } = await sb.functions.invoke('send-push', { body: { type: 'test' } })
      if (error) throw new Error('A função de envio não respondeu. Confira se "send-push" foi publicada no Supabase.')
      if (!data?.sent) throw new Error('Nenhum aparelho ativado para este login. Toque em "Ativar neste aparelho" primeiro.')
      return data
    },
    async session() {
      const { data } = await sb.auth.getSession()
      if (!data.session) return null
      const prof = must(await sb.from('staff').select('*').eq('user_id', data.session.user.id).maybeSingle())
      if (!prof) throw new Error('Este login ainda não tem acesso ao painel. Peça para a gestão vincular seu e-mail em Equipe.')
      role = prof.role
      return { role: prof.role, name: prof.name, barberId: prof.barber_id }
    },

    reset() {},
  }
}
