# 🚗 Placas Pro API • Inteligência e Telemetria Veicular Anycast

API de borda Cloudflare Workers de altíssimo desempenho (<2ms de latência Anycast) para validação, conversão, conformidade e auditoria de veículos brasileiros.

## 🌟 Recursos Principais

- **Validação de Placas Oficiais:** Validação completa do padrão Antigo Cinza (`AAA-9999`), Mercosul Automóvel (`AAA9A99`) e Mercosul Motocicleta (`AAA99A9`).
- **Conversão Bidirecional CONTRAN:** Conversão determinística oficial entre padrão antigo e Mercosul.
- **Identificação de UF de Origem (27 UFs):** Mapeamento por faixas oficiais CONTRAN/SENATRAN com estado e macrorregião.
- **Validador de RENAVAM Oficial:** Algoritmo oficial Módulo 11 DENATRAN com suporte a 9 e 11 dígitos.
- **Decodificador de Chassi/VIN (ISO 3779 / SAE J853):** Extração de fabricante (WMI), país de montagem, ano-modelo e validação do dígito verificador (check digit).
- **Rodízio Municipal de Veículos (SP Capital CET):** Identificação de dia de restrição, horários de pico e status em tempo real.
- **Calendário Oficial de Licenciamento (DETRAN):** Consulta por final de placa e UF com mês limite e status de renovação.
- **Calculadora Flex Econômica:** Análise de paridade técnica entre Etanol e Gasolina para frota flex.
- **Estimativa de IPVA por Estado:** Cálculo com base nas alíquotas fiscais oficiais das 27 UFs.
- **Renderizador Vetorial SVG de Placas:** Gera o SVG hiper-realista da placa Mercosul com bandeira do Brasil, brasão do Mercosul, QR Code e marca d'água da UF.
- **Gerador Sandbox:** Geração de placas e RENAVAM matematicamente válidos para ambientes de teste e QA.

---

## 🚀 Endpoints REST

### 1. Consultar e Converter Placa
`GET /api/placas/:placa`

```bash
curl -s "https://placas-pro-api.clepta2.workers.dev/api/placas/BRA2E19"
```

```json
{
  "valido": true,
  "placaOriginal": "BRA2E19",
  "placaNormalizada": "BRA2E19",
  "formato": "mercosul_automovel",
  "padrao": "Mercosul",
  "tipoVeiculo": "automovel",
  "placaAntigaFormatada": "BRA-2419",
  "placaMercosulFormatada": "BRA2E19",
  "podeConverterParaAntiga": true,
  "ultimoDigito": "9",
  "origem": {
    "uf": "SP",
    "estado": "São Paulo",
    "regiao": "Sudeste"
  },
  "licenciamento": {
    "uf": "SP",
    "finalPlaca": "9",
    "mesLimite": 11,
    "mesVencimentoExtenso": "Novembro",
    "exercicio": 2026
  },
  "rodizioSP": {
    "diaRestricao": "Sexta-feira",
    "horarios": "07h00 às 10h00 e das 17h00 às 20h00",
    "statusAgora": "LIBERADO para circulação"
  }
}
```

### 2. Renderizar SVG da Placa Mercosul
`GET /api/placas/:placa/svg`

```html
<!-- Incorporação direta em HTML / E-commerce -->
<img src="https://placas-pro-api.clepta2.workers.dev/api/placas/BRA2E19/svg" alt="Placa Mercosul" width="400">
```

### 3. Decodificar Chassi / VIN (ISO 3779)
`GET /api/placas/chassi/:chassi`

```bash
curl -s "https://placas-pro-api.clepta2.workers.dev/api/placas/chassi/9BWCA45Z1FP012345"
```

```json
{
  "valido": true,
  "chassiNormalizado": "9BWCA45Z1FP012345",
  "fabricante": "Volkswagen",
  "paisFabricacao": "Brasil",
  "origem": "Nacional",
  "anoModelo": 2015,
  "plantaMontagem": "P",
  "numeroSerie": "012345"
}
```

### 4. Validar RENAVAM (Módulo 11)
`GET /api/placas/renavam/:renavam`

```bash
curl -s "https://placas-pro-api.clepta2.workers.dev/api/placas/renavam/00632345678"
```

### 5. Calculadora Flex (Etanol x Gasolina)
`GET /api/placas/flex?etanol=3.80&gasolina=5.90`

```json
{
  "paridadePercentual": "64.4%",
  "combustivelVantajoso": "ETANOL",
  "economiaEstimada": "8.0%",
  "parecerTecnico": "O Etanol está custando 64.4% da Gasolina (abaixo do limiar técnico de 70%). É a opção mais vantajosa!"
}
```

---

## 🛠️ Instalação Local e Testes

```bash
git clone https://github.com/clepta2/placas-pro.git
cd placas-pro
npm test
```

## 📄 Licença

MIT © [clepta2](https://github.com/clepta2)
