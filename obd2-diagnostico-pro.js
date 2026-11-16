/**
 * obd2-diagnostico-pro.js
 * Módulo de Diagnóstico Automotivo OBD-II e Decodificador de Falhas DTC (SAE J2012)
 * 
 * Funcionalidades para Oficinas, Mecânicos e Motoristas:
 * - Decodificação de códigos de injeção eletrônica, câmbio, ABS e carroceria
 * - Tradução técnica e explicação didática do defeito em português
 * - Severidade da falha (Crítica, Média, Preventiva)
 * - Sintomas perceptíveis ao dirigir (motor falhando, luz da injeção piscando, perda de potência)
 * - Possíveis causas de oficina mecânica
 * - Instruções técnicas e passo a passo de concerto e reparo
 * 
 * @license MIT
 * @see https://github.com/clepta2/placas-pro
 */

export const CODIGOS_OBD2_DEFEITOS = {
  // ── Misfire / Ignição ──
  'P0300': {
    codigo: 'P0300',
    sistema: 'Powertrain (Trem de Força / Injeção)',
    titulo: 'Falha de Ignição Aleatória / Múltiplos Cilindros (Random Misfire)',
    severidade: 'ALTA / CRÍTICA',
    luzPainel: 'Luz da Injeção Eletrônica piscando ou acesa contínua',
    sintomas: [
      'Motor engasgando ou trepidando em marcha lenta e aceleração',
      'Falta de potência considerável em subidas e retomadas',
      'Aumento expressivo no consumo de combustível',
      'Cheiro forte de combustível cru no escapamento'
    ],
    causasComuns: [
      'Velas de ignição desgastadas, com folga excessiva ou carbonizadas',
      'Bobinas de ignição individuais (copo) com fuga de corrente ou defeito',
      'Bicos injetores entupidos, sujos ou travados abertos',
      'Combustível adulterado com água ou excesso de solvente',
      'Baixa pressão da bomba de combustível ou filtro entupido',
      'Entrada falsa de ar no coletor de admissão'
    ],
    instrucoesConcerto: [
      '1. Retire e inspecione o estado das velas de ignição (eletrodos queimados ou carbonizados). Troque o jogo completo se estiverem gastas.',
      '2. Teste a resistência primária e secundária das bobinas de ignição com osciloscópio ou multímetro.',
      '3. Realize teste de vazão e estanqueidade dos bicos injetores em máquina de ultrassom.',
      '4. Meça a pressão e vazão da linha de combustível no manômetro (deve acusar entre 3.0 e 4.2 bar dependendo do veículo).',
      '5. Após o reparo, utilize o scanner para apagar os códigos DTC e realize teste de rodagem.'
    ]
  },
  'P0301': {
    codigo: 'P0301',
    sistema: 'Powertrain (Injeção / Cilindro 1)',
    titulo: 'Falha de Ignição Detectada no Cilindro 1',
    severidade: 'ALTA',
    luzPainel: 'Acesa ou piscando',
    sintomas: ['Motor vibrando em 3 cilindros', 'Perda de torque', 'Consumo elevado'],
    causasComuns: ['Vela do cilindro 1 defeituosa', 'Bobina do cilindro 1 queimada', 'Bico injetor 1 travado', 'Baixa compressão no cilindro 1'],
    instrucoesConcerto: [
      '1. Inverta a bobina do cilindro 1 com o cilindro 2. Se o código mudar para P0302, a bobina está condenada.',
      '2. Troque a vela de ignição do cilindro 1.',
      '3. Verifique o chicote e pulso elétrico do injetor 1.'
    ]
  },
  'P0302': {
    codigo: 'P0302',
    sistema: 'Powertrain (Injeção / Cilindro 2)',
    titulo: 'Falha de Ignição Detectada no Cilindro 2',
    severidade: 'ALTA',
    luzPainel: 'Acesa ou piscando',
    sintomas: ['Vibração intensa', 'Dificuldade de partida', 'Fumaça escura no escape'],
    causasComuns: ['Bobina do cilindro 2', 'Vela de ignição', 'Injetor 2', 'Junta de cabeçote queimada entre cilindros'],
    instrucoesConcerto: ['Inverta componentes com cilindro adjacente e teste com osciloscópio.']
  },

  // ── Emissões & Catalisador ──
  'P0420': {
    codigo: 'P0420',
    sistema: 'Emissões e Exaustão',
    titulo: 'Eficiência do Sistema Catalisador Abaixo do Limite (Banco 1)',
    severidade: 'MÉDIA / AMBIENTAL',
    luzPainel: 'Luz da Injeção Eletrônica acesa direto (amarela)',
    sintomas: [
      'Na maioria dos casos o carro não perde potência aparente de imediato',
      'Reprovação imediata no teste de emissões de poluentes e vistoria',
      'Cheiro característico de ovo podre (enxofre) em desacelerações',
      'Pequena elevação no consumo de combustível'
    ],
    causasComuns: [
      'Catalisador desgastado, desmanchado ou contaminado por óleo/combustível',
      'Sensor de oxigênio pós-catalisador (Sonda Lambda 2) com leitura errada',
      'Furo ou vazamento no escapamento antes da sonda pós-catalisador',
      'Queima de óleo do motor (anéis ou retentores de válvula gastos)'
    ],
    instrucoesConcerto: [
      '1. Verifique se o escapamento possui furos ou trincas entre o coletor e a sonda.',
      '2. Compare o gráfico da Sonda 1 (pré) com a Sonda 2 (pós) no scanner: a Sonda 2 deve oscilar lentamente em torno de 0.6V a 0.7V. Se ela oscilar rápido igual à Sonda 1, o catalisador perdeu a capacidade de conversão química.',
      '3. Substitua o catalisador por peça homologada com selo INMETRO.'
    ]
  },

  // ── Mistura Ar/Combustível ──
  'P0171': {
    codigo: 'P0171',
    sistema: 'Alimentação de Combustível',
    titulo: 'Sistema de Alimentação com Mistura Muito Pobre (Banco 1)',
    severidade: 'ALTA',
    luzPainel: 'Luz da Injeção acesa',
    sintomas: ['Motor fraco', 'Dificuldade de pegar de manhã', 'Estalos no coletor de admissão', 'Marcha lenta oscilando'],
    causasComuns: [
      'Entrada falsa de ar (mangueira de vácuo furada, junta do coletor ressecada)',
      'Sensor MAF (fluxo de ar) sujo com poeira ou óleo',
      'Filtro de combustível entupido',
      'Bomba de combustível com pressão insuficiente (<3 bar)',
      'Válvula do Canister travada aberta'
    ],
    instrucoesConcerto: [
      '1. Utilize máquina de fumaça (Smoke Test) para localizar vazamentos de vácuo na admissão.',
      '2. Limpe o sensor MAF com spray limpador de contato específico para fluxo de ar.',
      '3. Meça a pressão estática e dinâmica da bomba de combustível.'
    ]
  },
  'P0172': {
    codigo: 'P0172',
    sistema: 'Alimentação de Combustível',
    titulo: 'Sistema de Alimentação com Mistura Muito Rica (Banco 1)',
    severidade: 'MÉDIA / ALTA',
    luzPainel: 'Luz da injeção acesa',
    sintomas: ['Fumaça preta no escapamento', 'Cheiro de gasolina crua', 'Velas de ignição pretas de fuligem', 'Consumo absurdo'],
    causasComuns: ['Bico injetor gotejando ou travado aberto', 'Regulador de pressão furado', 'Sensor de temperatura da água marcando motor sempre frio'],
    instrucoesConcerto: ['1. Teste estanqueidade dos bicos injetores. 2. Verifique o sensor de temperatura ECT via scanner.']
  },

  // ── Sensores Críticos ──
  'P0128': {
    codigo: 'P0128',
    sistema: 'Sistema de Arrefecimento',
    titulo: 'Temperatura do Motor Abaixo da Faixa de Operação Termostática',
    severidade: 'MÉDIA',
    luzPainel: 'Luz de injeção acesa',
    sintomas: ['Ponteiro de temperatura não chega no meio', 'Ar quente da cabine não esquenta', 'Injeção gasta mais combustível'],
    causasComuns: ['Válvula termostática travada aberta', 'Sensor de temperatura ECT defeituoso'],
    instrucoesConcerto: ['Substitua a válvula termostática e complete o sistema com aditivo orgânico concentrado.']
  },
  'P0335': {
    codigo: 'P0335',
    sistema: 'Sensor de Rotação (CKP)',
    titulo: 'Mau Funcionamento no Circuito do Sensor de Posição da Árvore de Manivelas (Sensor de Rotação)',
    severidade: 'CRÍTICA',
    luzPainel: 'Luz da injeção acesa',
    sintomas: ['Carro apaga do nada e não pega mais', 'Motor gira na chave mas não entra em funcionamento', 'Cortes repentinos em velocidade'],
    causasComuns: ['Sensor de rotação indutivo/Hall queimado', 'Cabo do sensor rompido ou encostando no escape', 'Roda fônica amassada ou solta'],
    instrucoesConcerto: [
      '1. Teste o sinal de rotação do sensor com osciloscópio (sinal senoidal ou onda quadrada).',
      '2. Inspecione a integridade física do chicote elétrico próximo ao bloco do motor.',
      '3. Substitua o sensor de rotação por peça original.'
    ]
  },
  'P0340': {
    codigo: 'P0340',
    sistema: 'Sensor de Fase (CMP)',
    titulo: 'Mau Funcionamento no Circuito do Sensor de Posição do Comando de Válvulas',
    severidade: 'ALTA',
    luzPainel: 'Luz da injeção acesa',
    sintomas: ['Partida muito longa (precisa insistir na chave)', 'Falta de potência em altas rotações', 'Câmbio automático em modo de emergência'],
    causasComuns: ['Sensor de fase queimado', 'Motor fora de ponto (correia ou corrente dentada pulou dente)', 'Baixa pressão de óleo no variador VVT'],
    instrucoesConcerto: [
      '1. Verifique com ferramentas de fasagem se o motor está no ponto sincronizado.',
      '2. Meça a alimentação (5V/12V) e sinal do sensor de fase.'
    ]
  },

  // ── Rede & Comunicação ──
  'U0100': {
    codigo: 'U0100',
    sistema: 'Rede CAN Bus (Comunicação)',
    titulo: 'Perda de Comunicação com o Módulo de Controle do Motor (ECM / PCM)',
    severidade: 'CRÍTICA',
    luzPainel: 'Luzes de injeção, ABS e controle de tração acesas simultaneamente',
    sintomas: ['Carro não dá partida', 'Painel exibe traços no hodômetro', 'Direção elétrica pesada'],
    causasComuns: ['Bateria fraca ou bornes soltos', 'Fusível principal do módulo queimado', 'Chicote CAN Bus partido ou em curto', 'Módulo ECM queimado'],
    instrucoesConcerto: [
      '1. Meça a tensão da bateria com o multímetro (deve estar acima de 12.4V em repouso).',
      '2. Verifique os pontos de aterramento do motor e chassi.',
      '3. Teste a resistência dos resistores de terminação da rede CAN (deve medir 60 ohms entre CAN-High e CAN-Low).'
    ]
  }
};

/**
 * Decodifica qualquer código OBD-II / DTC e fornece parecer mecânico completo.
 */
export function decodificarCodigoObd2(codigoInput) {
  const clean = String(codigoInput || '').toUpperCase().trim();

  // 1. Busca direta na base rica
  if (CODIGOS_OBD2_DEFEITOS[clean]) {
    return {
      ok: true,
      conhecido: true,
      ...CODIGOS_OBD2_DEFEITOS[clean]
    };
  }

  // 2. Análise da anatomia do código segundo padrão SAE J2012
  if (clean.length === 5) {
    const letra = clean[0];
    const tipo = clean[1]; // 0 = Padrão ISO/SAE genérico, 1/2 = Específico da Montadora
    const subsistema = clean[2];

    const sistemas = {
      'P': 'Powertrain (Motor, Injeção Eletrônica e Transmissão)',
      'C': 'Chassis (Freios ABS, Controle de Estabilidade ESP e Suspensão)',
      'B': 'Body (Carroceria, Airbags, Travas e Ar-condicionado)',
      'U': 'Network (Rede de Comunicação CAN Bus e Computadores de Bordo)'
    };

    const subsistemasP = {
      '1': 'Medição de Combustível e Ar (Sensores MAF, MAP, Sondas Lambda)',
      '2': 'Medição de Combustível e Injetores (Bicos, Bomba de Alta Pressão)',
      '3': 'Sistema de Ignição ou Falha de Cilindro (Misfire, Velas, Bobinas)',
      '4': 'Controles de Emissões Auxiliares (Catalisador, EGR, EVAP Canister)',
      '5': 'Controle de Velocidade do Veículo e Marcha Lenta (Corpo de Borboleta)',
      '6': 'Circuito de Saída do Computador de Bordo e Módulos ECM/PCM',
      '7': 'Transmissão e Câmbio Automático / CVT',
      '8': 'Transmissão e Câmbio Automático / Tração 4x4'
    };

    if (sistemas[letra]) {
      return {
        ok: true,
        conhecido: false,
        codigo: clean,
        sistema: sistemas[letra],
        origem: tipo === '0' ? 'Genérico Padrão Internacional SAE J2012' : 'Específico do Fabricante / Montadora',
        areaAfetada: (letra === 'P' && subsistemasP[subsistema]) ? subsistemasP[subsistema] : 'Componentes de Bordo',
        severidade: 'MODERADA (Requer leitura detalhada)',
        luzPainel: 'Indicador de anomalia aceso no painel',
        sintomas: ['Possível comportamento anormal do sistema correspondente', 'Registro gravado na memória de falhas da central'],
        instrucoesConcerto: [
          '1. Conecte o scanner automotivo e visualize os parâmetros em tempo real (Live Data).',
          '2. Inspecione conectores, fios e fusíveis relacionados ao circuito elétrico correspondente.',
          '3. Verifique o manual de serviço específico da montadora para a rotina de teste guiada deste código.'
        ]
      };
    }
  }

  return {
    ok: false,
    codigo: codigoInput,
    erro: 'FORMATO_OBD2_INVALIDO',
    mensagem: 'Código OBD-II deve seguir o padrão SAE de 5 caracteres alfanuméricos (Ex: P0300, P0420, P0171, U0100).'
  };
}

/**
 * Busca códigos por palavra-chave (ex: "ignicao", "catalisador", "arrefecimento", "pobre").
 */
export function buscarCodigosObd2(termo) {
  const q = String(termo || '').toLowerCase().trim();
  if (!q) return Object.values(CODIGOS_OBD2_DEFEITOS);

  return Object.values(CODIGOS_OBD2_DEFEITOS).filter(c => 
    c.codigo.toLowerCase().includes(q) ||
    c.titulo.toLowerCase().includes(q) ||
    c.sistema.toLowerCase().includes(q) ||
    c.causasComuns.some(causa => causa.toLowerCase().includes(q))
  );
}
