/**
 * Textos em português (pt) — dicionário central da interface.
 * Nenhum texto de interface deve ser escrito diretamente nas vistas ou
 * componentes: adicionar aqui e consumir através de `t('chave.aninhada')`.
 */
export default {
  app: {
    name: 'Sobredot',
    tagline: 'Uma visão integrada do percurso da criança',
    endorsement: 'uma solução da Oficina das Emoções',
  },

  demo: {
    banner: 'Dados de demonstração — nenhuma informação real é apresentada.',
    modeLabel: 'Modo de demonstração',
    modeExplanation:
      'Está a explorar um protótipo com dados fictícios. Não existe início de sessão real nem armazenamento em servidor.',
  },

  nav: {
    dashboard: 'Início',
    timeline: 'Linha do tempo',
    documents: 'Documentos',
    insights: 'Insights',
    reports: 'Relatórios',
    profile: 'Perfil',
    register: 'Registar',
  },

  welcome: {
    title: 'Bem-vindo à Sobredot',
    subtitle:
      'Reúna, num só lugar, os registos de sono, alimentação, emoções, comportamentos e muito mais — partilhados entre família, escola e profissionais.',
    ctaEnter: 'Entrar em modo de demonstração',
    ctaLearnMore: 'Saber mais sobre privacidade',
    disclaimerTitle: 'O que a Sobredot não faz',
    disclaimerBody:
      'A Sobredot não diagnostica, não prescreve, não substitui profissionais de saúde ou educação e não toma decisões automáticas sobre a criança. É uma ferramenta de apoio ao registo e à compreensão do percurso.',
    consentTitle: 'Privacidade e consentimento',
    consentBody:
      'Nesta demonstração não são recolhidos dados reais. Numa versão futura com dados reais, cada pessoa saberá sempre o que é partilhado, com quem e porquê, e poderá rever ou remover o seu consentimento a qualquer momento.',
  },

  origin: {
    label: 'Origem da relação',
    ode: 'Aluno(a) da Oficina das Emoções',
    partner: 'Instituição parceira',
    direct: 'Família direta',
  },

  dashboard: {
    greetingMorning: 'Bom dia',
    greetingAfternoon: 'Boa tarde',
    greetingEvening: 'Boa noite',
    subtitle: 'Aqui está um resumo do dia.',
    changeChild: 'Mudar de criança',
    cards: {
      sleep: {
        title: 'Sono',
        icon: '🌙',
        emptyMeta: 'Sem registo hoje',
      },
      mood: {
        title: 'Humor',
        icon: '🙂',
        emptyMeta: 'Sem registo hoje',
      },
      food: {
        title: 'Alimentação',
        icon: '🍽️',
        emptyMeta: 'Sem registo hoje',
      },
      medication: {
        title: 'Medicação',
        icon: '💊',
        emptyMeta: 'Sem registo hoje',
      },
    },
    shortcuts: {
      timeline: 'Linha do tempo',
      documents: 'Documentos',
      insights: 'Insights',
      reports: 'Relatórios',
    },
    registerCta: 'REGISTAR',
  },

  register: {
    title: 'Novo registo',
    subtitle: 'Escolha uma categoria para começar.',
    backToCategories: 'Voltar às categorias',
    categories: {
      emotions: { label: 'Emoções', icon: '💛' },
      behaviors: { label: 'Comportamentos', icon: '🧩' },
      sleep: { label: 'Sono', icon: '🌙' },
      food: { label: 'Alimentação', icon: '🍽️' },
      medication: { label: 'Medicação', icon: '💊' },
      school: { label: 'Escola', icon: '🏫' },
      communication: { label: 'Comunicação', icon: '💬' },
      sensory: { label: 'Sensorial', icon: '🖐️' },
      achievements: { label: 'Conquistas', icon: '⭐' },
      observations: { label: 'Observações', icon: '📝' },
    },
    form: {
      dateLabel: 'Data e hora',
      noteLabel: 'Notas (opcional)',
      notePlaceholder: 'Descreva o que observou…',
      intensityLabel: 'Intensidade',
      intensityLow: 'Ligeira',
      intensityMedium: 'Moderada',
      intensityHigh: 'Intensa',
      saveDraft: 'Guardar registo',
      cancel: 'Cancelar',
    },
    confirm: {
      title: 'Guardar este registo?',
      body: 'O registo ficará guardado apenas neste dispositivo, como dado de demonstração.',
      confirmLabel: 'Guardar',
      cancelLabel: 'Voltar a editar',
    },
    success: {
      title: 'Registo guardado',
      body: 'O registo foi guardado localmente nesta demonstração.',
      newRecord: 'Fazer novo registo',
      viewTimeline: 'Ver na linha do tempo',
    },
  },

  timeline: {
    title: 'Linha do tempo',
    subtitle: 'Todos os registos, por ordem cronológica.',
    filterAll: 'Todas as categorias',
    emptyTitle: 'Ainda não há registos',
    emptyBody: 'Os registos que criar vão aparecer aqui, organizados por data.',
    emptyCta: 'Criar o primeiro registo',
  },

  documents: {
    title: 'Documentos',
    subtitle: 'Laudos, avaliações e relatórios da criança.',
    emptyTitle: 'Ainda não existem documentos',
    emptyBody:
      'Numa próxima etapa poderá adicionar aqui laudos e relatórios para consulta e cruzamento de informação.',
    uploadComingSoon: 'Carregar documento (em breve)',
  },

  insights: {
    title: 'Insights',
    subtitle: 'Leituras cruzadas entre registos e documentos.',
    notActiveTitle: 'A IA ainda não está ativa nesta versão',
    notActiveBody:
      'Esta área vai futuramente ajudar a cruzar registos do quotidiano com laudos e relatórios. Nenhuma análise automática é feita nesta etapa.',
  },

  reports: {
    title: 'Relatórios',
    subtitle: 'Resumos do percurso, prontos a partilhar.',
    emptyTitle: 'Ainda não existem relatórios',
    emptyBody: 'Quando existirem registos suficientes, poderá gerar aqui um resumo do período.',
  },

  profile: {
    title: 'Perfil e definições',
    subtitle: 'Informação da conta de demonstração.',
    sectionAccount: 'Conta',
    sectionChildren: 'Crianças associadas',
    sectionAccessibility: 'Acessibilidade',
    sectionPrivacy: 'Privacidade',
    sectionLanguage: 'Idioma',
    languagePt: 'Português',
    reducedMotionLabel: 'Reduzir animações',
    exitDemo: 'Sair do modo de demonstração',
    privacyNote:
      'Nesta demonstração, todos os dados ficam apenas neste dispositivo (armazenamento local do navegador) e podem ser apagados a qualquer momento.',
    clearLocalData: 'Apagar dados locais desta demonstração',
  },

  states: {
    loading: 'A carregar…',
    error: {
      title: 'Não foi possível carregar',
      body: 'Ocorreu um problema inesperado. Pode tentar novamente.',
      retry: 'Tentar novamente',
    },
  },

  common: {
    back: 'Voltar',
    close: 'Fechar',
    optional: 'opcional',
    save: 'Guardar',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    skipToContent: 'Saltar para o conteúdo principal',
  },

  notFound: {
    title: 'Página não encontrada',
    body: 'A rota pedida não existe nesta demonstração.',
    backHome: 'Voltar ao início',
  },
};
