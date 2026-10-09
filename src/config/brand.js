/**
 * DRA. FRANCINE · DTM, DOR OROFACIAL E SONO — configuração white-label
 * ------------------------------------------------------------
 * Sistema Astrovia (agendamento + gestão). Logo em src/assets:
 * icon.jpg (redonda), mark.png (logo com fundo transparente),
 * mark-light.png (versão para o tema escuro) e banner.jpg.
 * Serviços, equipe, horários, mensagens e a ficha de anamnese são editados no painel.
 */
import logo from '../assets/icon.jpg'
import mark from '../assets/mark.png'
import markLight from '../assets/mark-light.png'
import banner from '../assets/banner.jpg'

export const BRAND = {
  appName: 'Dra. Francine · DTM, Dor Orofacial e Sono',
  shopName: 'Dra. Francine',
  wordmark: 'Dra. Francine',
  tagline: 'DTM · dor orofacial · sono',
  heroText: 'Tratamento de DTM e dor orofacial, ronco, apneia, bruxismo, cefaleia e zumbido. Agende sua consulta e envie sua ficha de saúde em poucos minutos.',
  logo,
  mark,
  markLight,
  banner,
  colors: {
    primary: '#F5A800',      // âmbar da logo
    primaryDark: '#C98600',
    red: '#D9202B',          // contorno vermelho da logo
    mist: '#E3E7F2',         // cinza-lavanda do perfil
    paper: '#FFFBF3',
  },
  // PIN da proprietária no modo demonstração (no Supabase o login é por e-mail/senha)
  demoAdminPin: '1234',
}

/** As cores da marca vêm do CSS (camada Dra. Francine no fim de styles.css) */
export function applyBrandColors() {}
