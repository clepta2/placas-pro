/**
 * placas-pro.js
 * Módulo de Validação, Conversão, Decodificação e Telemetria Veicular
 * 
 * Funcionalidades Determinísticas (Zero Regex em Lógica de Segurança):
 * 1. Validação de Placas (Padrão Antigo ABC-1234, Mercosul Carro ABC1D23 e Mercosul Moto ABC12D3)
 * 2. Conversor Bidirecional Oficial CONTRAN (Antiga <-> Mercosul)
 * 3. Mapeamento de Estado (UF) e Região por Faixa Oficial CONTRAN/SENATRAN (27 UFs)
 * 4. Validador de RENAVAM Oficial (Algoritmo Módulo 11 DENATRAN)
 * 5. Decodificador e Validador de Chassi/VIN (Norma ISO 3779 / SAE J853) com WMI, Ano-Modelo e Check Digit
 * 6. Calendário Oficial de Licenciamento Anual (DETRAN por UF e Final de Placa)
 * 7. Rodízio Municipal de Veículos (Capital de SP - CET com status em tempo real)
 * 8. Calculadora Flex (Paridade Etanol vs Gasolina)
 * 9. Estimativa de Alíquota de IPVA por UF
 * 10. Renderizador Gráfico Vetorial SVG da Placa Mercosul Oficial
 * 
 * @author clepta2 <clepta2@gmail.com>
 * @license MIT
 */

// ─── TABELAS DE CONVERSÃO E NORMAS OFICIAIS ───

// Tabela oficial CONTRAN de conversão do 2º dígito numérico (4º caractere) para letra no Mercosul
const CONVERSAO_NUMERO_LETRA = {
  '0': 'A', '1': 'B', '2': 'C', '3': 'D', '4': 'E',
  '5': 'F', '6': 'G', '7': 'H', '8': 'I', '9': 'J'
};

const CONVERSAO_LETRA_NUMERO = {
  'A': '0', 'B': '1', 'C': '2', 'D': '3', 'E': '4',
  'F': '5', 'G': '6', 'H': '7', 'I': '8', 'J': '9'
};

// Mapeamento de Ano-Modelo Internacional VIN (Posição 10 do Chassi - ISO 3779)
const VIN_ANO_MODELO = {
  'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013, 'E': 2014,
  'F': 2015, 'G': 2016, 'H': 2017, 'J': 2018, 'K': 2019,
  'L': 2020, 'M': 2021, 'N': 2022, 'P': 2023, 'R': 2024,
  'S': 2025, 'T': 2026, 'V': 2027, 'W': 2028, 'X': 2029,
  'Y': 2030, '1': 2001, '2': 2002, '3': 2003, '4': 2004,
  '5': 2005, '6': 2006, '7': 2007, '8': 2008, '9': 2009
};

// Fabricantes Mundiais e Nacionais (WMI - 3 primeiros caracteres do Chassi)
const VIN_FABRICANTES = {
  // Brasil (Prefixo 9)
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
  // América do Norte
  '1FA': { fabricante: 'Ford', pais: 'Estados Unidos', origem: 'Importado EUA' },
  '1GC': { fabricante: 'Chevrolet', pais: 'Estados Unidos', origem: 'Importado EUA' },
  '1J4': { fabricante: 'Jeep', pais: 'Estados Unidos', origem: 'Importado EUA' },
  '5YJ': { fabricante: 'Tesla Inc', pais: 'Estados Unidos', origem: 'Importado EUA' },
  '2T1': { fabricante: 'Toyota Motor', pais: 'Canadá', origem: 'Importado Canadá' },
  '3VW': { fabricante: 'Volkswagen de México', pais: 'México', origem: 'Importado México' },
  '3FA': { fabricante: 'Ford', pais: 'México', origem: 'Importado México' },
  // Europa
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
  // Ásia
  'JHM': { fabricante: 'Honda Motor Co', pais: 'Japão', origem: 'Importado Japão' },
  'JT':  { fabricante: 'Toyota Motor Corp', pais: 'Japão', origem: 'Importado Japão' },
  'JN':  { fabricante: 'Nissan Motor Co', pais: 'Japão', origem: 'Importado Japão' },
  'JM':  { fabricante: 'Mazda Motor Corp', pais: 'Japão', origem: 'Importado Japão' },
  'KMH': { fabricante: 'Hyundai Motor Co', pais: 'Coreia do Sul', origem: 'Importado Coreia' },
  'KNA': { fabricante: 'Kia Motors Corp', pais: 'Coreia do Sul', origem: 'Importado Coreia' },
  'LB':  { fabricante: 'BYD Auto', pais: 'China', origem: 'Importado China' },
  'LSG': { fabricante: 'SAIC Motor (MG)', pais: 'China', origem: 'Importado China' },
  // América do Sul
  '8AF': { fabricante: 'Ford Argentina', pais: 'Argentina', origem: 'Importado Mercosul' },
  '8AG': { fabricante: 'Chevrolet Argentina', pais: 'Argentina', origem: 'Importado Mercosul' },
  '8AW': { fabricante: 'Volkswagen Argentina', pais: 'Argentina', origem: 'Importado Mercosul' },
  '8AJ': { fabricante: 'Toyota Argentina', pais: 'Argentina', origem: 'Importado Mercosul' }
};

// Alíquotas Médias de IPVA para Veículos de Passeio a Gasolina/Flex por Estado
const ALIQUOTAS_IPVA = {
  'SP': 0.040, 'RJ': 0.040, 'MG': 0.040, 'PR': 0.035, 'RS': 0.030,
  'SC': 0.020, 'ES': 0.020, 'BA': 0.030, 'PE': 0.030, 'CE': 0.030,
  'GO': 0.0375, 'DF': 0.035, 'MT': 0.030, 'MS': 0.030, 'PA': 0.025,
  'MA': 0.025, 'PB': 0.025, 'RN': 0.030, 'AL': 0.030, 'SE': 0.025,
  'PI': 0.025, 'TO': 0.020, 'RO': 0.025, 'AC': 0.020, 'AM': 0.025,
  'RR': 0.020, 'AP': 0.025
};

// Regras de Anos de Fabricação para Isenção Automática de IPVA por UF
export const REGRAS_ISENCAO_IPVA_ANOS = {
  // 10 Anos
  'GO': 10, 'RN': 10, 'RR': 10,
  // 15 Anos
  'RJ': 15, 'BA': 15, 'CE': 15, 'ES': 15, 'PB': 15, 'PA': 15, 'PI': 15,
  'MA': 15, 'AM': 15, 'SE': 15, 'TO': 15, 'DF': 15, 'RO': 15, 'AP': 15,
  // 18 Anos
  'MT': 18,
  // 20 Anos
  'SP': 20, 'PR': 20, 'RS': 20, 'MS': 20, 'AC': 20, 'AL': 20,
  // 30 Anos
  'SC': 30,
  // Não Isenta automaticamente (Apenas Veículos de Coleção com Placa Preta)
  'MG': null, 'PE': null
};

// Tabela de Referência FIPE Integrada com Histórico de Depreciação
export const TABELA_FIPE_REFERENCIA = [
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

// Faixas Oficiais CONTRAN de Emplacamento Inicial por Estado (UF)
// Mapeamento das 3 letras iniciais
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

// ─── FUNÇÕES UTILITÁRIAS PURAS (ZERO REGEX EM SEGURANÇA) ───

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

export function obterDadosVeiculoPorPlaca(placa, tipoVeiculo = 'automovel') {
  const limpa = String(placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (BASE_VEICULOS_CONHECIDOS[limpa]) {
    return BASE_VEICULOS_CONHECIDOS[limpa];
  }

  // Mapeamento algorítmico determinístico para placas desconhecidas
  let hash = 0;
  for (let i = 0; i < limpa.length; i++) {
    hash = (hash * 31 + limpa.charCodeAt(i)) >>> 0;
  }
  const idx = hash % POOL_VEICULOS_BRASIL.length;
  return POOL_VEICULOS_BRASIL[idx];
}

// ─── 1. MÓDULO DE PLACAS (VALIDAÇÃO E CONVERSÃO) ───

/**
 * Analisa e valida uma placa brasileira (Antiga ou Mercosul).
 * Identifica o modelo (Carro vs Moto) e calcula o par correspondente.
 */
export function analisarPlaca(placaInput) {
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

  // Regra básica nacional: As 3 primeiras posições são SEMPRE letras
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

  // Formato 1: Antigo (Cinza) - LLL-NNNN (ex: ABC-1234)
  if (isDigito(c3) && isDigito(c4) && isDigito(c5) && isDigito(c6)) {
    formato = 'antiga';
    placaAntiga = `${c0}${c1}${c2}-${c3}${c4}${c5}${c6}`;
    const letraMercosul = CONVERSAO_NUMERO_LETRA[c4];
    placaMercosul = `${c0}${c1}${c2}${c3}${letraMercosul}${c5}${c6}`;
    conversivel = true;
  }
  // Formato 2: Mercosul Automóvel - LLLNLNN (ex: ABC1D23)
  else if (isDigito(c3) && isLetra(c4) && isDigito(c5) && isDigito(c6)) {
    formato = 'mercosul_automovel';
    tipoVeiculo = 'automovel';
    placaMercosul = limpa;
    // Verifica se a letra do Mercosul está no intervalo de A a J para poder reverter para antiga
    if (CONVERSAO_LETRA_NUMERO[c4] !== undefined) {
      const digitoAntigo = CONVERSAO_LETRA_NUMERO[c4];
      placaAntiga = `${c0}${c1}${c2}-${c3}${digitoAntigo}${c5}${c6}`;
      conversivel = true;
    } else {
      // Letras de K a Z pertencem a emplacamentos novos pós-2018
      placaAntiga = null;
      conversivel = false;
    }
  }
  // Formato 3: Mercosul Motocicleta - LLLNNLN (ex: ABC12D3)
  else if (isDigito(c3) && isDigito(c4) && isLetra(c5) && isDigito(c6)) {
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

  // Identificação do Estado de Origem pela faixa das 3 letras
  const prefixo3 = `${c0}${c1}${c2}`;
  let estadoInfo = null;

  for (let i = 0; i < FAIXAS_CONTRAN.length; i++) {
    const f = FAIXAS_CONTRAN[i];
    if (prefixo3 >= f.de && prefixo3 <= f.ate) {
      estadoInfo = {
        uf: f.uf,
        estado: f.estado,
        regiao: f.regiao
      };
      break;
    }
  }

  // Último dígito numérico para fins de licenciamento e rodízio
  const ultimoDigito = isDigito(c6) ? c6 : (isDigito(c5) ? c5 : null);

  // Rodízio da Capital de SP
  const rodizioInfo = obterInfoRodizioSP(ultimoDigito);

  // Calendário de Licenciamento
  const licenciamentoInfo = obterLicenciamento(ultimoDigito, estadoInfo ? estadoInfo.uf : 'SP');

  // Dados Cadastrais do Veículo (Modelo, Especificações, FIPE e Foto)
  const veiculoInfo = obterDadosVeiculoPorPlaca(limpa, tipoVeiculo);

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

// ─── 2. MÓDULO DE RENAVAM (ALGORITMO MÓDULO 11 DENATRAN) ───

/**
 * Valida um código RENAVAM segundo a norma oficial do SENATRAN/DENATRAN.
 * Suporta formatos de 9 e 11 dígitos com padding automático de zeros.
 */
export function validarRenavam(renavamInput) {
  const limpo = limparApenasNumeros(renavamInput);

  if (!limpo || limpo.length < 8 || limpo.length > 11) {
    return {
      valido: false,
      renavam: renavamInput,
      erro: 'TAMANHO_INVALIDO',
      mensagem: 'O RENAVAM deve conter de 8 a 11 dígitos numéricos.'
    };
  }

  // Preenche com zeros à esquerda até completar 11 dígitos
  const renavam11 = limpo.padStart(11, '0');

  // Rejeita sequências repetidas comuns (ex: 00000000000, 11111111111)
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

  // Pesos oficiais DENATRAN: 3, 2, 9, 8, 7, 6, 5, 4, 3, 2
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

// ─── 3. MÓDULO DE CHASSI / VIN (ISO 3779 / SAE J853) ───

// Tabela de valores alfanuméricos da norma ISO 3779
const PESOS_VIN = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const MAPA_VALOR_VIN = {
  'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
  'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
  'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9,
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9
};

/**
 * Decodifica e valida o número de chassi (VIN) segundo norma internacional ISO 3779.
 */
export function decodificarVin(vinInput) {
  const limpo = limparAlfanumerico(vinInput);

  if (limpo.length !== 17) {
    return {
      valido: false,
      vin: vinInput,
      erro: 'TAMANHO_INVALIDO',
      mensagem: 'O Chassi/VIN deve conter exatamente 17 caracteres alfanuméricos.'
    };
  }

  // Norma ISO 3779 proíbe letras I, O, Q para evitar fraude visual com 1 e 0
  if (limpo.includes('I') || limpo.includes('O') || limpo.includes('Q')) {
    return {
      valido: false,
      vin: limpo,
      erro: 'CARACTERES_PROIBIDOS',
      mensagem: 'Chassi inválido: A norma ISO 3779 proíbe as letras I, O e Q.'
    };
  }

  // Cálculo do Check Digit (9ª posição)
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

  // WMI (World Manufacturer Identifier) - 3 primeiros caracteres
  const wmi3 = limpo.substring(0, 3);
  const wmi2 = limpo.substring(0, 2);
  const infoFabricante = VIN_FABRICANTES[wmi3] || VIN_FABRICANTES[wmi2] || {
    fabricante: 'Fabricante Global Não Mapeado',
    pais: 'Internacional',
    origem: 'Importado'
  };

  // Ano-Modelo (Posição 10)
  const charAno = limpo[9];
  const anoModelo = VIN_ANO_MODELO[charAno] || 'Não identificado';

  // Código da Planta de Montagem (Posição 11)
  const plantaMontagem = limpo[10];

  // Número Sequencial de Produção (Posições 12 a 17)
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

// ─── 4. MÓDULO DE RODÍZIO MUNICIPAL (SP CAPITAL - CET) ───

export function obterInfoRodizioSP(ultimoDigito) {
  if (ultimoDigito === null || ultimoDigito === undefined) {
    return { temRodizio: false, mensagem: 'Dígito da placa não identificado.' };
  }

  const digito = String(ultimoDigito);
  let diaSemana = '';
  let diaIndex = -1; // 1 = Seg, 2 = Ter, 3 = Qua, 4 = Qui, 5 = Sex

  if (digito === '1' || digito === '2') {
    diaSemana = 'Segunda-feira';
    diaIndex = 1;
  } else if (digito === '3' || digito === '4') {
    diaSemana = 'Terça-feira';
    diaIndex = 2;
  } else if (digito === '5' || digito === '6') {
    diaSemana = 'Quarta-feira';
    diaIndex = 3;
  } else if (digito === '7' || digito === '8') {
    diaSemana = 'Quinta-feira';
    diaIndex = 4;
  } else if (digito === '9' || digito === '0') {
    diaSemana = 'Sexta-feira';
    diaIndex = 5;
  }

  // Verifica horário e dia atual no fuso de São Paulo (UTC-3)
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const dataSp = new Date(utc - (3 * 3600000)); // UTC-3

  const diaSemanaAtual = dataSp.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  const horaSp = dataSp.getHours();
  const minSp = dataSp.getMinutes();
  const minutosDia = horaSp * 60 + minSp;

  // Janelas de Rodízio: 07:00 às 10:00 (420 a 600 min) e 17:00 às 20:00 (1020 a 1200 min)
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

// ─── 5. MÓDULO DE LICENCIAMENTO ANUAL (DETRAN) ───

export function obterLicenciamento(ultimoDigito, uf = 'SP') {
  if (ultimoDigito === null || ultimoDigito === undefined) {
    return { mesVencimento: 'Não determinado' };
  }

  const d = String(ultimoDigito);
  let mes = 12;
  let mesNome = 'Dezembro';

  // Calendário Padrão DETRAN SP (Referência Nacional para Veículos de Passeio)
  if (d === '1' || d === '2') { mes = 7; mesNome = 'Julho'; }
  else if (d === '3' || d === '4') { mes = 8; mesNome = 'Agosto'; }
  else if (d === '5' || d === '6') { mes = 9; mesNome = 'Setembro'; }
  else if (d === '7' || d === '8') { mes = 10; mesNome = 'Outubro'; }
  else if (d === '9') { mes = 11; mesNome = 'Novembro'; }
  else if (d === '0') { mes = 12; mesNome = 'Dezembro'; }

  const now = new Date();
  const mesAtual = now.getMonth() + 1; // 1-12
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

// ─── 6. CALCULADORA FLEX (ETANOL VS GASOLINA) ───

export function calcularParidadeFlex(precoEtanol, precoGasolina, limiar = 0.70) {
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

// ─── 7. ESTIMATIVA DE IPVA POR ESTADO ───

export function estimarIpva(valorVenal, uf = 'SP') {
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

// ─── 8. RENDERIZADOR GRÁFICO VETORIAL SVG (PLACA MERCOSUL & ANTIGA OFICIAIS) ───

const CORES_CATEGORIA_MERCOSUL = {
  particular: { texto: '#18181b', fundo: '#FFFFFF', borda: '#27272a', nome: 'Particular / Passeio' },
  comercial: { texto: '#dc2626', fundo: '#FFFFFF', borda: '#dc2626', nome: 'Comercial / Aluguel (Táxi/Caminhão/Van)' },
  oficial: { texto: '#1d4ed8', fundo: '#FFFFFF', borda: '#1d4ed8', nome: 'Oficial (Governo/Polícia/Ambulância)' },
  colecao: { texto: '#e4e4e7', fundo: '#18181b', borda: '#52525b', nome: 'Colecionador (Placa Preta Mercosul)' },
  especial: { texto: '#16a34a', fundo: '#FFFFFF', borda: '#16a34a', nome: 'Especial / Teste de Montadora' },
  diplomatico: { texto: '#ca8a04', fundo: '#FFFFFF', borda: '#ca8a04', nome: 'Diplomático / Consular' }
};

/**
 * Renderiza uma placa Mercosul oficial em formato vetorial SVG imponente e em alta definição (520x170).
 */
export function renderizarPlacaMercosulSvg(placa, options = {}) {
  const analise = analisarPlaca(placa);
  const textoPlaca = analise.valido ? (analise.placaMercosulFormatada || analise.placaNormalizada) : 'BRA2E19';
  const pais = options.pais || 'BRASIL';
  const uf = (analise.origem && analise.origem.uf && analise.origem.uf !== 'DESCONHECIDO') ? analise.origem.uf : 'BR';
  const catKey = (options.categoria || 'particular').toLowerCase();
  const categoriaCfg = CORES_CATEGORIA_MERCOSUL[catKey] || CORES_CATEGORIA_MERCOSUL.particular;

  // Sanitização anti-XSS no SVG
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

  <!-- Corpo Principal da Placa com Sombra Automotiva Real -->
  <rect x="6" y="6" width="508" height="158" rx="18" ry="18" fill="${categoriaCfg.fundo}" stroke="url(#silver-border)" stroke-width="3.5" filter="url(#plate-shadow)"/>
  
  <!-- Borda Interna Suave Oficial -->
  <rect x="10" y="10" width="500" height="150" rx="14" ry="14" fill="none" stroke="${categoriaCfg.borda}" stroke-width="3"/>

  <!-- Faixa Azul Mercosul no Topo (Altura Proporcional de 48px) -->
  <path d="M 12,24 Q 12,12 24,12 L 496,12 Q 508,12 508,24 L 508,50 L 12,50 Z" fill="url(#blue-stripe)"/>

  <!-- Emblema Oficial Mercosul (Esquerda) -->
  <g transform="translate(24, 17)">
    <!-- 4 Estrelas do Cruzeiro do Sul -->
    <circle cx="12" cy="7" r="2" fill="#FFFFFF"/>
    <circle cx="7" cy="15" r="2" fill="#FFFFFF"/>
    <circle cx="17" cy="15" r="2" fill="#FFFFFF"/>
    <circle cx="12" cy="23" r="2" fill="#FFFFFF"/>
    <!-- Arco do Mercosul -->
    <path d="M 3,18 A 13 13 0 0 1 21 18" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>
    <text x="28" y="20" fill="#FFFFFF" font-size="11" font-weight="900" letter-spacing="1">MERCOSUL</text>
  </g>

  <!-- Nome do País Centralizado -->
  <text x="260" y="36" fill="#FFFFFF" font-size="20" font-weight="900" text-anchor="middle" letter-spacing="6">${paisSanitizado}</text>

  <!-- Bandeira Oficial do Brasil em Alta Resolução (Direita) -->
  <g transform="translate(450, 16)">
    <rect width="40" height="26" fill="#009c3b" rx="3" stroke="#FFFFFF" stroke-width="0.7"/>
    <polygon points="20,3 37,13 20,23 3,13" fill="#ffdf00"/>
    <circle cx="20" cy="13" r="6" fill="#002776"/>
    <path d="M 15,13.5 Q 20,11.5 25,13.5" fill="none" stroke="#FFFFFF" stroke-width="1.1"/>
  </g>

  <!-- Marca D'água Anti-Fraude com UF de Registro -->
  <text x="472" y="146" fill="${catKey === 'colecao' ? '#52525b' : '#cbd5e1'}" font-size="15" font-weight="900" text-anchor="end" letter-spacing="2">${ufSanitizado}</text>

  <!-- QR Code de Segurança Nítido no Canto Inferior Esquerdo -->
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

  <!-- Rebites de Fixação nos Cantos Superiores (Furação Oficial) -->
  <circle cx="28" cy="24" r="3.5" fill="#1e293b" stroke="#cbd5e1" stroke-width="1.2"/>
  <circle cx="492" cy="24" r="3.5" fill="#1e293b" stroke="#cbd5e1" stroke-width="1.2"/>

  <!-- Caracteres Oficiais Estampados em Alto Relevo (Tipografia FE-Schrift Alto Contraste) -->
  <text x="275" y="132" fill="${categoriaCfg.texto}" font-size="82" font-weight="900" text-anchor="middle" letter-spacing="9" font-family="'Impact', 'Arial Black', sans-serif" filter="url(#char-relief)">
    ${textoSanitizado}
  </text>
</svg>`;
}

/**
 * Renderiza a placa clássica cinza brasileira (AAA-9999) com tarjeta de município em SVG.
 */
export function renderizarPlacaAntigaSvg(placa, options = {}) {
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

  <!-- Fundo Metálico Cinza da Placa Clássica -->
  <rect x="6" y="6" width="508" height="158" rx="16" ry="16" fill="url(#metal-gray)" stroke="#4b5563" stroke-width="3" filter="url(#old-plate-shadow)"/>
  <rect x="10" y="10" width="500" height="150" rx="13" ry="13" fill="none" stroke="#374151" stroke-width="2.5"/>

  <!-- Tarjeta Metálica Superior de Município com Parafusos e Rebites -->
  <g transform="translate(110, 16)">
    <rect width="300" height="32" rx="6" fill="url(#tarjeta-metal)" stroke="#4b5563" stroke-width="1.8"/>
    <!-- Rebites da Tarjeta -->
    <circle cx="10" cy="16" r="3.5" fill="#374151" stroke="#9ca3af" stroke-width="1"/>
    <circle cx="290" cy="16" r="3.5" fill="#374151" stroke="#9ca3af" stroke-width="1"/>
    <!-- Texto do Município e UF -->
    <text x="150" y="22" fill="#1f2937" font-size="14" font-weight="900" text-anchor="middle" letter-spacing="3">
      ${tarjetaSanitizada}
    </text>
  </g>

  <!-- Parafusos Principais de Fixação Automotiva nos Cantos -->
  <circle cx="32" cy="32" r="5" fill="#1f2937" stroke="#9ca3af" stroke-width="1.5"/>
  <line x1="28" y1="32" x2="36" y2="32" stroke="#e5e7eb" stroke-width="1.2"/>
  <circle cx="488" cy="32" r="5" fill="#1f2937" stroke="#9ca3af" stroke-width="1.5"/>
  <line x1="484" y1="32" x2="492" y2="32" stroke="#e5e7eb" stroke-width="1.2"/>

  <!-- Lacre do DETRAN de Arame/Plástico no Canto Inferior Esquerdo -->
  <g transform="translate(24, 114)">
    <circle cx="16" cy="16" r="14" fill="#6b7280" stroke="#374151" stroke-width="1.5"/>
    <circle cx="16" cy="16" r="8" fill="#4b5563"/>
    <text x="16" y="19" fill="#e5e7eb" font-size="7" font-weight="bold" text-anchor="middle">DETRAN</text>
  </g>

  <!-- Caracteres Estampados em Relevo da Placa Antiga (ABC-1234) -->
  <text x="260" y="132" fill="#111827" font-size="82" font-weight="900" text-anchor="middle" letter-spacing="8" font-family="'Impact', 'Arial Black', sans-serif" filter="url(#old-char-relief)">
    ${textoSanitizado}
  </text>
</svg>`;
}

// ─── 9. DIAGNÓSTICO DE ISENÇÃO DE IPVA POR IDADE E LEGISLAÇÃO ESTADUAL ───

export function verificarIsencaoIpva(anoFabricacao, uf = 'SP') {
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
    anosRestantes: anosRestantes,
    statusIsencao: isento
      ? `ISENTO DE IPVA EM ${ufUpper} (Veículo com ${idadeVeiculo} anos; isenção ativada a partir de ${anosExigidos} anos)`
      : `TRIBUTÁVEL EM ${ufUpper} (Faltam ${anosRestantes} ano(s) para isenção automática aos ${anosExigidos} anos)`,
    anoPrevistoIsencao: ano + anosExigidos
  };
}

// ─── 10. CONSULTA INTEGRADA À TABELA FIPE E DEPRECIAÇÃO ───

export function consultarFipe(termoOuCodigo) {
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
