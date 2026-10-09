# Dra. Francine · DTM, Dor Orofacial e Sono · Agendamento e Gestão

Sistema da Astrovia Solutions feito para a **Dra. Francine** (cirurgiã-dentista: DTM e dor orofacial, ronco, apneia, bruxismo, cefaleia, zumbido e patologias orais): site de agendamento para os pacientes, **ficha de anamnese preenchida no agendamento**, avaliação clínica da Dra. e **relatório clínico em PDF**, com o mesmo painel de gestão do sistema da Lu Wolcher.

- **Sem `.env`**, o sistema abre em **modo demonstração**: os dados de exemplo ficam salvos no navegador. PIN da Dra. **1234** e da equipe **1111 / 2222**.
- **Com `.env`** (dados do Supabase), o sistema funciona **online de verdade**: a dona, a equipe e as clientes usam o mesmo sistema, cada uma com o seu login.

---

## O que o sistema faz

| Área | Recursos |
|---|---|
| **Ficha de anamnese** | O paciente preenche logo depois de reservar (por partes, no celular) ou pelo link #/ficha/<id> que a Dra. envia pelo WhatsApp do agendamento. Perguntas de DTM, dor orofacial, bruxismo, cefaleia, zumbido, sono/apneia, saúde geral e bucal — todas editáveis em **Ajustes → Ficha de anamnese** |
| **Avaliação e relatório** | Menu **Anamneses**: fichas novas/em análise/concluídas, alertas (alergia, medicação, apneia presenciada…), a Dra. completa as respostas, gera a história clínica, preenche exame físico, hipótese diagnóstica e conduta e baixa o **relatório em PDF** (modelo do RELATORIO EXEMPLO, com a logo e a assinatura/CRO) |
| **Site de agendamento** | Busca e categorias de procedimentos, vários serviços de uma vez, profissional que faz cada serviço, horário de almoço de cada uma, "Meus horários", lembrete no celular (1 dia, 1 hora e 15 min antes) e botão "Salvar na agenda" |
| **Agenda** | Dia, semana, mês e período. Encaixe fora do horário (a cliente não vê), bloqueios editáveis, busca, lista de espera, sala compartilhada, aviso de conflito com sugestão de horário |
| **Atendimento** | Editar agendamento, observações, dividir serviços entre profissionais com valor, link de confirmação ✅, lembrete no WhatsApp e notificação no celular |
| **Caixa** | Pix, cartão e dinheiro, desconto e adicional, comissão automática. Pode ficar só com a dona (Ajustes → Privacidade) |
| **Clientes** | Ficha com anamnese e alertas, portfólio antes/depois, histórico com busca, edição de nome e WhatsApp |
| **Equipe** | Serviços que cada uma faz, tempo e comissão por procedimento, almoço, sala, acesso por e-mail criado pelo painel |
| **Gestão** | Relatórios e extratos em PDF, lucro real, clube de assinatura, fidelidade, aniversariantes, avaliações, avisos para a equipe, modo TV |
| **Notificações push** | Novo agendamento, cancelamento, alteração, confirmação, venda, avaliação, lista de espera, estoque baixo e resumo do dia |

---

## Colocar no ar (Supabase + GitHub + Vercel)

São três contas gratuitas: **Supabase** (banco e login), **GitHub** (guarda o código) e **Vercel** (publica o site).
O banco começa **vazio**: sem pacientes, vendas ou equipe de exemplo. A Dra. cadastra tudo pelo painel.

Arquivos que ficam **fora** desta pasta (na pasta `Dra Francine`) e **nunca vão para o GitHub**:
`CHAVES-PUSH.txt` (chaves das notificações) e `ATIVAR-PUSH.sql` (senha interna da função de envio).

### 1. Supabase (banco de dados)

1. supabase.com → **New project**. Nome: `dra-francine`. Região: **South America (São Paulo)**. Guarde a senha do banco.
2. **SQL Editor → New query** → cole o arquivo `supabase/INSTALAR-SUPABASE.sql` **inteiro** → **Run**. Deve aparecer "Success".
   (Ele junta, na ordem certa, o `schema.sql` e todos os complementos, incluindo a ficha de anamnese. Pode rodar de novo sem perder dados.)
3. **Authentication → Users → Add user → Create new user**: e-mail e senha da **Dra.**, com **Auto Confirm User** marcado.
4. De volta ao **SQL Editor**, rode trocando o e-mail:
   ```sql
   insert into staff(user_id, role, name, email)
   select id, 'admin', 'Dra. Francine', email from auth.users where email = 'EMAIL-DA-DRA';
   ```
5. **Authentication → Sign In / Providers**: deixe **Email** ligado e desligue "Allow new users to sign up".
6. **Project Settings → API**: copie a **Project URL** e a chave **anon public** (vão para a Vercel no passo 3).

### 2. GitHub (código)

1. Crie um repositório **privado** chamado `dra-francine`.
2. Envie o conteúdo da pasta `Sistema Dra Francine` **sem** `node_modules`, `dist` e `.env`.
   O jeito mais fácil: descompacte `dra-francine-github.zip` (na pasta `Dra Francine`) e arraste os arquivos em **Add file → Upload files**.

### 3. Vercel (site)

1. vercel.com → **Add New → Project** → importe o repositório `dra-francine`. O `vercel.json` já configura Vite, build e pasta `dist`.
2. **Environment Variables**:
   - `VITE_SUPABASE_URL` = Project URL do Supabase
   - `VITE_SUPABASE_ANON_KEY` = chave anon public
   - `VITE_VAPID_PUBLIC_KEY` = valor do `CHAVES-PUSH.txt`
3. **Deploy**. O link fica no formato `dra-francine.vercel.app` (dá para ligar um domínio próprio depois em Settings → Domains).

> Pelos termos da Vercel, o plano Hobby (gratuito) é para uso não comercial. Para uso comercial use o plano Pro, ou Netlify / Cloudflare Pages com as mesmas configurações.

### 4. Notificações no celular (push)

1. **Supabase → Edge Functions → Deploy a new function → Via Editor**: nome **`send-push`** (exatamente assim). Cole `supabase/functions/send-push/index.ts` → **Deploy**. Nos detalhes da função, **desligue "Verify JWT"** e salve.
2. **Edge Functions → Secrets**: adicione os 4 segredos do `CHAVES-PUSH.txt` (troque o e-mail do `VAPID_SUBJECT`).
3. **SQL Editor**: abra o `ATIVAR-PUSH.sql`, troque `SEU-PROJETO` pelo código do projeto (o da Project URL) e rode.
4. No celular da Dra.: abra o site → Área da equipe → **Ativar** no aviso. No iPhone, antes: Compartilhar → **Adicionar à Tela de Início** e abrir pelo ícone.

### 5. Primeiro acesso da Dra.

1. Abra o link → **Área da equipe** → e-mail e senha criados no passo 1.
2. **Ajustes**: nome, WhatsApp, endereço, Instagram, horários e mensagens. Em **Ficha de anamnese e relatório**: confira as perguntas e coloque **nome, especialidade, CRO e cidade** da assinatura do relatório. **Salvar**.
3. **Catálogo**: cadastre as consultas e procedimentos com preço e duração (o site de agendamento só mostra o que estiver aqui).
4. **Equipe**: cadastre a Dra. (e quem mais atender), com dias de folga e almoço.
5. Teste: faça um agendamento pelo site com seu próprio WhatsApp, preencha a ficha e veja chegar em **Anamneses**.
6. Copie o link de agendamento (Ajustes → Link de agendamento) para a bio do Instagram e a mensagem automática do WhatsApp.

### Dicas

- **Pausa do Supabase**: no plano gratuito, projetos sem nenhum acesso por 7 dias são pausados. Com uso diário, isso não acontece.
- **Backup**: Ajustes → Backup dos dados (baixa tudo em JSON).

---

## Para desenvolver

```bash
npm install
npm run dev          # http://localhost:5173 (modo demonstração sem .env)
npm run build        # versão de produção em dist/
npm run build:demo   # demonstração em um único arquivo: dist-demo/index.html
```

```
src/
  config/brand.js        ← nome, logo e textos da marca
  lib/messages.js        ← modelos das mensagens de WhatsApp (editáveis em Ajustes)
  lib/pdf.js             ← relatórios em PDF
  lib/commission.js      ← regras de comissão e tempo por profissional
  components/Notifier.jsx← pop-ups e notificações da equipe
  data/demo.js | supabase.js ← modo demonstração | banco real
  pages/Booking.jsx      ← site da cliente
  pages/staff/*          ← painel da gestão e das profissionais
supabase/schema.sql      ← tabelas, regras de acesso (RLS) e funções
```

### Segurança

- As clientes só veem serviços, profissionais (sem telefone) e horários ocupados, sem nomes.
- O agendamento passa pela função `book_appointment`: o preço e a duração saem do banco (com o tempo próprio de cada profissional), e ela impede que duas clientes marquem o mesmo horário.
- As profissionais **não acessam** as tabelas de clientes e agendamentos direto. Elas usam as funções `pro_*`, que entregam só a agenda dela, sem contato das clientes quando a privacidade está ligada.
- Vendas, estoque e conclusão do atendimento acontecem juntos, em uma única operação (`create_sale`). Cada profissional só lança vendas dela e só a gestão pode estornar.
