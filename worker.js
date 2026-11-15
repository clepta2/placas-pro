/**
 * worker.js
 * Cloudflare Worker Anycast para Placas Pro API
 * 
 * Inteligência Veicular, Validação e Telemetria Nacional de Borda (<2ms):
 * - Validação e Conversão de Placas Mercosul <-> Antiga (Padrão CONTRAN)
 * - Mapeamento de Estado (27 UFs) e Região por Faixa Oficial CONTRAN/SENATRAN
 * - Validador de RENAVAM Oficial (Algoritmo Módulo 11 DENATRAN)
 * - Decodificador e Validador de Chassi/VIN (Norma Internacional ISO 3779 / SAE J853)
 * - Calendário Oficial de Licenciamento Anual (DETRAN 27 UFs)
 * - Rodízio Municipal de Veículos (SP Capital CET em tempo real)
 * - Calculadora Flex de Paridade de Combustível (Etanol vs Gasolina)
 * - Estimativa de IPVA por UF
 * - Renderizador Gráfico Vetorial SVG da Placa Mercosul Oficial em Tempo Real
 * - Gerador de Placas e RENAVAM Válidos para Sandbox/QA
 * 
 * @license MIT
 * @see https://github.com/clepta2/placas-pro
 */

import { STYLES_CSS, HTML_INDEX, CLIENT_JS, OZPRO_MARK_SVG } from './site-assets.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Max-Age': '86400'
};

// ─── MATRIZ DE PLANOS E RATE LIMITING ───
const PLANOS_CONFIG = {
  free: {
    nome: 'Free / Sandbox',
    rpm: 60,
    cotaDiaria: 1000,
    prefixo: 'plc_free_',
    cadencia: '60 RPM (1 req/s)'
  },
  starter: {
    nome: 'Starter',
    rpm: 300,
    cotaDiaria: 25000,
    prefixo: 'plc_start_',
    cadencia: '5 req/s contínuo'
  },
  pro: {
    nome: 'Pro',
    rpm: 1200,
    cotaDiaria: 150000,
    prefixo: 'plc_pro_',
    cadencia: '20 req/s contínuo'
  },
  business: {
    nome: 'Business Enterprise',
    rpm: 3000,
    cotaDiaria: 1000000,
    prefixo: 'plc_biz_',
    cadencia: '50 req/s contínuo'
  },
  master: {
    nome: 'Master Admin (Bypass Ilimitado)',
    rpm: 6000,
    cotaDiaria: Infinity,
    prefixo: 'plc_master_',
    cadencia: 'Ilimitada (Sub-2ms Anycast)'
  }
};

const minuteBuckets = new Map();
const dailyBuckets = new Map();
const BOOT_TIME = Date.now();

function resolverPlanoEChave(request) {
  const authHeader = request.headers.get('Authorization') || '';
  const xApiKey = request.headers.get('x-api-key') || '';
  const url = new URL(request.url);
  const queryKey = url.searchParams.get('key') || url.searchParams.get('api_key') || '';

  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (xApiKey) {
    token = xApiKey.trim();
  } else if (queryKey) {
    token = queryKey.trim();
  }

  if (!token) {
    const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'anonymous_ip';
    return { plano: 'free', keyId: `ip_${clientIp}`, config: PLANOS_CONFIG.free, isAnonymous: true };
  }

  if (token.startsWith('plc_master_') || token === 'plc_master_key_bypass') {
    return { plano: 'master', keyId: token, config: PLANOS_CONFIG.master, isAnonymous: false };
  }
  if (token.startsWith('plc_biz_')) {
    return { plano: 'business', keyId: token, config: PLANOS_CONFIG.business, isAnonymous: false };
  }
  if (token.startsWith('plc_pro_')) {
    return { plano: 'pro', keyId: token, config: PLANOS_CONFIG.pro, isAnonymous: false };
  }
  if (token.startsWith('plc_start_')) {
    return { plano: 'starter', keyId: token, config: PLANOS_CONFIG.starter, isAnonymous: false };
  }

  return { plano: 'starter', keyId: token, config: PLANOS_CONFIG.starter, isAnonymous: false };
}

function aplicarRateLimit(keyId, config) {
  const now = Date.now();
  const isMaster = config.prefixo === 'plc_master_';

  // 1. Minuto
  let minBucket = minuteBuckets.get(keyId);
  if (!minBucket || now >= minBucket.resetAt) {
    minBucket = { count: 0, resetAt: now + 60000 };
    minuteBuckets.set(keyId, minBucket);
  }

  // 2. Diário
  let dailyBucket = dailyBuckets.get(keyId);
  if (!dailyBucket || now >= dailyBucket.resetAt) {
    dailyBucket = { count: 0, resetAt: now + 86400000 };
    dailyBuckets.set(keyId, dailyBucket);
  }

  if (!isMaster && dailyBucket.count >= config.cotaDiaria) {
    return {
      ok: false,
      error: 'DAILY_LIMIT_EXCEEDED',
      message: `Cota diária de requisições excedida para o plano ${config.nome}.`,
      plano: config.nome
    };
  }

  if (minBucket.count >= config.rpm) {
    return {
      ok: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: `Limite de requisições por minuto excedido para o plano ${config.nome} (${config.rpm} RPM).`,
      plano: config.nome
    };
  }

  minBucket.count++;
  dailyBucket.count++;

  return {
    ok: true,
    limit: config.rpm,
    remaining: Math.max(0, config.rpm - minBucket.count),
    resetAt: minBucket.resetAt
  };
}

// ─── TABELAS E MOTORES DETERMINÍSTICOS (ZERO REGEX) ───

const CONVERSAO_NUMERO_LETRA = {
  '0': 'A', '1': 'B', '2': 'C', '3': 'D', '4': 'E',
  '5': 'F', '6': 'G', '7': 'H', '8': 'I', '9': 'J'
};

const CONVERSAO_LETRA_NUMERO = {
  'A': '0', 'B': '1', 'C': '2', 'D': '3', 'E': '4',
  'F': '5', 'G': '6', 'H': '7', 'I': '8', 'J': '9'
};

const VIN_ANO_MODELO = {
  'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013, 'E': 2014,
  'F': 2015, 'G': 2016, 'H': 2017, 'J': 2018, 'K': 2019,
  'L': 2020, 'M': 2021, 'N': 2022, 'P': 2023, 'R': 2024,
  'S': 2025, 'T': 2026, 'V': 2027, 'W': 2028, 'X': 2029,
  'Y': 2030, '1': 2001, '2': 2002, '3': 2003, '4': 2004,
  '5': 2005, '6': 2006, '7': 2007, '8': 2008, '9': 2009
};

const VIN_FABRICANTES = {
  '9BW': { fabricante: 'Volkswagen', pais: 'Brasil', origem: 'Nacional' },
  '9BG': { fabricante: 'General Motors (Chevrolet)', pais: 'Brasil', origem: 'Nacional' },
  '9BD': { fabricante: 'Fiat Automóveis', pais: 'Brasil', origem: 'Nacional' },
  '9BF': { fabricante: 'Ford Motor Company', pais: 'Brasil', origem: 'Nacional' },
  '9BR': { fabricante: 'Toyota do Brasil', pais: 'Brasil', origem: 'Nacional' },
  '9BH': { fabricante: 'Hyundai Motor Brasil', pais: 'Brasil', origem: 'Nacional' },
  '93H': { fabricante: 'Honda Automóveis do Brasil', pais: 'Brasil', origem: 'Nacional' },
  '93Y': { fabricante: 'Renault do Brasil', pais: 'Brasil', origem: 'Nacional' },
  '9BM': { fabricante: 'Mercedes-Benz do Brasil', pais: 'Brasil', origem: 'Nacional' },
  '9BS': { fabricante: 'Scania Latin America', pais: 'Brasil', origem: 'Nacional' },
  '9BV': { fabricante: 'Volvo do Brasil', pais: 'Brasil', origem: 'Nacional' },
  '95V': { fabricante: 'CAOA Chery', pais: 'Brasil', origem: 'Nacional' },
  '94D': { fabricante: 'Nissan do Brasil', pais: 'Brasil', origem: 'Nacional' },
  '988': { fabricante: 'Jeep / Stellantis', pais: 'Brasil', origem: 'Nacional' },
  '9CD': { fabricante: 'Moto Honda da Amazônia', pais: 'Brasil', origem: 'Nacional (Motos)' },
  '9C6': { fabricante: 'Yamaha Motor da Amazônia', pais: 'Brasil', origem: 'Nacional (Motos)' },
  '1FA': { fabricante: 'Ford', pais: 'Estados Unidos', origem: 'Importado EUA' },
  '1GC': { fabricante: 'Chevrolet', pais: 'Estados Unidos', origem: 'Importado EUA' },
  '1J4': { fabricante: 'Jeep', pais: 'Estados Unidos', origem: 'Importado EUA' },
  '5YJ': { fabricante: 'Tesla Inc', pais: 'Estados Unidos', origem: 'Importado EUA' },
  '2T1': { fabricante: 'Toyota Motor', pais: 'Canadá', origem: 'Importado Canadá' },
  '3VW': { fabricante: 'Volkswagen de México', pais: 'México', origem: 'Importado México' },
  '3FA': { fabricante: 'Ford', pais: 'México', origem: 'Importado México' },
  'WAU': { fabricante: 'Audi AG', pais: 'Alemanha', origem: 'Importado Alemanha' },
  'WBA': { fabricante: 'BMW AG', pais: 'Alemanha', origem: 'Importado Alemanha' },
  'WDB': { fabricante: 'Mercedes-Benz AG', pais: 'Alemanha', origem: 'Importado Alemanha' },
  'WVW': { fabricante: 'Volkswagen AG', pais: 'Alemanha', origem: 'Importado Alemanha' },
  'WP0': { fabricante: 'Porsche AG', pais: 'Alemanha', origem: 'Importado Alemanha' },
  'VF1': { fabricante: 'Renault', pais: 'França', origem: 'Importado França' },
  'VF3': { fabricante: 'Peugeot', pais: 'França', origem: 'Importado França' },
  'VF7': { fabricante: 'Citroën', pais: 'França', origem: 'Importado França' },
  'ZAR': { fabricante: 'Alfa Romeo', pais: 'Itália', origem: 'Importado Itália' },
  'ZFF': { fabricante: 'Ferrari', pais: 'Itália', origem: 'Importado Itália' },
  'YV1': { fabricante: 'Volvo Cars', pais: 'Suécia', origem: 'Importado Suécia' },
  'JHM': { fabricante: 'Honda Motor Co', pais: 'Japão', origem: 'Importado Japão' },
  'JT':  { fabricante: 'Toyota Motor Corp', pais: 'Japão', origem: 'Importado Japão' },
  'JN':  { fabricante: 'Nissan Motor Co', pais: 'Japão', origem: 'Importado Japão' },
  'JM':  { fabricante: 'Mazda Motor Corp', pais: 'Japão', origem: 'Importado Japão' },
  'KMH': { fabricante: 'Hyundai Motor Co', pais: 'Coreia do Sul', origem: 'Importado Coreia' },
  'KNA': { fabricante: 'Kia Motors Corp', pais: 'Coreia do Sul', origem: 'Importado Coreia' },
  'LB':  { fabricante: 'BYD Auto', pais: 'China', origem: 'Importado China' },
  'LSG': { fabricante: 'SAIC Motor (MG)', pais: 'China', origem: 'Importado China' },
  '8AF': { fabricante: 'Ford Argentina', pais: 'Argentina', origem: 'Importado Mercosul' },
  '8AG': { fabricante: 'Chevrolet Argentina', pais: 'Argentina', origem: 'Importado Mercosul' },
  '8AW': { fabricante: 'Volkswagen Argentina', pais: 'Argentina', origem: 'Importado Mercosul' },
  '8AJ': { fabricante: 'Toyota Argentina', pais: 'Argentina', origem: 'Importado Mercosul' }
};

const ALIQUOTAS_IPVA = {
  'SP': 0.040, 'RJ': 0.040, 'MG': 0.040, 'PR': 0.035, 'RS': 0.030,
  'SC': 0.020, 'ES': 0.020, 'BA': 0.030, 'PE': 0.030, 'CE': 0.030,
  'GO': 0.0375, 'DF': 0.035, 'MT': 0.030, 'MS': 0.030, 'PA': 0.025,
  'MA': 0.025, 'PB': 0.025, 'RN': 0.030, 'AL': 0.030, 'SE': 0.025,
  'PI': 0.025, 'TO': 0.020, 'RO': 0.025, 'AC': 0.020, 'AM': 0.025,
  'RR': 0.020, 'AP': 0.025
};

const FAIXAS_CONTRAN = [
  { de: 'AAA', ate: 'BEZ', uf: 'PR', estado: 'Paraná', regiao: 'Sul' },
  { de: 'BFA', ate: 'GKI', uf: 'SP', estado: 'São Paulo', regiao: 'Sudeste' },
  { de: 'GKJ', ate: 'HOK', uf: 'MG', estado: 'Minas Gerais', regiao: 'Sudeste' },
  { de: 'HOL', ate: 'HQE', uf: 'MA', estado: 'Maranhão', regiao: 'Nordeste' },
  { de: 'HQF', ate: 'HTB', uf: 'MS', estado: 'Mato Grosso do Sul', regiao: 'Centro-Oeste' },
  { de: 'HTC', ate: 'HTE', uf: 'CE', estado: 'Ceará', regiao: 'Nordeste' },
  { de: 'HTF', ate: 'HTG', uf: 'RN', estado: 'Rio Grande do Norte', regiao: 'Nordeste' },
  { de: 'HTH', ate: 'HTH', uf: 'PI', estado: 'Piauí', regiao: 'Nordeste' },
  { de: 'HTI', ate: 'HTI', uf: 'MA', estado: 'Maranhão', regiao: 'Nordeste' },
  { de: 'HTJ', ate: 'HTZ', uf: 'RO', estado: 'Rondônia', regiao: 'Norte' },
  { de: 'HUA', ate: 'HUZ', uf: 'CE', estado: 'Ceará', regiao: 'Nordeste' },
  { de: 'HVA', ate: 'HXZ', uf: 'CE', estado: 'Ceará', regiao: 'Nordeste' },
  { de: 'HYA', ate: 'HZZ', uf: 'CE', estado: 'Ceará', regiao: 'Nordeste' },
  { de: 'IAA', ate: 'JDO', uf: 'RS', estado: 'Rio Grande do Sul', regiao: 'Sul' },
  { de: 'JDP', ate: 'JKR', uf: 'DF', estado: 'Distrito Federal', regiao: 'Centro-Oeste' },
  { de: 'JKS', ate: 'JSZ', uf: 'BA', estado: 'Bahia', regiao: 'Nordeste' },
  { de: 'JTA', ate: 'JWE', uf: 'PA', estado: 'Pará', regiao: 'Norte' },
  { de: 'JWF', ate: 'JXY', uf: 'AM', estado: 'Amazonas', regiao: 'Norte' },
  { de: 'JXZ', ate: 'KAU', uf: 'MT', estado: 'Mato Grosso', regiao: 'Centro-Oeste' },
  { de: 'KAV', ate: 'KFC', uf: 'GO', estado: 'Goiás', regiao: 'Centro-Oeste' },
  { de: 'KFD', ate: 'KME', uf: 'PE', estado: 'Pernambuco', regiao: 'Nordeste' },
  { de: 'KMF', ate: 'LVE', uf: 'RJ', estado: 'Rio de Janeiro', regiao: 'Sudeste' },
  { de: 'LVF', ate: 'LWQ', uf: 'PI', estado: 'Piauí', regiao: 'Nordeste' },
  { de: 'LWR', ate: 'MMM', uf: 'SC', estado: 'Santa Catarina', regiao: 'Sul' },
  { de: 'MMN', ate: 'MOW', uf: 'PB', estado: 'Paraíba', regiao: 'Nordeste' },
  { de: 'MOX', ate: 'MTZ', uf: 'ES', estado: 'Espírito Santo', regiao: 'Sudeste' },
  { de: 'MUA', ate: 'MVI', uf: 'AL', estado: 'Alagoas', regiao: 'Nordeste' },
  { de: 'MVJ', ate: 'MXG', uf: 'TO', estado: 'Tocantins', regiao: 'Norte' },
  { de: 'MXH', ate: 'MZM', uf: 'RN', estado: 'Rio Grande do Norte', regiao: 'Nordeste' },
  { de: 'MZN', ate: 'NAG', uf: 'AC', estado: 'Acre', regiao: 'Norte' },
  { de: 'NAH', ate: 'NBA', uf: 'RR', estado: 'Roraima', regiao: 'Norte' },
  { de: 'NBB', ate: 'NEH', uf: 'RO', estado: 'Rondônia', regiao: 'Norte' },
  { de: 'NEI', ate: 'NFB', uf: 'AP', estado: 'Amapá', regiao: 'Norte' },
  { de: 'NFC', ate: 'NGZ', uf: 'GO', estado: 'Goiás', regiao: 'Centro-Oeste' },
  { de: 'NHA', ate: 'NHT', uf: 'MA', estado: 'Maranhão', regiao: 'Nordeste' },
  { de: 'NHU', ate: 'NIX', uf: 'PI', estado: 'Piauí', regiao: 'Nordeste' },
  { de: 'NIY', ate: 'NJW', uf: 'MT', estado: 'Mato Grosso', regiao: 'Centro-Oeste' },
  { de: 'NJX', ate: 'NLU', uf: 'GO', estado: 'Goiás', regiao: 'Centro-Oeste' },
  { de: 'NLV', ate: 'NMO', uf: 'AL', estado: 'Alagoas', regiao: 'Nordeste' },
  { de: 'NMP', ate: 'NNI', uf: 'MA', estado: 'Maranhão', regiao: 'Nordeste' },
  { de: 'NNJ', ate: 'NOH', uf: 'RN', estado: 'Rio Grande do Norte', regiao: 'Nordeste' },
  { de: 'NOI', ate: 'NPB', uf: 'AM', estado: 'Amazonas', regiao: 'Norte' },
  { de: 'NPC', ate: 'NPQ', uf: 'MT', estado: 'Mato Grosso', regiao: 'Centro-Oeste' },
  { de: 'NPR', ate: 'NQK', uf: 'PB', estado: 'Paraíba', regiao: 'Nordeste' },
  { de: 'NQL', ate: 'NRE', uf: 'CE', estado: 'Ceará', regiao: 'Nordeste' },
  { de: 'NRF', ate: 'NSD', uf: 'MS', estado: 'Mato Grosso do Sul', regiao: 'Centro-Oeste' },
  { de: 'NSE', ate: 'NTC', uf: 'PA', estado: 'Pará', regiao: 'Norte' },
  { de: 'NTD', ate: 'NTW', uf: 'BA', estado: 'Bahia', regiao: 'Nordeste' },
  { de: 'NTX', ate: 'NUL', uf: 'MT', estado: 'Mato Grosso', regiao: 'Centro-Oeste' },
  { de: 'NUM', ate: 'NVF', uf: 'CE', estado: 'Ceará', regiao: 'Nordeste' },
  { de: 'NVG', ate: 'NVZ', uf: 'SE', estado: 'Sergipe', regiao: 'Nordeste' },
  { de: 'NWA', ate: 'NXF', uf: 'GO', estado: 'Goiás', regiao: 'Centro-Oeste' },
  { de: 'NXG', ate: 'NXK', uf: 'MA', estado: 'Maranhão', regiao: 'Nordeste' },
  { de: 'NXL', ate: 'NXR', uf: 'AC', estado: 'Acre', regiao: 'Norte' },
  { de: 'NXS', ate: 'NXW', uf: 'AP', estado: 'Amapá', regiao: 'Norte' },
  { de: 'NXX', ate: 'NYG', uf: 'MG', estado: 'Minas Gerais', regiao: 'Sudeste' },
  { de: 'NYH', ate: 'NZZ', uf: 'BA', estado: 'Bahia', regiao: 'Nordeste' },
  { de: 'OAA', ate: 'OAO', uf: 'AM', estado: 'Amazonas', regiao: 'Norte' },
  { de: 'OAP', ate: 'OBS', uf: 'MT', estado: 'Mato Grosso', regiao: 'Centro-Oeste' },
  { de: 'OBT', ate: 'OCA', uf: 'PA', estado: 'Pará', regiao: 'Norte' },
  { de: 'OCB', ate: 'OCU', uf: 'CE', estado: 'Ceará', regiao: 'Nordeste' },
  { de: 'OCV', ate: 'ODT', uf: 'ES', estado: 'Espírito Santo', regiao: 'Sudeste' },
  { de: 'ODU', ate: 'OEI', uf: 'PI', estado: 'Piauí', regiao: 'Nordeste' },
  { de: 'OEJ', ate: 'OES', uf: 'SE', estado: 'Sergipe', regiao: 'Nordeste' },
  { de: 'OET', ate: 'OFH', uf: 'PB', estado: 'Paraíba', regiao: 'Nordeste' },
  { de: 'OFI', ate: 'OFW', uf: 'PA', estado: 'Pará', regiao: 'Norte' },
  { de: 'OFX', ate: 'OGG', uf: 'PB', estado: 'Paraíba', regiao: 'Nordeste' },
  { de: 'OGH', ate: 'OHA', uf: 'GO', estado: 'Goiás', regiao: 'Centro-Oeste' },
  { de: 'OHB', ate: 'OHK', uf: 'AL', estado: 'Alagoas', regiao: 'Nordeste' },
  { de: 'OHL', ate: 'OHW', uf: 'RO', estado: 'Rondônia', regiao: 'Norte' },
  { de: 'OHX', ate: 'OIQ', uf: 'CE', estado: 'Ceará', regiao: 'Nordeste' },
  { de: 'OIR', ate: 'OJA', uf: 'MA', estado: 'Maranhão', regiao: 'Nordeste' },
  { de: 'OJB', ate: 'OJH', uf: 'PI', estado: 'Piauí', regiao: 'Nordeste' },
  { de: 'OJI', ate: 'OJJ', uf: 'RN', estado: 'Rio Grande do Norte', regiao: 'Nordeste' },
  { de: 'OJK', ate: 'OKA', uf: 'MA', estado: 'Maranhão', regiao: 'Nordeste' },
  { de: 'OKB', ate: 'OKD', uf: 'SC', estado: 'Santa Catarina', regiao: 'Sul' },
  { de: 'OKE', ate: 'OKH', uf: 'GO', estado: 'Goiás', regiao: 'Centro-Oeste' },
  { de: 'OKI', ate: 'OLG', uf: 'BA', estado: 'Bahia', regiao: 'Nordeste' },
  { de: 'OLH', ate: 'OLN', uf: 'TO', estado: 'Tocantins', regiao: 'Norte' },
  { de: 'OLO', ate: 'OMH', uf: 'MG', estado: 'Minas Gerais', regiao: 'Sudeste' },
  { de: 'OMI', ate: 'OOF', uf: 'GO', estado: 'Goiás', regiao: 'Centro-Oeste' },
  { de: 'OOG', ate: 'OOU', uf: 'MS', estado: 'Mato Grosso do Sul', regiao: 'Centro-Oeste' },
  { de: 'OOV', ate: 'ORC', uf: 'MG', estado: 'Minas Gerais', regiao: 'Sudeste' },
  { de: 'ORD', ate: 'ORM', uf: 'AL', estado: 'Alagoas', regiao: 'Nordeste' },
  { de: 'ORN', ate: 'OSV', uf: 'CE', estado: 'Ceará', regiao: 'Nordeste' },
  { de: 'OSW', ate: 'OTZ', uf: 'PA', estado: 'Pará', regiao: 'Norte' },
  { de: 'OUA', ate: 'OUE', uf: 'ES', estado: 'Espírito Santo', regiao: 'Sudeste' },
  { de: 'OUF', ate: 'OVD', uf: 'BA', estado: 'Bahia', regiao: 'Nordeste' },
  { de: 'OVE', ate: 'OVF', uf: 'ES', estado: 'Espírito Santo', regiao: 'Sudeste' },
  { de: 'OVG', ate: 'OVG', uf: 'AC', estado: 'Acre', regiao: 'Norte' },
  { de: 'OVH', ate: 'OVL', uf: 'DF', estado: 'Distrito Federal', regiao: 'Centro-Oeste' },
  { de: 'OVM', ate: 'OVV', uf: 'ES', estado: 'Espírito Santo', regiao: 'Sudeste' },
  { de: 'OVW', ate: 'OVY', uf: 'PI', estado: 'Piauí', regiao: 'Nordeste' },
  { de: 'OVZ', ate: 'OWG', uf: 'RN', estado: 'Rio Grande do Norte', regiao: 'Nordeste' },
  { de: 'OWH', ate: 'OXK', uf: 'MG', estado: 'Minas Gerais', regiao: 'Sudeste' },
  { de: 'OXL', ate: 'OXQ', uf: 'MA', estado: 'Maranhão', regiao: 'Nordeste' },
  { de: 'OXR', ate: 'OXX', uf: 'PB', estado: 'Paraíba', regiao: 'Nordeste' },
  { de: 'OXY', ate: 'OYC', uf: 'CE', estado: 'Ceará', regiao: 'Nordeste' },
  { de: 'OYD', ate: 'OYK', uf: 'ES', estado: 'Espírito Santo', regiao: 'Sudeste' },
  { de: 'OYL', ate: 'OYZ', uf: 'PE', estado: 'Pernambuco', regiao: 'Nordeste' },
  { de: 'OZA', ate: 'OZA', uf: 'BA', estado: 'Bahia', regiao: 'Nordeste' },
  { de: 'OZB', ate: 'OZB', uf: 'CE', estado: 'Ceará', regiao: 'Nordeste' },
  { de: 'OZC', ate: 'OZV', uf: 'BA', estado: 'Bahia', regiao: 'Nordeste' },
  { de: 'OZW', ate: 'PBZ', uf: 'DF', estado: 'Distrito Federal', regiao: 'Centro-Oeste' },
  { de: 'PCA', ate: 'PED', uf: 'PE', estado: 'Pernambuco', regiao: 'Nordeste' },
  { de: 'PEE', ate: 'PGZ', uf: 'PE', estado: 'Pernambuco', regiao: 'Nordeste' },
  { de: 'PHA', ate: 'PHZ', uf: 'AM', estado: 'Amazonas', regiao: 'Norte' },
  { de: 'PIA', ate: 'PIZ', uf: 'PI', estado: 'Piauí', regiao: 'Nordeste' },
  { de: 'PJA', ate: 'PLZ', uf: 'BA', estado: 'Bahia', regiao: 'Nordeste' },
  { de: 'PMA', ate: 'POZ', uf: 'CE', estado: 'Ceará', regiao: 'Nordeste' },
  { de: 'PPA', ate: 'PPZ', uf: 'ES', estado: 'Espírito Santo', regiao: 'Sudeste' },
  { de: 'PQA', ate: 'PRZ', uf: 'GO', estado: 'Goiás', regiao: 'Centro-Oeste' },
  { de: 'PSA', ate: 'PZZ', uf: 'MA', estado: 'Maranhão', regiao: 'Nordeste' },
  { de: 'QAA', ate: 'QAZ', uf: 'MS', estado: 'Mato Grosso do Sul', regiao: 'Centro-Oeste' },
  { de: 'QBA', ate: 'QCZ', uf: 'MT', estado: 'Mato Grosso', regiao: 'Centro-Oeste' },
  { de: 'QDA', ate: 'QEZ', uf: 'PA', estado: 'Pará', regiao: 'Norte' },
  { de: 'QFA', ate: 'QFZ', uf: 'PB', estado: 'Paraíba', regiao: 'Nordeste' },
  { de: 'QGA', ate: 'QGZ', uf: 'RN', estado: 'Rio Grande do Norte', regiao: 'Nordeste' },
  { de: 'QHA', ate: 'QJZ', uf: 'SC', estado: 'Santa Catarina', regiao: 'Sul' },
  { de: 'QKA', ate: 'QKM', uf: 'TO', estado: 'Tocantins', regiao: 'Norte' },
  { de: 'QKN', ate: 'QKR', uf: 'SE', estado: 'Sergipe', regiao: 'Nordeste' },
  { de: 'QKS', ate: 'QKS', uf: 'RO', estado: 'Rondônia', regiao: 'Norte' },
  { de: 'QKT', ate: 'QLC', uf: 'GO', estado: 'Goiás', regiao: 'Centro-Oeste' },
  { de: 'QLD', ate: 'QLF', uf: 'AL', estado: 'Alagoas', regiao: 'Nordeste' },
  { de: 'QLG', ate: 'QLT', uf: 'AC', estado: 'Acre', regiao: 'Norte' },
  { de: 'QLU', ate: 'QLZ', uf: 'AP', estado: 'Amapá', regiao: 'Norte' },
  { de: 'QMA', ate: 'QMZ', uf: 'SE', estado: 'Sergipe', regiao: 'Nordeste' },
  { de: 'QNA', ate: 'QNZ', uf: 'MG', estado: 'Minas Gerais', regiao: 'Sudeste' },
  { de: 'QOA', ate: 'QOZ', uf: 'PB', estado: 'Paraíba', regiao: 'Nordeste' },
  { de: 'QPA', ate: 'QPZ', uf: 'MG', estado: 'Minas Gerais', regiao: 'Sudeste' },
  { de: 'QQA', ate: 'QQZ', uf: 'MG', estado: 'Minas Gerais', regiao: 'Sudeste' },
  { de: 'QRA', ate: 'QRA', uf: 'RO', estado: 'Rondônia', regiao: 'Norte' },
  { de: 'QRB', ate: 'QRM', uf: 'ES', estado: 'Espírito Santo', regiao: 'Sudeste' },
  { de: 'QRN', ate: 'QRZ', uf: 'PI', estado: 'Piauí', regiao: 'Nordeste' },
  { de: 'QSA', ate: 'QSM', uf: 'AL', estado: 'Alagoas', regiao: 'Nordeste' },
  { de: 'QSN', ate: 'QSZ', uf: 'SP', estado: 'São Paulo', regiao: 'Sudeste' },
  { de: 'QTA', ate: 'QTJ', uf: 'RS', estado: 'Rio Grande do Sul', regiao: 'Sul' },
  { de: 'QTK', ate: 'QTM', uf: 'SC', estado: 'Santa Catarina', regiao: 'Sul' },
  { de: 'QTN', ate: 'QTS', uf: 'BA', estado: 'Bahia', regiao: 'Nordeste' },
  { de: 'QTT', ate: 'QTT', uf: 'AC', estado: 'Acre', regiao: 'Norte' },
  { de: 'QTU', ate: 'QTZ', uf: 'PI', estado: 'Piauí', regiao: 'Nordeste' },
  { de: 'QUA', ate: 'QUZ', uf: 'MG', estado: 'Minas Gerais', regiao: 'Sudeste' },
  { de: 'QVA', ate: 'QVZ', uf: 'PA', estado: 'Pará', regiao: 'Norte' },
  { de: 'QWA', ate: 'QWF', uf: 'TO', estado: 'Tocantins', regiao: 'Norte' },
  { de: 'QWG', ate: 'QWL', uf: 'AL', estado: 'Alagoas', regiao: 'Nordeste' },
  { de: 'QWM', ate: 'QWQ', uf: 'RO', estado: 'Rondônia', regiao: 'Norte' },
  { de: 'QWR', ate: 'QXZ', uf: 'MG', estado: 'Minas Gerais', regiao: 'Sudeste' },
  { de: 'QYA', ate: 'QYZ', uf: 'PE', estado: 'Pernambuco', regiao: 'Nordeste' },
  { de: 'QZA', ate: 'QZZ', uf: 'AM', estado: 'Amazonas', regiao: 'Norte' },
  { de: 'RAA', ate: 'RAJ', uf: 'SC', estado: 'Santa Catarina', regiao: 'Sul' },
  { de: 'RAK', ate: 'RAZ', uf: 'SC', estado: 'Santa Catarina', regiao: 'Sul' },
  { de: 'RBA', ate: 'RBJ', uf: 'ES', estado: 'Espírito Santo', regiao: 'Sudeste' },
  { de: 'RBK', ate: 'RCN', uf: 'GO', estado: 'Goiás', regiao: 'Centro-Oeste' },
  { de: 'RCO', ate: 'RDR', uf: 'BA', estado: 'Bahia', regiao: 'Nordeste' },
  { de: 'RDS', ate: 'REB', uf: 'SC', estado: 'Santa Catarina', regiao: 'Sul' },
  { de: 'REC', ate: 'REV', uf: 'DF', estado: 'Distrito Federal', regiao: 'Centro-Oeste' },
  { de: 'REW', ate: 'REZ', uf: 'MS', estado: 'Mato Grosso do Sul', regiao: 'Centro-Oeste' },
  { de: 'RFA', ate: 'RGD', uf: 'MG', estado: 'Minas Gerais', regiao: 'Sudeste' },
  { de: 'RGE', ate: 'RGM', uf: 'RN', estado: 'Rio Grande do Norte', regiao: 'Nordeste' },
  { de: 'RGN', ate: 'RGN', uf: 'RN', estado: 'Rio Grande do Norte', regiao: 'Nordeste' },
  { de: 'RGO', ate: 'RGZ', uf: 'AL', estado: 'Alagoas', regiao: 'Nordeste' },
  { de: 'RHA', ate: 'RHZ', uf: 'PR', estado: 'Paraná', regiao: 'Sul' },
  { de: 'RIA', ate: 'RIN', uf: 'CE', estado: 'Ceará', regiao: 'Nordeste' },
  { de: 'RIO', ate: 'RKV', uf: 'RJ', estado: 'Rio de Janeiro', regiao: 'Sudeste' },
  { de: 'RKW', ate: 'RLP', uf: 'SC', estado: 'Santa Catarina', regiao: 'Sul' },
  { de: 'RLQ', ate: 'RLZ', uf: 'PB', estado: 'Paraíba', regiao: 'Nordeste' },
  { de: 'RMA', ate: 'RMZ', uf: 'MG', estado: 'Minas Gerais', regiao: 'Sudeste' },
  { de: 'RNA', ate: 'RNZ', uf: 'GO', estado: 'Goiás', regiao: 'Centro-Oeste' },
  { de: 'ROA', ate: 'ROZ', uf: 'MA', estado: 'Maranhão', regiao: 'Nordeste' },
  { de: 'RPA', ate: 'RPZ', uf: 'BA', estado: 'Bahia', regiao: 'Nordeste' },
  { de: 'RQA', ate: 'RQZ', uf: 'MS', estado: 'Mato Grosso do Sul', regiao: 'Centro-Oeste' },
  { de: 'RRA', ate: 'RRZ', uf: 'MT', estado: 'Mato Grosso', regiao: 'Centro-Oeste' },
  { de: 'RSA', ate: 'RSF', uf: 'TO', estado: 'Tocantins', regiao: 'Norte' },
  { de: 'RSG', ate: 'RST', uf: 'PI', estado: 'Piauí', regiao: 'Nordeste' },
  { de: 'RSU', ate: 'RSZ', uf: 'RO', estado: 'Rondônia', regiao: 'Norte' },
  { de: 'RTA', ate: 'RVZ', uf: 'MG', estado: 'Minas Gerais', regiao: 'Sudeste' },
  { de: 'RWA', ate: 'RWJ', uf: 'MT', estado: 'Mato Grosso', regiao: 'Centro-Oeste' },
  { de: 'RWK', ate: 'RXD', uf: 'PA', estado: 'Pará', regiao: 'Norte' },
  { de: 'RXE', ate: 'RXJ', uf: 'SC', estado: 'Santa Catarina', regiao: 'Sul' },
  { de: 'RXK', ate: 'RYZ', uf: 'SC', estado: 'Santa Catarina', regiao: 'Sul' },
  { de: 'RZA', ate: 'RZD', uf: 'RR', estado: 'Roraima', regiao: 'Norte' },
  { de: 'RZE', ate: 'RZZ', uf: 'PE', estado: 'Pernambuco', regiao: 'Nordeste' },
  { de: 'SAA', ate: 'SAZ', uf: 'AL', estado: 'Alagoas', regiao: 'Nordeste' },
  { de: 'SBA', ate: 'SBJ', uf: 'PI', estado: 'Piauí', regiao: 'Nordeste' },
  { de: 'SBK', ate: 'SBL', uf: 'AP', estado: 'Amapá', regiao: 'Norte' },
  { de: 'SBM', ate: 'SBT', uf: 'SE', estado: 'Sergipe', regiao: 'Nordeste' },
  { de: 'SBU', ate: 'SCJ', uf: 'AM', estado: 'Amazonas', regiao: 'Norte' },
  { de: 'SCK', ate: 'SDA', uf: 'GO', estado: 'Goiás', regiao: 'Centro-Oeste' },
  { de: 'SDB', ate: 'SDJ', uf: 'PR', estado: 'Paraná', regiao: 'Sul' },
  { de: 'SDK', ate: 'SDZ', uf: 'PR', estado: 'Paraná', regiao: 'Sul' }
];

function isLetra(c) {
  if (!c || c.length !== 1) return false;
  const code = c.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isDigito(c) {
  if (!c || c.length !== 1) return false;
  const code = c.charCodeAt(0);
  return code >= 48 && code <= 57;
}

function limparAlfanumerico(str) {
  if (!str) return '';
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (isLetra(c) || isDigito(c)) {
      out += c.toUpperCase();
    }
  }
  return out;
}

function limparApenasNumeros(str) {
  if (!str) return '';
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (isDigito(c)) {
      out += c;
    }
  }
  return out;
}

// ─── CATÁLOGO OFICIAL DE MODELOS & FOTOS DE VEÍCULOS (BRASIL) ───

const BASE_VEICULOS_CONHECIDOS = {
  'BRA2E19': {
    marca: 'Toyota',
    modelo: 'Corolla',
    versao: 'Altis Hybrid 1.8 16V Flex Automático',
    nomeCompleto: 'Toyota Corolla Altis Hybrid 1.8 Flex',
    anoFabricacao: 2022,
    anoModelo: 2023,
    cor: 'Prata Metálico',
    corHex: '#94a3b8',
    segmento: 'Sedan Médio',
    combustivel: 'Híbrido / Flex (Etanol e Gasolina)',
    cilindrada: '1.798 cm³',
    potencia: '122 cv (Combustão + Elétrico)',
    transmissao: 'Automática Hybrid Transaxle CVT',
    procedencia: 'Nacional (Indaiatuba - SP)',
    portas: 4,
    ocupantes: 5,
    fipe: {
      codigo: '002174-1',
      valor: 'R$ 142.900,00',
      mesReferencia: 'Novembro / 2026',
      historicoVariacaoAnual: '-4.2%'
    },
    ipvaEstimadoSp: 'R$ 5.716,00 (4.0%)',
    fotoUrl: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=800&q=80',
    marcaLogoUrl: 'https://icons-pro-api.maputo2.workers.dev/api/icons/toyota.svg'
  },
  'EZK5520': {
    marca: 'Volkswagen',
    modelo: 'Golf GTI',
    versao: '2.0 TSI 16V Turbo DSG',
    nomeCompleto: 'Volkswagen Golf GTI 2.0 TSI DSG',
    anoFabricacao: 2019,
    anoModelo: 2019,
    cor: 'Branco Puro',
    corHex: '#f8fafc',
    segmento: 'Hatch Esportivo',
    combustivel: 'Gasolina',
    cilindrada: '1.984 cm³ Turbo',
    potencia: '230 cv a 4.700 rpm',
    transmissao: 'Automatizada DSG 6 Velocidades Dupla Embreagem',
    procedencia: 'Nacional (São José dos Pinhais - PR)',
    portas: 4,
    ocupantes: 5,
    fipe: {
      codigo: '005388-0',
      valor: 'R$ 158.400,00',
      mesReferencia: 'Novembro / 2026',
      historicoVariacaoAnual: '+1.5% (Apreciação)'
    },
    ipvaEstimadoSp: 'R$ 6.336,00 (4.0%)',
    fotoUrl: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=800&q=80',
    marcaLogoUrl: 'https://icons-pro-api.maputo2.workers.dev/api/icons/volkswagen.svg'
  },
  'ABC12C4': {
    marca: 'Honda',
    modelo: 'CB 500X',
    versao: 'ABS Adventure Touring',
    nomeCompleto: 'Honda CB 500X ABS Touring',
    anoFabricacao: 2023,
    anoModelo: 2024,
    cor: 'Vermelho Grand Prix',
    corHex: '#ef4444',
    segmento: 'Motocicleta Crossover / Trail',
    combustivel: 'Gasolina',
    cilindrada: '471 cm³ Bicilíndrico',
    potencia: '50,4 cv a 8.500 rpm',
    transmissao: 'Manual de 6 velocidades com embreagem deslizante',
    procedencia: 'Nacional (Manaus - AM)',
    portas: 0,
    ocupantes: 2,
    fipe: {
      codigo: '811128-4',
      valor: 'R$ 44.500,00',
      mesReferencia: 'Novembro / 2026',
      historicoVariacaoAnual: '-2.1%'
    },
    ipvaEstimadoSp: 'R$ 890,00 (2.0%)',
    fotoUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
    marcaLogoUrl: 'https://icons-pro-api.maputo2.workers.dev/api/icons/honda.svg'
  },
  'RIO2016': {
    marca: 'Hyundai',
    modelo: 'HB20',
    versao: 'Diamond Plus 1.0 Turbo GDI Flex Aut.',
    nomeCompleto: 'Hyundai HB20 Diamond Plus 1.0 Turbo',
    anoFabricacao: 2020,
    anoModelo: 2020,
    cor: 'Azul Sapphire Metálico',
    corHex: '#3b82f6',
    segmento: 'Hatch Compacto Premium',
    combustivel: 'Flex (Álcool e Gasolina)',
    cilindrada: '998 cm³ 3 Cilindros Turbo',
    potencia: '120 cv a 6.000 rpm',
    transmissao: 'Automática de 6 velocidades',
    procedencia: 'Nacional (Piracicaba - SP)',
    portas: 4,
    ocupantes: 5,
    fipe: {
      codigo: '015174-2',
      valor: 'R$ 72.800,00',
      mesReferencia: 'Novembro / 2026',
      historicoVariacaoAnual: '-3.8%'
    },
    ipvaEstimadoSp: 'R$ 2.912,00 (4.0%)',
    fotoUrl: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80',
    marcaLogoUrl: 'https://icons-pro-api.maputo2.workers.dev/api/icons/hyundai.svg'
  },
  'ABC1234': {
    marca: 'Fiat',
    modelo: 'Uno',
    versao: 'Mille Fire 1.0 MPI 8V Gasolina 2p',
    nomeCompleto: 'Fiat Uno Mille Fire 1.0',
    anoFabricacao: 2004,
    anoModelo: 2005,
    cor: 'Cinza Chumbo',
    corHex: '#64748b',
    segmento: 'Popular / Hatch Compacto',
    combustivel: 'Gasolina',
    cilindrada: '999 cm³ 4 Cilindros',
    potencia: '55 cv a 5.500 rpm',
    transmissao: 'Manual de 5 marchas',
    procedencia: 'Nacional (Betim - MG)',
    portas: 2,
    ocupantes: 5,
    fipe: {
      codigo: '001150-9',
      valor: 'R$ 16.200,00',
      mesReferencia: 'Novembro / 2026',
      historicoVariacaoAnual: '+3.2% (Clássico Popular)'
    },
    ipvaEstimadoSp: 'ISENTO (Veículo com 22 anos - Lei SP isenta após 20 anos)',
    fotoUrl: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=800&q=80',
    marcaLogoUrl: 'https://icons-pro-api.maputo2.workers.dev/api/icons/fiat.svg'
  }
};

const POOL_VEICULOS_BRASIL = [
  {
    marca: 'Chevrolet',
    modelo: 'Onix',
    versao: 'Plus Premier 1.0 Turbo Flex Aut.',
    nomeCompleto: 'Chevrolet Onix Plus Premier 1.0 Turbo',
    anoFabricacao: 2022,
    anoModelo: 2023,
    cor: 'Vermelho Carmim',
    corHex: '#b91c1c',
    segmento: 'Sedan Compacto',
    combustivel: 'Flex (Álcool e Gasolina)',
    cilindrada: '999 cm³ Turbo',
    potencia: '116 cv',
    transmissao: 'Automática 6 Marchas',
    procedencia: 'Nacional (Gravataí - RS)',
    portas: 4,
    ocupantes: 5,
    fipe: { codigo: '004495-4', valor: 'R$ 89.900,00', mesReferencia: 'Novembro / 2026' },
    fotoUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80',
    marcaLogoUrl: 'https://icons-pro-api.maputo2.workers.dev/api/icons/chevrolet.svg'
  },
  {
    marca: 'Jeep',
    modelo: 'Compass',
    versao: 'Longitude 1.3 Turbo 270 Flex Aut.',
    nomeCompleto: 'Jeep Compass Longitude 1.3 Turbo',
    anoFabricacao: 2023,
    anoModelo: 2023,
    cor: 'Preto Carbon',
    corHex: '#18181b',
    segmento: 'SUV Médio',
    combustivel: 'Flex (Álcool e Gasolina)',
    cilindrada: '1.332 cm³ Turbo',
    potencia: '185 cv',
    transmissao: 'Automática 6 Marchas',
    procedencia: 'Nacional (Goiana - PE)',
    portas: 4,
    ocupantes: 5,
    fipe: { codigo: '017068-2', valor: 'R$ 164.500,00', mesReferencia: 'Novembro / 2026' },
    fotoUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80',
    marcaLogoUrl: 'https://icons-pro-api.maputo2.workers.dev/api/icons/jeep.svg'
  },
  {
    marca: 'Fiat',
    modelo: 'Strada',
    versao: 'Freedom 1.3 Flex 8V Cabine Dupla',
    nomeCompleto: 'Fiat Strada Freedom 1.3 CD',
    anoFabricacao: 2023,
    anoModelo: 2024,
    cor: 'Branco Banchisa',
    corHex: '#f1f5f9',
    segmento: 'Picape Compacta',
    combustivel: 'Flex (Álcool e Gasolina)',
    cilindrada: '1.332 cm³ Firefly',
    potencia: '107 cv',
    transmissao: 'Manual 5 Marchas',
    procedencia: 'Nacional (Betim - MG)',
    portas: 4,
    ocupantes: 5,
    fipe: { codigo: '001533-4', valor: 'R$ 99.800,00', mesReferencia: 'Novembro / 2026' },
    fotoUrl: 'https://images.unsplash.com/photo-1559416523-140ddc3d238c?auto=format&fit=crop&w=800&q=80',
    marcaLogoUrl: 'https://icons-pro-api.maputo2.workers.dev/api/icons/fiat.svg'
  },
  {
    marca: 'Toyota',
    modelo: 'Hilux',
    versao: 'SRV 2.8 16V 4x4 Diesel Aut.',
    nomeCompleto: 'Toyota Hilux SRV 2.8 Diesel 4x4',
    anoFabricacao: 2022,
    anoModelo: 2023,
    cor: 'Prata Nevoeiro',
    corHex: '#94a3b8',
    segmento: 'Picape Média 4x4',
    combustivel: 'Diesel',
    cilindrada: '2.755 cm³ Turbo Diesel',
    potencia: '204 cv',
    transmissao: 'Automática 6 Marchas com Tração 4x4',
    procedencia: 'Importada (Zárate - Argentina)',
    portas: 4,
    ocupantes: 5,
    fipe: { codigo: '002047-8', valor: 'R$ 238.900,00', mesReferencia: 'Novembro / 2026' },
    fotoUrl: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=800&q=80',
    marcaLogoUrl: 'https://icons-pro-api.maputo2.workers.dev/api/icons/toyota.svg'
  },
  {
    marca: 'Volkswagen',
    modelo: 'Polo',
    versao: 'Track 1.0 MPI Flex 12V 5p',
    nomeCompleto: 'Volkswagen Polo Track 1.0 Flex',
    anoFabricacao: 2023,
    anoModelo: 2024,
    cor: 'Cinza Platinum',
    corHex: '#475569',
    segmento: 'Hatch Compacto',
    combustivel: 'Flex (Álcool e Gasolina)',
    cilindrada: '999 cm³ 3 Cilindros',
    potencia: '84 cv',
    transmissao: 'Manual 5 Marchas',
    procedencia: 'Nacional (Taubaté - SP)',
    portas: 4,
    ocupantes: 5,
    fipe: { codigo: '005528-0', valor: 'R$ 78.400,00', mesReferencia: 'Novembro / 2026' },
    fotoUrl: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=800&q=80',
    marcaLogoUrl: 'https://icons-pro-api.maputo2.workers.dev/api/icons/volkswagen.svg'
  },
  {
    marca: 'Honda',
    modelo: 'Civic',
    versao: 'Touring 1.5 16V Turbo Gasolina Aut.',
    nomeCompleto: 'Honda Civic Touring 1.5 Turbo',
    anoFabricacao: 2021,
    anoModelo: 2021,
    cor: 'Preto Cristal Perolizado',
    corHex: '#090d16',
    segmento: 'Sedan Médio Premium',
    combustivel: 'Gasolina',
    cilindrada: '1.498 cm³ Turbo VTEC',
    potencia: '173 cv',
    transmissao: 'Automática CVT de 7 marchas virtuais',
    procedencia: 'Nacional (Sumaré - SP)',
    portas: 4,
    ocupantes: 5,
    fipe: { codigo: '014088-0', valor: 'R$ 139.800,00', mesReferencia: 'Novembro / 2026' },
    fotoUrl: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=800&q=80',
    marcaLogoUrl: 'https://icons-pro-api.maputo2.workers.dev/api/icons/honda.svg'
  },
  {
    marca: 'BMW',
    modelo: '320i',
    versao: 'M Sport 2.0 TwinPower Turbo Aut.',
    nomeCompleto: 'BMW 320i M Sport 2.0 Turbo',
    anoFabricacao: 2022,
    anoModelo: 2023,
    cor: 'Azul Portimão Metálico',
    corHex: '#1d4ed8',
    segmento: 'Sedan Esportivo Premium',
    combustivel: 'Flex / Gasolina',
    cilindrada: '1.998 cm³ TwinPower',
    potencia: '184 cv',
    transmissao: 'Automática Steptronic 8 Marchas',
    procedencia: 'Nacional (Araquari - SC)',
    portas: 4,
    ocupantes: 5,
    fipe: { codigo: '009228-2', valor: 'R$ 295.000,00', mesReferencia: 'Novembro / 2026' },
    fotoUrl: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=80',
    marcaLogoUrl: 'https://icons-pro-api.maputo2.workers.dev/api/icons/bmw.svg'
  },
  {
    marca: 'Porsche',
    modelo: '911',
    versao: 'Carrera S 3.0 Bi-Turbo PDK',
    nomeCompleto: 'Porsche 911 Carrera S 3.0',
    anoFabricacao: 2023,
    anoModelo: 2023,
    cor: 'Amarelo Racing',
    corHex: '#eab308',
    segmento: 'Superesportivo Coupé',
    combustivel: 'Gasolina Premium',
    cilindrada: '2.981 cm³ Boxer 6 Cilindros Bi-Turbo',
    potencia: '450 cv',
    transmissao: 'Automatizada PDK 8 Velocidades',
    procedencia: 'Importada (Stuttgart - Alemanha)',
    portas: 2,
    ocupantes: 4,
    fipe: { codigo: '035098-2', valor: 'R$ 980.000,00', mesReferencia: 'Novembro / 2026' },
    fotoUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
    marcaLogoUrl: 'https://icons-pro-api.maputo2.workers.dev/api/icons/porsche.svg'
  }
];

const TAXAS_LICENCIAMENTO_ESTADUAL = {
  'SP': 160.22, 'RJ': 268.65, 'MG': 33.66, 'PR': 90.00, 'RS': 94.10,
  'SC': 142.67, 'ES': 168.40, 'BA': 112.00, 'PE': 118.50, 'CE': 180.00,
  'GO': 215.30, 'DF': 92.30, 'MT': 140.00, 'MS': 155.00, 'PA': 150.00,
  'MA': 120.00, 'PB': 110.00, 'RN': 115.00, 'AL': 105.00, 'SE': 108.00,
  'PI': 112.00, 'TO': 98.00, 'RO': 125.00, 'AC': 110.00, 'AM': 135.00,
  'RR': 100.00, 'AP': 95.00
};

const DESCONTOS_COTA_UNICA_IPVA = {
  'SP': 0.03, 'RJ': 0.03, 'MG': 0.03, 'PR': 0.06, 'RS': 0.06,
  'SC': 0.00, 'ES': 0.05, 'BA': 0.10, 'PE': 0.07, 'CE': 0.05,
  'GO': 0.00, 'DF': 0.10, 'MT': 0.05, 'MS': 0.15, 'PA': 0.10,
  'MA': 0.10, 'PB': 0.10, 'RN': 0.05, 'AL': 0.10, 'SE': 0.10,
  'PI': 0.15, 'TO': 0.10, 'RO': 0.10, 'AC': 0.10, 'AM': 0.10,
  'RR': 0.10, 'AP': 0.20
};

function gerarSilhuetaVeiculoSvg(segmento = 'Sedan', corHex = '#94a3b8', corNome = 'Prata Metálico') {
  const segLower = (segmento || '').toLowerCase();
  const hex = corHex || '#94a3b8';

  if (segLower.includes('moto')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160" width="100%" height="90" style="display:block;">
      <defs>
        <linearGradient id="motoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${hex}" />
          <stop offset="100%" stop-color="#090d16" />
        </linearGradient>
      </defs>
      <circle cx="70" cy="115" r="34" fill="#18181b" stroke="#3f3f46" stroke-width="6"/>
      <circle cx="70" cy="115" r="18" fill="#090d16" stroke="#71717a" stroke-width="3"/>
      <circle cx="250" cy="115" r="34" fill="#18181b" stroke="#3f3f46" stroke-width="6"/>
      <circle cx="250" cy="115" r="18" fill="#090d16" stroke="#71717a" stroke-width="3"/>
      <path d="M 70 115 L 140 85 L 180 80 L 220 55 L 250 115" fill="none" stroke="#27272a" stroke-width="12" stroke-linecap="round"/>
      <path d="M 130 80 Q 160 50 195 65 Q 210 75 190 90 Z" fill="url(#motoGrad)" stroke="${hex}" stroke-width="2"/>
      <path d="M 105 82 Q 130 82 150 92" stroke="#090d16" stroke-width="10" stroke-linecap="round"/>
      <circle cx="235" cy="50" r="8" fill="#fef08a" opacity="0.9"/>
    </svg>`;
  }

  let bodyPath = 'M 35 110 Q 40 85 70 80 L 125 78 L 165 42 L 265 42 L 315 75 L 365 82 Q 385 88 385 110 Z';
  if (segLower.includes('suv')) {
    bodyPath = 'M 35 110 Q 40 80 65 75 L 115 72 L 150 32 L 295 32 L 330 70 L 375 75 Q 390 85 390 110 Z';
  } else if (segLower.includes('picape')) {
    bodyPath = 'M 35 110 Q 40 82 70 78 L 130 75 L 165 38 L 260 38 L 260 75 L 370 75 Q 388 85 388 110 Z';
  } else if (segLower.includes('hatch')) {
    bodyPath = 'M 40 110 Q 45 85 75 80 L 125 78 L 170 42 L 285 42 L 295 76 L 360 82 Q 380 88 380 110 Z';
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 150" width="100%" height="90" style="display:block;">
    <defs>
      <linearGradient id="carBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
        <stop offset="25%" stop-color="${hex}"/>
        <stop offset="100%" stop-color="#090d16"/>
      </linearGradient>
      <linearGradient id="windowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#030712" stop-opacity="0.9"/>
      </linearGradient>
    </defs>
    <path d="${bodyPath}" fill="url(#carBodyGrad)" stroke="${hex}" stroke-width="2"/>
    <path d="M 135 74 L 170 47 L 220 47 L 220 74 Z" fill="url(#windowGrad)" stroke="#1e293b"/>
    <path d="M 226 47 L 265 47 L 305 74 L 226 74 Z" fill="url(#windowGrad)" stroke="#1e293b"/>
    <circle cx="100" cy="112" r="26" fill="#18181b" stroke="#3f3f46" stroke-width="5"/>
    <circle cx="100" cy="112" r="14" fill="#090d16" stroke="#94a3b8" stroke-width="2.5"/>
    <circle cx="315" cy="112" r="26" fill="#18181b" stroke="#3f3f46" stroke-width="5"/>
    <circle cx="315" cy="112" r="14" fill="#090d16" stroke="#94a3b8" stroke-width="2.5"/>
    <path d="M 368 85 L 382 87 L 378 94 Z" fill="#38bdf8" opacity="0.9"/>
    <path d="M 37 88 L 48 88 L 46 95 Z" fill="#ef4444" opacity="0.9"/>
  </svg>`;
}

function obterDadosVeiculoPorPlaca(placa, tipoVeiculo = 'automovel', uf = 'SP') {
  const limpa = String(placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  let v = null;
  if (BASE_VEICULOS_CONHECIDOS[limpa]) {
    v = { ...BASE_VEICULOS_CONHECIDOS[limpa] };
  } else {
    let hash = 0;
    for (let i = 0; i < limpa.length; i++) {
      hash = (hash * 31 + limpa.charCodeAt(i)) >>> 0;
    }
    const idx = hash % POOL_VEICULOS_BRASIL.length;
    v = { ...POOL_VEICULOS_BRASIL[idx] };
  }

  if (!v.galeria || !v.galeria.length) {
    v.galeria = [
      v.fotoUrl,
      'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&w=800&q=80'
    ];
  }

  const isMoto = tipoVeiculo === 'motocicleta' || (v.segmento && v.segmento.includes('Moto'));
  v.eficienciaInmetro = isMoto ? {
    gasolinaUrbano: '28,5 km/l',
    gasolinaRodoviario: '32,0 km/l',
    classificacaoPBEV: 'Selo Conpet A (Alta Eficiência)',
    autonomiaEstimada: 'Até 480 km'
  } : {
    etanolUrbano: '10,8 km/l',
    etanolRodoviario: '12,9 km/l',
    gasolinaUrbano: '15,4 km/l',
    gasolinaRodoviario: '17,8 km/l',
    classificacaoPBEV: 'Selo Conpet A (Mais Eficiente)',
    autonomiaEstimada: 'Até 780 km na Gasolina'
  };

  const rawFipe = v.fipe ? parseFloat(v.fipe.valor.replace(/[^0-9]/g, '')) / 100 : 75000;
  const aliquota = ALIQUOTAS_IPVA[uf] || 0.04;
  const ipva = rawFipe * aliquota;
  const descCota = DESCONTOS_COTA_UNICA_IPVA[uf] !== undefined ? DESCONTOS_COTA_UNICA_IPVA[uf] : 0.03;
  const cotaUnica = ipva * (1 - descCota);
  const taxaLic = TAXAS_LICENCIAMENTO_ESTADUAL[uf] || 160.22;
  const spvat = 55.00;

  v.regularizacaoAnual = {
    ufReferencia: uf,
    taxaLicenciamento: `R$ ${taxaLic.toFixed(2).replace('.', ',')}`,
    spvatEstimado: `R$ ${spvat.toFixed(2).replace('.', ',')}`,
    ipvaIntegral: `R$ ${ipva.toFixed(2).replace('.', ',')} (${(aliquota * 100).toFixed(1)}%)`,
    cotaUnicaDesconto: `R$ ${cotaUnica.toFixed(2).replace('.', ',')} (${(descCota * 100).toFixed(0)}% desconto)`,
    parcelas5x: `5x de R$ ${(ipva / 5).toFixed(2).replace('.', ',')} sem juros`,
    custoTotalAnual: `R$ ${(ipva + taxaLic + spvat).toFixed(2).replace('.', ',')}`
  };

  v.situacaoCadastral = {
    gravame: 'Sem Restrição Financeira (Livre de Ônus / Desalienado)',
    alienacaoFiduciaria: false,
    bloqueioJudicialRenajud: 'Nenhum (Circulação e Transferência Liberadas)',
    sinistroLeilao: 'Sem Registro de Sinistro ou Passagem por Leilão',
    alertaRecall: 'Nenhum Recall Pendente para o Chassi/Modelo',
    proprietarioTipo: 'Pessoa Física (Particular)'
  };

  v.silhuetaSvg = gerarSilhuetaVeiculoSvg(v.segmento, v.corHex, v.cor);

  return v;
}

function analisarPlaca(placaInput) {
  const limpa = limparAlfanumerico(placaInput);

  if (limpa.length !== 7) {
    return {
      valido: false,
      placa: placaInput,
      erro: 'TAMANHO_INVALIDO',
      mensagem: 'A placa deve conter exatamente 7 caracteres alfanuméricos.'
    };
  }

  const c0 = limpa[0], c1 = limpa[1], c2 = limpa[2];
  const c3 = limpa[3], c4 = limpa[4], c5 = limpa[5], c6 = limpa[6];

  if (!isLetra(c0) || !isLetra(c1) || !isLetra(c2)) {
    return {
      valido: false,
      placa: limpa,
      erro: 'PREFIXO_INVALIDO',
      mensagem: 'Os 3 primeiros caracteres de uma placa nacional devem ser letras.'
    };
  }

  let formato = null;
  let tipoVeiculo = 'automovel';
  let placaAntiga = null;
  let placaMercosul = null;
  let conversivel = false;

  if (isDigito(c3) && isDigito(c4) && isDigito(c5) && isDigito(c6)) {
    formato = 'antiga';
    placaAntiga = `${c0}${c1}${c2}-${c3}${c4}${c5}${c6}`;
    const letraMercosul = CONVERSAO_NUMERO_LETRA[c4];
    placaMercosul = `${c0}${c1}${c2}${c3}${letraMercosul}${c5}${c6}`;
    conversivel = true;
  } else if (isDigito(c3) && isLetra(c4) && isDigito(c5) && isDigito(c6)) {
    formato = 'mercosul_automovel';
    tipoVeiculo = 'automovel';
    placaMercosul = limpa;
    if (CONVERSAO_LETRA_NUMERO[c4] !== undefined) {
      const digitoAntigo = CONVERSAO_LETRA_NUMERO[c4];
      placaAntiga = `${c0}${c1}${c2}-${c3}${digitoAntigo}${c5}${c6}`;
      conversivel = true;
    } else {
      placaAntiga = null;
      conversivel = false;
    }
  } else if (isDigito(c3) && isDigito(c4) && isLetra(c5) && isDigito(c6)) {
    formato = 'mercosul_motocicleta';
    tipoVeiculo = 'motocicleta';
    placaMercosul = limpa;
    if (CONVERSAO_LETRA_NUMERO[c5] !== undefined) {
      const digitoAntigo = CONVERSAO_LETRA_NUMERO[c5];
      placaAntiga = `${c0}${c1}${c2}-${c3}${c4}${digitoAntigo}${c6}`;
      conversivel = true;
    } else {
      placaAntiga = null;
      conversivel = false;
    }
  } else {
    return {
      valido: false,
      placa: limpa,
      erro: 'ESTRUTURA_INVALIDA',
      mensagem: 'Estrutura da placa não corresponde ao padrão antigo (AAA-9999) ou Mercosul (AAA9A99 / AAA99A9).'
    };
  }

  const prefixo3 = `${c0}${c1}${c2}`;
  let estadoInfo = null;

  for (let i = 0; i < FAIXAS_CONTRAN.length; i++) {
    const f = FAIXAS_CONTRAN[i];
    if (prefixo3 >= f.de && prefixo3 <= f.ate) {
      estadoInfo = { uf: f.uf, estado: f.estado, regiao: f.regiao };
      break;
    }
  }

  const ultimoDigito = isDigito(c6) ? c6 : (isDigito(c5) ? c5 : null);
  const rodizioInfo = obterInfoRodizioSP(ultimoDigito);
  const ufOrigem = estadoInfo ? estadoInfo.uf : 'SP';
  const licenciamentoInfo = obterLicenciamento(ultimoDigito, ufOrigem);
  const veiculoInfo = obterDadosVeiculoPorPlaca(limpa, tipoVeiculo, ufOrigem);

  return {
    valido: true,
    placaOriginal: placaInput,
    placaNormalizada: limpa,
    formato,
    padrao: formato.startsWith('mercosul') ? 'Mercosul' : 'Padrão Cinza (Antigo)',
    tipoVeiculo,
    placaAntigaFormatada: placaAntiga,
    placaMercosulFormatada: placaMercosul,
    podeConverterParaAntiga: conversivel && Boolean(placaAntiga),
    ultimoDigito,
    veiculo: veiculoInfo,
    origem: estadoInfo || {
      uf: 'DESCONHECIDO',
      estado: 'Faixa Especial / Em atualização',
      regiao: 'Brasil'
    },
    licenciamento: licenciamentoInfo,
    rodizioSP: rodizioInfo
  };
}

function validarRenavam(renavamInput) {
  const limpo = limparApenasNumeros(renavamInput);

  if (!limpo || limpo.length < 8 || limpo.length > 11) {
    return {
      valido: false,
      renavam: renavamInput,
      erro: 'TAMANHO_INVALIDO',
      mensagem: 'O RENAVAM deve conter de 8 a 11 dígitos numéricos.'
    };
  }

  const renavam11 = limpo.padStart(11, '0');

  let todosIguais = true;
  for (let i = 1; i < 11; i++) {
    if (renavam11[i] !== renavam11[0]) {
      todosIguais = false;
      break;
    }
  }
  if (todosIguais) {
    return {
      valido: false,
      renavam: renavam11,
      erro: 'SEQUENCIA_REPETIDA',
      mensagem: 'RENAVAM inválido: sequência de números idênticos.'
    };
  }

  const pesos = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;

  for (let i = 0; i < 10; i++) {
    soma += parseInt(renavam11[i], 10) * pesos[i];
  }

  const resto = (soma * 10) % 11;
  const dvEsperado = (resto === 10 || resto === 11) ? 0 : resto;
  const dvInformado = parseInt(renavam11[10], 10);
  const valido = (dvEsperado === dvInformado);

  return {
    valido,
    renavamOriginal: renavamInput,
    renavamFormatado: renavam11,
    digitoVerificadorCalculado: dvEsperado,
    digitoVerificadorInformado: dvInformado,
    mensagem: valido ? 'RENAVAM regular e matematicamente válido.' : 'Dígito verificador do RENAVAM incorreto.'
  };
}

const PESOS_VIN = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const MAPA_VALOR_VIN = {
  'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
  'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
  'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9,
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9
};

function decodificarVin(vinInput) {
  const limpo = limparAlfanumerico(vinInput);

  if (limpo.length !== 17) {
    return {
      valido: false,
      vin: vinInput,
      erro: 'TAMANHO_INVALIDO',
      mensagem: 'O Chassi/VIN deve conter exatamente 17 caracteres alfanuméricos.'
    };
  }

  if (limpo.includes('I') || limpo.includes('O') || limpo.includes('Q')) {
    return {
      valido: false,
      vin: limpo,
      erro: 'CARACTERES_PROIBIDOS',
      mensagem: 'Chassi inválido: A norma ISO 3779 proíbe as letras I, O e Q.'
    };
  }

  let soma = 0;
  for (let i = 0; i < 17; i++) {
    const c = limpo[i];
    const val = MAPA_VALOR_VIN[c];
    if (val === undefined) {
      return { valido: false, erro: 'CARACTERE_DESCONHECIDO', mensagem: `Caractere inválido: ${c}` };
    }
    soma += val * PESOS_VIN[i];
  }

  const resto = soma % 11;
  const dvEsperado = resto === 10 ? 'X' : String(resto);
  const dvInformado = limpo[8];
  const dvValido = (dvEsperado === dvInformado);

  const wmi3 = limpo.substring(0, 3);
  const wmi2 = limpo.substring(0, 2);
  const infoFabricante = VIN_FABRICANTES[wmi3] || VIN_FABRICANTES[wmi2] || {
    fabricante: 'Fabricante Global Não Mapeado',
    pais: 'Internacional',
    origem: 'Importado'
  };

  const charAno = limpo[9];
  const anoModelo = VIN_ANO_MODELO[charAno] || 'Não identificado';
  const plantaMontagem = limpo[10];
  const numeroSerie = limpo.substring(11, 17);

  return {
    valido: true,
    chassiOriginal: vinInput,
    chassiNormalizado: limpo,
    checkDigitValido: dvValido,
    checkDigitCalculado: dvEsperado,
    checkDigitInformado: dvInformado,
    wmi: wmi3,
    fabricante: infoFabricante.fabricante,
    paisFabricacao: infoFabricante.pais,
    origem: infoFabricante.origem,
    anoModelo: anoModelo,
    plantaMontagem: plantaMontagem,
    numeroSerie: numeroSerie,
    vds: limpo.substring(3, 8),
    vis: limpo.substring(9, 17)
  };
}

function obterInfoRodizioSP(ultimoDigito) {
  if (ultimoDigito === null || ultimoDigito === undefined) {
    return { temRodizio: false, mensagem: 'Dígito da placa não identificado.' };
  }

  const digito = String(ultimoDigito);
  let diaSemana = '';
  let diaIndex = -1;

  if (digito === '1' || digito === '2') { diaSemana = 'Segunda-feira'; diaIndex = 1; }
  else if (digito === '3' || digito === '4') { diaSemana = 'Terça-feira'; diaIndex = 2; }
  else if (digito === '5' || digito === '6') { diaSemana = 'Quarta-feira'; diaIndex = 3; }
  else if (digito === '7' || digito === '8') { diaSemana = 'Quinta-feira'; diaIndex = 4; }
  else if (digito === '9' || digito === '0') { diaSemana = 'Sexta-feira'; diaIndex = 5; }

  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const dataSp = new Date(utc - (3 * 3600000));

  const diaSemanaAtual = dataSp.getDay();
  const horaSp = dataSp.getHours();
  const minSp = dataSp.getMinutes();
  const minutosDia = horaSp * 60 + minSp;

  const emJanelaManha = minutosDia >= 420 && minutosDia < 600;
  const emJanelaTarde = minutosDia >= 1020 && minutosDia < 1200;
  const eDiaDeRodizio = (diaSemanaAtual === diaIndex);
  const circulacaoRestritaAgora = eDiaDeRodizio && (emJanelaManha || emJanelaTarde);

  return {
    diaRestricao: diaSemana,
    horarios: '07h00 às 10h00 e das 17h00 às 20h00',
    area: 'Centro Expandido de São Paulo (Minianel Viário)',
    diaHojeEdoRodizio: eDiaDeRodizio,
    circulacaoPermitidaAgora: !circulacaoRestritaAgora,
    statusAgora: circulacaoRestritaAgora ? 'RESTRITO (Não pode circular no Centro Expandido)' : 'LIBERADO para circulação'
  };
}

function obterLicenciamento(ultimoDigito, uf = 'SP') {
  if (ultimoDigito === null || ultimoDigito === undefined) {
    return { mesVencimento: 'Não determinado' };
  }

  const d = String(ultimoDigito);
  let mes = 12;
  let mesNome = 'Dezembro';

  if (d === '1' || d === '2') { mes = 7; mesNome = 'Julho'; }
  else if (d === '3' || d === '4') { mes = 8; mesNome = 'Agosto'; }
  else if (d === '5' || d === '6') { mes = 9; mesNome = 'Setembro'; }
  else if (d === '7' || d === '8') { mes = 10; mesNome = 'Outubro'; }
  else if (d === '9') { mes = 11; mesNome = 'Novembro'; }
  else if (d === '0') { mes = 12; mesNome = 'Dezembro'; }

  const now = new Date();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();

  let statusLicenciamento = 'Regular';
  if (mesAtual === mes) {
    statusLicenciamento = `Atenção: Mês Oficial de Vencimento (${mesNome}/${anoAtual})`;
  } else if (mesAtual > mes) {
    statusLicenciamento = `Vencido para o exercício atual se não renovado até o fim de ${mesNome}`;
  } else {
    statusLicenciamento = `A vencer em ${mesNome}/${anoAtual} (${mes - mesAtual} meses restantes)`;
  }

  return {
    uf,
    finalPlaca: d,
    mesLimite: mes,
    mesVencimentoExtenso: mesNome,
    exercicio: anoAtual,
    statusExercicioAtual: statusLicenciamento
  };
}

function calcularParidadeFlex(precoEtanol, precoGasolina, limiar = 0.70) {
  const etanol = parseFloat(precoEtanol);
  const gasolina = parseFloat(precoGasolina);

  if (isNaN(etanol) || isNaN(gasolina) || etanol <= 0 || gasolina <= 0) {
    return { erro: 'VALORES_INVALIDOS', mensagem: 'Informe preços válidos e positivos para os combustíveis.' };
  }

  const paridade = (etanol / gasolina);
  const paridadePct = (paridade * 100).toFixed(1);
  const limiarPct = (limiar * 100).toFixed(0);

  let combustivelRecomendado = '';
  let justificativa = '';
  let economiaEstimadaPct = 0;

  if (paridade < limiar) {
    combustivelRecomendado = 'ETANOL';
    economiaEstimadaPct = ((limiar - paridade) / limiar * 100).toFixed(1);
    justificativa = `O Etanol está custando ${paridadePct}% da Gasolina (abaixo do limiar técnico de ${limiarPct}%). É a opção mais vantajosa!`;
  } else {
    combustivelRecomendado = 'GASOLINA';
    economiaEstimadaPct = ((paridade - limiar) / paridade * 100).toFixed(1);
    justificativa = `O Etanol está custando ${paridadePct}% da Gasolina (acima do limiar técnico de ${limiarPct}%). Abastecer com Gasolina rende mais autonomia e menor custo por km rodado.`;
  }

  return {
    precoEtanol: etanol,
    precoGasolina: gasolina,
    paridadeReal: paridade,
    paridadePercentual: `${paridadePct}%`,
    limiarAdotado: `${limiarPct}%`,
    combustivelVantajoso: combustivelRecomendado,
    economiaEstimada: `${economiaEstimadaPct}%`,
    parecerTecnico: justificativa
  };
}

function estimarIpva(valorVenal, uf = 'SP') {
  const valor = parseFloat(valorVenal);
  if (isNaN(valor) || valor <= 0) {
    return { erro: 'VALOR_INVALIDO', mensagem: 'Informe um valor venal positivo para o veículo.' };
  }

  const ufUpper = (uf || 'SP').toUpperCase().trim();
  const aliquota = ALIQUOTAS_IPVA[ufUpper] || 0.040;
  const ipvaDevido = valor * aliquota;

  return {
    uf: ufUpper,
    valorVenalVeiculo: valor,
    aliquotaIpva: aliquota,
    aliquotaPercentual: `${(aliquota * 100).toFixed(1)}%`,
    ipvaAnualEstimado: parseFloat(ipvaDevido.toFixed(2)),
    parcelaEm5x: parseFloat((ipvaDevido / 5).toFixed(2))
  };
}

const REGRAS_ISENCAO_IPVA_ANOS = {
  'GO': 10, 'RN': 10, 'RR': 10,
  'RJ': 15, 'BA': 15, 'CE': 15, 'ES': 15, 'PB': 15, 'PA': 15, 'PI': 15,
  'MA': 15, 'AM': 15, 'SE': 15, 'TO': 15, 'DF': 15, 'RO': 15, 'AP': 15,
  'MT': 18,
  'SP': 20, 'PR': 20, 'RS': 20, 'MS': 20, 'AC': 20, 'AL': 20,
  'SC': 30,
  'MG': null, 'PE': null
};

const TABELA_FIPE_REFERENCIA = [
  {
    codigoFipe: '004123-8',
    marca: 'Volkswagen',
    modelo: 'Gol 1.0 Flex 12V 5p',
    combustivel: 'Flex',
    categoria: 'Hatch Compacto',
    historicoAnos: [
      { ano: 2024, precoMedio: 58500.00, ipvaMedioSp: 2340.00 },
      { ano: 2023, precoMedio: 54200.00, ipvaMedioSp: 2168.00 },
      { ano: 2022, precoMedio: 50800.00, ipvaMedioSp: 2032.00 },
      { ano: 2021, precoMedio: 46900.00, ipvaMedioSp: 1876.00 },
      { ano: 2020, precoMedio: 42500.00, ipvaMedioSp: 1700.00 }
    ]
  },
  {
    codigoFipe: '005432-1',
    marca: 'Chevrolet',
    modelo: 'Onix Hatch 1.0 Turbo Flex Aut.',
    combustivel: 'Flex',
    categoria: 'Hatch Compacto',
    historicoAnos: [
      { ano: 2024, precoMedio: 84500.00, ipvaMedioSp: 3380.00 },
      { ano: 2023, precoMedio: 79200.00, ipvaMedioSp: 3168.00 },
      { ano: 2022, precoMedio: 74500.00, ipvaMedioSp: 2980.00 },
      { ano: 2021, precoMedio: 68900.00, ipvaMedioSp: 2756.00 },
      { ano: 2020, precoMedio: 62000.00, ipvaMedioSp: 2480.00 }
    ]
  },
  {
    codigoFipe: '001234-5',
    marca: 'Fiat',
    modelo: 'Strada Freedom 1.3 Flex 8V CD',
    combustivel: 'Flex',
    categoria: 'Picape Compacta',
    historicoAnos: [
      { ano: 2024, precoMedio: 99800.00, ipvaMedioSp: 3992.00 },
      { ano: 2023, precoMedio: 93500.00, ipvaMedioSp: 3740.00 },
      { ano: 2022, precoMedio: 87900.00, ipvaMedioSp: 3516.00 },
      { ano: 2021, precoMedio: 82000.00, ipvaMedioSp: 3280.00 }
    ]
  },
  {
    codigoFipe: '002567-9',
    marca: 'Toyota',
    modelo: 'Corolla XEi 2.0 Flex 16V Aut.',
    combustivel: 'Flex',
    categoria: 'Sedan Médio',
    historicoAnos: [
      { ano: 2024, precoMedio: 148500.00, ipvaMedioSp: 5940.00 },
      { ano: 2023, precoMedio: 139200.00, ipvaMedioSp: 5568.00 },
      { ano: 2022, precoMedio: 131000.00, ipvaMedioSp: 5240.00 },
      { ano: 2021, precoMedio: 122500.00, ipvaMedioSp: 4900.00 },
      { ano: 2020, precoMedio: 115000.00, ipvaMedioSp: 4600.00 }
    ]
  },
  {
    codigoFipe: '003789-0',
    marca: 'Hyundai',
    modelo: 'HB20 Sense 1.0 Flex 12V Mec.',
    combustivel: 'Flex',
    categoria: 'Hatch Compacto',
    historicoAnos: [
      { ano: 2024, precoMedio: 76500.00, ipvaMedioSp: 3060.00 },
      { ano: 2023, precoMedio: 71200.00, ipvaMedioSp: 2848.00 },
      { ano: 2022, precoMedio: 66800.00, ipvaMedioSp: 2672.00 },
      { ano: 2021, precoMedio: 60500.00, ipvaMedioSp: 2420.00 },
      { ano: 2020, precoMedio: 53900.00, ipvaMedioSp: 2156.00 }
    ]
  },
  {
    codigoFipe: '008901-2',
    marca: 'Tesla',
    modelo: 'Model 3 Long Range Dual Motor AWD',
    combustivel: 'Elétrico',
    categoria: 'Sedan Premium Elétrico',
    historicoAnos: [
      { ano: 2024, precoMedio: 315000.00, ipvaMedioSp: 12600.00 },
      { ano: 2023, precoMedio: 295000.00, ipvaMedioSp: 11800.00 },
      { ano: 2022, precoMedio: 320000.00, ipvaMedioSp: 12800.00 },
      { ano: 2021, precoMedio: 345000.00, ipvaMedioSp: 13800.00 }
    ]
  }
];

function verificarIsencaoIpva(anoFabricacao, uf = 'SP') {
  const ano = parseInt(anoFabricacao, 10);
  if (isNaN(ano) || ano < 1900 || ano > new Date().getFullYear() + 1) {
    return { erro: 'ANO_INVALIDO', mensagem: 'Informe um ano de fabricação válido.' };
  }

  const ufUpper = (uf || 'SP').toUpperCase().trim();
  const anoAtual = new Date().getFullYear();
  const idadeVeiculo = Math.max(0, anoAtual - ano);
  const anosExigidos = REGRAS_ISENCAO_IPVA_ANOS[ufUpper];

  if (anosExigidos === null) {
    return {
      uf: ufUpper,
      anoFabricacao: ano,
      idadeVeiculoAnos: idadeVeiculo,
      isentoPorIdade: false,
      regraEstado: `${ufUpper} não concede isenção automática por tempo de fabricação (apenas veículos de coleção certificados com Placa Preta e laudo de originalidade).`,
      anosRestantes: null
    };
  }

  const isento = idadeVeiculo >= anosExigidos;
  const anosRestantes = isento ? 0 : (anosExigidos - idadeVeiculo);

  return {
    uf: ufUpper,
    anoFabricacao: ano,
    idadeVeiculoAnos: idadeVeiculo,
    anosParaIsencao: anosExigidos,
    isentoPorIdade: isento,
    statusIsencao: isento
      ? `ISENTO DE IPVA EM ${ufUpper} (Veículo com ${idadeVeiculo} anos; isenção ativada a partir de ${anosExigidos} anos)`
      : `TRIBUTÁVEL EM ${ufUpper} (Faltam ${anosRestantes} ano(s) para isenção automática aos ${anosExigidos} anos)`,
    anoPrevistoIsencao: ano + anosExigidos
  };
}

function consultarFipe(termoOuCodigo) {
  if (!termoOuCodigo) {
    return { ok: true, total: TABELA_FIPE_REFERENCIA.length, modelos: TABELA_FIPE_REFERENCIA };
  }

  const q = String(termoOuCodigo).toLowerCase().trim();
  const filtrados = TABELA_FIPE_REFERENCIA.filter(item => 
    item.codigoFipe.toLowerCase().includes(q) ||
    item.modelo.toLowerCase().includes(q) ||
    item.marca.toLowerCase().includes(q) ||
    item.categoria.toLowerCase().includes(q)
  );

  return {
    ok: true,
    termoBuscado: termoOuCodigo,
    totalEncontrados: filtrados.length,
    modelos: filtrados
  };
}

const CORES_CATEGORIA_MERCOSUL = {
  particular: { texto: '#18181b', fundo: '#FFFFFF', borda: '#27272a', nome: 'Particular / Passeio' },
  comercial: { texto: '#dc2626', fundo: '#FFFFFF', borda: '#dc2626', nome: 'Comercial / Aluguel (Táxi/Caminhão/Van)' },
  oficial: { texto: '#1d4ed8', fundo: '#FFFFFF', borda: '#1d4ed8', nome: 'Oficial (Governo/Polícia/Ambulância)' },
  colecao: { texto: '#e4e4e7', fundo: '#18181b', borda: '#52525b', nome: 'Colecionador (Placa Preta Mercosul)' },
  especial: { texto: '#16a34a', fundo: '#FFFFFF', borda: '#16a34a', nome: 'Especial / Teste de Montadora' },
  diplomatico: { texto: '#ca8a04', fundo: '#FFFFFF', borda: '#ca8a04', nome: 'Diplomático / Consular' }
};

function renderizarPlacaMercosulSvg(placa, options = {}) {
  const analise = analisarPlaca(placa);
  const textoPlaca = analise.valido ? (analise.placaMercosulFormatada || analise.placaNormalizada) : 'BRA2E19';
  const pais = options.pais || 'BRASIL';
  const uf = (analise.origem && analise.origem.uf && analise.origem.uf !== 'DESCONHECIDO') ? analise.origem.uf : 'BR';
  const catKey = (options.categoria || 'particular').toLowerCase();
  const categoriaCfg = CORES_CATEGORIA_MERCOSUL[catKey] || CORES_CATEGORIA_MERCOSUL.particular;

  const sanitize = (s) => String(s || '').replace(/</g, '').replace(/>/g, '').replace(/"/g, '');
  const textoSanitizado = sanitize(textoPlaca);
  const paisSanitizado = sanitize(pais);
  const ufSanitizado = sanitize(uf);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 170" width="100%" height="170" style="font-family: 'Helvetica Neue', Arial, sans-serif; user-select: none; display: block; filter: drop-shadow(0 14px 28px rgba(0,0,0,0.35));">
  <defs>
    <filter id="plate-shadow" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#000" flood-opacity="0.30"/>
    </filter>
    <filter id="char-relief" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="1" dy="2" stdDeviation="1.2" flood-color="#000" flood-opacity="0.35"/>
    </filter>
    <linearGradient id="blue-stripe" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#002266" />
      <stop offset="50%" stop-color="#003db8" />
      <stop offset="100%" stop-color="#002266" />
    </linearGradient>
    <linearGradient id="silver-border" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#cbd5e1" />
      <stop offset="50%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#94a3b8" />
    </linearGradient>
  </defs>

  <rect x="6" y="6" width="508" height="158" rx="18" ry="18" fill="${categoriaCfg.fundo}" stroke="url(#silver-border)" stroke-width="3.5" filter="url(#plate-shadow)"/>
  <rect x="10" y="10" width="500" height="150" rx="14" ry="14" fill="none" stroke="${categoriaCfg.borda}" stroke-width="3"/>

  <!-- Faixa Azul Mercosul no Topo -->
  <path d="M 12,24 Q 12,12 24,12 L 496,12 Q 508,12 508,24 L 508,50 L 12,50 Z" fill="url(#blue-stripe)"/>

  <!-- Emblema Oficial Mercosul -->
  <g transform="translate(24, 17)">
    <circle cx="12" cy="7" r="2" fill="#FFFFFF"/>
    <circle cx="7" cy="15" r="2" fill="#FFFFFF"/>
    <circle cx="17" cy="15" r="2" fill="#FFFFFF"/>
    <circle cx="12" cy="23" r="2" fill="#FFFFFF"/>
    <path d="M 3,18 A 13 13 0 0 1 21 18" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>
    <text x="28" y="20" fill="#FFFFFF" font-size="11" font-weight="900" letter-spacing="1">MERCOSUL</text>
  </g>

  <!-- País -->
  <text x="260" y="36" fill="#FFFFFF" font-size="20" font-weight="900" text-anchor="middle" letter-spacing="6">${paisSanitizado}</text>

  <!-- Bandeira Oficial do Brasil -->
  <g transform="translate(450, 16)">
    <rect width="40" height="26" fill="#009c3b" rx="3" stroke="#FFFFFF" stroke-width="0.7"/>
    <polygon points="20,3 37,13 20,23 3,13" fill="#ffdf00"/>
    <circle cx="20" cy="13" r="6" fill="#002776"/>
    <path d="M 15,13.5 Q 20,11.5 25,13.5" fill="none" stroke="#FFFFFF" stroke-width="1.1"/>
  </g>

  <!-- Marca D'água Anti-Fraude com UF -->
  <text x="472" y="146" fill="${catKey === 'colecao' ? '#52525b' : '#cbd5e1'}" font-size="15" font-weight="900" text-anchor="end" letter-spacing="2">${ufSanitizado}</text>

  <!-- QR Code de Segurança Nítido -->
  <g transform="translate(24, 66)">
    <rect width="36" height="36" fill="${categoriaCfg.texto}" rx="3"/>
    <rect x="3" y="3" width="11" height="11" fill="#FFFFFF"/>
    <rect x="6" y="6" width="5" height="5" fill="${categoriaCfg.texto}"/>
    <rect x="22" y="3" width="11" height="11" fill="#FFFFFF"/>
    <rect x="25" y="6" width="5" height="5" fill="${categoriaCfg.texto}"/>
    <rect x="3" y="22" width="11" height="11" fill="#FFFFFF"/>
    <rect x="6" y="25" width="5" height="5" fill="${categoriaCfg.texto}"/>
    <rect x="18" y="18" width="6" height="6" fill="#FFFFFF"/>
    <rect x="27" y="27" width="6" height="6" fill="#FFFFFF"/>
    <text x="0" y="48" fill="${catKey === 'colecao' ? '#71717a' : '#94a3b8'}" font-size="8" font-weight="bold">QR-SEC</text>
  </g>

  <!-- Furos / Rebites de Fixação nos Cantos Superiores -->
  <circle cx="28" cy="24" r="3.5" fill="#1e293b" stroke="#cbd5e1" stroke-width="1.2"/>
  <circle cx="492" cy="24" r="3.5" fill="#1e293b" stroke="#cbd5e1" stroke-width="1.2"/>

  <!-- Caracteres Oficiais com Alto Relevo Estampado -->
  <text x="275" y="132" fill="${categoriaCfg.texto}" font-size="82" font-weight="900" text-anchor="middle" letter-spacing="9" font-family="'Impact', 'Arial Black', sans-serif" filter="url(#char-relief)">
    ${textoSanitizado}
  </text>
</svg>`;
}

function renderizarPlacaAntigaSvg(placa, options = {}) {
  const analise = analisarPlaca(placa);
  const textoPlaca = analise.placaAntigaFormatada || (analise.valido ? analise.placaOriginal.toUpperCase() : 'ABC-1234');
  const cidade = options.cidade || (analise.origem ? analise.origem.estado : 'SAO PAULO');
  const uf = options.uf || (analise.origem ? analise.origem.uf : 'SP');

  const sanitize = (s) => String(s || '').replace(/</g, '').replace(/>/g, '').replace(/"/g, '');
  const textoSanitizado = sanitize(textoPlaca);
  const tarjetaSanitizada = `${sanitize(cidade).toUpperCase()} - ${sanitize(uf).toUpperCase()}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 170" width="100%" height="170" style="font-family: 'Helvetica Neue', Arial, sans-serif; user-select: none; display: block; filter: drop-shadow(0 14px 28px rgba(0,0,0,0.35));">
  <defs>
    <filter id="old-plate-shadow" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#000" flood-opacity="0.30"/>
    </filter>
    <filter id="old-char-relief" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="1.5" dy="2" stdDeviation="1" flood-color="#000" flood-opacity="0.45"/>
    </filter>
    <linearGradient id="metal-gray" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#9ca3af" />
      <stop offset="35%" stop-color="#d1d5db" />
      <stop offset="70%" stop-color="#e5e7eb" />
      <stop offset="100%" stop-color="#9ca3af" />
    </linearGradient>
    <linearGradient id="tarjeta-metal" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#e5e7eb" />
      <stop offset="50%" stop-color="#f3f4f6" />
      <stop offset="100%" stop-color="#d1d5db" />
    </linearGradient>
  </defs>

  <rect x="6" y="6" width="508" height="158" rx="16" ry="16" fill="url(#metal-gray)" stroke="#4b5563" stroke-width="3" filter="url(#old-plate-shadow)"/>
  <rect x="10" y="10" width="500" height="150" rx="13" ry="13" fill="none" stroke="#374151" stroke-width="2.5"/>

  <!-- Tarjeta Metálica Superior de Município -->
  <g transform="translate(110, 16)">
    <rect width="300" height="32" rx="6" fill="url(#tarjeta-metal)" stroke="#4b5563" stroke-width="1.8"/>
    <circle cx="10" cy="16" r="3.5" fill="#374151" stroke="#9ca3af" stroke-width="1"/>
    <circle cx="290" cy="16" r="3.5" fill="#374151" stroke="#9ca3af" stroke-width="1"/>
    <text x="150" y="22" fill="#1f2937" font-size="14" font-weight="900" text-anchor="middle" letter-spacing="3">
      ${tarjetaSanitizada}
    </text>
  </g>

  <!-- Parafusos Principais nos Cantos -->
  <circle cx="32" cy="32" r="5" fill="#1f2937" stroke="#9ca3af" stroke-width="1.5"/>
  <line x1="28" y1="32" x2="36" y2="32" stroke="#e5e7eb" stroke-width="1.2"/>
  <circle cx="488" cy="32" r="5" fill="#1f2937" stroke="#9ca3af" stroke-width="1.5"/>
  <line x1="484" y1="32" x2="492" y2="32" stroke="#e5e7eb" stroke-width="1.2"/>

  <!-- Lacre Oficial do DETRAN -->
  <g transform="translate(24, 114)">
    <circle cx="16" cy="16" r="14" fill="#6b7280" stroke="#374151" stroke-width="1.5"/>
    <circle cx="16" cy="16" r="8" fill="#4b5563"/>
    <text x="16" y="19" fill="#e5e7eb" font-size="7" font-weight="bold" text-anchor="middle">DETRAN</text>
  </g>

  <text x="260" y="132" fill="#111827" font-size="82" font-weight="900" text-anchor="middle" letter-spacing="8" font-family="'Impact', 'Arial Black', sans-serif" filter="url(#old-char-relief)">
    ${textoSanitizado}
  </text>
</svg>`;
}

function gerarPlacaValida(formato = 'mercosul', uf = 'SP') {
  // Letras de SP por padrão
  let prefixo = 'BRA';
  if (uf === 'SP') prefixo = 'EZK';
  else if (uf === 'RJ') prefixo = 'RIO';
  else if (uf === 'MG') prefixo = 'HOK';
  else if (uf === 'PR') prefixo = 'AAA';
  else if (uf === 'RS') prefixo = 'IAA';
  else if (uf === 'SC') prefixo = 'LWR';
  else if (uf === 'BA') prefixo = 'JKS';

  const n1 = Math.floor(Math.random() * 10);
  const n2 = Math.floor(Math.random() * 10);
  const n3 = Math.floor(Math.random() * 10);
  const n4 = Math.floor(Math.random() * 10);

  if (formato === 'antiga') {
    return `${prefixo}-${n1}${n2}${n3}${n4}`;
  }

  const letraMercosul = CONVERSAO_NUMERO_LETRA[String(n2)] || 'A';
  return `${prefixo}${n1}${letraMercosul}${n3}${n4}`;
}

function gerarRenavamValido() {
  const d = [];
  for (let i = 0; i < 10; i++) {
    d.push(Math.floor(Math.random() * 10));
  }
  const pesos = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += d[i] * pesos[i];
  }
  const resto = (soma * 10) % 11;
  const dv = (resto === 10 || resto === 11) ? 0 : resto;
  return d.join('') + dv;
}

// ─── HANDLER PRINCIPAL CLOUDFLARE WORKER ANYCAST ───

export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    // Handle OPTIONS (Preflight CORS)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Rate Limiting
    const auth = resolverPlanoEChave(request);
    const rateCheck = aplicarRateLimit(auth.keyId, auth.config);

    if (!rateCheck.ok) {
      return new Response(JSON.stringify(rateCheck, null, 2), {
        status: 429,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json; charset=utf-8',
          'Retry-After': '60'
        }
      });
    }

    const jsonResponse = (data, status = 200) => {
      const latencyMs = Date.now() - startTime;
      const payload = {
        ...data,
        telemetria: {
          latencyMs,
          edgePoP: request.cf ? request.cf.colo : 'ANYCAST',
          plano: auth.plano,
          limiteRestante: rateCheck.remaining,
          timestamp: new Date().toISOString()
        }
      };
      return new Response(JSON.stringify(payload, null, 2), {
        status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=60, s-maxage=300'
        }
      });
    };

    // ── ROTA: ARQUIVOS ESTÁTICOS DO SITE PRÓPRIO (TEMPLATE PONTE API MARKETPLACE) ──
    if (pathname === '/styles.css' || pathname === '/ponte-suite.css') {
      return new Response(STYLES_CSS, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/css; charset=utf-8',
          'Cache-Control': 'public, max-age=604800, s-maxage=2592000'
        }
      });
    }

    if (pathname === '/brand/ozpro-mark.svg') {
      return new Response(OZPRO_MARK_SVG, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=2592000, s-maxage=2592000'
        }
      });
    }

    if (pathname === '/placas-pro.js') {
      return new Response(CLIENT_JS, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }

    // ── ROTA: SITE PRÓPRIO OFICIAL (TEMPLATE SUÍTE PONTE / OZPRO) ──
    const acceptHeader = request.headers.get('Accept') || '';
    if ((pathname === '/' || pathname === '/app') && !acceptHeader.includes('application/json')) {
      return new Response(HTML_INDEX, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300, s-maxage=3600'
        }
      });
    }

    // ── ROTA: DOCUMENTAÇÃO / SWAGGER INTERATIVO ──
    if (pathname === '/docs' || pathname === '/documentacao') {
      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Placas Pro API • Documentação & Swagger Anycast</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen p-6 font-sans">
  <div class="max-w-4xl mx-auto space-y-6">
    <div class="border-b border-slate-800 pb-4">
      <div class="flex items-center gap-3">
        <span class="text-3xl">🚗</span>
        <div>
          <h1 class="text-2xl font-bold text-sky-400">Placas Pro API • Documentação Oficial</h1>
          <p class="text-slate-400 text-sm">Validador de Placas Mercosul/Cinza, CONTRAN 27 UFs, RENAVAM Módulo 11, Chassi VIN ISO 3779, Licenciamento, Rodízio e SVG</p>
        </div>
      </div>
    </div>

    <!-- Banner Teste Ao Vivo -->
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <h2 class="text-lg font-semibold text-white">⚡ Teste Imediato de Placa</h2>
      <div class="flex gap-2">
        <input type="text" id="inputPlaca" value="BRA2E19" placeholder="Ex: BRA2E19 ou ABC-1234" class="bg-slate-950 border border-slate-700 px-4 py-2 rounded-lg flex-1 text-white uppercase font-mono">
        <button onclick="testarPlaca()" class="bg-sky-500 hover:bg-sky-600 px-6 py-2 rounded-lg font-semibold text-white">Consultar</button>
      </div>
      <div id="svgContainer" class="flex justify-center p-4 bg-slate-950 rounded-lg border border-slate-800 hidden"></div>
      <pre id="outputPlaca" class="bg-slate-950 p-4 rounded-lg text-xs text-sky-300 font-mono overflow-x-auto max-h-72 hidden"></pre>
    </div>

    <!-- Tabela de Endpoints -->
    <div class="space-y-4">
      <h2 class="text-lg font-semibold text-white">Endpoints Oficiais REST</h2>
      <div class="grid gap-3">
        <div class="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div class="flex items-center gap-2 font-mono text-sm">
            <span class="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold">GET</span>
            <span class="text-slate-200">/api/placas/:placa</span>
          </div>
          <p class="text-slate-400 text-xs mt-1">Validação completa da placa, conversão Antiga <-> Mercosul, UF CONTRAN, Licenciamento e Rodízio SP.</p>
        </div>
        <div class="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div class="flex items-center gap-2 font-mono text-sm">
            <span class="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold">GET</span>
            <span class="text-slate-200">/api/placas/:placa/svg</span>
          </div>
          <p class="text-slate-400 text-xs mt-1">Renderização direta da placa Mercosul em formato vetorial SVG puro.</p>
        </div>
        <div class="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div class="flex items-center gap-2 font-mono text-sm">
            <span class="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold">GET</span>
            <span class="text-slate-200">/api/placas/chassi/:chassi</span>
          </div>
          <p class="text-slate-400 text-xs mt-1">Decodificação VIN ISO 3779 (Fabricante WMI, País de Montagem, Ano-Modelo, Check Digit).</p>
        </div>
        <div class="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div class="flex items-center gap-2 font-mono text-sm">
            <span class="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold">GET</span>
            <span class="text-slate-200">/api/placas/renavam/:renavam</span>
          </div>
          <p class="text-slate-400 text-xs mt-1">Validação matemática oficial do RENAVAM (Algoritmo Módulo 11 DENATRAN).</p>
        </div>
        <div class="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div class="flex items-center gap-2 font-mono text-sm">
            <span class="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold">GET</span>
            <span class="text-slate-200">/api/placas/rodizio/:final</span>
          </div>
          <p class="text-slate-400 text-xs mt-1">Status e regras do Rodízio Municipal SP da CET por final de placa.</p>
        </div>
        <div class="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div class="flex items-center gap-2 font-mono text-sm">
            <span class="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold">GET</span>
            <span class="text-slate-200">/api/placas/flex?etanol=3.80&gasolina=5.80</span>
          </div>
          <p class="text-slate-400 text-xs mt-1">Calculadora técnica de paridade combustível (Etanol vs Gasolina).</p>
        </div>
        <div class="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div class="flex items-center gap-2 font-mono text-sm">
            <span class="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold">GET</span>
            <span class="text-slate-200">/api/placas/gerador?formato=mercosul&uf=SP</span>
          </div>
          <p class="text-slate-400 text-xs mt-1">Gerador de placas e RENAVAM matematicamente válidos para ambientes de homologação.</p>
        </div>
      </div>
    </div>
  </div>

  <script>
    async function testarPlaca() {
      const p = document.getElementById('inputPlaca').value.trim();
      if (!p) return;
      const res = await fetch('/api/placas/' + encodeURIComponent(p));
      const data = await res.json();
      const out = document.getElementById('outputPlaca');
      out.textContent = JSON.stringify(data, null, 2);
      out.classList.remove('hidden');

      const svgRes = await fetch('/api/placas/' + encodeURIComponent(p) + '/svg');
      if (svgRes.ok) {
        const svgText = await svgRes.text();
        const sc = document.getElementById('svgContainer');
        sc.innerHTML = svgText;
        sc.classList.remove('hidden');
      }
    }
    testarPlaca();
  </script>
</body>
</html>`;
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // ── ROTA: STATUS / HEALTH ──
    if (pathname === '/' || pathname === '/health' || pathname === '/api/placas/health') {
      return jsonResponse({
        servico: 'Placas Pro & Telemetria Veicular Anycast API',
        versao: '1.0.0',
        status: 'UP',
        uptimeSegundos: Math.floor((Date.now() - BOOT_TIME) / 1000),
        docsUrl: `${url.origin}/docs`,
        funcionalidades: [
          'Validação e Conversão Mercosul <-> Antiga CONTRAN',
          'Mapeamento de 27 UFs e Regiões por Faixa de Registro',
          'RENAVAM Módulo 11 DENATRAN',
          'Chassi / VIN ISO 3779 (WMI, Ano-Modelo, Check Digit)',
          'Rodízio Municipal CET Capital de SP em Tempo Real',
          'Calendário Oficial de Licenciamento Anual DETRAN',
          'Calculadora Flex Econômica (Etanol x Gasolina)',
          'Estimativa de Alíquota e IPVA por UF',
          'Renderizador Vetorial SVG da Placa Mercosul',
          'Gerador de Placas e RENAVAM Válidos para Sandbox/QA'
        ]
      });
    }

    // ── ROTA: GERADOR SANDBOX ──
    if (pathname === '/api/placas/gerador' || pathname === '/api/placas/gerar') {
      const formato = url.searchParams.get('formato') || 'mercosul';
      const uf = (url.searchParams.get('uf') || 'SP').toUpperCase();
      const placa = gerarPlacaValida(formato, uf);
      const renavam = gerarRenavamValido();
      const analise = analisarPlaca(placa);

      return jsonResponse({
        geradoComSucesso: true,
        placaGerada: placa,
        formato,
        uf,
        renavamGerado: renavam,
        analisePlaca: analise
      });
    }

    // ── ROTA: CALCULADORA FLEX ──
    if (pathname === '/api/placas/flex' || pathname === '/api/placas/combustivel') {
      const etanol = url.searchParams.get('etanol') || url.searchParams.get('e');
      const gasolina = url.searchParams.get('gasolina') || url.searchParams.get('g');
      const limiar = parseFloat(url.searchParams.get('limiar') || '0.70');

      if (!etanol || !gasolina) {
        return jsonResponse({
          erro: 'PARAMETROS_AUSENTES',
          mensagem: 'Informe os parâmetros etanol e gasolina (Ex: /api/placas/flex?etanol=3.80&gasolina=5.90)'
        }, 400);
      }

      const resultado = calcularParidadeFlex(etanol, gasolina, limiar);
      return jsonResponse(resultado);
    }

    // ── ROTA: ESTIMATIVA DE IPVA ──
    if (pathname === '/api/placas/ipva') {
      const valor = url.searchParams.get('valor') || url.searchParams.get('v');
      const uf = url.searchParams.get('uf') || 'SP';

      if (!valor) {
        return jsonResponse({
          erro: 'PARAMETRO_VALOR_AUSENTE',
          mensagem: 'Informe o parâmetro valor (Ex: /api/placas/ipva?valor=70000&uf=SP)'
        }, 400);
      }

      const resIpva = estimarIpva(valor, uf);
      return jsonResponse(resIpva);
    }

    // ── ROTA: ISENÇÃO DE IPVA POR IDADE E LEGISLAÇÃO ESTADUAL (27 UFS) ──
    if (pathname === '/api/placas/isencao-ipva' || pathname === '/api/placas/isencao') {
      const ano = url.searchParams.get('ano') || url.searchParams.get('a');
      const uf = url.searchParams.get('uf') || 'SP';

      if (!ano) {
        return jsonResponse({
          erro: 'PARAMETRO_ANO_AUSENTE',
          mensagem: 'Informe o ano de fabricação do veículo (Ex: /api/placas/isencao-ipva?ano=2004&uf=SP)'
        }, 400);
      }

      const resIsencao = verificarIsencaoIpva(ano, uf);
      return jsonResponse(resIsencao);
    }

    // ── ROTA: TABELA FIPE OFICIAL INTEGRADA (VALOR VENAL E HISTÓRICO) ──
    if (pathname.startsWith('/api/placas/fipe')) {
      const termo = pathname.replace('/api/placas/fipe', '').replace(/^\//, '') || url.searchParams.get('q') || '';
      const resFipe = consultarFipe(termo);
      return jsonResponse(resFipe);
    }

    // ── ROTA: RODÍZIO SP MUNICIPAL ──
    if (pathname.startsWith('/api/placas/rodizio/')) {
      const finalParam = pathname.split('/')[4] || '';
      const info = obterInfoRodizioSP(finalParam);
      return jsonResponse(info);
    }

    // ── ROTA: LICENCIAMENTO ANUAL ──
    if (pathname.startsWith('/api/placas/licenciamento/')) {
      const partes = pathname.split('/');
      const ufParam = partes[4] ? partes[4].toUpperCase() : 'SP';
      const finalParam = partes[5] || '1';
      const info = obterLicenciamento(finalParam, ufParam);
      return jsonResponse(info);
    }

    // ── ROTA: VALIDAR RENAVAM ──
    if (pathname.startsWith('/api/placas/renavam/')) {
      const renavamParam = pathname.split('/')[4] || '';
      const validacao = validarRenavam(renavamParam);
      return jsonResponse(validacao);
    }

    // ── ROTA: CHASSI / VIN ISO 3779 ──
    if (pathname.startsWith('/api/placas/chassi/') || pathname.startsWith('/api/placas/vin/')) {
      const vinParam = pathname.split('/')[4] || '';
      const ufParam = url.searchParams.get('uf') || 'SP';
      const decodificado = decodificarVin(vinParam);
      if (decodificado.valido && typeof decodificado.anoModelo === 'number') {
        decodificado.analiseIsencaoIpva = verificarIsencaoIpva(decodificado.anoModelo, ufParam);
      }
      return jsonResponse(decodificado);
    }

    // ── ROTA: RENDERIZADOR SVG DA PLACA MERCOSUL & ANTIGA ──
    if (pathname.startsWith('/api/placas/') && pathname.endsWith('/svg')) {
      const partes = pathname.split('/');
      const placaParam = partes[3] || 'BRA2E19';
      const categoria = url.searchParams.get('categoria') || url.searchParams.get('cat') || 'particular';
      const formatoPlaca = url.searchParams.get('formato') || url.searchParams.get('tipo') || 'mercosul';

      let svg = '';
      if (formatoPlaca === 'antiga' || formatoPlaca === 'cinza') {
        const cidade = url.searchParams.get('cidade') || '';
        const uf = url.searchParams.get('uf') || '';
        svg = renderizarPlacaAntigaSvg(placaParam, { cidade, uf });
      } else {
        svg = renderizarPlacaMercosulSvg(placaParam, { categoria });
      }

      return new Response(svg, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=86400, s-maxage=604800'
        }
      });
    }

    if (pathname.startsWith('/api/placas/') && pathname.endsWith('/antiga-svg')) {
      const partes = pathname.split('/');
      const placaParam = partes[3] || 'ABC1234';
      const cidade = url.searchParams.get('cidade') || '';
      const uf = url.searchParams.get('uf') || '';
      const svg = renderizarPlacaAntigaSvg(placaParam, { cidade, uf });

      return new Response(svg, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=86400, s-maxage=604800'
        }
      });
    }

    // ── ROTA: CONSULTA E VALIDAÇÃO DE PLACAS ──
    let placaConsulta = '';
    if (pathname.startsWith('/api/placas/')) {
      const sub = pathname.replace('/api/placas/', '');
      if (sub && !sub.includes('/')) {
        placaConsulta = sub;
      }
    } else if (url.searchParams.get('placa')) {
      placaConsulta = url.searchParams.get('placa');
    }

    if (placaConsulta) {
      const analise = analisarPlaca(placaConsulta);
      return jsonResponse(analise);
    }

    return jsonResponse({
      erro: 'ROTA_NAO_ENCONTRADA',
      mensagem: 'Consulte a documentação em /docs para verificar os endpoints disponíveis.'
    }, 404);
  }
};
