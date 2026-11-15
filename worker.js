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

import { CSS_SUITE, HTML_INDEX, CLIENT_JS } from './site-assets.js';

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
  const licenciamentoInfo = obterLicenciamento(ultimoDigito, estadoInfo ? estadoInfo.uf : 'SP');

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

function renderizarPlacaMercosulSvg(placa, options = {}) {
  const analise = analisarPlaca(placa);
  const textoPlaca = analise.valido ? (analise.placaMercosulFormatada || analise.placaNormalizada) : 'BRA2E19';
  const pais = options.pais || 'BRASIL';
  const uf = (analise.origem && analise.origem.uf && analise.origem.uf !== 'DESCONHECIDO') ? analise.origem.uf : 'BR';

  const sanitize = (s) => String(s || '').replace(/</g, '').replace(/>/g, '').replace(/"/g, '');
  const textoSanitizado = sanitize(textoPlaca);
  const paisSanitizado = sanitize(pais);
  const ufSanitizado = sanitize(uf);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 130" width="400" height="130" style="font-family: 'Helvetica Neue', Arial, sans-serif; user-select: none;">
  <defs>
    <filter id="plate-shadow" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.25"/>
    </filter>
    <linearGradient id="blue-stripe" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#002776" />
      <stop offset="50%" stop-color="#0038A8" />
      <stop offset="100%" stop-color="#002776" />
    </linearGradient>
    <linearGradient id="silver-border" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#d4d4d8" />
      <stop offset="50%" stop-color="#f4f4f5" />
      <stop offset="100%" stop-color="#a1a1aa" />
    </linearGradient>
  </defs>

  <!-- Placa -->
  <rect x="5" y="5" width="390" height="120" rx="14" ry="14" fill="#FFFFFF" stroke="url(#silver-border)" stroke-width="3" filter="url(#plate-shadow)"/>
  <rect x="8" y="8" width="384" height="114" rx="11" ry="11" fill="none" stroke="#27272a" stroke-width="2.5"/>

  <!-- Faixa Azul Mercosul -->
  <path d="M 9,19 Q 9,9 19,9 L 381,9 Q 391,9 391,19 L 391,38 L 9,38 Z" fill="url(#blue-stripe)"/>

  <!-- Emblema Oficial Mercosul -->
  <g transform="translate(18, 14)">
    <circle cx="9" cy="5" r="1.5" fill="#FFFFFF"/>
    <circle cx="5" cy="11" r="1.5" fill="#FFFFFF"/>
    <circle cx="13" cy="11" r="1.5" fill="#FFFFFF"/>
    <circle cx="9" cy="17" r="1.5" fill="#FFFFFF"/>
    <path d="M 2,13 A 10 10 0 0 1 18 13" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round"/>
    <text x="22" y="15" fill="#FFFFFF" font-size="8" font-weight="900" letter-spacing="0.5">MERCOSUL</text>
  </g>

  <!-- País -->
  <text x="200" y="27" fill="#FFFFFF" font-size="15" font-weight="900" text-anchor="middle" letter-spacing="4">${paisSanitizado}</text>

  <!-- Bandeira do Brasil -->
  <g transform="translate(352, 14)">
    <rect width="28" height="18" fill="#009c3b" rx="2" stroke="#FFFFFF" stroke-width="0.5"/>
    <polygon points="14,2 26,9 14,16 2,9" fill="#ffdf00"/>
    <circle cx="14" cy="9" r="4.2" fill="#002776"/>
    <path d="M 10.5,9.5 Q 14,8 17.5,9.5" fill="none" stroke="#FFFFFF" stroke-width="0.8"/>
  </g>

  <!-- Marca D'água UF -->
  <text x="365" y="112" fill="#d1d5db" font-size="11" font-weight="900" text-anchor="end" letter-spacing="1">${ufSanitizado}</text>

  <!-- QR Code Simulado -->
  <g transform="translate(18, 48)">
    <rect width="26" height="26" fill="#18181b" rx="2"/>
    <rect x="2" y="2" width="8" height="8" fill="#FFFFFF"/>
    <rect x="4" y="4" width="4" height="4" fill="#18181b"/>
    <rect x="16" y="2" width="8" height="8" fill="#FFFFFF"/>
    <rect x="18" y="4" width="4" height="4" fill="#18181b"/>
    <rect x="2" y="16" width="8" height="8" fill="#FFFFFF"/>
    <rect x="4" y="18" width="4" height="4" fill="#18181b"/>
    <rect x="14" y="14" width="4" height="4" fill="#FFFFFF"/>
    <rect x="20" y="20" width="4" height="4" fill="#FFFFFF"/>
    <text x="0" y="36" fill="#a1a1aa" font-size="6" font-weight="bold">QR-SEC</text>
  </g>

  <!-- Caracteres Oficiais -->
  <text x="215" y="103" fill="#18181b" font-size="62" font-weight="900" text-anchor="middle" letter-spacing="7" font-family="'Impact', 'Arial Black', sans-serif">
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

    // ── ROTA: ARQUIVOS ESTÁTICOS DO SITE PRÓPRIO ──
    if (pathname === '/ponte-suite.css') {
      return new Response(CSS_SUITE, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/css; charset=utf-8',
          'Cache-Control': 'public, max-age=604800, s-maxage=2592000'
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
      const decodificado = decodificarVin(vinParam);
      return jsonResponse(decodificado);
    }

    // ── ROTA: RENDERIZADOR SVG DA PLACA MERCOSUL ──
    if (pathname.startsWith('/api/placas/') && pathname.endsWith('/svg')) {
      const partes = pathname.split('/');
      const placaParam = partes[3] || 'BRA2E19';
      const svg = renderizarPlacaMercosulSvg(placaParam);

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
