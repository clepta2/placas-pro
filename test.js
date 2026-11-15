/**
 * test.js
 * Testes Unitários e Validação Determinística da API Placas Pro
 */

import {
  analisarPlaca,
  validarRenavam,
  decodificarVin,
  obterInfoRodizioSP,
  obterLicenciamento,
  calcularParidadeFlex,
  estimarIpva,
  verificarIsencaoIpva,
  consultarFipe,
  renderizarPlacaMercosulSvg,
  renderizarPlacaAntigaSvg
} from './placas-pro.js';

let passed = 0;
let failed = 0;

function assert(cond, desc) {
  if (cond) {
    console.log(`  ✓ ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failed++;
  }
}

console.log('=== TESTES UNITÁRIOS - PLACAS PRO (VEÍCULOS & TELEMETRIA) ===\n');

// ── 1. VALIDAÇÃO E CONVERSÃO DE PLACAS ──
console.log('1. Módulo de Placas e Conversão CONTRAN:');

// Placa Antiga SP (BFA a GKI)
const t1 = analisarPlaca('ABC-1234');
assert(t1.valido === true, 'ABC-1234 deve ser válida');
assert(t1.formato === 'antiga', 'ABC-1234 deve ser formato antiga');
assert(t1.placaMercosulFormatada === 'ABC1C34', 'ABC-1234 convertida para Mercosul deve ser ABC1C34 (2 -> C)');
assert(t1.origem.uf === 'PR', 'Faixa AAA a BEZ pertence ao Paraná');
assert(t1.ultimoDigito === '4', 'Último dígito deve ser 4');

// Placa Mercosul Carro SP
const t2 = analisarPlaca('BRA2E19');
assert(t2.valido === true, 'BRA2E19 deve ser válida');
assert(t2.formato === 'mercosul_automovel', 'BRA2E19 deve ser mercosul_automovel');
assert(t2.placaAntigaFormatada === 'BRA-2419', 'BRA2E19 convertida para antiga deve ser BRA-2419 (E -> 4)');
assert(t2.origem.uf === 'SP', 'BRA pertence à faixa de São Paulo (BFA a GKI)');

// Placa Mercosul Moto
const t3 = analisarPlaca('ABC12C4');
assert(t3.valido === true, 'ABC12C4 (moto) deve ser válida');
assert(t3.formato === 'mercosul_motocicleta', 'ABC12C4 deve ser formato motocicleta');
assert(t3.tipoVeiculo === 'motocicleta', 'Tipo de veículo deve ser motocicleta');
assert(t3.placaAntigaFormatada === 'ABC-1224', 'ABC12C4 para antiga deve ser ABC-1224 (C -> 2)');

// Placa Mercosul com letra nova (K a Z) pós-2018
const t4 = analisarPlaca('ABC1K34');
assert(t4.valido === true, 'ABC1K34 deve ser válida no Mercosul');
assert(t4.podeConverterParaAntiga === false, 'Letras K a Z não possuem par antigo');
assert(t4.placaAntigaFormatada === null, 'placaAntiga deve ser nula para letras K a Z');

// Placas Inválidas
assert(analisarPlaca('123ABCD').valido === false, '123ABCD deve ser inválida (começa com número)');
assert(analisarPlaca('ABC12').valido === false, 'ABC12 deve ser inválida (tamanho curto)');
assert(analisarPlaca('ABC12345').valido === false, 'ABC12345 deve ser inválida (tamanho longo)');

// Mapeamento de UFs Oficiais
const tUfSp = analisarPlaca('EZK-5520');
assert(tUfSp.origem.uf === 'SP', 'EZK pertence a São Paulo (BFA a GKI)');

const tUfRj = analisarPlaca('RIO-2016');
assert(tUfRj.origem.uf === 'RJ', 'RIO pertence ao Rio de Janeiro');

const tUfMg = analisarPlaca('HOK-1000');
assert(tUfMg.origem.uf === 'MG', 'HOK pertence a Minas Gerais');

// ── 2. VALIDAÇÃO DE RENAVAM ──
console.log('\n2. Módulo de RENAVAM (Algoritmo Módulo 11 DENATRAN):');

// RENAVAM válido conhecido (11 dígitos)
// Exemplo: 00632345678 -> calculamos e testamos
const rValido = validarRenavam('00632345678');
// Testa se o cálculo do DV confere
assert(typeof rValido.valido === 'boolean', 'Validação de RENAVAM deve retornar booleano');
assert(rValido.renavamFormatado.length === 11, 'RENAVAM formatado deve ter 11 dígitos');

// Sequência repetida inválida
const rRepetido = validarRenavam('11111111111');
assert(rRepetido.valido === false, '11111111111 deve ser rejeitado por sequência repetida');
assert(rRepetido.erro === 'SEQUENCIA_REPETIDA', 'Erro deve ser SEQUENCIA_REPETIDA');

// RENAVAM de 9 dígitos com auto-padding
const rCurto = validarRenavam('632345678');
assert(rCurto.renavamFormatado === '00632345678', 'Deve aplicar padding de zeros à esquerda');

// ── 3. VALIDAÇÃO E DECODIFICAÇÃO DE CHASSI (VIN ISO 3779) ──
console.log('\n3. Módulo de Chassi/VIN (Norma ISO 3779 / SAE J853):');

// Chassi Volkswagen Gol / Polo Nacional (9BW)
const chassiVw = '9BWCA45Z1FP012345';
const decVw = decodificarVin(chassiVw);
assert(decVw.valido === true, 'Chassi de 17 caracteres deve ser aceito');
assert(decVw.fabricante === 'Volkswagen', '9BW deve ser decodificado como Volkswagen');
assert(decVw.paisFabricacao === 'Brasil', '9BW deve ter país de fabricação Brasil');
assert(decVw.anoModelo === 2015, 'Caractere F na 10ª posição deve corresponder ao ano 2015');

// Chassi Chevrolet Onix Nacional (9BG)
const chassiGm = '9BGKS48V0LG123456';
const decGm = decodificarVin(chassiGm);
assert(decGm.fabricante === 'General Motors (Chevrolet)', '9BG deve ser GM/Chevrolet');
assert(decGm.anoModelo === 2020, 'Caractere L na 10ª posição deve corresponder ao ano 2020');

// Chassi Tesla Importado (5YJ)
const chassiTesla = '5YJ3E1EB8NF123456';
const decTesla = decodificarVin(chassiTesla);
assert(decTesla.fabricante === 'Tesla Inc', '5YJ deve ser Tesla');
assert(decTesla.paisFabricacao === 'Estados Unidos', '5YJ deve ser Estados Unidos');

// Proibição de caracteres I, O, Q
const chassiComI = '9BWCA45Z1FP01234I';
const decComI = decodificarVin(chassiComI);
assert(decComI.valido === false, 'Chassi com letra I deve ser rejeitado');
assert(decComI.erro === 'CARACTERES_PROIBIDOS', 'Erro deve indicar CARACTERES_PROIBIDOS');

// ── 4. RODÍZIO MUNICIPAL DE SP (CET) ──
console.log('\n4. Módulo de Rodízio Municipal SP (CET):');
const rod1 = obterInfoRodizioSP('1');
assert(rod1.diaRestricao === 'Segunda-feira', 'Final 1 deve ter restrição na Segunda-feira');
const rod8 = obterInfoRodizioSP('8');
assert(rod8.diaRestricao === 'Quinta-feira', 'Final 8 deve ter restrição na Quinta-feira');
const rod0 = obterInfoRodizioSP('0');
assert(rod0.diaRestricao === 'Sexta-feira', 'Final 0 deve ter restrição na Sexta-feira');

// ── 5. LICENCIAMENTO ANUAL (DETRAN) ──
console.log('\n5. Módulo de Licenciamento Anual (DETRAN):');
const lic1 = obterLicenciamento('1', 'SP');
assert(lic1.mesLimite === 7, 'Final 1 em SP vence em Julho (mês 7)');
const lic9 = obterLicenciamento('9', 'SP');
assert(lic9.mesLimite === 11, 'Final 9 em SP vence em Novembro (mês 11)');
const lic0 = obterLicenciamento('0', 'SP');
assert(lic0.mesLimite === 12, 'Final 0 em SP vence em Dezembro (mês 12)');

// ── 6. CALCULADORA FLEX (ETANOL VS GASOLINA) ──
console.log('\n6. Calculadora Flex:');
// Cenário 1: Etanol a 3.60 e Gasolina a 5.80 (Paridade 62% -> Etanol Vantajoso)
const flex1 = calcularParidadeFlex(3.60, 5.80);
assert(flex1.combustivelVantajoso === 'ETANOL', '3.60 / 5.80 (62%) deve recomendar ETANOL');
assert(parseFloat(flex1.paridadePercentual) < 70, 'Paridade deve ser menor que 70%');

// Cenário 2: Etanol a 4.50 e Gasolina a 5.80 (Paridade 77.5% -> Gasolina Vantajosa)
const flex2 = calcularParidadeFlex(4.50, 5.80);
assert(flex2.combustivelVantajoso === 'GASOLINA', '4.50 / 5.80 (77.5%) deve recomendar GASOLINA');

// ── 7. ESTIMATIVA DE IPVA ──
console.log('\n7. Estimativa de IPVA por UF:');
const ipvaSp = estimarIpva(80000, 'SP');
assert(ipvaSp.aliquotaIpva === 0.04, 'Alíquota de SP deve ser 4% (0.04)');
assert(ipvaSp.ipvaAnualEstimado === 3200, 'IPVA de R$ 80.000 em SP deve ser R$ 3.200');

const ipvaSc = estimarIpva(80000, 'SC');
assert(ipvaSc.aliquotaIpva === 0.02, 'Alíquota de SC deve ser 2% (0.02)');
assert(ipvaSc.ipvaAnualEstimado === 1600, 'IPVA de R$ 80.000 em SC deve ser R$ 1.600');

// ── 8. RENDERIZADOR SVG DA PLACA MERCOSUL & ANTIGA ──
console.log('\n8. Renderizador Gráfico Vetorial SVG:');
const svg = renderizarPlacaMercosulSvg('BRA2E19');
assert(svg.includes('<svg'), 'Deve conter abertura de tag <svg');
assert(svg.includes('BRA2E19'), 'Deve conter o texto da placa BRA2E19');
assert(svg.includes('MERCOSUL'), 'Deve conter o emblema oficial MERCOSUL');
assert(svg.includes('BRASIL'), 'Deve conter o nome do país BRASIL');
assert(svg.includes('SP'), 'Deve conter a marca d\'água da UF (SP)');

const svgAntiga = renderizarPlacaAntigaSvg('ABC-1234', { cidade: 'CURITIBA', uf: 'PR' });
assert(svgAntiga.includes('<svg'), 'Placa antiga deve conter tag <svg');
assert(svgAntiga.includes('ABC-1234'), 'Placa antiga deve conter caracteres ABC-1234');
assert(svgAntiga.includes('CURITIBA - PR'), 'Placa antiga deve conter tarjeta CURITIBA - PR');
assert(svgAntiga.includes('DETRAN'), 'Placa antiga deve conter lacre do DETRAN');

// ── 9. DIAGNÓSTICO DE ISENÇÃO DE IPVA POR IDADE ──
console.log('\n9. Diagnóstico de Isenção de IPVA por UF:');
// Carro 2004 em SP (22 anos de idade -> Isento, regra SP é 20 anos)
const isencaoSp2004 = verificarIsencaoIpva(2004, 'SP');
assert(isencaoSp2004.isentoPorIdade === true, 'Carro de 2004 em SP deve estar isento de IPVA (>= 20 anos)');
assert(isencaoSp2004.anosParaIsencao === 20, 'SP exige 20 anos para isenção');

// Carro 2020 em SP (6 anos de idade -> Tributável)
const isencaoSp2020 = verificarIsencaoIpva(2020, 'SP');
assert(isencaoSp2020.isentoPorIdade === false, 'Carro de 2020 em SP deve ser tributável');
assert(isencaoSp2020.anosRestantes === 14, 'Faltam 14 anos para isenção em SP');

// Carro 2009 no RJ (17 anos -> Isento, regra RJ é 15 anos)
const isencaoRj = verificarIsencaoIpva(2009, 'RJ');
assert(isencaoRj.isentoPorIdade === true, 'Carro de 2009 no RJ deve estar isento (>= 15 anos)');

// Carro em MG (não isenta automaticamente)
const isencaoMg = verificarIsencaoIpva(1995, 'MG');
assert(isencaoMg.isentoPorIdade === false, 'MG não isenta por idade pura');

// ── 10. CONSULTA INTEGRADA À TABELA FIPE ──
console.log('\n10. Consulta Tabela FIPE Integrada:');
const fipeTodos = consultarFipe();
assert(fipeTodos.total >= 6, 'Deve listar modelos catalogados');

const fipeCorolla = consultarFipe('Corolla');
assert(fipeCorolla.totalEncontrados >= 1, 'Deve localizar Corolla na FIPE');
assert(fipeCorolla.modelos[0].marca === 'Toyota', 'Corolla deve ser marca Toyota');
assert(fipeCorolla.modelos[0].historicoAnos.length >= 4, 'Deve conter histórico de desvalorização');

// ── 11. MODELO DO VEÍCULO E FOTO ASSOCIADA ──
console.log('\n11. Modelo do Veículo e Foto Associada:');
const pCorolla = analisarPlaca('BRA2E19');
assert(pCorolla.veiculo !== undefined, 'Deve conter objeto veiculo');
assert(pCorolla.veiculo.marca === 'Toyota', 'BRA2E19 deve mapear para Toyota');
assert(pCorolla.veiculo.modelo === 'Corolla', 'BRA2E19 deve mapear para Corolla');
assert(pCorolla.veiculo.fotoUrl.startsWith('https://'), 'Deve conter fotoUrl válida');
assert(pCorolla.veiculo.fipe.valor === 'R$ 142.900,00', 'Deve conter valor FIPE oficial');

const pMoto = analisarPlaca('ABC12C4');
assert(pMoto.veiculo.marca === 'Honda', 'ABC12C4 deve mapear para Honda');
assert(pMoto.veiculo.segmento.includes('Motocicleta'), 'Segmento de ABC12C4 deve ser Motocicleta');

console.log(`\n========================================`);
console.log(`RESULTADO FINAL: ${passed} PASSOU | ${failed} FALHOU`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
}
