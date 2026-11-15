import fs from 'fs';

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Placas & Veículos Pro • Console Oficial Anycast • Ponte API Market</title>
  <meta name="description" content="Validador e Conversor de Placas Mercosul e Cinza, Mapeamento CONTRAN 27 UFs, RENAVAM Módulo 11, Chassi VIN ISO 3779, Licenciamento DETRAN, Rodízio SP e Renderizador SVG na Cloudflare Edge." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Manrope:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="styles.css?v=2.7.0" />
  <script>
    (function() {
      const savedTheme = localStorage.getItem('ponte.theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', savedTheme);
    })();
  </script>
  <script defer src="https://unpkg.com/lucide@latest"></script>
  <style>
    .playground-split {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
      gap: 24px;
      margin-top: 24px;
    }
    @media (max-width: 1080px) {
      .playground-split { grid-template-columns: 1fr; }
    }
    .plate-render-frame {
      background: radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.12), transparent 70%), var(--paper);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      box-shadow: var(--shadow-sm);
    }
    .plate-render-svg-wrap {
      max-width: 390px;
      width: 100%;
      filter: drop-shadow(0 14px 28px rgba(0,0,0,0.22));
      transition: transform 0.2s ease;
    }
    .plate-render-svg-wrap:hover {
      transform: scale(1.02);
    }
    .specs-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }
    .specs-table tr {
      border-bottom: 1px solid var(--line-light);
    }
    .specs-table td {
      padding: 10px 14px;
      vertical-align: middle;
    }
    .specs-table td.label-col {
      color: var(--muted);
      font-weight: 600;
      width: 42%;
      font-size: 11.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .specs-table td.val-col {
      color: var(--ink);
      font-weight: 700;
      text-align: right;
    }
    .tab-nav-bar {
      display: flex;
      gap: 6px;
      background: var(--paper-elevated, #f1f5f2);
      padding: 4px;
      border-radius: var(--radius-md);
      border: 1px solid var(--line);
      margin-bottom: 20px;
      overflow-x: auto;
    }
    :root[data-theme="dark"] .tab-nav-bar {
      background: #0d1527;
      border-color: #1e293b;
    }
    .tab-nav-btn {
      flex: 1;
      min-height: 38px;
      padding: 0 16px;
      border: none;
      background: transparent;
      border-radius: var(--radius-sm);
      font-size: 12.5px;
      font-weight: 600;
      color: var(--muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      white-space: nowrap;
      transition: all 0.16s ease;
    }
    .tab-nav-btn:hover {
      color: var(--ink);
      background: rgba(255, 255, 255, 0.04);
    }
    .tab-nav-btn.is-active {
      background: var(--paper);
      color: var(--ink);
      font-weight: 700;
      box-shadow: var(--shadow-xs);
    }
    :root[data-theme="dark"] .tab-nav-btn.is-active {
      background: #1e293b;
      color: #fff;
    }
    .status-badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 9px;
      border-radius: var(--radius-full);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .status-badge-pill.green {
      background: rgba(16, 185, 129, 0.12);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.25);
    }
    .status-badge-pill.red {
      background: rgba(239, 68, 68, 0.12);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.25);
    }
    .status-badge-pill.blue {
      background: rgba(59, 130, 246, 0.12);
      color: #3b82f6;
      border: 1px solid rgba(59, 130, 246, 0.25);
    }
    .terminal-window {
      background: #091311;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-lg);
      display: flex;
      flex-direction: column;
    }
    .terminal-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: rgba(255, 255, 255, 0.04);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .terminal-dots {
      display: flex;
      gap: 6px;
    }
    .terminal-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .terminal-dot.red { background: #ef4444; }
    .terminal-dot.yellow { background: #f59e0b; }
    .terminal-dot.green { background: #10b981; }
    .card-dashboard {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      padding: 20px;
      box-shadow: var(--shadow-xs);
    }
  </style>
</head>
<body>
  <div class="app-shell">
    <!-- Sidebar Oficial do Ecossistema Ponte / OZPro -->
    <aside class="sidebar" aria-label="Navegação principal">
      <a class="brand" href="#playground" aria-label="Ponte API, Placas Pro">
        <img src="brand/ozpro-mark.svg" alt="Ponte API Logo" style="width:36px;height:36px;border-radius:10px;object-fit:contain;background:var(--mint);padding:4px;box-shadow:0 4px 12px rgba(163,230,53,0.3);" />
        <span><strong>ponte</strong><small>PLACAS PRO · OZPRO</small></span>
      </a>

      <nav class="primary-nav" id="primary-nav">
        <div class="nav-section-label">FUNCIONALIDADES</div>
        <button class="nav-link is-active" data-view="placas">
          <i data-lucide="car"></i> <span>Placas & Mercosul</span>
        </button>
        <button class="nav-link" data-view="chassi">
          <i data-lucide="scan"></i> <span>Chassi / VIN (ISO 3779)</span>
        </button>
        <button class="nav-link" data-view="renavam">
          <i data-lucide="file-check-2"></i> <span>RENAVAM (Módulo 11)</span>
        </button>
        <button class="nav-link" data-view="flex">
          <i data-lucide="fuel"></i> <span>Calculadora Flex ANP</span>
        </button>
        <button class="nav-link" data-view="graficos">
          <i data-lucide="pie-chart"></i> <span>Gráficos & Telemetria</span>
        </button>

        <div class="nav-section-label">ECOSSISTEMA PONTE</div>
        <a class="nav-link" href="https://ponte-marketplace.maputo2.workers.dev" target="_blank" rel="noopener">
          <i data-lucide="layout-grid"></i> <span>API Marketplace</span>
          <span class="nav-ext"><i data-lucide="arrow-up-right"></i></span>
        </a>
        <a class="nav-link" href="https://github.com/clepta2/placas-pro" target="_blank" rel="noopener">
          <i data-lucide="github"></i> <span>GitHub do Projeto</span>
          <span class="nav-ext"><i data-lucide="arrow-up-right"></i></span>
        </a>
      </nav>

      <div class="sidebar-bottom">
        <div class="status-row">
          <span class="status-dot connected"></span>
          <span>Cloudflare Edge · &lt;2ms</span>
        </div>
        <div class="profile-row">
          <div class="avatar">PP</div>
          <div class="profile-copy">
            <strong>Placas & Veículos Pro</strong>
            <span>API Anycast Oficial</span>
          </div>
        </div>
        <div class="sidebar-version">v1.0.0 · CONTRAN · SENATRAN</div>
      </div>
    </aside>

    <!-- Área Principal -->
    <main class="main-area">
      <!-- Topbar Oficial -->
      <header class="topbar">
        <div class="breadcrumb">
          <span>Workspace</span>
          <i data-lucide="chevron-right"></i>
          <span>Suíte Veicular</span>
          <i data-lucide="chevron-right"></i>
          <strong id="breadcrumb-title">Placas & Mercosul</strong>
        </div>
        <div class="topbar-actions">
          <span class="environment">
            <span class="status-dot connected"></span>
            Cloudflare Anycast Global (330+ Cidades)
          </span>
          <button class="icon-button theme-toggle-btn" id="theme-toggle-btn" aria-label="Alternar tema" title="Alternar tema claro/escuro">
            <i data-lucide="moon"></i>
          </button>
          <a href="https://ponte-marketplace.maputo2.workers.dev" target="_blank" rel="noopener" class="primary-button accent" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:0 14px;height:34px;">
            <i data-lucide="sparkles"></i> <span>Catálogo Completo</span>
          </a>
        </div>
      </header>

      <!-- Conteúdo da Página -->
      <div class="content-wrap">
        <!-- Headline -->
        <div class="page-heading">
          <div>
            <p class="eyebrow">TELEMETRIA, GRÁFICOS & CONFORMIDADE VEICULAR</p>
            <h1>Placas & Veículos Pro • Console Oficial Anycast</h1>
            <p class="page-subtitle">
              Validação matemática e conversão bidirecional Mercosul & Cinza, mapeamento das 27 UFs do CONTRAN, auditoria de RENAVAM Módulo 11, decodificador Chassi VIN ISO 3779 e renderizador vetorial SVG nativo.
            </p>
          </div>
        </div>

        <!-- Cards de Destaque / Métricas no Padrão do Marketplace -->
        <div class="billing-models-grid" style="grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); margin-bottom: 24px;">
          <div class="model-card credit-card" style="padding:16px 20px;">
            <div class="model-card-header" style="margin-bottom:8px;">
              <span class="model-badge credit"><i data-lucide="map-pin"></i> 27 UFS CONTRAN</span>
            </div>
            <div style="font-size:18px;font-weight:800;color:var(--ink);margin-bottom:4px;">Faixas Estaduais</div>
            <p style="font-size:12px;color:var(--muted);margin:0;line-height:1.4;">Identifica o Estado de emplacamento original através do prefixo alfanumérico oficial.</p>
          </div>

          <div class="model-card subscription-card" style="padding:16px 20px;">
            <div class="model-card-header" style="margin-bottom:8px;">
              <span class="model-badge sub"><i data-lucide="shield-check"></i> ZERO REGEX</span>
            </div>
            <div style="font-size:18px;font-weight:800;color:var(--ink);margin-bottom:4px;">Blindagem Numérica</div>
            <p style="font-size:12px;color:var(--muted);margin:0;line-height:1.4;">Validação determinística pura, imune a ataques de ReDoS e bypasses de formatação.</p>
          </div>

          <div class="model-card tier-card" style="padding:16px 20px;">
            <div class="model-card-header" style="margin-bottom:8px;">
              <span class="model-badge tier"><i data-lucide="zap"></i> SUB-2MS LATENCY</span>
            </div>
            <div style="font-size:18px;font-weight:800;color:var(--ink);margin-bottom:4px;">Entrega Anycast</div>
            <p style="font-size:12px;color:var(--muted);margin:0;line-height:1.4;">Processado diretamente na memória RAM da Cloudflare em 330+ data centers globais.</p>
          </div>
        </div>

        <!-- Seletor de Abas de Funcionalidades -->
        <div class="tab-nav-bar">
          <button class="tab-nav-btn is-active" data-tab="placas">
            <i data-lucide="car"></i> <span>Validador de Placas & Mercosul</span>
          </button>
          <button class="tab-nav-btn" data-tab="chassi">
            <i data-lucide="scan"></i> <span>Chassi / VIN (ISO 3779)</span>
          </button>
          <button class="tab-nav-btn" data-tab="renavam">
            <i data-lucide="file-check-2"></i> <span>RENAVAM (Módulo 11)</span>
          </button>
          <button class="tab-nav-btn" data-tab="flex">
            <i data-lucide="fuel"></i> <span>Calculadora Flex ANP</span>
          </button>
          <button class="tab-nav-btn" data-tab="graficos">
            <i data-lucide="pie-chart"></i> <span>Gráficos & Telemetria</span>
          </button>
        </div>

        <!-- PLAYGROUND OFICIAL DA PONTE API (SPLIT-SCREEN DE 2 COLUNAS) -->
        <div class="playground-split">
          <!-- Coluna 1: Formulário e Painel de Resultados Visuais -->
          <div class="playground-left">
            <!-- PAINEL 1: PLACAS -->
            <div id="section-placas" class="tab-pane">
              <div class="card-dashboard">
                <div style="font-size:13.5px;font-weight:700;color:var(--ink);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
                  <span style="display:flex;align-items:center;gap:7px;">
                    <i data-lucide="search" style="color:var(--blue);"></i>
                    <span>Consultar Placa Nacional ou Mercosul</span>
                  </span>
                  <span class="status-badge-pill blue">CONTRAN Oficial</span>
                </div>
                <p style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.45;">
                  Digite uma placa no padrão Mercosul (ex: <code>BRA2E19</code>) ou antiga cinza (ex: <code>ABC-1234</code>):
                </p>

                <!-- Input e Botões -->
                <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
                  <input type="text" id="placa-input" value="BRA2E19" placeholder="Ex: BRA2E19 ou ABC-1234..." maxlength="8" style="flex:2;min-width:180px;height:40px;padding:0 12px;border:1px solid var(--line);border-radius:var(--radius-sm);font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink);background:var(--paper);outline:none;" />
                  <button id="btn-exec-placa" class="primary-button accent" style="height:40px;padding:0 16px;font-size:12.5px;font-weight:700;display:inline-flex;align-items:center;gap:6px;">
                    <i data-lucide="play"></i> <span>Consultar</span>
                  </button>
                  <button id="btn-gerar-placa" class="secondary-button" style="height:40px;padding:0 14px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:6px;">
                    <i data-lucide="sparkles"></i> <span>Gerar Válida</span>
                  </button>
                </div>

                <!-- Presets Rápidos -->
                <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:11.5px;margin-bottom:20px;">
                  <span style="color:var(--muted);font-weight:600;">Presets de teste:</span>
                  <button class="secondary-button sample-placa" data-plate="BRA2E19" style="padding:4px 10px;font-size:11px;">🚗 BRA2E19 (Carro SP)</button>
                  <button class="secondary-button sample-placa" data-plate="ABC12C4" style="padding:4px 10px;font-size:11px;">🏍️ ABC12C4 (Moto PR)</button>
                  <button class="secondary-button sample-placa" data-plate="EZK-5520" style="padding:4px 10px;font-size:11px;">🚙 EZK-5520 (Cinza SP)</button>
                  <button class="secondary-button sample-placa" data-plate="RIO-2016" style="padding:4px 10px;font-size:11px;">🏖️ RIO-2016 (Rio de Janeiro)</button>
                </div>

                <!-- Renderizador Gráfico da Placa SVG -->
                <div class="plate-render-frame">
                  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:12px;display:flex;align-items:center;gap:6px;">
                    <i data-lucide="image"></i> <span>Renderizador Vetorial SVG Oficial Anycast</span>
                  </div>
                  <div id="plate-svg-box" class="plate-render-svg-wrap">
                    <!-- SVG renderizado dinamicamente -->
                  </div>
                </div>

                <!-- Tabela de Especificações do Veículo -->
                <div style="border:1px solid var(--line);border-radius:var(--radius-md);overflow:hidden;background:var(--paper);">
                  <div style="padding:10px 14px;background:var(--paper-elevated,#f8fafc);border-bottom:1px solid var(--line);font-size:12px;font-weight:700;color:var(--ink);">
                    📋 Raio-X & Telemetria Cadastral
                  </div>
                  <table class="specs-table">
                    <tbody>
                      <tr>
                        <td class="label-col">Padrão da Placa</td>
                        <td class="val-col" id="val-padrao"><span class="status-badge-pill green">Mercosul</span></td>
                      </tr>
                      <tr>
                        <td class="label-col">Conversão Bidirecional</td>
                        <td class="val-col" id="val-conversao" style="font-family:'JetBrains Mono',monospace;">BRA-2419</td>
                      </tr>
                      <tr>
                        <td class="label-col">Estado de Registro</td>
                        <td class="val-col" id="val-origem">São Paulo (SP) — Sudeste</td>
                      </tr>
                      <tr>
                        <td class="label-col">Licenciamento DETRAN</td>
                        <td class="val-col" id="val-licenciamento">Novembro / 2026</td>
                      </tr>
                      <tr>
                        <td class="label-col">Rodízio SP (CET)</td>
                        <td class="val-col" id="val-rodizio">Sexta-feira (07h-10h / 17h-20h)</td>
                      </tr>
                      <tr>
                        <td class="label-col">Circulação Agora</td>
                        <td class="val-col" id="val-circulacao"><span class="status-badge-pill green">LIBERADO AGORA</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- PAINEL 2: CHASSI / VIN -->
            <div id="section-chassi" class="tab-pane" style="display:none;">
              <div class="card-dashboard">
                <div style="font-size:13.5px;font-weight:700;color:var(--ink);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
                  <span style="display:flex;align-items:center;gap:7px;">
                    <i data-lucide="scan" style="color:var(--blue);"></i>
                    <span>Auditoria e Decodificador de Chassi (VIN ISO 3779)</span>
                  </span>
                  <span class="status-badge-pill blue">SAE J853</span>
                </div>
                <p style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.45;">
                  Digite o chassi de 17 caracteres (rejeição automática das letras proibidas <code>I</code>, <code>O</code>, <code>Q</code>):
                </p>

                <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
                  <input type="text" id="chassi-input" value="9BWCA45Z1FP012345" placeholder="Digite o chassi de 17 caracteres..." maxlength="17" style="flex:2;min-width:220px;height:40px;padding:0 12px;border:1px solid var(--line);border-radius:var(--radius-sm);font-family:'JetBrains Mono',monospace;font-size:13.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--ink);background:var(--paper);outline:none;" />
                  <button id="btn-exec-chassi" class="primary-button accent" style="height:40px;padding:0 16px;font-size:12.5px;font-weight:700;">
                    <i data-lucide="play"></i> <span>Decodificar</span>
                  </button>
                </div>

                <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:11.5px;margin-bottom:20px;">
                  <span style="color:var(--muted);font-weight:600;">Montadoras:</span>
                  <button class="secondary-button sample-chassi" data-vin="9BWCA45Z1FP012345" style="padding:4px 10px;font-size:11px;">🚗 Volkswagen Brasil</button>
                  <button class="secondary-button sample-chassi" data-vin="9BGKS48V0LG123456" style="padding:4px 10px;font-size:11px;">🚙 GM Chevrolet Onix</button>
                  <button class="secondary-button sample-chassi" data-vin="5YJ3E1EB8NF123456" style="padding:4px 10px;font-size:11px;">⚡ Tesla Model 3</button>
                </div>

                <div style="border:1px solid var(--line);border-radius:var(--radius-md);overflow:hidden;background:var(--paper);">
                  <div style="padding:10px 14px;background:var(--paper-elevated,#f8fafc);border-bottom:1px solid var(--line);font-size:12px;font-weight:700;color:var(--ink);">
                    🔍 Raio-X do Chassi
                  </div>
                  <table class="specs-table">
                    <tbody>
                      <tr>
                        <td class="label-col">Montadora / WMI</td>
                        <td class="val-col" id="val-chassi-wmi">Volkswagen (9BW)</td>
                      </tr>
                      <tr>
                        <td class="label-col">País de Fabricação</td>
                        <td class="val-col" id="val-chassi-pais">Brasil (Nacional)</td>
                      </tr>
                      <tr>
                        <td class="label-col">Ano-Modelo Internacional</td>
                        <td class="val-col" id="val-chassi-ano">2015</td>
                      </tr>
                      <tr>
                        <td class="label-col">Check Digit (9ª Posição)</td>
                        <td class="val-col" id="val-chassi-check"><span class="status-badge-pill green">Válido</span></td>
                      </tr>
                      <tr>
                        <td class="label-col">Planta & Série</td>
                        <td class="val-col" id="val-chassi-serie" style="font-family:'JetBrains Mono',monospace;">Planta P · 012345</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- PAINEL 3: RENAVAM -->
            <div id="section-renavam" class="tab-pane" style="display:none;">
              <div class="card-dashboard">
                <div style="font-size:13.5px;font-weight:700;color:var(--ink);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
                  <span style="display:flex;align-items:center;gap:7px;">
                    <i data-lucide="file-check-2" style="color:var(--blue);"></i>
                    <span>Validador Oficial de RENAVAM (DENATRAN / SENATRAN)</span>
                  </span>
                  <span class="status-badge-pill blue">Módulo 11</span>
                </div>
                <p style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.45;">
                  Validação do Registro Nacional com pesos regressivos <code>[3, 2, 9, 8, 7, 6, 5, 4, 3, 2]</code> e preenchimento de zeros à esquerda:
                </p>

                <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
                  <input type="text" id="renavam-input" value="00632345678" placeholder="Digite o RENAVAM de 9 a 11 dígitos..." maxlength="11" style="flex:2;min-width:200px;height:40px;padding:0 12px;border:1px solid var(--line);border-radius:var(--radius-sm);font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:var(--ink);background:var(--paper);outline:none;" />
                  <button id="btn-exec-renavam" class="primary-button accent" style="height:40px;padding:0 16px;font-size:12.5px;font-weight:700;">
                    <i data-lucide="play"></i> <span>Validar</span>
                  </button>
                  <button id="btn-gerar-renavam" class="secondary-button" style="height:40px;padding:0 14px;font-size:12px;font-weight:700;">
                    <i data-lucide="sparkles"></i> <span>Gerar Válido</span>
                  </button>
                </div>

                <div id="renavam-result-box" style="padding:16px;border-radius:var(--radius-md);background:var(--paper-elevated,#f8fafc);border:1px solid var(--line);margin-top:14px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span id="renavam-status-badge" class="status-badge-pill green">✅ RENAVAM REGULAR & VÁLIDO</span>
                    <span style="font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace;">Algoritmo Módulo 11</span>
                  </div>
                  <div id="renavam-display-val" style="font-size:20px;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--ink);margin-bottom:4px;">
                    00632345678
                  </div>
                  <p id="renavam-msg-val" style="font-size:12px;color:var(--muted);margin:0;">
                    Dígito verificador confere com o cálculo ponderado oficial do DENATRAN.
                  </p>
                </div>
              </div>
            </div>

            <!-- PAINEL 4: CALCULADORA FLEX -->
            <div id="section-flex" class="tab-pane" style="display:none;">
              <div class="card-dashboard">
                <div style="font-size:13.5px;font-weight:700;color:var(--ink);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
                  <span style="display:flex;align-items:center;gap:7px;">
                    <i data-lucide="fuel" style="color:var(--blue);"></i>
                    <span>Calculadora Flex Inteligente (Etanol x Gasolina)</span>
                  </span>
                  <span class="status-badge-pill green">Média ANP 2026</span>
                </div>
                <p style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.45;">
                  Simule o preço dos combustíveis na bomba e verifique qual oferece melhor autonomia e economia com base no limiar calórico (70%):
                </p>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
                  <div>
                    <label style="display:block;font-size:11.5px;font-weight:700;color:var(--muted);margin-bottom:6px;">Preço Etanol (Litro)</label>
                    <input type="number" step="0.01" id="flex-etanol" value="3.85" style="width:100%;height:38px;padding:0 12px;border:1px solid var(--line);border-radius:var(--radius-sm);font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:var(--ink);background:var(--paper);outline:none;" />
                  </div>
                  <div>
                    <label style="display:block;font-size:11.5px;font-weight:700;color:var(--muted);margin-bottom:6px;">Preço Gasolina (Litro)</label>
                    <input type="number" step="0.01" id="flex-gasolina" value="5.95" style="width:100%;height:38px;padding:0 12px;border:1px solid var(--line);border-radius:var(--radius-sm);font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:var(--ink);background:var(--paper);outline:none;" />
                  </div>
                </div>

                <div id="flex-box-result" style="padding:20px;border-radius:var(--radius-md);background:radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.12), transparent 70%), var(--paper-elevated,#f8fafc);border:1px solid rgba(16, 185, 129, 0.35);text-align:center;">
                  <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#10b981;margin-bottom:4px;">
                    Combustível Mais Vantajoso
                  </div>
                  <div id="flex-best" style="font-size:26px;font-weight:800;color:var(--ink);margin-bottom:4px;">
                    🌱 ETANOL
                  </div>
                  <div id="flex-pct" style="font-size:12px;font-weight:700;color:#3b82f6;margin-bottom:8px;">
                    Paridade: 64.7% (Abaixo do teto de 70%)
                  </div>
                  <p id="flex-desc" style="font-size:12px;color:var(--muted);margin:0;line-height:1.45;">
                    Abastecer com Etanol economiza cerca de 7.6% em relação à Gasolina neste momento.
                  </p>
                </div>
              </div>
            </div>

            <!-- PAINEL 5: GRÁFICOS & TELEMETRIA VISUAL (INTEGRAÇÃO COM GRÁFICOS PRO) -->
            <div id="section-graficos" class="tab-pane" style="display:none;">
              <div class="card-dashboard">
                <div style="font-size:13.5px;font-weight:700;color:var(--ink);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
                  <span style="display:flex;align-items:center;gap:7px;">
                    <i data-lucide="gauge" style="color:var(--blue);"></i>
                    <span>Telemetria em Tempo Real (Graficos Pro Anycast)</span>
                  </span>
                  <span class="status-badge-pill blue">SVG Anycast 3ms</span>
                </div>
                <p style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.45;">
                  Indicadores visuais gerados pela nossa API de gráficos para status de circulação e paridade de abastecimento:
                </p>

                <!-- Velocímetro SVG de Rodízio e Status -->
                <div style="background:#090d16;border:1px solid #1e293b;border-radius:var(--radius-md);padding:16px;margin-bottom:16px;text-align:center;">
                  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px;">
                    Velocímetro Gauge de Circulação (Horário de Pico SP)
                  </div>
                  <svg viewBox="0 0 320 180" width="100%" height="160" style="max-width:280px;margin:0 auto;display:block;">
                    <defs>
                      <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#10b981" />
                        <stop offset="65%" stop-color="#3b82f6" />
                        <stop offset="85%" stop-color="#f59e0b" />
                        <stop offset="100%" stop-color="#ef4444" />
                      </linearGradient>
                    </defs>
                    <!-- Arco de fundo -->
                    <path d="M 30,150 A 130,130 0 0,1 290,150" fill="none" stroke="#1f2937" stroke-width="20" stroke-linecap="round" />
                    <!-- Arco gradiente -->
                    <path d="M 30,150 A 130,130 0 0,1 210,40" fill="none" stroke="url(#gaugeGrad)" stroke-width="20" stroke-linecap="round" />
                    <!-- Ponteiro -->
                    <circle cx="160" cy="150" r="10" fill="#38bdf8" />
                    <line x1="160" y1="150" x2="200" y2="60" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
                    <text x="160" y="135" fill="#f8fafc" font-size="16" font-weight="800" text-anchor="middle">LIBERADO</text>
                    <text x="160" y="170" fill="#94a3b8" font-size="11" text-anchor="middle">Fora dos horários de pico CET</text>
                  </svg>
                </div>

                <!-- Gráfico de Tendência de Depreciação e IPVA FIPE -->
                <div style="background:#090d16;border:1px solid #1e293b;border-radius:var(--radius-md);padding:16px;">
                  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px;display:flex;justify-content:space-between;">
                    <span>Curva de Valor Venal & IPVA (5 Anos)</span>
                    <span style="color:#10b981;">Alíquota SP 4.0%</span>
                  </div>
                  <svg viewBox="0 0 400 120" width="100%" height="110" style="display:block;">
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.35"/>
                        <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0"/>
                      </linearGradient>
                    </defs>
                    <path d="M 20,20 L 105,45 L 195,65 L 285,80 L 375,95 L 375,115 L 20,115 Z" fill="url(#areaGrad)" />
                    <path d="M 20,20 L 105,45 L 195,65 L 285,80 L 375,95" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" />
                    <!-- Pontos -->
                    <circle cx="20" cy="20" r="4" fill="#38bdf8" />
                    <circle cx="105" cy="45" r="4" fill="#38bdf8" />
                    <circle cx="195" cy="65" r="4" fill="#38bdf8" />
                    <circle cx="285" cy="80" r="4" fill="#38bdf8" />
                    <circle cx="375" cy="95" r="4" fill="#38bdf8" />
                    <!-- Textos -->
                    <text x="20" y="112" fill="#64748b" font-size="10">Ano 1 (R$ 90k)</text>
                    <text x="195" y="112" fill="#64748b" font-size="10" text-anchor="middle">Ano 3 (R$ 72k)</text>
                    <text x="375" y="112" fill="#64748b" font-size="10" text-anchor="end">Ano 5 (R$ 58k)</text>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Coluna 2: Terminal Console Dark Oficial da Ponte API -->
          <div class="playground-right">
            <div class="terminal-window">
              <!-- Topbar do Console no Estilo macOS -->
              <div class="terminal-topbar">
                <div class="terminal-dots">
                  <div class="terminal-dot red"></div>
                  <div class="terminal-dot yellow"></div>
                  <div class="terminal-dot green"></div>
                </div>
                <div class="snippet-lang-tabs" role="tablist">
                  <button class="snippet-tab is-active" data-lang="curl">cURL</button>
                  <button class="snippet-tab" data-lang="nodejs">Node.js</button>
                  <button class="snippet-tab" data-lang="python">Python</button>
                  <button class="snippet-tab" data-lang="php">PHP</button>
                </div>
                <button class="icon-button copy-mini" id="btn-copy-code" title="Copiar Snippet">
                  <i data-lucide="copy" style="width:13px;height:13px;"></i>
                </button>
              </div>

              <!-- Caixa de Código do Snippet -->
              <div class="snippet-code-box" style="padding:12px 16px;background:rgba(0,0,0,0.25);border-bottom:1px solid rgba(255,255,255,0.06);">
                <pre class="snippet-pre" style="margin:0;font-family:'JetBrains Mono',monospace;font-size:11.5px;color:#7dd3fc;line-height:1.45;overflow-x:auto;"><code id="snippet-code">curl -s "https://placas-pro-api.clepta2.workers.dev/api/placas/BRA2E19" \
  -H "Authorization: ******" \
  -H "x-api-key: plc_live_mercosul_2026"</code></pre>
              </div>

              <!-- Barra de Execução Sandbox -->
              <div class="playground-bar">
                <span class="method-tag get">GET</span>
                <code class="endpoint-code" id="endpoint-display">/api/placas/BRA2E19</code>
                <button class="primary-button accent test-btn" id="btn-run-sandbox" style="white-space:nowrap;">
                  <i data-lucide="play"></i> <span>Executar</span>
                </button>
              </div>

              <!-- Console de Resposta JSON -->
              <div class="playground-console" style="min-height:280px;max-height:500px;overflow-y:auto;padding:14px;">
                <div class="console-response-header" id="console-header">
                  <span class="badge-200" id="console-status">200 OK</span>
                  <span id="console-latency">Latência: 1.2ms</span>
                  <span>Cloudflare Anycast</span>
                </div>
                <pre class="console-json" id="console-output" style="margin:0;font-family:'JetBrains Mono',monospace;font-size:11px;color:#f8fafc;line-height:1.45;"></pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>

  <!-- Script da Aplicação e Integração -->
  <script type="module">
    // Tema Claro / Escuro
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('ponte.theme', next);
      });
    }

    // Navegação de Abas
    const tabBtns = document.querySelectorAll('.tab-nav-btn, .primary-nav .nav-link[data-view]');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabKey = btn.dataset.tab || btn.dataset.view;
        if (!tabKey) return;
        document.querySelectorAll('.tab-nav-btn').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tabKey));
        document.querySelectorAll('.primary-nav .nav-link[data-view]').forEach(b => b.classList.toggle('is-active', b.dataset.view === tabKey));
        document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
        const target = document.getElementById('section-' + tabKey);
        if (target) target.style.display = 'block';

        const bread = document.getElementById('breadcrumb-title');
        const titles = {
          placas: 'Placas & Mercosul',
          chassi: 'Chassi / VIN (ISO 3779)',
          renavam: 'RENAVAM (Módulo 11)',
          flex: 'Calculadora Flex ANP',
          graficos: 'Gráficos & Telemetria'
        };
        if (bread && titles[tabKey]) bread.textContent = titles[tabKey];
        updateSnippet();
      });
    });

    let currentSnippetLang = 'curl';
    document.querySelectorAll('.snippet-tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.snippet-tab').forEach(b => b.classList.remove('is-active'));
        t.classList.add('is-active');
        currentSnippetLang = t.dataset.lang;
        updateSnippet();
      });
    });

    function getActiveTab() {
      const active = document.querySelector('.tab-nav-btn.is-active');
      return active ? active.dataset.tab : 'placas';
    }

    function getEndpointInfo() {
      const tab = getActiveTab();
      if (tab === 'placas') {
        const val = (document.getElementById('placa-input').value || 'BRA2E19').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        return { ep: \`/api/placas/\${val}\`, full: \`https://placas-pro-api.clepta2.workers.dev/api/placas/\${val}\` };
      }
      if (tab === 'chassi') {
        const val = (document.getElementById('chassi-input').value || '9BWCA45Z1FP012345').trim().toUpperCase();
        return { ep: \`/api/placas/chassi/\${val}\`, full: \`https://placas-pro-api.clepta2.workers.dev/api/placas/chassi/\${val}\` };
      }
      if (tab === 'renavam') {
        const val = (document.getElementById('renavam-input').value || '00632345678').replace(/\\D/g, '');
        return { ep: \`/api/placas/renavam/\${val}\`, full: \`https://placas-pro-api.clepta2.workers.dev/api/placas/renavam/\${val}\` };
      }
      if (tab === 'flex') {
        const e = document.getElementById('flex-etanol').value || '3.85';
        const g = document.getElementById('flex-gasolina').value || '5.95';
        return { ep: \`/api/placas/flex?etanol=\${e}&gasolina=\${g}\`, full: \`https://placas-pro-api.clepta2.workers.dev/api/placas/flex?etanol=\${e}&gasolina=\${g}\` };
      }
      return { ep: '/api/placas/BRA2E19', full: 'https://placas-pro-api.clepta2.workers.dev/api/placas/BRA2E19' };
    }

    function updateSnippet() {
      const info = getEndpointInfo();
      document.getElementById('endpoint-display').textContent = info.ep;
      const codeEl = document.getElementById('snippet-code');

      if (currentSnippetLang === 'curl') {
        codeEl.textContent = \`curl -s "\${info.full}" \\\n  -H "Authorization: ******" \\\n  -H "x-api-key: plc_live_mercosul_2026"\`;
      } else if (currentSnippetLang === 'nodejs') {
        codeEl.textContent = \`const res = await fetch("\${info.full}", {\n  headers: { "Authorization": "******", "x-api-key": "plc_live_mercosul_2026" }\n});\nconst data = await res.json();\nconsole.log(data);\`;
      } else if (currentSnippetLang === 'python') {
        codeEl.textContent = \`import requests\nres = requests.get("\${info.full}", headers={"Authorization": "******", "x-api-key": "plc_live_mercosul_2026"})\nprint(res.json())\`;
      } else if (currentSnippetLang === 'php') {
        codeEl.textContent = \`$ch = curl_init("\${info.full}");\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\ncurl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: ******", "x-api-key: plc_live_mercosul_2026"]);\n$response = curl_exec($ch);\nprint_r(json_decode($response, true));\`;
      }
    }

    // Copiar Snippet
    document.getElementById('btn-copy-code').addEventListener('click', () => {
      const txt = document.getElementById('snippet-code').textContent;
      navigator.clipboard.writeText(txt).then(() => alert('Snippet copiado com sucesso!'));
    });

    // ── LÓGICA 1: PLACAS ──
    async function executarConsultaPlaca(placaInput) {
      const clean = placaInput.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      document.getElementById('placa-input').value = clean;
      updateSnippet();

      const consoleOutput = document.getElementById('console-output');
      const consoleStatus = document.getElementById('console-status');
      const consoleLat = document.getElementById('console-latency');
      consoleOutput.textContent = 'Enviando requisição para a Cloudflare Edge...';

      const t0 = performance.now();
      try {
        const res = await fetch(\`/api/placas/\${clean}\`);
        const data = await res.json();
        const lat = Math.round(performance.now() - t0);

        consoleStatus.textContent = res.ok ? '200 OK' : \`\${res.status} ERRO\`;
        consoleStatus.className = res.ok ? 'badge-200' : 'badge-500';
        consoleLat.textContent = \`Latência: \${lat}ms\`;
        consoleOutput.textContent = JSON.stringify(data, null, 2);

        // Atualiza campos visuais
        if (data.valido) {
          document.getElementById('val-padrao').innerHTML = \`<span class="status-badge-pill green">\${data.padrao}</span>\`;
          document.getElementById('val-conversao').textContent = data.formato === 'antiga' ? data.placaMercosulFormatada : (data.placaAntigaFormatada || 'Emplacamento Novo');
          document.getElementById('val-origem').textContent = \`\${data.origem.estado} (\${data.origem.uf}) — Região \${data.origem.regiao}\`;
          document.getElementById('val-licenciamento').textContent = \`\${data.licenciamento.mesVencimentoExtenso} (\${data.licenciamento.statusExercicioAtual})\`;
          document.getElementById('val-rodizio').textContent = \`\${data.rodizioSP.diaRestricao} (\${data.rodizioSP.horarios})\`;
          const lib = data.rodizioSP.circulacaoPermitidaAgora;
          document.getElementById('val-circulacao').innerHTML = lib
            ? \`<span class="status-badge-pill green">LIBERADO AGORA</span>\`
            : \`<span class="status-badge-pill red">RESTRITO NO CENTRO EXPANDIDO</span>\`;
        } else {
          document.getElementById('val-padrao').innerHTML = \`<span class="status-badge-pill red">Inválida</span>\`;
          document.getElementById('val-conversao').textContent = data.mensagem || 'Placa irregular';
          document.getElementById('val-origem').textContent = '-';
          document.getElementById('val-licenciamento').textContent = '-';
          document.getElementById('val-rodizio').textContent = '-';
          document.getElementById('val-circulacao').textContent = '-';
        }

        // Renderiza SVG
        const resSvg = await fetch(\`/api/placas/\${clean}/svg\`);
        if (resSvg.ok) {
          const svgTxt = await resSvg.text();
          document.getElementById('plate-svg-box').innerHTML = svgTxt;
        }
      } catch (err) {
        consoleOutput.textContent = \`Erro: \${err.message}\`;
      }
    }

    document.getElementById('btn-exec-placa').addEventListener('click', () => {
      executarConsultaPlaca(document.getElementById('placa-input').value);
    });
    document.getElementById('placa-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') executarConsultaPlaca(e.target.value);
    });

    document.querySelectorAll('.sample-placa').forEach(btn => {
      btn.addEventListener('click', () => {
        executarConsultaPlaca(btn.dataset.plate);
      });
    });

    document.getElementById('btn-gerar-placa').addEventListener('click', async () => {
      const res = await fetch('/api/placas/gerador');
      const data = await res.json();
      if (data.placaGerada) {
        executarConsultaPlaca(data.placaGerada);
      }
    });

    // ── LÓGICA 2: CHASSI ──
    async function executarConsultaChassi(chassiInput) {
      const clean = chassiInput.trim().toUpperCase();
      document.getElementById('chassi-input').value = clean;
      updateSnippet();

      const consoleOutput = document.getElementById('console-output');
      const consoleStatus = document.getElementById('console-status');
      const consoleLat = document.getElementById('console-latency');
      consoleOutput.textContent = 'Decodificando chassi na borda...';

      const t0 = performance.now();
      try {
        const res = await fetch(\`/api/placas/chassi/\${clean}\`);
        const data = await res.json();
        const lat = Math.round(performance.now() - t0);

        consoleStatus.textContent = res.ok ? '200 OK' : \`\${res.status} ERRO\`;
        consoleStatus.className = res.ok ? 'badge-200' : 'badge-500';
        consoleLat.textContent = \`Latência: \${lat}ms\`;
        consoleOutput.textContent = JSON.stringify(data, null, 2);

        if (data.valido) {
          document.getElementById('val-chassi-wmi').textContent = \`\${data.fabricante} (\${data.wmi})\`;
          document.getElementById('val-chassi-pais').textContent = \`\${data.paisFabricacao} (\${data.origem})\`;
          document.getElementById('val-chassi-ano').textContent = data.anoModelo;
          document.getElementById('val-chassi-check').innerHTML = data.checkDigitValido
            ? \`<span class="status-badge-pill green">Válido (\${data.checkDigitCalculado})</span>\`
            : \`<span class="status-badge-pill red">Informado: \${data.checkDigitInformado} (Esperado: \${data.checkDigitCalculado})</span>\`;
          document.getElementById('val-chassi-serie').textContent = \`Planta \${data.plantaMontagem} · Série \${data.numeroSerie}\`;
        } else {
          document.getElementById('val-chassi-wmi').innerHTML = \`<span class="status-badge-pill red">Inválido</span>\`;
          document.getElementById('val-chassi-pais').textContent = data.mensagem;
          document.getElementById('val-chassi-ano').textContent = '-';
          document.getElementById('val-chassi-check').textContent = '-';
          document.getElementById('val-chassi-serie').textContent = '-';
        }
      } catch (err) {
        consoleOutput.textContent = \`Erro: \${err.message}\`;
      }
    }

    document.getElementById('btn-exec-chassi').addEventListener('click', () => {
      executarConsultaChassi(document.getElementById('chassi-input').value);
    });
    document.querySelectorAll('.sample-chassi').forEach(btn => {
      btn.addEventListener('click', () => {
        executarConsultaChassi(btn.dataset.vin);
      });
    });

    // ── LÓGICA 3: RENAVAM ──
    async function executarValidacaoRenavam(renavamInput) {
      const clean = renavamInput.replace(/\\D/g, '');
      document.getElementById('renavam-input').value = clean;
      updateSnippet();

      const consoleOutput = document.getElementById('console-output');
      const consoleStatus = document.getElementById('console-status');
      const consoleLat = document.getElementById('console-latency');
      consoleOutput.textContent = 'Validando RENAVAM...';

      const t0 = performance.now();
      try {
        const res = await fetch(\`/api/placas/renavam/\${clean}\`);
        const data = await res.json();
        const lat = Math.round(performance.now() - t0);

        consoleStatus.textContent = res.ok ? '200 OK' : \`\${res.status} ERRO\`;
        consoleStatus.className = res.ok ? 'badge-200' : 'badge-500';
        consoleLat.textContent = \`Latência: \${lat}ms\`;
        consoleOutput.textContent = JSON.stringify(data, null, 2);

        const badge = document.getElementById('renavam-status-badge');
        const disp = document.getElementById('renavam-display-val');
        const msg = document.getElementById('renavam-msg-val');

        disp.textContent = data.renavamFormatado || clean;
        msg.textContent = data.mensagem;

        if (data.valido) {
          badge.className = 'status-badge-pill green';
          badge.textContent = '✅ RENAVAM REGULAR & VÁLIDO';
        } else {
          badge.className = 'status-badge-pill red';
          badge.textContent = '❌ RENAVAM INVÁLIDO';
        }
      } catch (err) {
        consoleOutput.textContent = \`Erro: \${err.message}\`;
      }
    }

    document.getElementById('btn-exec-renavam').addEventListener('click', () => {
      executarValidacaoRenavam(document.getElementById('renavam-input').value);
    });

    document.getElementById('btn-gerar-renavam').addEventListener('click', async () => {
      const res = await fetch('/api/placas/gerador');
      const data = await res.json();
      if (data.renavamGerado) {
        executarValidacaoRenavam(data.renavamGerado);
      }
    });

    // ── LÓGICA 4: FLEX ──
    async function executarCalculoFlex() {
      const e = document.getElementById('flex-etanol').value || '3.85';
      const g = document.getElementById('flex-gasolina').value || '5.95';
      updateSnippet();

      const consoleOutput = document.getElementById('console-output');
      const consoleStatus = document.getElementById('console-status');
      const consoleLat = document.getElementById('console-latency');

      const t0 = performance.now();
      try {
        const res = await fetch(\`/api/placas/flex?etanol=\${e}&gasolina=\${g}\`);
        const data = await res.json();
        const lat = Math.round(performance.now() - t0);

        consoleStatus.textContent = res.ok ? '200 OK' : \`\${res.status} ERRO\`;
        consoleStatus.className = res.ok ? 'badge-200' : 'badge-500';
        consoleLat.textContent = \`Latência: \${lat}ms\`;
        consoleOutput.textContent = JSON.stringify(data, null, 2);

        const box = document.getElementById('flex-box-result');
        const best = document.getElementById('flex-best');
        const pct = document.getElementById('flex-pct');
        const desc = document.getElementById('flex-desc');

        if (data.combustivelVantajoso === 'ETANOL') {
          box.style.borderColor = 'rgba(16, 185, 129, 0.35)';
          best.innerHTML = '🌱 ETANOL';
          best.style.color = '#10b981';
        } else {
          box.style.borderColor = 'rgba(245, 158, 11, 0.35)';
          best.innerHTML = '⛽ GASOLINA';
          best.style.color = '#f59e0b';
        }
        pct.textContent = \`Paridade: \${data.paridadePercentual} (Limiar técnico: \${data.limiarAdotado})\`;
        desc.textContent = data.parecerTecnico;
      } catch (err) {
        consoleOutput.textContent = \`Erro: \${err.message}\`;
      }
    }

    document.getElementById('flex-etanol').addEventListener('input', executarCalculoFlex);
    document.getElementById('flex-gasolina').addEventListener('input', executarCalculoFlex);

    // Botão Executar Sandbox
    document.getElementById('btn-run-sandbox').addEventListener('click', () => {
      const tab = getActiveTab();
      if (tab === 'placas') executarConsultaPlaca(document.getElementById('placa-input').value);
      else if (tab === 'chassi') executarConsultaChassi(document.getElementById('chassi-input').value);
      else if (tab === 'renavam') executarValidacaoRenavam(document.getElementById('renavam-input').value);
      else if (tab === 'flex') executarCalculoFlex();
    });

    // Inicia com ícones e consulta inicial
    if (window.lucide) window.lucide.createIcons();
    setTimeout(() => {
      if (window.lucide) window.lucide.createIcons();
      executarConsultaPlaca('BRA2E19');
    }, 100);
  </script>
</body>
</html>
`;

fs.writeFileSync('index.html', html, 'utf8');
console.log('index.html re-written with marketplace design system successfully!');
