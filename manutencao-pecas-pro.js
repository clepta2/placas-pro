/**
 * manutencao-pecas-pro.js
 * Módulo de Manutenção Preventiva, Especificações de Fluidos e Catálogo de Peças de Reposição
 * 
 * Inteligência Automotiva para Oficinas, Frotas e Proprietários:
 * - Especificações oficiais de Óleo de Motor (Viscosidade SAE, Norma API/ILSAC, Capacidade em Litros)
 * - Calibragem recomendada de Pneus (Dianteira/Traseira em PSI com carga leve e máxima)
 * - Cronograma de Revisões Oficiais (10.000 km a 100.000 km com serviços e preços médios de mercado)
 * - Catálogo de Peças de Alto Desgaste com Códigos Originais (OEM) e Referências Paralelas (Aftermarket)
 * - Links diretos oficiais para os Portais de Manuais dos Fabricantes no Brasil
 * 
 * @license MIT
 * @see https://github.com/clepta2/placas-pro
 */

export const PORTAIS_MANUAIS_MONTADORAS = {
  'toyota': 'https://www.toyota.com.br/manuais',
  'volkswagen': 'https://www.meuvw.com.br/manuais',
  'chevrolet': 'https://www.chevrolet.com.br/manuais',
  'fiat': 'https://servicos.fiat.com.br/manuais.html',
  'hyundai': 'https://www.hyundai.com.br/pos-venda/manuais.html',
  'honda': 'https://www.honda.com.br/pos-venda/automoveis/manuais',
  'jeep': 'https://www.jeep.com.br/proprietarios/manuais.html',
  'renault': 'https://www.renault.com.br/manuais.html',
  'nissan': 'https://www.nissan.com.br/pos-venda/manuais.html',
  'ford': 'https://www.ford.com.br/pos-vendas/manuais/',
  'peugeot': 'https://carros.peugeot.com.br/servicos/manuais.html',
  'citroen': 'https://www.citroen.com.br/pos-venda/manuais.html',
  'bmw': 'https://www.bmw.com.br/pt/topics/fascination-bmw/drivers-guide.html',
  'byd': 'https://www.byd.com/br/suporte/manuais',
  'porsche': 'https://www.porsche.com/brazil/pt/accessoriesandservice/porscheservice/manuals/'
};

// Base estruturada de manutenção preventiva por família de motor/veículo no Brasil
export const PLANOS_MANUTENCAO_VEICULOS = {
  // Toyota Corolla Altis Hybrid
  'toyota-corolla': {
    modeloReferencia: 'Toyota Corolla Altis Hybrid 1.8 Flex',
    motorizacao: '1.8 16V Atkinson Flex (2ZR-FXE) + Motor Elétrico 72 cv',
    oleoMotor: {
      viscosidade: 'SAE 0W-20',
      tipo: '100% Sintético',
      norma: 'API SP / ILSAC GF-6A',
      capacidadeComFiltroLitros: 4.2,
      capacidadeSemFiltroLitros: 3.9,
      intervaloTroca: '10.000 km ou 12 meses (uso severo: 5.000 km ou 6 meses)'
    },
    calibragemPneus: {
      medidaPadrao: '215/50 R17 91V',
      pressaoDianteiraPsi: 32,
      pressaoTraseiraPsi: 30,
      pressaoCargaMaximaPsi: 35,
      estepePsi: 60
    },
    bateria: {
      sistema12v: 'Auxiliar AGM 45Ah CCA 380A',
      sistemaHibrido: 'Bateria Tração Ni-MH 6.5 Ah (Garantia 8 anos de fábrica)'
    },
    cronogramaRevisoes: [
      { km: 10000, mes: 12, itens: ['Troca de óleo 0W-20', 'Filtro de óleo', 'Anel de vedação', 'Inspeção geral e bateria híbrida'], precoMedio: 'R$ 495,00' },
      { km: 20000, mes: 24, itens: ['Troca de óleo 0W-20', 'Filtro de óleo', 'Filtro de ar do motor', 'Filtro de ar-condicionado (cabine)', 'Rodízio de pneus'], precoMedio: 'R$ 780,00' },
      { km: 30000, mes: 36, itens: ['Troca de óleo 0W-20', 'Filtro de óleo', 'Fluido de freio DOT 4', 'Alinhamento e balanceamento'], precoMedio: 'R$ 620,00' },
      { km: 40000, mes: 48, itens: ['Troca de óleo 0W-20', 'Filtro de óleo', 'Filtro de combustível', 'Filtro de ar', 'Filtro cabine'], precoMedio: 'R$ 1.150,00' },
      { km: 50000, mes: 60, itens: ['Troca de óleo 0W-20', 'Filtro de óleo', 'Inspeção sistema híbrido e refrigeração'], precoMedio: 'R$ 520,00' },
      { km: 100000, mes: 120, itens: ['Troca de velas de ignição Iridium', 'Líquido de arrefecimento Long Life Coolant', 'Revisão completa'], precoMedio: 'R$ 1.850,00' }
    ],
    pecasDesgaste: {
      filtroOleo: { oem: '04152-YZZA6', aftermarket: 'Tecfil PEL714 / Mann HU6006z' },
      filtroAr: { oem: '17801-21060', aftermarket: 'Tecfil ARL2203 / Fram CA10741' },
      filtroCabine: { oem: '87139-0E040', aftermarket: 'Tecfil ACP886 / Fram CF10285' },
      filtroCombustivel: { oem: '23300-21010', aftermarket: 'Tecfil GI50/7' },
      pastilhasFreioDianteira: { oem: '04465-02420', aftermarket: 'Cobreq N-1454 / Fras-le PD/1454' },
      pastilhasFreioTraseira: { oem: '04466-02380', aftermarket: 'Cobreq N-1455 / Fras-le PD/1455' },
      velasIgnicao: { oem: '90919-01275', aftermarket: 'NGK ILKAR7B11 (Iridium Long Life)' }
    }
  },

  // Volkswagen Golf GTI
  'vw-golf-gti': {
    modeloReferencia: 'Volkswagen Golf GTI 2.0 TSI DSG',
    motorizacao: '2.0 TSI 16V Turbo (EA888 Gen 3) 230 cv',
    oleoMotor: {
      viscosidade: 'SAE 5W-40 ou 0W-30',
      tipo: '100% Sintético de Alta Performance',
      norma: 'VW 502.00 / VW 504.00',
      capacidadeComFiltroLitros: 5.7,
      capacidadeSemFiltroLitros: 5.2,
      intervaloTroca: '10.000 km ou 12 meses (uso em pista/severo: 5.000 km)'
    },
    calibragemPneus: {
      medidaPadrao: '225/45 R17 ou 225/40 R18',
      pressaoDianteiraPsi: 34,
      pressaoTraseiraPsi: 32,
      pressaoCargaMaximaPsi: 38,
      estepePsi: 60
    },
    bateria: {
      sistema12v: 'EFB / AGM 68Ah CCA 680A (Compatível com Start-Stop)'
    },
    cronogramaRevisoes: [
      { km: 10000, mes: 12, itens: ['Troca de óleo 5W-40 Maxi Performance', 'Filtro de óleo', 'Inspeção de suspensão e freios'], precoMedio: 'R$ 680,00' },
      { km: 20000, mes: 24, itens: ['Troca de óleo', 'Filtro de óleo', 'Filtro de ar do motor', 'Filtro de ar-condicionado'], precoMedio: 'R$ 950,00' },
      { km: 40000, mes: 48, itens: ['Troca de velas de ignição Laser Platinum', 'Fluido de freio DOT 4 LV', 'Filtro de combustível'], precoMedio: 'R$ 1.450,00' },
      { km: 60000, mes: 72, itens: ['Troca de óleo do câmbio DSG (dupla embreagem banhada a óleo) e filtro DSG', 'Troca de correia dentada de comando'], precoMedio: 'R$ 2.800,00' }
    ],
    pecasDesgaste: {
      filtroOleo: { oem: '06L-115-562-B', aftermarket: 'Tecfil PEL802 / Mann HU6013z' },
      filtroAr: { oem: '5Q0-129-620-B', aftermarket: 'Tecfil ARL6075 / Mann C30005' },
      filtroCabine: { oem: '5Q0-819-653', aftermarket: 'Tecfil ACP805 / Mann CU26009' },
      filtroCombustivel: { oem: '1K0-201-051-K', aftermarket: 'Tecfil GI04/1' },
      pastilhasFreioDianteira: { oem: '8V0-698-151-C', aftermarket: 'Cobreq N-2070 / Ferodo FDB4433' },
      pastilhasFreioTraseira: { oem: '5Q0-698-451-B', aftermarket: 'Cobreq N-2071 / Fras-le PD/1512' },
      velasIgnicao: { oem: '06K-905-601-D', aftermarket: 'NGK PLFER7A8EG (Double Platinum)' }
    }
  },

  // Chevrolet Onix / Onix Plus
  'gm-onix': {
    modeloReferencia: 'Chevrolet Onix / Onix Plus 1.0 Turbo Flex',
    motorizacao: '1.0 12V 3 Cilindros Turbo Flex (CSS Prime) 116 cv com Correia Banhada a Óleo',
    oleoMotor: {
      viscosidade: 'SAE 0W-20 (OBRIGATÓRIO Dexos 1 Gen 3)',
      tipo: '100% Sintético Específico para Correia Banhada',
      norma: 'GM Dexos 1 Gen 3 (Norma anti-degradação da correia)',
      capacidadeComFiltroLitros: 3.75,
      capacidadeSemFiltroLitros: 3.5,
      intervaloTroca: '10.000 km ou 12 meses rigorosamente (uso severo: 5.000 km)'
    },
    calibragemPneus: {
      medidaPadrao: '185/65 R15 ou 195/55 R16',
      pressaoDianteiraPsi: 35,
      pressaoTraseiraPsi: 35,
      pressaoCargaMaximaPsi: 38,
      estepePsi: 60
    },
    bateria: {
      sistema12v: 'Moura / ACDelco 50Ah CCA 450A'
    },
    cronogramaRevisoes: [
      { km: 10000, mes: 12, itens: ['Troca de óleo ACDelco 0W-20 Dexos 1', 'Filtro de óleo', 'Inspeção de freios'], precoMedio: 'R$ 420,00' },
      { km: 20000, mes: 24, itens: ['Troca de óleo', 'Filtro de óleo', 'Filtro de combustível', 'Filtro de cabine'], precoMedio: 'R$ 680,00' },
      { km: 30000, mes: 36, itens: ['Troca de óleo', 'Filtro de óleo', 'Filtro de ar do motor', 'Velas de ignição'], precoMedio: 'R$ 890,00' },
      { km: 100000, mes: 120, itens: ['Inspeção da correia dentada banhada a óleo e bomba de óleo'], precoMedio: 'R$ 1.950,00' }
    ],
    pecasDesgaste: {
      filtroOleo: { oem: '55496756', aftermarket: 'Tecfil PSL619 / ACDelco 19355314' },
      filtroAr: { oem: '26241944', aftermarket: 'Tecfil ARL8832 / Mann C25042' },
      filtroCabine: { oem: '13508023', aftermarket: 'Tecfil ACP023 / Fram CF11809' },
      filtroCombustivel: { oem: '13503670', aftermarket: 'Tecfil GI50/7' },
      pastilhasFreioDianteira: { oem: '26270500', aftermarket: 'Cobreq N-2088 / Fras-le PD/1560' },
      velasIgnicao: { oem: '12688094', aftermarket: 'ACDelco 41-163 / NGK ILKER7A8E' }
    }
  },

  // Fiat Strada / Argo / Cronos
  'fiat-strada': {
    modeloReferencia: 'Fiat Strada Freedom / Volcano 1.3 Firefly Flex',
    motorizacao: '1.3 8V Firefly 4 Cilindros Flex 107 cv',
    oleoMotor: {
      viscosidade: 'SAE 0W-20',
      tipo: '100% Sintético',
      norma: 'Fiat 9.55535-GS1 / Selenia Forward',
      capacidadeComFiltroLitros: 3.2,
      capacidadeSemFiltroLitros: 3.0,
      intervaloTroca: '10.000 km ou 12 meses'
    },
    calibragemPneus: {
      medidaPadrao: '205/60 R15 ou 205/55 R16',
      pressaoDianteiraPsi: 32,
      pressaoTraseiraPsi: 32,
      pressaoCargaMaximaPsi: 44,
      estepePsi: 44
    },
    bateria: {
      sistema12v: 'Moura 60Ah CCA 480A'
    },
    cronogramaRevisoes: [
      { km: 10000, mes: 12, itens: ['Troca de óleo Selenia 0W-20', 'Filtro de óleo', 'Inspeção geral'], precoMedio: 'R$ 440,00' },
      { km: 20000, mes: 24, itens: ['Troca de óleo', 'Filtro de óleo', 'Filtro de combustível', 'Filtro de ar', 'Filtro cabine'], precoMedio: 'R$ 750,00' },
      { km: 40000, mes: 48, itens: ['Troca de óleo', 'Filtros', 'Velas de ignição', 'Fluido de freio DOT 4'], precoMedio: 'R$ 1.100,00' }
    ],
    pecasDesgaste: {
      filtroOleo: { oem: '50035048', aftermarket: 'Tecfil PSL55 / Mann W610/0' },
      filtroAr: { oem: '51977570', aftermarket: 'Tecfil ARL4157 / Fram CA12076' },
      filtroCabine: { oem: '52063812', aftermarket: 'Tecfil ACP906 / Fram CF11158' },
      filtroCombustivel: { oem: '51806073', aftermarket: 'Tecfil GI50/7' },
      pastilhasFreioDianteira: { oem: '7090333', aftermarket: 'Cobreq N-548 / Fras-le PD/1515' },
      velasIgnicao: { oem: '55267995', aftermarket: 'NGK KR6G-10D / Champion REC9MCLX' }
    }
  },

  // Motocicleta Honda CG 160 / Titan
  'honda-cg160': {
    modeloReferencia: 'Honda CG 160 Titan / Fan Flex',
    motorizacao: '162,7 cm³ OHC Monocilíndrico 4 Tempos Refrigerado a Ar 15.1 cv',
    oleoMotor: {
      viscosidade: 'SAE 10W-30',
      tipo: 'Semissintético 4T para Motocicletas',
      norma: 'JASO MA / API SL (Honda Pro Honda)',
      capacidadeComFiltroLitros: 1.0,
      capacidadeSemFiltroLitros: 1.0,
      intervaloTroca: '4.000 km ou 6 meses (primeira revisão aos 1.000 km)'
    },
    calibragemPneus: {
      medidaPadrao: 'Dianteiro 80/100-18 | Traseiro 90/90-18',
      pressaoDianteiraPsi: 25,
      pressaoTraseiraPsi: 29,
      pressaoCargaMaximaPsi: 33,
      estepePsi: 0
    },
    bateria: {
      sistema12v: 'Yuasa / Heliar 5Ah Selada Livre de Manutenção'
    },
    cronogramaRevisoes: [
      { km: 1000, mes: 6, itens: ['Troca de óleo Pro Honda 10W-30', 'Limpeza da tela do filtro de óleo e filtro centrífugo', 'Ajuste de corrente e folga de válvulas'], precoMedio: 'R$ 120,00' },
      { km: 4000, mes: 12, itens: ['Troca de óleo do motor', 'Ajuste e lubrificação da corrente de transmissão', 'Verificação de freios'], precoMedio: 'R$ 140,00' },
      { km: 8000, mes: 18, itens: ['Troca de óleo', 'Vela de ignição', 'Filtro de ar do motor'], precoMedio: 'R$ 220,00' }
    ],
    pecasDesgaste: {
      filtroAr: { oem: '17211-KVS-J00', aftermarket: 'Vedamotors FAP0020' },
      velaIgnicao: { oem: '98056-58717', aftermarket: 'NGK CPR8EA-9' },
      pastilhaFreioDianteira: { oem: '06455-KRE-G01', aftermarket: 'Cobreq N-948 / Diafrag DFP-20853' },
      lonaFreioTraseira: { oem: '43125-KRE-G01', aftermarket: 'Cobreq 0322-DIA' },
      kitTransmissaoCorrente: { oem: '06406-KVS-J00', aftermarket: 'DID 428 HDS / Riffel Titanium' }
    }
  }
};

/**
 * Retorna o plano oficial de manutenção preventiva e peças para um determinado veículo ou placa.
 */
export function obterPlanoManutencaoPorModelo(modeloOuPlaca) {
  const query = String(modeloOuPlaca || '').toLowerCase().trim();

  // 1. Mapeamento direto por chaves conhecidas
  if (query.includes('corolla')) return PLANOS_MANUTENCAO_VEICULOS['toyota-corolla'];
  if (query.includes('golf')) return PLANOS_MANUTENCAO_VEICULOS['vw-golf-gti'];
  if (query.includes('onix')) return PLANOS_MANUTENCAO_VEICULOS['gm-onix'];
  if (query.includes('strada') || query.includes('argo') || query.includes('mobi')) return PLANOS_MANUTENCAO_VEICULOS['fiat-strada'];
  if (query.includes('cg') || query.includes('titan') || query.includes('fan') || query.includes('160')) return PLANOS_MANUTENCAO_VEICULOS['honda-cg160'];

  // 2. Mapeamento por placa conhecida
  const limpa = query.replace(/[^a-z0-9]/g, '').toUpperCase();
  if (limpa === 'BRA2E19') return PLANOS_MANUTENCAO_VEICULOS['toyota-corolla'];
  if (limpa === 'EZK5520') return PLANOS_MANUTENCAO_VEICULOS['vw-golf-gti'];
  if (limpa === 'ABC12C4') return PLANOS_MANUTENCAO_VEICULOS['honda-cg160'];
  if (limpa === 'RIO2016') return PLANOS_MANUTENCAO_VEICULOS['gm-onix'];

  // 3. Fallback inteligente com plano padrão de automóvel nacional
  return {
    modeloReferencia: 'Veículo Nacional Padrão Flex',
    motorizacao: 'Motor 4 Cilindros / 3 Cilindros 1.0 a 1.6 Flex',
    oleoMotor: {
      viscosidade: 'SAE 5W-30 ou 0W-20',
      tipo: '100% Sintético',
      norma: 'API SP / ILSAC GF-6',
      capacidadeComFiltroLitros: 4.0,
      capacidadeSemFiltroLitros: 3.6,
      intervaloTroca: '10.000 km ou 12 meses'
    },
    calibragemPneus: {
      medidaPadrao: '195/60 R15 ou 205/55 R16',
      pressaoDianteiraPsi: 32,
      pressaoTraseiraPsi: 30,
      pressaoCargaMaximaPsi: 36,
      estepePsi: 45
    },
    bateria: {
      sistema12v: 'Bateria Selada 60Ah CCA 450A'
    },
    cronogramaRevisoes: [
      { km: 10000, mes: 12, itens: ['Troca de óleo de motor', 'Filtro de óleo', 'Inspeção geral e alinhamento'], precoMedio: 'R$ 450,00' },
      { km: 20000, mes: 24, itens: ['Troca de óleo', 'Filtros de óleo, ar e cabine', 'Rodízio de pneus'], precoMedio: 'R$ 720,00' },
      { km: 40000, mes: 48, itens: ['Troca de óleo', 'Filtros', 'Velas de ignição', 'Fluido de freio DOT 4'], precoMedio: 'R$ 1.150,00' }
    ],
    pecasDesgaste: {
      filtroOleo: { oem: 'Original de Fábrica', aftermarket: 'Tecfil / Mann / Fram' },
      filtroAr: { oem: 'Original de Fábrica', aftermarket: 'Tecfil / Fram' },
      filtroCabine: { oem: 'Anti-pólen original', aftermarket: 'Tecfil ACP' },
      pastilhasFreioDianteira: { oem: 'Homologada montadora', aftermarket: 'Cobreq / Fras-le / Bosch' },
      velasIgnicao: { oem: 'Velas originais', aftermarket: 'NGK / Bosch' }
    }
  };
}
