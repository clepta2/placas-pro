import fs from 'fs';
import { MONTADORAS_BRASIL, FAMILIAS_VEICULOS_BRASIL } from './catalogo-veiculos-brasil.js';

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
  <link rel="stylesheet" href="styles.css?v=4.0.0" />
  <script>
    (function() {
      const savedTheme = localStorage.getItem('ponte.theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', savedTheme);
    })();
  </script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    /* Padrão Rigoroso de Ícones e Tipografia Profissional */
    svg.lucide, .lucide {
      width: 18px !important;
      height: 18px !important;
      stroke-width: 2 !important;
      display: inline-block;
      vertical-align: middle;
    }
    .nav-link svg, .nav-link .lucide {
      width: 18px !important;
      height: 18px !important;
    }
    .brand-mark svg {
      width: 22px !important;
      height: 22px !important;
    }
    .playground-split {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
      gap: 26px;
      margin-top: 24px;
    }
    @media (max-width: 1100px) {
      .playground-split { grid-template-columns: 1fr; }
    }
    .plate-render-frame {
      background: radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.12), transparent 70%), var(--paper);
      border: 1px solid var(--line);
      border-radius: var(--radius-xl);
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-bottom: 22px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.12);
    }
    .plate-render-svg-wrap {
      max-width: 520px;
      width: 100%;
      filter: drop-shadow(0 16px 32px rgba(0,0,0,0.30));
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .plate-render-svg-wrap:hover {
      transform: scale(1.02);
    }
    .specs-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .specs-table tr {
      border-bottom: 1px solid var(--line-light);
    }
    .specs-table td {
      padding: 12px 16px;
      vertical-align: middle;
    }
    .specs-table td.label-col {
      color: var(--muted);
      font-weight: 600;
      width: 42%;
      font-size: 11.5px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .specs-table td.val-col {
      color: var(--ink);
      font-weight: 700;
      text-align: right;
    }
    .tab-nav-bar {
      display: flex;
      gap: 8px;
      background: var(--paper-elevated, #f1f5f2);
      padding: 6px;
      border-radius: var(--radius-lg);
      border: 1px solid var(--line);
      margin-bottom: 24px;
      overflow-x: auto;
    }
    :root[data-theme="dark"] .tab-nav-bar {
      background: #0d1527;
      border-color: #1e293b;
    }
    .tab-nav-btn {
      flex: 1;
      min-height: 40px;
      padding: 0 18px;
      border: none;
      background: transparent;
      border-radius: var(--radius-md);
      font-size: 12.5px;
      font-weight: 600;
      color: var(--muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      white-space: nowrap;
      transition: all 0.16s ease;
    }
    .tab-nav-btn:hover {
      color: var(--ink);
      background: rgba(255, 255, 255, 0.05);
    }
    .tab-nav-btn.is-active {
      background: var(--paper);
      color: var(--ink);
      font-weight: 800;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    :root[data-theme="dark"] .tab-nav-btn.is-active {
      background: #1e293b;
      color: #fff;
    }
    .status-badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 11px;
      border-radius: var(--radius-full);
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .status-badge-pill.green {
      background: rgba(16, 185, 129, 0.12);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .status-badge-pill.red {
      background: rgba(239, 68, 68, 0.12);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    .status-badge-pill.blue {
      background: rgba(59, 130, 246, 0.12);
      color: #3b82f6;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    .terminal-window {
      background: #091311;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: var(--radius-xl);
      overflow: hidden;
      box-shadow: var(--shadow-xl);
      display: flex;
      flex-direction: column;
    }
    .terminal-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 18px;
      background: rgba(255, 255, 255, 0.04);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .terminal-dots {
      display: flex;
      gap: 7px;
    }
    .terminal-dot {
      width: 11px;
      height: 11px;
      border-radius: 50%;
    }
    .terminal-dot.red { background: #ef4444; }
    .terminal-dot.yellow { background: #f59e0b; }
    .terminal-dot.green { background: #10b981; }
    .card-dashboard {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: var(--radius-xl);
      padding: 24px;
      box-shadow: var(--shadow-sm);
    }
    .cat-btn {
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      border: 1px solid var(--line);
      background: var(--paper);
      color: var(--muted);
      transition: all 0.15s ease;
    }
    .cat-btn.active {
      border-color: #3b82f6;
      background: #1e3a8a;
      color: #93c5fd;
    }
    .brand-logo-frame {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: var(--paper);
      border: 1px solid var(--line);
      display: grid;
      place-items: center;
      padding: 8px;
      box-shadow: var(--shadow-xs);
    }
    .brand-logo-frame img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    /* Terminal Console: contraste garantido em qualquer tema */
    .console-json, #console-output {
      color: #f8fafc !important;
      font-family: 'JetBrains Mono', monospace !important;
    }

    /* Compactação de Pílulas e Chips para evitar botões gigantes */
    .sample-placa, .sample-chassi, .sample-renavam, .sample-boleto, .cat-btn, #btn-mode-mercosul, #btn-mode-antiga {
      min-height: 28px !important;
      height: 28px !important;
      padding: 0 10px !important;
      font-size: 11px !important;
      border-radius: 6px !important;
    }

    html, body {
      overflow-x: hidden !important;
      max-width: 100vw !important;
    }

    /* ── Otimizações Responsivas Mobile & Telas Estreitas (<850px) ── */
    @media (max-width: 850px) {
      html, body, .app-shell, .main-area, .content-wrap {
        overflow-x: hidden !important;
        width: 100% !important;
        max-width: 100vw !important;
        box-sizing: border-box !important;
      }
      .app-shell {
        grid-template-columns: 1fr !important;
      }
      /* Sidebar mobile drawer */
      .sidebar {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        bottom: 0 !important;
        width: 285px !important;
        max-width: 85vw !important;
        z-index: 100 !important;
        transform: translateX(-100%);
        transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
        display: flex !important;
      }
      .sidebar.is-open {
        transform: translateX(0) !important;
      }
      .topbar {
        height: auto !important;
        min-height: 48px !important;
        padding: 6px 12px !important;
        gap: 6px !important;
      }
      .breadcrumb {
        font-size: 11px !important;
      }
      .breadcrumb span:not(:last-child), .breadcrumb a {
        display: none !important;
      }
      .environment {
        display: none !important;
      }
      .topbar-actions {
        margin-left: auto !important;
        gap: 6px !important;
      }
      .primary-button.accent {
        height: 32px !important;
        min-height: 32px !important;
        padding: 0 10px !important;
        font-size: 11px !important;
      }
      .theme-toggle-btn {
        width: 32px !important;
        height: 32px !important;
      }
      .content-wrap {
        padding: 12px 12px 36px !important;
      }
      .page-heading {
        margin-bottom: 12px !important;
      }
      .page-heading h1 {
        font-size: 1.25rem !important;
        line-height: 1.25 !important;
        margin-bottom: 4px !important;
      }
      .page-heading .eyebrow {
        font-size: 9.5px !important;
        margin-bottom: 2px !important;
      }
      .page-subtitle {
        font-size: 11.5px !important;
        line-height: 1.4 !important;
        margin-bottom: 10px !important;
      }
      .billing-models-grid {
        display: flex !important;
        overflow-x: auto !important;
        scrollbar-width: none !important;
        -webkit-overflow-scrolling: touch !important;
        gap: 6px !important;
        margin-bottom: 12px !important;
        padding-bottom: 2px !important;
      }
      .billing-models-grid::-webkit-scrollbar {
        display: none !important;
      }
      .model-card {
        flex: 1 0 auto !important;
        padding: 6px 10px !important;
        border-radius: var(--radius-md) !important;
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
      }
      .model-card .model-badge {
        font-size: 9px !important;
        padding: 2px 5px !important;
        margin-bottom: 0 !important;
        white-space: nowrap !important;
      }
      .model-card div[style*="font-size:20px"] {
        font-size: 11.5px !important;
        font-weight: 700 !important;
        margin-bottom: 0 !important;
        white-space: nowrap !important;
      }
      .model-card p {
        display: none !important;
      }
      .tab-nav-bar {
        display: flex !important;
        flex-wrap: nowrap !important;
        overflow-x: auto !important;
        scrollbar-width: none !important;
        -webkit-overflow-scrolling: touch !important;
        gap: 6px !important;
        padding: 4px !important;
        margin-bottom: 14px !important;
        border-radius: var(--radius-lg) !important;
      }
      .tab-nav-bar::-webkit-scrollbar {
        display: none !important;
      }
      .tab-nav-btn {
        flex: 0 0 auto !important;
        height: 32px !important;
        min-height: 32px !important;
        padding: 0 12px !important;
        font-size: 11.5px !important;
        white-space: nowrap !important;
        border-radius: var(--radius-md) !important;
        gap: 5px !important;
        text-align: center !important;
      }
      .tab-nav-btn svg, .tab-nav-btn .lucide {
        width: 14px !important;
        height: 14px !important;
      }
      .card-dashboard {
        padding: 12px !important;
        border-radius: var(--radius-lg) !important;
      }
      .card-dashboard div[style*="font-size:14px"] {
        font-size: 12.5px !important;
      }
      .card-dashboard p[style*="font-size:12.5px"] {
        font-size: 11px !important;
        margin-bottom: 10px !important;
      }
      input[type="text"], input[type="number"], select {
        height: 36px !important;
        min-height: 36px !important;
        font-size: 12.5px !important;
        padding: 0 10px !important;
      }
      .primary-button, .secondary-button, #btn-exec-placa, #btn-gerar-placa, #btn-exec-chassi, #btn-exec-renavam {
        height: 36px !important;
        min-height: 36px !important;
        padding: 0 12px !important;
        font-size: 11.5px !important;
      }
      .sample-placa, .sample-chassi, .sample-renavam, .sample-boleto, .cat-btn, #btn-mode-mercosul, #btn-mode-antiga {
        min-height: 26px !important;
        height: 26px !important;
        padding: 0 7px !important;
        font-size: 10.5px !important;
      }
      .plate-render-frame {
        padding: 10px 6px !important;
        margin-bottom: 12px !important;
        width: 100% !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
      }
      .plate-render-svg-wrap {
        max-width: 100% !important;
        width: 100% !important;
      }
      .playground-split {
        margin-top: 12px !important;
        gap: 12px !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }
      .playground-left, .playground-right {
        width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
        overflow-x: hidden !important;
      }
      .specs-table td {
        padding: 7px 9px !important;
        font-size: 11px !important;
      }
      .specs-table td.label-col {
        font-size: 10px !important;
        width: 38% !important;
      }
      .terminal-window {
        border-radius: var(--radius-lg) !important;
        background: #091311 !important;
      }
      .terminal-topbar {
        padding: 7px 10px !important;
      }
      .snippet-tab {
        padding: 2px 6px !important;
        font-size: 10px !important;
      }
      .terminal-body {
        padding: 8px 10px !important;
        font-size: 11px !important;
      }
      .playground-console {
        padding: 12px !important;
        min-height: 200px !important;
        max-height: 380px !important;
      }
      .console-json, #console-output {
        color: #f8fafc !important;
        font-size: 11px !important;
      }
    }
  </style>
</head>
<body>
  <div class="sidebar-drawer-backdrop" id="sidebar-drawer-backdrop" hidden></div>
  <div class="app-shell">
    <!-- Sidebar Oficial do Ecossistema Ponte / OZPro -->
    <aside class="sidebar" aria-label="Navegação principal">
      <button class="sidebar-drawer-close" id="sidebar-drawer-close" aria-label="Fechar menu lateral"><i data-lucide="x"></i></button>
      <a class="brand" href="#playground" aria-label="Ponte API, Placas Pro">
        <img src="brand/ozpro-mark.svg" alt="Ponte API Logo" style="width:38px;height:38px;border-radius:10px;object-fit:contain;background:var(--mint);padding:4px;box-shadow:0 4px 12px rgba(163,230,53,0.35);" />
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
        <button class="nav-link" data-view="catalogo">
          <i data-lucide="layers"></i> <span>Catálogo Nacional FIPE</span>
        </button>

        <div class="nav-section-label">ECOSSISTEMA PONTE</div>
        <a class="nav-link" href="https://ponte-marketplace.maputo2.workers.dev" target="_blank" rel="noopener">
          <i data-lucide="layout-grid"></i> <span>API Marketplace</span>
          <span class="nav-ext"><i data-lucide="arrow-up-right"></i></span>
        </a>
        <a class="nav-link" href="https://github.com/clepta2/placas-pro" target="_blank" rel="noopener">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>
          <span>GitHub do Projeto</span>
          <span class="nav-ext"><i data-lucide="arrow-up-right"></i></span>
        </a>
      </nav>

      <div class="sidebar-bottom">
        <div class="status-row">
          <span class="status-dot connected"></span>
          <span>Cloudflare Edge · &lt;2ms</span>
        </div>
        <div class="profile-row">
          <div class="avatar lg">PP</div>
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
        <button class="mobile-hamburger-btn" id="mobile-hamburger-btn" aria-label="Abrir menu lateral"><i data-lucide="menu"></i></button>
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
          <a href="https://ponte-marketplace.maputo2.workers.dev" target="_blank" rel="noopener" class="primary-button accent" style="text-decoration:none;display:inline-flex;align-items:center;gap:7px;font-size:12.5px;padding:0 16px;height:36px;">
            <i data-lucide="sparkles"></i> <span>Catálogo Completo</span>
          </a>
        </div>
      </header>

      <!-- Conteúdo da Página -->
      <div class="content-wrap">
        <div class="page-heading">
          <div>
            <p class="eyebrow">TELEMETRIA, GRÁFICOS & CONFORMIDADE VEICULAR</p>
            <h1>Placas & Veículos Pro • Console Oficial Anycast</h1>
            <p class="page-subtitle">
              Validação matemática e conversão bidirecional Mercosul & Cinza, mapeamento das 27 UFs do CONTRAN, auditoria de RENAVAM Módulo 11, decodificador Chassi VIN ISO 3779 e renderizador vetorial SVG nativo.
            </p>
          </div>
        </div>

        <!-- Cards de Destaque / Métricas -->
        <div class="billing-models-grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); margin-bottom: 26px;">
          <div class="model-card credit-card" style="padding:18px 22px;">
            <div class="model-card-header" style="margin-bottom:10px;">
              <span class="model-badge credit"><i data-lucide="map-pin"></i> 27 UFS CONTRAN</span>
            </div>
            <div style="font-size:20px;font-weight:800;color:var(--ink);margin-bottom:4px;">Faixas Estaduais</div>
            <p style="font-size:12.5px;color:var(--muted);margin:0;line-height:1.45;">Identifica o Estado de emplacamento original através do prefixo alfanumérico oficial.</p>
          </div>

          <div class="model-card subscription-card" style="padding:18px 22px;">
            <div class="model-card-header" style="margin-bottom:10px;">
              <span class="model-badge sub"><i data-lucide="shield-check"></i> ZERO REGEX</span>
            </div>
            <div style="font-size:20px;font-weight:800;color:var(--ink);margin-bottom:4px;">Blindagem Numérica</div>
            <p style="font-size:12.5px;color:var(--muted);margin:0;line-height:1.45;">Validação determinística pura, imune a ataques de ReDoS e bypasses de formatação.</p>
          </div>

          <div class="model-card tier-card" style="padding:18px 22px;">
            <div class="model-card-header" style="margin-bottom:10px;">
              <span class="model-badge tier"><i data-lucide="zap"></i> SUB-2MS LATENCY</span>
            </div>
            <div style="font-size:20px;font-weight:800;color:var(--ink);margin-bottom:4px;">Entrega Anycast</div>
            <p style="font-size:12.5px;color:var(--muted);margin:0;line-height:1.45;">Processado diretamente na memória RAM da Cloudflare em 330+ data centers globais.</p>
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
          <button class="tab-nav-btn" data-tab="catalogo">
            <i data-lucide="layers"></i> <span>Catálogo Nacional FIPE</span>
          </button>
        </div>

        <!-- PLAYGROUND OFICIAL DA PONTE API (SPLIT-SCREEN DE 2 COLUNAS) -->
        <div class="playground-split">
          <!-- Coluna 1: Formulário e Painel de Resultados Visuais -->
          <div class="playground-left">
            <!-- PAINEL 1: PLACAS -->
            <div id="section-placas" class="tab-pane">
              <div class="card-dashboard">
                <div style="font-size:14px;font-weight:700;color:var(--ink);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
                  <span style="display:flex;align-items:center;gap:8px;">
                    <i data-lucide="search" style="color:var(--blue);"></i>
                    <span>Consultar Placa Nacional ou Mercosul</span>
                  </span>
                  <span class="status-badge-pill blue">CONTRAN Oficial</span>
                </div>
                <p style="font-size:12.5px;color:var(--muted);margin-bottom:16px;line-height:1.5;">
                  Digite uma placa no padrão Mercosul (ex: <code>BRA2E19</code>) ou antiga cinza (ex: <code>ABC-1234</code>):
                </p>

                <!-- Input e Botões -->
                <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
                  <input type="text" id="placa-input" value="BRA2E19" placeholder="Ex: BRA2E19 ou ABC-1234..." maxlength="8" style="flex:2;min-width:180px;height:44px;padding:0 14px;border:1px solid var(--line);border-radius:var(--radius-md);font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:var(--ink);background:var(--paper);outline:none;" />
                  <button id="btn-exec-placa" class="primary-button accent" style="height:44px;padding:0 18px;font-size:13px;font-weight:700;display:inline-flex;align-items:center;gap:7px;">
                    <i data-lucide="play"></i> <span>Consultar</span>
                  </button>
                  <button id="btn-gerar-placa" class="secondary-button" style="height:44px;padding:0 16px;font-size:12.5px;font-weight:700;display:inline-flex;align-items:center;gap:7px;">
                    <i data-lucide="sparkles"></i> <span>Gerar Válida</span>
                  </button>
                </div>

                <!-- Presets Rápidos com Ícones Padronizados (Zero Emojis) -->
                <div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center;font-size:11.5px;margin-bottom:16px;">
                  <span style="color:var(--muted);font-weight:600;">Presets de teste:</span>
                  <button class="secondary-button sample-placa" data-plate="BRA2E19" style="padding:4px 10px;font-size:11.5px;display:inline-flex;align-items:center;gap:5px;">
                    <i data-lucide="car"></i> <span>BRA2E19 (SP)</span>
                  </button>
                  <button class="secondary-button sample-placa" data-plate="ABC12C4" style="padding:4px 10px;font-size:11.5px;display:inline-flex;align-items:center;gap:5px;">
                    <i data-lucide="bike"></i> <span>ABC12C4 (PR Moto)</span>
                  </button>
                  <button class="secondary-button sample-placa" data-plate="EZK-5520" style="padding:4px 10px;font-size:11.5px;display:inline-flex;align-items:center;gap:5px;">
                    <i data-lucide="car"></i> <span>EZK-5520 (SP Cinza)</span>
                  </button>
                  <button class="secondary-button sample-placa" data-plate="RIO-2016" style="padding:4px 10px;font-size:11.5px;display:inline-flex;align-items:center;gap:5px;">
                    <i data-lucide="map-pin"></i> <span>RIO-2016 (RJ)</span>
                  </button>
                </div>

                <!-- Seletor de Estilo & Categoria da Placa -->
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:14px;padding:0 2px;">
                  <div style="display:flex;gap:6px;align-items:center;">
                    <span style="font-size:11.5px;font-weight:700;color:var(--muted);">Estilo:</span>
                    <button id="btn-mode-mercosul" class="secondary-button" style="padding:3px 9px;font-size:11px;font-weight:700;border-color:var(--blue);color:var(--blue);">Mercosul</button>
                    <button id="btn-mode-antiga" class="secondary-button" style="padding:3px 9px;font-size:11px;font-weight:700;">Cinza Clássica</button>
                  </div>
                  <div id="categoria-selector" style="display:flex;gap:5px;align-items:center;">
                    <span style="font-size:11px;font-weight:700;color:var(--muted);">Categoria:</span>
                    <button class="secondary-button cat-btn" data-cat="particular" style="padding:3px 8px;font-size:10.5px;font-weight:700;border-color:var(--blue);color:var(--blue);">Particular</button>
                    <button class="secondary-button cat-btn" data-cat="comercial" style="padding:3px 8px;font-size:10.5px;font-weight:700;color:#ef4444;">Comercial</button>
                    <button class="secondary-button cat-btn" data-cat="colecao" style="padding:3px 8px;font-size:10.5px;font-weight:700;">Colecionador</button>
                    <button class="secondary-button cat-btn" data-cat="oficial" style="padding:3px 8px;font-size:10.5px;font-weight:700;color:#3b82f6;">Oficial</button>
                  </div>
                </div>

                <!-- Renderizador Gráfico da Placa SVG em Alta Resolução (520px) -->
                <div class="plate-render-frame">
                  <div id="plate-svg-box" class="plate-render-svg-wrap">
                    <!-- SVG renderizado dinamicamente -->
                  </div>
                </div>

                <!-- Card Oficial do Veículo (Foto Realista em Alta Resolução, FIPE, Galeria & Dados) -->
                <div id="veiculo-card" style="border:1px solid var(--line);border-radius:var(--radius-lg);overflow:hidden;background:var(--paper);margin-bottom:18px;box-shadow:var(--shadow-sm);transition:all 0.2s ease;">
                  <div style="position:relative;width:100%;height:230px;overflow:hidden;background:#090d16;">
                    <img id="veiculo-foto-img" src="https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=800&q=80" alt="Foto Oficial do Veículo" style="width:100%;height:100%;object-fit:cover;object-position:center;transition:transform 0.3s ease;" />
                    
                    <!-- Badge da Montadora e Categoria -->
                    <div style="position:absolute;top:12px;left:12px;display:flex;gap:6px;align-items:center;">
                      <div style="display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:var(--radius-full);background:rgba(9,13,22,0.85);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.15);color:#fff;font-size:11px;font-weight:700;">
                        <img id="veiculo-montadora-logo" src="https://icons-pro-api.maputo2.workers.dev/api/icons/toyota.svg" alt="Logo" style="width:16px;height:16px;object-fit:contain;" />
                        <span id="veiculo-marca-nome">Toyota</span>
                      </div>
                      <span id="veiculo-segmento-badge" class="status-badge-pill blue" style="background:rgba(59,130,246,0.9);color:#fff;font-size:10.5px;border:none;">Sedan Médio</span>
                    </div>

                    <!-- Badge de Preço FIPE -->
                    <div style="position:absolute;bottom:12px;right:12px;padding:6px 12px;border-radius:8px;background:rgba(9,13,22,0.9);backdrop-filter:blur(10px);border:1px solid rgba(16,185,129,0.4);text-align:right;">
                      <div style="font-size:9.5px;font-weight:700;color:#cbd5e1;text-transform:uppercase;letter-spacing:0.8px;">Tabela FIPE Oficial</div>
                      <div id="veiculo-fipe-valor" style="font-size:15px;font-weight:900;color:#10b981;font-family:'JetBrains Mono',monospace;">R$ 142.900,00</div>
                    </div>
                  </div>

                  <!-- Galeria de Fotos Multi-Ângulo (Estúdio Automotivo) -->
                  <div id="veiculo-galeria-container" style="display:flex;gap:8px;padding:8px 14px;background:var(--paper-elevated,#111827);border-bottom:1px solid var(--line);overflow-x:auto;">
                    <!-- Thumbs gerados dinamicamente via JS -->
                  </div>

                  <!-- Ficha Rápida do Veículo -->
                  <div style="padding:14px 16px;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px;">
                      <div>
                        <h3 id="veiculo-nome-completo" style="margin:0 0 4px;font-size:16px;font-weight:800;color:var(--ink);">
                          Toyota Corolla Altis Hybrid 1.8 Flex
                        </h3>
                        <p id="veiculo-versao-sub" style="margin:0;font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                          <span>Ano Fabricação / Modelo: <strong id="veiculo-ano-modelo" style="color:var(--ink);">2022 / 2023</strong></span>
                          <span>&bull;</span>
                          <span style="display:inline-flex;align-items:center;gap:4px;">
                            <span id="veiculo-cor-swatch" style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#94a3b8;border:1px solid rgba(255,255,255,0.4);"></span>
                            Cor: <strong id="veiculo-cor" style="color:var(--ink);">Prata Metálico</strong>
                          </span>
                        </p>
                      </div>
                    </div>

                    <!-- Tags Técnicas do Veículo -->
                    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid var(--line-light);">
                      <span class="category-pill blue" id="veiculo-combustivel-tag">Híbrido / Flex</span>
                      <span class="category-pill" id="veiculo-potencia-tag">122 cv</span>
                      <span class="category-pill" id="veiculo-motor-tag">1.8 16V</span>
                      <span class="category-pill" id="veiculo-procedencia-tag">Nacional (SP)</span>
                    </div>

                    <!-- Bloco de Eficiência e Consumo Real Inmetro (PBEV) -->
                    <div style="margin-top:12px;padding:12px;border-radius:var(--radius-md);background:var(--paper-elevated,#111827);border:1px solid var(--line);">
                      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
                        <span><i data-lucide="gauge" style="width:13px;height:13px;vertical-align:middle;margin-right:4px;"></i> Consumo Real Homologado (Inmetro PBEV)</span>
                        <span class="status-badge-pill green" id="veiculo-selo-conpet" style="font-size:10px;padding:2px 8px;">Selo Conpet A</span>
                      </div>
                      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11.5px;">
                        <div>⛽ <strong>Gasolina:</strong> <span id="veiculo-consumo-gasolina" style="color:var(--ink);">15,4 km/l (urb) • 17,8 km/l (rod)</span></div>
                        <div>🌱 <strong>Etanol:</strong> <span id="veiculo-consumo-etanol" style="color:var(--ink);">10,8 km/l (urb) • 12,9 km/l (rod)</span></div>
                      </div>
                    </div>

                    <!-- Bloco de Custos Anuais & IPVA Parcelado DETRAN -->
                    <div style="margin-top:10px;padding:12px;border-radius:var(--radius-md);background:var(--paper-elevated,#111827);border:1px solid var(--line);">
                      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
                        <span><i data-lucide="receipt" style="width:13px;height:13px;vertical-align:middle;margin-right:4px;"></i> Custos Anuais de Regularização (<span id="veiculo-uf-custo">SP</span>)</span>
                        <span style="font-size:11px;color:#10b981;font-weight:800;" id="veiculo-custo-total">R$ 5.931,22</span>
                      </div>
                      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;color:var(--muted);">
                        <div>IPVA Integral: <strong id="veiculo-ipva-val" style="color:var(--ink);">R$ 5.716,00</strong></div>
                        <div>Cota Única (3% desc): <strong id="veiculo-cota-desc" style="color:#10b981;">R$ 5.544,52</strong></div>
                        <div>Taxa Licenciamento: <strong id="veiculo-taxa-lic" style="color:var(--ink);">R$ 160,22</strong></div>
                        <div>Parcelamento Oficial: <strong id="veiculo-parcelas" style="color:var(--ink);">5x de R$ 1.143,20</strong></div>
                      </div>
                    </div>

                    <!-- Status de Gravame & Restrições Financeiras -->
                    <div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:var(--radius-sm);background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);font-size:11px;">
                      <span style="display:flex;align-items:center;gap:6px;color:#10b981;font-weight:700;">
                        <i data-lucide="shield-check" style="width:14px;height:14px;"></i>
                        <span id="veiculo-gravame-status">Sem Restrição Financeira (Desalienado)</span>
                      </span>
                      <span style="color:var(--muted);font-size:10.5px;" id="veiculo-proprietario-tipo">Pessoa Física</span>
                    </div>

                    <!-- Silhueta Vetorial na Cor Real do Documento -->
                    <div style="margin-top:12px;border-top:1px solid var(--line-light);padding-top:10px;">
                      <div style="font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">
                        Silhueta Vetorial Técnica com Pintura Homologada
                      </div>
                      <div id="veiculo-silhueta-svg-container" style="background:var(--paper-elevated,#111827);border-radius:var(--radius-md);padding:8px;border:1px solid var(--line);display:flex;justify-content:center;">
                        <!-- SVG gerado dinamicamente -->
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Tabela de Especificações do Veículo -->
                <div style="border:1px solid var(--line);border-radius:var(--radius-lg);overflow:hidden;background:var(--paper);">
                  <div style="padding:12px 16px;background:var(--paper-elevated,#162032);border-bottom:1px solid var(--line);font-size:13px;font-weight:700;color:var(--ink);display:flex;align-items:center;gap:7px;">
                    <i data-lucide="clipboard-list"></i>
                    <span>Raio-X & Telemetria Cadastral</span>
                  </div>
                  <table class="specs-table">
                    <tbody>
                      <tr>
                        <td class="label-col">Veículo & Modelo</td>
                        <td class="val-col" id="val-veiculo-nome" style="font-weight:800;color:var(--ink);">Toyota Corolla Altis Hybrid</td>
                      </tr>
                      <tr>
                        <td class="label-col">Ano / Modelo</td>
                        <td class="val-col" id="val-veiculo-ano">2022 / 2023</td>
                      </tr>
                      <tr>
                        <td class="label-col">Cor Cadastrada</td>
                        <td class="val-col" id="val-veiculo-cor">Prata Metálico</td>
                      </tr>
                      <tr>
                        <td class="label-col">Avaliação FIPE</td>
                        <td class="val-col" id="val-veiculo-fipe" style="font-weight:800;color:#10b981;">R$ 142.900,00</td>
                      </tr>
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
                        <td class="val-col" id="val-origem">São Paulo (SP) — Região Sudeste</td>
                      </tr>
                      <tr>
                        <td class="label-col">Licenciamento DETRAN</td>
                        <td class="val-col" id="val-licenciamento">Novembro / 2026</td>
                      </tr>
                      <tr>
                        <td class="label-col">Rodízio SP (CET)</td>
                        <td class="val-col" id="val-rodizio">Sexta-feira (07h00 às 10h00 e das 17h00 às 20h00)</td>
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
                <div style="font-size:14px;font-weight:700;color:var(--ink);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
                  <span style="display:flex;align-items:center;gap:8px;">
                    <i data-lucide="scan" style="color:var(--blue);"></i>
                    <span>Auditoria e Decodificador de Chassi (VIN ISO 3779)</span>
                  </span>
                  <span class="status-badge-pill blue">SAE J853</span>
                </div>
                <p style="font-size:12.5px;color:var(--muted);margin-bottom:16px;line-height:1.5;">
                  Digite o chassi de 17 caracteres (rejeição automática das letras proibidas <code>I</code>, <code>O</code>, <code>Q</code>):
                </p>

                <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
                  <input type="text" id="chassi-input" value="9BWCA45Z1FP012345" placeholder="Digite o chassi de 17 caracteres..." maxlength="17" style="flex:2;min-width:220px;height:44px;padding:0 14px;border:1px solid var(--line);border-radius:var(--radius-md);font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--ink);background:var(--paper);outline:none;" />
                  <button id="btn-exec-chassi" class="primary-button accent" style="height:44px;padding:0 18px;font-size:13px;font-weight:700;">
                    <i data-lucide="play"></i> <span>Decodificar</span>
                  </button>
                </div>

                <div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center;font-size:11.5px;margin-bottom:20px;">
                  <span style="color:var(--muted);font-weight:600;">Montadoras:</span>
                  <button class="secondary-button sample-chassi" data-vin="9BWCA45Z1FP012345" style="padding:4px 10px;font-size:11.5px;display:inline-flex;align-items:center;gap:5px;">
                    <i data-lucide="car"></i> <span>Volkswagen</span>
                  </button>
                  <button class="secondary-button sample-chassi" data-vin="9BGKS48V0LG123456" style="padding:4px 10px;font-size:11.5px;display:inline-flex;align-items:center;gap:5px;">
                    <i data-lucide="car"></i> <span>Chevrolet Onix</span>
                  </button>
                  <button class="secondary-button sample-chassi" data-vin="5YJ3E1EB8NF123456" style="padding:4px 10px;font-size:11.5px;display:inline-flex;align-items:center;gap:5px;">
                    <i data-lucide="zap"></i> <span>Tesla Model 3</span>
                  </button>
                </div>

                <!-- Emblema da Montadora com SVG Oficial de Icons Pro -->
                <div id="montadora-badge-box" style="padding:18px;border-radius:var(--radius-lg);background:var(--paper-elevated,#162032);border:1px solid var(--line);margin-bottom:20px;display:flex;align-items:center;gap:18px;">
                  <div class="brand-logo-frame" id="brand-logo-container">
                    <img id="brand-logo-img" src="https://icons-pro-api.maputo2.workers.dev/api/icons/volkswagen.svg" alt="Volkswagen" />
                  </div>
                  <div>
                    <div id="display-fabricante-nome" style="font-size:18px;font-weight:800;color:var(--ink);">Volkswagen</div>
                    <div id="display-fabricante-origem" style="font-size:12px;color:var(--muted);">Código WMI: 9BW · Fabricação Brasil (Nacional)</div>
                  </div>
                </div>

                <div style="border:1px solid var(--line);border-radius:var(--radius-lg);overflow:hidden;background:var(--paper);">
                  <div style="padding:12px 16px;background:var(--paper-elevated,#162032);border-bottom:1px solid var(--line);font-size:13px;font-weight:700;color:var(--ink);">
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
                <div style="font-size:14px;font-weight:700;color:var(--ink);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
                  <span style="display:flex;align-items:center;gap:8px;">
                    <i data-lucide="file-check-2" style="color:var(--blue);"></i>
                    <span>Validador Oficial de RENAVAM (DENATRAN / SENATRAN)</span>
                  </span>
                  <span class="status-badge-pill blue">Módulo 11</span>
                </div>
                <p style="font-size:12.5px;color:var(--muted);margin-bottom:16px;line-height:1.5;">
                  Validação do Registro Nacional com pesos regressivos <code>[3, 2, 9, 8, 7, 6, 5, 4, 3, 2]</code> e preenchimento de zeros à esquerda:
                </p>

                <div style="display:gap:10px;margin-bottom:14px;flex-wrap:wrap;display:flex;">
                  <input type="text" id="renavam-input" value="00632345678" placeholder="Digite o RENAVAM de 9 a 11 dígitos..." maxlength="11" style="flex:2;min-width:200px;height:44px;padding:0 14px;border:1px solid var(--line);border-radius:var(--radius-md);font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:var(--ink);background:var(--paper);outline:none;" />
                  <button id="btn-exec-renavam" class="primary-button accent" style="height:44px;padding:0 18px;font-size:13px;font-weight:700;">
                    <i data-lucide="play"></i> <span>Validar</span>
                  </button>
                  <button id="btn-gerar-renavam" class="secondary-button" style="height:44px;padding:0 16px;font-size:12.5px;font-weight:700;">
                    <i data-lucide="sparkles"></i> <span>Gerar Válido</span>
                  </button>
                </div>

                <div id="renavam-result-box" style="padding:20px;border-radius:var(--radius-lg);background:var(--paper-elevated,#162032);border:1px solid var(--line);margin-top:16px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <span id="renavam-status-badge" class="status-badge-pill green">RENAVAM REGULAR & VÁLIDO</span>
                    <span style="font-size:11.5px;color:var(--muted);font-family:'JetBrains Mono',monospace;">Algoritmo Módulo 11</span>
                  </div>
                  <div id="renavam-display-val" style="font-size:22px;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--ink);margin-bottom:6px;">
                    00632345678
                  </div>
                  <p id="renavam-msg-val" style="font-size:12.5px;color:var(--muted);margin:0;">
                    Dígito verificador confere com o cálculo ponderado oficial do DENATRAN.
                  </p>
                </div>
              </div>
            </div>

            <!-- PAINEL 4: CALCULADORA FLEX -->
            <div id="section-flex" class="tab-pane" style="display:none;">
              <div class="card-dashboard">
                <div style="font-size:14px;font-weight:700;color:var(--ink);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
                  <span style="display:flex;align-items:center;gap:8px;">
                    <i data-lucide="fuel" style="color:var(--blue);"></i>
                    <span>Calculadora Flex Inteligente (Etanol x Gasolina)</span>
                  </span>
                  <span class="status-badge-pill green">Média ANP 2026</span>
                </div>
                <p style="font-size:12.5px;color:var(--muted);margin-bottom:16px;line-height:1.5;">
                  Simule o preço dos combustíveis na bomba e verifique qual oferece melhor autonomia e economia com base no limiar calórico (70%):
                </p>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;">
                  <div>
                    <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:6px;">Preço Etanol (Litro)</label>
                    <input type="number" step="0.01" id="flex-etanol" value="3.85" style="width:100%;height:42px;padding:0 14px;border:1px solid var(--line);border-radius:var(--radius-md);font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:var(--ink);background:var(--paper);outline:none;" />
                  </div>
                  <div>
                    <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:6px;">Preço Gasolina (Litro)</label>
                    <input type="number" step="0.01" id="flex-gasolina" value="5.95" style="width:100%;height:42px;padding:0 14px;border:1px solid var(--line);border-radius:var(--radius-md);font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:var(--ink);background:var(--paper);outline:none;" />
                  </div>
                </div>

                <div id="flex-box-result" style="padding:22px;border-radius:var(--radius-lg);background:radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.14), transparent 70%), var(--paper-elevated,#162032);border:1px solid rgba(16, 185, 129, 0.35);text-align:center;">
                  <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#10b981;margin-bottom:6px;">
                    Combustível Mais Vantajoso
                  </div>
                  <div id="flex-best" style="font-size:30px;font-weight:800;color:var(--ink);margin-bottom:6px;display:flex;align-items:center;justify-content:center;gap:8px;">
                    <i data-lucide="leaf" style="color:#10b981;width:28px;height:28px;"></i>
                    <span>ETANOL</span>
                  </div>
                  <div id="flex-pct" style="font-size:13px;font-weight:700;color:#3b82f6;margin-bottom:10px;">
                    Paridade: 64.7% (Abaixo do teto de 70%)
                  </div>
                  <p id="flex-desc" style="font-size:12.5px;color:var(--muted);margin:0;line-height:1.5;">
                    Abastecer com Etanol economiza cerca de 7.6% em relação à Gasolina neste momento.
                  </p>
                </div>
              </div>
            </div>

            <!-- PAINEL 5: GRÁFICOS & TELEMETRIA VISUAL (INTEGRAÇÃO COM GRÁFICOS PRO API) -->
            <div id="section-graficos" class="tab-pane" style="display:none;">
              <div class="card-dashboard">
                <div style="font-size:14px;font-weight:700;color:var(--ink);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
                  <span style="display:flex;align-items:center;gap:8px;">
                    <i data-lucide="gauge" style="color:var(--blue);"></i>
                    <span>Telemetria em Tempo Real (Graficos Pro Anycast)</span>
                  </span>
                  <span class="status-badge-pill blue">SVG Anycast 3ms</span>
                </div>
                <p style="font-size:12.5px;color:var(--muted);margin-bottom:18px;line-height:1.5;">
                  Visualizações gráficas dinâmicas geradas diretamente na borda Anycast da Cloudflare pela API <code>graficos-pro</code>:
                </p>

                <!-- Velocímetro Gauge Anycast Oficial de Rodízio SP -->
                <div style="background:#090d16;border:1px solid #1e293b;border-radius:var(--radius-lg);padding:18px;margin-bottom:20px;text-align:center;">
                  <div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px;">
                    Velocímetro Gauge de Circulação (Horário de Pico SP)
                  </div>
                  <div id="gauge-container" style="max-width:340px;margin:0 auto;"></div>
                </div>

                <!-- Gráfico de Tendência de Depreciação e IPVA FIPE Anycast -->
                <div style="background:#090d16;border:1px solid #1e293b;border-radius:var(--radius-lg);padding:18px;margin-bottom:20px;">
                  <div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px;display:flex;justify-content:space-between;">
                    <span>Curva de Valor Venal & IPVA (FIPE 5 Anos)</span>
                    <span style="color:#10b981;font-weight:700;">Alíquota SP 4.0%</span>
                  </div>
                  <div id="area-chart-container" style="width:100%;"></div>
                </div>

                <!-- Gráfico Donut de Paridade Flex Anycast -->
                <div style="background:#090d16;border:1px solid #1e293b;border-radius:var(--radius-lg);padding:18px;">
                  <div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#cbd5e1;margin-bottom:8px;">
                    Distribuição Calórica & Paridade de Custo
                  </div>
                  <div id="donut-chart-container" style="max-width:320px;margin:0 auto;"></div>
                </div>
              </div>
            </div>

            <!-- PAINEL 6: CATÁLOGO INTEGRAL DE VEÍCULOS & FIPE BRASIL -->
            <div id="section-catalogo" class="tab-pane" style="display:none;">
              <div class="card-dashboard">
                <div style="font-size:14px;font-weight:700;color:var(--ink);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
                  <span style="display:flex;align-items:center;gap:8px;">
                    <i data-lucide="layers" style="color:var(--blue);"></i>
                    <span>Catálogo Nacional de Veículos & Base FIPE (Zero Unsplash)</span>
                  </span>
                  <span class="status-badge-pill green">100% Cobertura Brasil</span>
                </div>
                <p style="font-size:12.5px;color:var(--muted);margin-bottom:14px;line-height:1.5;">
                  Explore modelos homologados no Brasil, dados Inmetro, avaliação FIPE e simulação de custos DETRAN:
                </p>

                <!-- Barra de Busca Rápida de Carros -->
                <div style="display:flex;gap:8px;margin-bottom:12px;">
                  <input type="text" id="catalogo-search-input" placeholder="Buscar por marca, modelo ou código FIPE (ex: Corolla, Onix, Gol)..." style="flex:1;height:38px;padding:0 12px;border:1px solid var(--line);border-radius:var(--radius-md);font-size:12.5px;background:var(--paper);color:var(--ink);outline:none;" />
                  <button class="primary-button accent" id="btn-catalogo-buscar" style="height:38px;padding:0 14px;font-size:12px;font-weight:700;">
                    <i data-lucide="search"></i> <span>Buscar</span>
                  </button>
                </div>

                <!-- Seletor de Categorias -->
                <div class="category-row" style="margin-bottom:12px;display:flex;gap:6px;overflow-x:auto;">
                  <button class="secondary-button cat-filter-btn is-selected" data-cat="todos" style="height:28px;padding:0 10px;font-size:11px;font-weight:700;border-radius:var(--radius-full);">Todos</button>
                  <button class="secondary-button cat-filter-btn" data-cat="hatch" style="height:28px;padding:0 10px;font-size:11px;font-weight:700;border-radius:var(--radius-full);">Hatches</button>
                  <button class="secondary-button cat-filter-btn" data-cat="sedan" style="height:28px;padding:0 10px;font-size:11px;font-weight:700;border-radius:var(--radius-full);">Sedans</button>
                  <button class="secondary-button cat-filter-btn" data-cat="suv" style="height:28px;padding:0 10px;font-size:11px;font-weight:700;border-radius:var(--radius-full);">SUVs</button>
                  <button class="secondary-button cat-filter-btn" data-cat="picape" style="height:28px;padding:0 10px;font-size:11px;font-weight:700;border-radius:var(--radius-full);">Picapes</button>
                  <button class="secondary-button cat-filter-btn" data-cat="motocicleta" style="height:28px;padding:0 10px;font-size:11px;font-weight:700;border-radius:var(--radius-full);">Motos</button>
                  <button class="secondary-button cat-filter-btn" data-cat="eletrico" style="height:28px;padding:0 10px;font-size:11px;font-weight:700;border-radius:var(--radius-full);">Elétricos</button>
                </div>

                <!-- Grade de Montadoras / Marcas -->
                <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">
                  Montadoras Homologadas (Filtro por Marca):
                </div>
                <div id="marcas-grid-container" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:16px;">
                  <!-- Marcas com logos carregados dinamicamente via Icons Pro -->
                </div>

                <!-- Lista de Modelos Encontrados -->
                <div id="catalogo-modelos-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(250px, 1fr));gap:12px;">
                  <!-- Cards de veículos gerados dinamicamente -->
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
                  <i data-lucide="copy" style="width:14px;height:14px;"></i>
                </button>
              </div>

              <!-- Caixa de Código do Snippet -->
              <div class="snippet-code-box" style="padding:14px 18px;background:rgba(0,0,0,0.30);border-bottom:1px solid rgba(255,255,255,0.06);">
                <pre class="snippet-pre" style="margin:0;font-family:'JetBrains Mono',monospace;font-size:12px;color:#7dd3fc;line-height:1.5;overflow-x:auto;"><code id="snippet-code">curl -s "https://placas-pro-api.clepta2.workers.dev/api/placas/BRA2E19" \
  -H "Authorization: ******" \
  -H "x-api-key: plc_live_mercosul_2026"</code></pre>
              </div>

              <!-- Barra de Execução Sandbox -->
              <div class="playground-bar">
                <span class="method-tag get">GET</span>
                <code class="endpoint-code" id="endpoint-display" style="font-size:12px;">/api/placas/BRA2E19</code>
                <button class="primary-button accent test-btn" id="btn-run-sandbox" style="white-space:nowrap;padding:0 14px;height:32px;">
                  <i data-lucide="play"></i> <span>Executar</span>
                </button>
              </div>

              <!-- Console de Resposta JSON -->
              <div class="playground-console" style="min-height:300px;max-height:540px;overflow-y:auto;padding:16px;">
                <div class="console-response-header" id="console-header" style="font-size:11.5px;margin-bottom:10px;">
                  <span class="badge-200" id="console-status">200 OK</span>
                  <span id="console-latency">Latência: 1.2ms</span>
                  <span>Cloudflare Anycast</span>
                </div>
                <pre class="console-json" id="console-output" style="margin:0;font-family:'JetBrains Mono',monospace;font-size:11.5px;color:#f8fafc;line-height:1.5;"></pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>

  <!-- Script da Aplicação e Integração -->
  <script type="module">

    // Controle do Menu Lateral Mobile (Drawer)
    function setupMobileNav() {
      const drawerBtn = document.getElementById('mobile-hamburger-btn');
      const drawerClose = document.getElementById('sidebar-drawer-close');
      const drawerBackdrop = document.getElementById('sidebar-drawer-backdrop');
      const sidebarEl = document.querySelector('.sidebar');

      function openDrawer() {
        if (sidebarEl) sidebarEl.classList.add('is-open');
        if (drawerBackdrop) drawerBackdrop.hidden = false;
      }
      function closeDrawer() {
        if (sidebarEl) sidebarEl.classList.remove('is-open');
        if (drawerBackdrop) drawerBackdrop.hidden = true;
      }

      drawerBtn?.addEventListener('click', openDrawer);
      drawerClose?.addEventListener('click', closeDrawer);
      drawerBackdrop?.addEventListener('click', closeDrawer);

      // Sincronização de Abas (Desktop, Sidebar e Mobile Bottom Nav)
      const allTabBtns = document.querySelectorAll('.tab-nav-btn, .primary-nav .nav-link[data-view], .mobile-bottom-nav .mobile-nav-item[data-tab]');
      allTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const tabKey = btn.dataset.tab || btn.dataset.view;
          if (!tabKey) return;
          document.querySelectorAll('.tab-nav-btn').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tabKey));
          document.querySelectorAll('.primary-nav .nav-link[data-view]').forEach(b => b.classList.toggle('is-active', b.dataset.view === tabKey));
          document.querySelectorAll('.mobile-bottom-nav .mobile-nav-item[data-tab]').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tabKey));
          document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
          const target = document.getElementById('section-' + tabKey);
          if (target) target.style.display = 'block';
          closeDrawer();
          if (typeof updateSnippet === 'function') updateSnippet();
          if (window.lucide) window.lucide.createIcons();
        });
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupMobileNav);
    } else {
      setupMobileNav();
    }

    // Tema Claro / Escuro
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('ponte.theme', next);
        renderLucide();
      });
    }

    function renderLucide() {
      if (window.lucide) window.lucide.createIcons();
    }

    // Mapa de Logos Oficiais de Fabricantes (Icons Pro API)
    const BRAND_LOGOS = {
      'Volkswagen': 'volkswagen',
      'General Motors (Chevrolet)': 'chevrolet',
      'Fiat Automóveis': 'fiat',
      'Ford Motor Company': 'ford',
      'Ford': 'ford',
      'Ford Argentina': 'ford',
      'Toyota do Brasil': 'toyota',
      'Toyota Motor': 'toyota',
      'Toyota Motor Corp': 'toyota',
      'Toyota Argentina': 'toyota',
      'Hyundai Motor Brasil': 'hyundai',
      'Hyundai Motor Co': 'hyundai',
      'Honda Automóveis do Brasil': 'honda',
      'Honda Motor Co': 'honda',
      'Renault do Brasil': 'renault',
      'Renault': 'renault',
      'BMW AG': 'bmw',
      'Audi AG': 'audi',
      'Porsche AG': 'porsche',
      'Ferrari': 'ferrari',
      'Volvo Cars': 'volvo',
      'Volvo do Brasil': 'volvo',
      'Nissan Motor Co': 'nissan',
      'Nissan do Brasil': 'nissan',
      'Tesla Inc': 'tesla'
    };

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
          graficos: 'Gráficos & Telemetria',
          catalogo: 'Catálogo Nacional FIPE'
        };
        if (bread && titles[tabKey]) bread.textContent = titles[tabKey];
        updateSnippet();
        renderLucide();

        if (tabKey === 'graficos') {
          carregarGraficosAnycast();
        } else if (tabKey === 'catalogo') {
          carregarCatalogoVeiculos();
        }
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

    let currentPlateMode = 'mercosul';
    let currentCategoria = 'particular';

    document.getElementById('btn-mode-mercosul')?.addEventListener('click', () => {
      currentPlateMode = 'mercosul';
      document.getElementById('btn-mode-mercosul').style.borderColor = 'var(--blue)';
      document.getElementById('btn-mode-mercosul').style.color = 'var(--blue)';
      document.getElementById('btn-mode-antiga').style.borderColor = 'var(--line)';
      document.getElementById('btn-mode-antiga').style.color = 'var(--muted)';
      document.getElementById('categoria-selector').style.display = 'flex';
      executarConsultaPlaca(document.getElementById('placa-input').value);
    });

    document.getElementById('btn-mode-antiga')?.addEventListener('click', () => {
      currentPlateMode = 'antiga';
      document.getElementById('btn-mode-antiga').style.borderColor = 'var(--blue)';
      document.getElementById('btn-mode-antiga').style.color = 'var(--blue)';
      document.getElementById('btn-mode-mercosul').style.borderColor = 'var(--line)';
      document.getElementById('btn-mode-mercosul').style.color = 'var(--muted)';
      document.getElementById('categoria-selector').style.display = 'none';
      executarConsultaPlaca(document.getElementById('placa-input').value);
    });

    document.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cat-btn').forEach(b => {
          b.style.borderColor = 'var(--line)';
          b.style.color = 'var(--muted)';
        });
        btn.style.borderColor = 'var(--blue)';
        btn.style.color = 'var(--blue)';
        currentCategoria = btn.dataset.cat || 'particular';
        executarConsultaPlaca(document.getElementById('placa-input').value);
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

    // Base de conexão Anycast inteligente (suporta tanto rodando no Worker quanto no GitHub Pages/Localhost)
    const API_BASE = window.location.hostname.includes('workers.dev') ? '' : 'https://placas-pro-api.clepta2.workers.dev';

    // Formatador JSON de Alto Contraste com Destaque de Sintaxe para Terminal
    function renderJsonToConsole(data, statusText, isOk, latencyMs) {
      const consoleOutput = document.getElementById('console-output');
      const consoleStatus = document.getElementById('console-status');
      const consoleLat = document.getElementById('console-latency');

      consoleStatus.textContent = statusText;
      consoleStatus.className = isOk ? 'badge-200' : 'badge-500';
      consoleLat.textContent = \`Latência: \${latencyMs}ms\`;

      const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      const escaped = jsonStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const highlighted = escaped.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            return \`<span style="color:#38bdf8;font-weight:600;">\${match}</span>\`;
          } else {
            return \`<span style="color:#86efac;">\${match}</span>\`;
          }
        } else if (/true|false/.test(match)) {
          return \`<span style="color:#c084fc;font-weight:700;">\${match}</span>\`;
        } else if (/null/.test(match)) {
          return \`<span style="color:#94a3b8;font-style:italic;">\${match}</span>\`;
        } else {
          return \`<span style="color:#fde047;font-weight:600;">\${match}</span>\`;
        }
      });
      consoleOutput.innerHTML = highlighted;
    }

    const VEICULOS_CLIENT = {
      'BRA2E19': {
        marca: 'Toyota',
        modelo: 'Corolla Altis Hybrid 1.8 Flex',
        nomeCompleto: 'Toyota Corolla Altis Hybrid 1.8 Flex',
        anoFabricacao: 2022,
        anoModelo: 2023,
        cor: 'Prata Metálico',
        segmento: 'Sedan Médio',
        combustivel: 'Híbrido / Flex',
        potencia: '122 cv',
        cilindrada: '1.798 cm³',
        procedencia: 'Nacional (SP)',
        valorFipeFormatado: 'R$ 142.900,00',
        fotoUrl: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=800&q=80',
        marcaLogoUrl: 'https://icons-pro-api.maputo2.workers.dev/api/icons/toyota.svg'
      },
      'EZK5520': {
        marca: 'Volkswagen',
        modelo: 'Golf GTI 2.0 TSI DSG',
        nomeCompleto: 'Volkswagen Golf GTI 2.0 TSI DSG',
        anoFabricacao: 2019,
        anoModelo: 2019,
        cor: 'Branco Puro',
        segmento: 'Hatch Esportivo',
        combustivel: 'Gasolina',
        potencia: '230 cv',
        cilindrada: '1.984 cm³ Turbo',
        procedencia: 'Nacional (PR)',
        valorFipeFormatado: 'R$ 158.400,00',
        fotoUrl: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=800&q=80',
        marcaLogoUrl: 'https://icons-pro-api.maputo2.workers.dev/api/icons/volkswagen.svg'
      },
      'ABC12C4': {
        marca: 'Honda',
        modelo: 'CB 500X ABS Touring',
        nomeCompleto: 'Honda CB 500X ABS Touring',
        anoFabricacao: 2023,
        anoModelo: 2024,
        cor: 'Vermelho Grand Prix',
        segmento: 'Motocicleta Crossover',
        combustivel: 'Gasolina',
        potencia: '50,4 cv',
        cilindrada: '471 cm³',
        procedencia: 'Nacional (AM)',
        valorFipeFormatado: 'R$ 44.500,00',
        fotoUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
        marcaLogoUrl: 'https://icons-pro-api.maputo2.workers.dev/api/icons/honda.svg'
      },
      'RIO2016': {
        marca: 'Hyundai',
        modelo: 'HB20 Diamond Plus 1.0 Turbo',
        nomeCompleto: 'Hyundai HB20 Diamond Plus 1.0 Turbo',
        anoFabricacao: 2020,
        anoModelo: 2020,
        cor: 'Azul Sapphire Metálico',
        segmento: 'Hatch Compacto',
        combustivel: 'Flex',
        potencia: '120 cv',
        cilindrada: '998 cm³ Turbo',
        procedencia: 'Nacional (SP)',
        valorFipeFormatado: 'R$ 72.800,00',
        fotoUrl: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80',
        marcaLogoUrl: 'https://icons-pro-api.maputo2.workers.dev/api/icons/hyundai.svg'
      }
    };

    const POOL_CLIENT = [
      {
        marca: 'Chevrolet',
        modelo: 'Onix Plus Premier 1.0 Turbo',
        nomeCompleto: 'Chevrolet Onix Plus Premier 1.0 Turbo',
        anoFabricacao: 2022,
        anoModelo: 2023,
        cor: 'Vermelho Carmim',
        segmento: 'Sedan Compacto',
        combustivel: 'Flex',
        potencia: '116 cv',
        cilindrada: '999 cm³ Turbo',
        procedencia: 'Nacional (RS)',
        valorFipeFormatado: 'R$ 89.900,00',
        fotoUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80',
        marcaLogoUrl: 'https://icons-pro-api.maputo2.workers.dev/api/icons/chevrolet.svg'
      },
      {
        marca: 'Jeep',
        modelo: 'Compass Longitude 1.3 Turbo',
        nomeCompleto: 'Jeep Compass Longitude 1.3 Turbo',
        anoFabricacao: 2023,
        anoModelo: 2023,
        cor: 'Preto Carbon',
        segmento: 'SUV Médio',
        combustivel: 'Flex',
        potencia: '185 cv',
        cilindrada: '1.332 cm³ Turbo',
        procedencia: 'Nacional (PE)',
        valorFipeFormatado: 'R$ 164.500,00',
        fotoUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80',
        marcaLogoUrl: 'https://icons-pro-api.maputo2.workers.dev/api/icons/jeep.svg'
      },
      {
        marca: 'Fiat',
        modelo: 'Strada Freedom 1.3 CD',
        nomeCompleto: 'Fiat Strada Freedom 1.3 CD',
        anoFabricacao: 2023,
        anoModelo: 2024,
        cor: 'Branco Banchisa',
        segmento: 'Picape Compacta',
        combustivel: 'Flex',
        potencia: '107 cv',
        cilindrada: '1.332 cm³',
        procedencia: 'Nacional (MG)',
        valorFipeFormatado: 'R$ 99.800,00',
        fotoUrl: 'https://images.unsplash.com/photo-1559416523-140ddc3d238c?auto=format&fit=crop&w=800&q=80',
        marcaLogoUrl: 'https://icons-pro-api.maputo2.workers.dev/api/icons/fiat.svg'
      },
      {
        marca: 'BMW',
        modelo: '320i M Sport 2.0 Turbo',
        nomeCompleto: 'BMW 320i M Sport 2.0 Turbo',
        anoFabricacao: 2022,
        anoModelo: 2023,
        cor: 'Azul Portimão Metálico',
        segmento: 'Sedan Premium',
        combustivel: 'Flex / Gasolina',
        potencia: '184 cv',
        cilindrada: '1.998 cm³',
        procedencia: 'Nacional (SC)',
        valorFipeFormatado: 'R$ 295.000,00',
        fotoUrl: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=80',
        marcaLogoUrl: 'https://icons-pro-api.maputo2.workers.dev/api/icons/bmw.svg'
      }
    ];

    function gerarSilhuetaClient(seg, hex) {
      const segLower = (seg || '').toLowerCase();
      const cor = hex || '#94a3b8';
      if (segLower.includes('moto')) {
        return \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160" width="100%" height="90"><circle cx="70" cy="115" r="32" fill="#18181b" stroke="#3f3f46" stroke-width="5"/><circle cx="250" cy="115" r="32" fill="#18181b" stroke="#3f3f46" stroke-width="5"/><path d="M 70 115 L 140 85 L 180 80 L 220 55 L 250 115" fill="none" stroke="#27272a" stroke-width="10" stroke-linecap="round"/><path d="M 130 80 Q 160 50 195 65 Q 210 75 190 90 Z" fill="\${cor}" stroke="\${cor}" stroke-width="2"/></svg>\`;
      }
      let bodyPath = 'M 35 110 Q 40 85 70 80 L 125 78 L 165 42 L 265 42 L 315 75 L 365 82 Q 385 88 385 110 Z';
      if (segLower.includes('suv')) bodyPath = 'M 35 110 Q 40 80 65 75 L 115 72 L 150 32 L 295 32 L 330 70 L 375 75 Q 390 85 390 110 Z';
      else if (segLower.includes('picape')) bodyPath = 'M 35 110 Q 40 82 70 78 L 130 75 L 165 38 L 260 38 L 260 75 L 370 75 Q 388 85 388 110 Z';
      else if (segLower.includes('hatch')) bodyPath = 'M 40 110 Q 45 85 75 80 L 125 78 L 170 42 L 285 42 L 295 76 L 360 82 Q 380 88 380 110 Z';
      return \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 150" width="100%" height="90"><path d="\${bodyPath}" fill="\${cor}" stroke="#1e293b" stroke-width="2" opacity="0.9"/><path d="M 135 74 L 170 47 L 220 47 L 220 74 Z" fill="#030712" opacity="0.75"/><path d="M 226 47 L 265 47 L 305 74 L 226 74 Z" fill="#030712" opacity="0.75"/><circle cx="100" cy="112" r="26" fill="#18181b" stroke="#3f3f46" stroke-width="5"/><circle cx="315" cy="112" r="26" fill="#18181b" stroke="#3f3f46" stroke-width="5"/></svg>\`;
    }

    function obterDadosVeiculoClient(placa, tipoVeiculo) {
      const clean = String(placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      let v = VEICULOS_CLIENT[clean];
      if (!v) {
        let hash = 0;
        for (let i = 0; i < clean.length; i++) hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
        v = { ...POOL_CLIENT[hash % POOL_CLIENT.length] };
      } else {
        v = { ...v };
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
        classificacaoPBEV: 'Selo Conpet A'
      } : {
        etanolUrbano: '10,8 km/l',
        etanolRodoviario: '12,9 km/l',
        gasolinaUrbano: '15,4 km/l',
        gasolinaRodoviario: '17,8 km/l',
        classificacaoPBEV: 'Selo Conpet A'
      };

      v.regularizacaoAnual = {
        taxaLicenciamento: 'R$ 160,22',
        spvatEstimado: 'R$ 55,00',
        ipvaIntegral: 'R$ 5.716,00 (4.0%)',
        cotaUnicaDesconto: 'R$ 5.544,52 (3% desc)',
        parcelas5x: '5x de R$ 1.143,20',
        custoTotalAnual: 'R$ 5.931,22'
      };

      v.situacaoCadastral = {
        gravame: 'Sem Restrição Financeira (Desalienado)',
        proprietarioTipo: 'Pessoa Física'
      };

      v.silhuetaSvg = gerarSilhuetaClient(v.segmento, v.corHex);
      return v;
    }

    // ── LÓGICA 1: PLACAS ──
    async function executarConsultaPlaca(placaInput) {
      const clean = placaInput.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      document.getElementById('placa-input').value = clean;
      updateSnippet();

      const consoleOutput = document.getElementById('console-output');
      consoleOutput.textContent = 'Enviando requisição para a Cloudflare Edge...';

      const t0 = performance.now();
      try {
        const res = await fetch(\`\${API_BASE}/api/placas/\${clean}\`);
        const data = await res.json();
        const lat = Math.round(performance.now() - t0);

        if (data.valido && !data.veiculo) {
          data.veiculo = obterDadosVeiculoClient(clean, data.tipoVeiculo);
        }

        renderJsonToConsole(data, res.ok ? '200 OK' : \`\${res.status} ERRO\`, res.ok, lat);

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

          // Atualiza Ficha Cadastral e Foto Oficial do Veículo
          if (data.veiculo) {
            const v = data.veiculo;
            const cardEl = document.getElementById('veiculo-card');
            if (cardEl) cardEl.style.display = 'block';

            const fotoEl = document.getElementById('veiculo-foto-img');
            if (fotoEl && v.fotoUrl) fotoEl.src = v.fotoUrl;

            // Galeria de Fotos Multi-Ângulo
            const galeriaContainer = document.getElementById('veiculo-galeria-container');
            if (galeriaContainer) {
              const fotos = (v.galeria && v.galeria.length) ? v.galeria : [v.fotoUrl];
              galeriaContainer.innerHTML = fotos.map((f, i) => \`
                <img src="\${f}" alt="Ângulo \${i + 1}" style="width:62px;height:40px;border-radius:6px;object-fit:cover;cursor:pointer;border:2px solid \${i === 0 ? 'var(--blue)' : 'var(--line)'};transition:all 0.15s ease;" onclick="document.getElementById('veiculo-foto-img').src='\${f}';document.querySelectorAll('#veiculo-galeria-container img').forEach(im=>im.style.borderColor='var(--line)');this.style.borderColor='var(--blue)';" />
              \`).join('');
            }

            const logoEl = document.getElementById('veiculo-montadora-logo');
            if (logoEl && v.marcaLogoUrl) logoEl.src = v.marcaLogoUrl;

            const marcaEl = document.getElementById('veiculo-marca-nome');
            if (marcaEl) marcaEl.textContent = v.marca;

            const segEl = document.getElementById('veiculo-segmento-badge');
            if (segEl) segEl.textContent = v.segmento || 'Veículo Nacional';

            const fipeEl = document.getElementById('veiculo-fipe-valor');
            if (fipeEl) fipeEl.textContent = (v.fipe && v.fipe.valor) ? v.fipe.valor : (v.valorFipeFormatado || 'R$ 78.500,00');

            const nomeEl = document.getElementById('veiculo-nome-completo');
            if (nomeEl) nomeEl.textContent = v.nomeCompleto || \`\${v.marca} \${v.modelo}\`;

            const anoEl = document.getElementById('veiculo-ano-modelo');
            if (anoEl) anoEl.textContent = \`\${v.anoFabricacao || 2023} / \${v.anoModelo || 2024}\`;

            const corEl = document.getElementById('veiculo-cor');
            if (corEl) corEl.textContent = v.cor || 'Prata';

            const swatchEl = document.getElementById('veiculo-cor-swatch');
            if (swatchEl) swatchEl.style.background = v.corHex || '#94a3b8';

            const combTag = document.getElementById('veiculo-combustivel-tag');
            if (combTag) combTag.textContent = v.combustivel || 'Flex';

            const potTag = document.getElementById('veiculo-potencia-tag');
            if (potTag) potTag.textContent = v.potencia || 'Potência Homologada';

            const motTag = document.getElementById('veiculo-motor-tag');
            if (motTag) motTag.textContent = v.cilindrada || 'Motor Nacional';

            const procTag = document.getElementById('veiculo-procedencia-tag');
            if (procTag) procTag.textContent = v.procedencia || 'Brasil';

            // Eficiência Inmetro (PBEV)
            const seloEl = document.getElementById('veiculo-selo-conpet');
            if (seloEl && v.eficienciaInmetro) seloEl.textContent = v.eficienciaInmetro.classificacaoPBEV || 'Selo Conpet A';

            const cGasEl = document.getElementById('veiculo-consumo-gasolina');
            if (cGasEl && v.eficienciaInmetro) {
              cGasEl.textContent = \`\${v.eficienciaInmetro.gasolinaUrbano} (urb) • \${v.eficienciaInmetro.gasolinaRodoviario} (rod)\`;
            }

            const cEtaEl = document.getElementById('veiculo-consumo-etanol');
            if (cEtaEl && v.eficienciaInmetro) {
              cEtaEl.textContent = \`\${v.eficienciaInmetro.etanolUrbano || '-'} (urb) • \${v.eficienciaInmetro.etanolRodoviario || '-'} (rod)\`;
            }

            // Custos Anuais DETRAN
            const ufCustoEl = document.getElementById('veiculo-uf-custo');
            if (ufCustoEl) ufCustoEl.textContent = (data.origem && data.origem.uf) || 'SP';

            const custoTotEl = document.getElementById('veiculo-custo-total');
            if (custoTotEl && v.regularizacaoAnual) custoTotEl.textContent = v.regularizacaoAnual.custoTotalAnual;

            const ipvaEl = document.getElementById('veiculo-ipva-val');
            if (ipvaEl && v.regularizacaoAnual) ipvaEl.textContent = v.regularizacaoAnual.ipvaIntegral;

            const cotaEl = document.getElementById('veiculo-cota-desc');
            if (cotaEl && v.regularizacaoAnual) cotaEl.textContent = v.regularizacaoAnual.cotaUnicaDesconto;

            const taxaEl = document.getElementById('veiculo-taxa-lic');
            if (taxaEl && v.regularizacaoAnual) taxaEl.textContent = v.regularizacaoAnual.taxaLicenciamento;

            const parcEl = document.getElementById('veiculo-parcelas');
            if (parcEl && v.regularizacaoAnual) parcEl.textContent = v.regularizacaoAnual.parcelas5x;

            // Gravame e Situação Cadastral
            const gravEl = document.getElementById('veiculo-gravame-status');
            if (gravEl && v.situacaoCadastral) gravEl.textContent = v.situacaoCadastral.gravame;

            const propEl = document.getElementById('veiculo-proprietario-tipo');
            if (propEl && v.situacaoCadastral) propEl.textContent = v.situacaoCadastral.proprietarioTipo;

            // Silhueta Vetorial na Cor Real
            const silhEl = document.getElementById('veiculo-silhueta-svg-container');
            if (silhEl && v.silhuetaSvg) silhEl.innerHTML = v.silhuetaSvg;

            // Atualiza linhas correspondentes na tabela Raio-X
            const rNome = document.getElementById('val-veiculo-nome');
            if (rNome) rNome.textContent = v.nomeCompleto || \`\${v.marca} \${v.modelo}\`;

            const rAno = document.getElementById('val-veiculo-ano');
            if (rAno) rAno.textContent = \`\${v.anoFabricacao || 2023} / \${v.anoModelo || 2024}\`;

            const rCor = document.getElementById('val-veiculo-cor');
            if (rCor) rCor.textContent = v.cor || 'Prata';

            const rFipe = document.getElementById('val-veiculo-fipe');
            if (rFipe) rFipe.textContent = (v.fipe && v.fipe.valor) ? v.fipe.valor : (v.valorFipeFormatado || '-');

            renderLucide();
          }
        } else {
          document.getElementById('val-padrao').innerHTML = \`<span class="status-badge-pill red">Inválida</span>\`;
          document.getElementById('val-conversao').textContent = data.mensagem || 'Placa irregular';
          document.getElementById('val-origem').textContent = '-';
          document.getElementById('val-licenciamento').textContent = '-';
          document.getElementById('val-rodizio').textContent = '-';
          document.getElementById('val-circulacao').textContent = '-';
          const cardEl = document.getElementById('veiculo-card');
          if (cardEl) cardEl.style.display = 'none';
        }

        // Renderiza SVG com categoria e estilo selecionados
        let svgUrl = \`\${API_BASE}/api/placas/\${clean}/svg?categoria=\${currentCategoria}\`;
        if (currentPlateMode === 'antiga') {
          svgUrl = \`\${API_BASE}/api/placas/\${clean}/antiga-svg\`;
        }
        const resSvg = await fetch(svgUrl);
        if (resSvg.ok) {
          const svgTxt = await resSvg.text();
          document.getElementById('plate-svg-box').innerHTML = svgTxt;
        }
      } catch (err) {
        renderJsonToConsole({ erro: 'FALHA_CONEXAO', mensagem: err.message }, '500 ERRO', false, Math.round(performance.now() - t0));
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
      const res = await fetch(\`\${API_BASE}/api/placas/gerador\`);
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
      consoleOutput.textContent = 'Decodificando chassi na borda...';

      const t0 = performance.now();
      try {
        const res = await fetch(\`\${API_BASE}/api/placas/chassi/\${clean}\`);
        const data = await res.json();
        const lat = Math.round(performance.now() - t0);

        renderJsonToConsole(data, res.ok ? '200 OK' : \`\${res.status} ERRO\`, res.ok, lat);

        if (data.valido) {
          document.getElementById('val-chassi-wmi').textContent = \`\${data.fabricante} (\${data.wmi})\`;
          document.getElementById('val-chassi-pais').textContent = \`\${data.paisFabricacao} (\${data.origem})\`;
          document.getElementById('val-chassi-ano').textContent = data.anoModelo;
          document.getElementById('val-chassi-check').innerHTML = data.checkDigitValido
            ? \`<span class="status-badge-pill green">Válido (\${data.checkDigitCalculado})</span>\`
            : \`<span class="status-badge-pill red">Informado: \${data.checkDigitInformado} (Esperado: \${data.checkDigitCalculado})</span>\`;
          document.getElementById('val-chassi-serie').textContent = \`Planta \${data.plantaMontagem} · Série \${data.numeroSerie}\`;
          
          document.getElementById('display-fabricante-nome').textContent = data.fabricante;
          document.getElementById('display-fabricante-origem').textContent = \`Código WMI: \${data.wmi} · \${data.paisFabricacao} (\${data.origem})\`;

          // Busca o logo vetorial oficial na API Icons Pro!
          const logoSlug = BRAND_LOGOS[data.fabricante] || 'volkswagen';
          document.getElementById('brand-logo-img').src = \`https://icons-pro-api.maputo2.workers.dev/api/icons/\${logoSlug}.svg\`;
        } else {
          document.getElementById('val-chassi-wmi').innerHTML = \`<span class="status-badge-pill red">Inválido</span>\`;
          document.getElementById('val-chassi-pais').textContent = data.mensagem;
          document.getElementById('val-chassi-ano').textContent = '-';
          document.getElementById('val-chassi-check').textContent = '-';
          document.getElementById('val-chassi-serie').textContent = '-';
        }
      } catch (err) {
        renderJsonToConsole({ erro: 'FALHA_CONEXAO', mensagem: err.message }, '500 ERRO', false, Math.round(performance.now() - t0));
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
      consoleOutput.textContent = 'Validando RENAVAM...';

      const t0 = performance.now();
      try {
        const res = await fetch(\`\${API_BASE}/api/placas/renavam/\${clean}\`);
        const data = await res.json();
        const lat = Math.round(performance.now() - t0);

        renderJsonToConsole(data, res.ok ? '200 OK' : \`\${res.status} ERRO\`, res.ok, lat);

        const badge = document.getElementById('renavam-status-badge');
        const disp = document.getElementById('renavam-display-val');
        const msg = document.getElementById('renavam-msg-val');

        disp.textContent = data.renavamFormatado || clean;
        msg.textContent = data.mensagem;

        if (data.valido) {
          badge.className = 'status-badge-pill green';
          badge.textContent = 'RENAVAM REGULAR & VÁLIDO';
        } else {
          badge.className = 'status-badge-pill red';
          badge.textContent = 'RENAVAM INVÁLIDO';
        }
      } catch (err) {
        renderJsonToConsole({ erro: 'FALHA_CONEXAO', mensagem: err.message }, '500 ERRO', false, Math.round(performance.now() - t0));
      }
    }

    document.getElementById('btn-exec-renavam').addEventListener('click', () => {
      executarValidacaoRenavam(document.getElementById('renavam-input').value);
    });

    document.getElementById('btn-gerar-renavam').addEventListener('click', async () => {
      const res = await fetch(\`\${API_BASE}/api/placas/gerador\`);
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

      const t0 = performance.now();
      try {
        const res = await fetch(\`\${API_BASE}/api/placas/flex?etanol=\${e}&gasolina=\${g}\`);
        const data = await res.json();
        const lat = Math.round(performance.now() - t0);

        renderJsonToConsole(data, res.ok ? '200 OK' : \`\${res.status} ERRO\`, res.ok, lat);

        const box = document.getElementById('flex-box-result');
        const best = document.getElementById('flex-best');
        const pct = document.getElementById('flex-pct');
        const desc = document.getElementById('flex-desc');

        if (data.combustivelVantajoso === 'ETANOL') {
          box.style.borderColor = 'rgba(16, 185, 129, 0.35)';
          best.innerHTML = '<i data-lucide="leaf" style="color:#10b981;width:28px;height:28px;"></i> <span>ETANOL</span>';
        } else {
          box.style.borderColor = 'rgba(245, 158, 11, 0.35)';
          best.innerHTML = '<i data-lucide="fuel" style="color:#f59e0b;width:28px;height:28px;"></i> <span>GASOLINA</span>';
        }
        pct.textContent = \`Paridade: \${data.paridadePercentual} (Limiar técnico: \${data.limiarAdotado})\`;
        desc.textContent = data.parecerTecnico;
        renderLucide();
      } catch (err) {
        renderJsonToConsole({ erro: 'FALHA_CONEXAO', mensagem: err.message }, '500 ERRO', false, Math.round(performance.now() - t0));
      }
    }

    document.getElementById('flex-etanol').addEventListener('input', executarCalculoFlex);
    document.getElementById('flex-gasolina').addEventListener('input', executarCalculoFlex);

    // ── LÓGICA 5: GRÁFICOS DINÂMICOS VIA GRAFICOS-PRO API ──
    async function carregarGraficosAnycast() {
      const curTheme = document.documentElement.getAttribute('data-theme') || 'dark';

      // 1. Gauge Chart de Rodízio (Paleta Vibrante de Alto Contraste)
      const gaugeContainer = document.getElementById('gauge-container');
      if (gaugeContainer) {
        try {
          const res = await fetch(\`https://graficos-pro-api.maputo2.workers.dev/api/grafico?tipo=gauge&valor=25&min=0&max=100&titulo=RODIZIO+SP+CET&subtitulo=Circulacao+Liberada&tema=\${curTheme}&paleta=contrast\`);
          if (res.ok) {
            gaugeContainer.innerHTML = await res.text();
          }
        } catch (_) {}
      }

      // 2. Area Chart de Depreciação FIPE 5 Anos
      const areaContainer = document.getElementById('area-chart-container');
      if (areaContainer) {
        try {
          const res = await fetch(\`https://graficos-pro-api.maputo2.workers.dev/api/grafico?tipo=area&valores=90,82,74,68,62,56&labels=2021,2022,2023,2024,2025,2026&titulo=Depreciacao+FIPE+e+IPVA+(5+Anos)&prefixo=R$+&sufixo=k&tema=\${curTheme}&paleta=contrast\`);
          if (res.ok) {
            areaContainer.innerHTML = await res.text();
          }
        } catch (_) {}
      }

      // 3. Donut Chart de Paridade Flex
      const donutContainer = document.getElementById('donut-chart-container');
      if (donutContainer) {
        try {
          const res = await fetch(\`https://graficos-pro-api.maputo2.workers.dev/api/grafico?tipo=donut&valores=64.7,35.3&labels=Etanol,Gasolina&titulo=Paridade+Flex&tema=\${curTheme}&paleta=flex&furo=0.65\`);
          if (res.ok) {
            donutContainer.innerHTML = await res.text();
          }
        } catch (_) {}
      }
    }

    // ── LÓGICA 6: CATÁLOGO NACIONAL DE VEÍCULOS & FIPE (100% OFICIAL) ──
    const MARCAS_CLIENT = ${JSON.stringify(MONTADORAS_BRASIL)};
    const FAMILIAS_CLIENT = ${JSON.stringify(FAMILIAS_VEICULOS_BRASIL)};
    let catalogoAtivoCategoria = 'todos';
    let catalogoAtivoMarca = '';

    async function carregarCatalogoVeiculos() {
      const q = (document.getElementById('catalogo-search-input')?.value || '').toLowerCase().trim();
      const grid = document.getElementById('catalogo-modelos-grid');
      const marcasContainer = document.getElementById('marcas-grid-container');
      if (!grid) return;

      // 1. Renderiza Marcas com Logos do Icons Pro
      if (marcasContainer && marcasContainer.children.length === 0) {
        const marcas = MARCAS_CLIENT;
        marcasContainer.innerHTML = marcas.map(m => \`
          <button class="secondary-button marca-chip-btn" data-marca="\${m.id}" style="height:32px;padding:0 10px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;border-radius:var(--radius-full);">
            <img src="https://icons-pro-api.maputo2.workers.dev/api/icons/\${m.logoSlug}.svg" alt="\${m.nome}" style="width:14px;height:14px;object-fit:contain;" />
            <span>\${m.nome}</span>
          </button>
        \`).join('');

        marcasContainer.querySelectorAll('.marca-chip-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const isSelected = btn.classList.contains('is-selected');
            marcasContainer.querySelectorAll('.marca-chip-btn').forEach(b => {
              b.classList.remove('is-selected');
              b.style.borderColor = 'var(--line)';
              b.style.color = 'var(--muted)';
            });
            if (!isSelected) {
              btn.classList.add('is-selected');
              btn.style.borderColor = 'var(--blue)';
              btn.style.color = 'var(--blue)';
              catalogoAtivoMarca = btn.dataset.marca;
            } else {
              catalogoAtivoMarca = '';
            }
            carregarCatalogoVeiculos();
          });
        });
      }

      // 2. Busca e Renderiza Veículos do Catálogo
      let lista = FAMILIAS_CLIENT;
      if (q) {
        lista = lista.filter(v => v.nomeCompleto.toLowerCase().includes(q) || v.marca.toLowerCase().includes(q) || v.modelo.toLowerCase().includes(q) || (v.fipe && v.fipe.codigo.includes(q)));
      }
      if (catalogoAtivoMarca) {
        lista = lista.filter(v => v.marca.toLowerCase().includes(catalogoAtivoMarca));
      }
      if (catalogoAtivoCategoria && catalogoAtivoCategoria !== 'todos') {
        lista = lista.filter(v => v.categoriaGeral === catalogoAtivoCategoria);
      }

      if (lista.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--muted);font-size:13px;">Nenhum veículo encontrado com os filtros selecionados.</div>';
        return;
      }

      grid.innerHTML = lista.map(v => {
        const silhueta = gerarSilhuetaClient(v.segmento, v.corHex);
        return \`
          <div class="api-card" style="padding:14px;border-radius:var(--radius-lg);background:var(--paper);border:1px solid var(--line);display:flex;flex-direction:column;gap:8px;">
            <div style="background:#090d16;border-radius:var(--radius-md);padding:6px;overflow:hidden;border:1px solid var(--line-light);">
              \${silhueta}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
              <div>
                <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;">\${v.marca} • \${v.segmento}</div>
                <strong style="font-size:13.5px;color:var(--ink);">\${v.modelo}</strong>
              </div>
              <span class="status-badge-pill green" style="font-size:10.5px;padding:2px 8px;">\${v.fipe ? v.fipe.valor : 'Consulte'}</span>
            </div>
            <div style="font-size:11px;color:var(--muted);line-height:1.4;">
              \${v.versaoPrincipal || v.nomeCompleto}
            </div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;font-size:9.5px;margin-top:auto;padding-top:6px;border-top:1px solid var(--line-light);">
              <span class="category-pill">\${v.potenciaCv} cv</span>
              <span class="category-pill blue">\${v.combustivelPadrao.split(' ')[0]}</span>
              <span class="category-pill">\${v.inmetro ? v.inmetro.selo : 'PBEV A'}</span>
            </div>
          </div>
        \`;
      }).join('');
    }

    // Filtros de Categoria do Catálogo
    document.querySelectorAll('.cat-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cat-filter-btn').forEach(b => {
          b.classList.remove('is-selected');
          b.style.borderColor = 'var(--line)';
          b.style.color = 'var(--muted)';
        });
        btn.classList.add('is-selected');
        btn.style.borderColor = 'var(--blue)';
        btn.style.color = 'var(--blue)';
        catalogoAtivoCategoria = btn.dataset.cat || 'todos';
        carregarCatalogoVeiculos();
      });
    });

    document.getElementById('catalogo-search-input')?.addEventListener('input', () => {
      carregarCatalogoVeiculos();
    });
    document.getElementById('btn-catalogo-buscar')?.addEventListener('click', () => {
      carregarCatalogoVeiculos();
    });

    // Botão Executar Sandbox
    document.getElementById('btn-run-sandbox').addEventListener('click', () => {
      const tab = getActiveTab();
      if (tab === 'placas') executarConsultaPlaca(document.getElementById('placa-input').value);
      else if (tab === 'chassi') executarConsultaChassi(document.getElementById('chassi-input').value);
      else if (tab === 'renavam') executarValidacaoRenavam(document.getElementById('renavam-input').value);
      else if (tab === 'flex') executarCalculoFlex();
      else if (tab === 'graficos') carregarGraficosAnycast();
      else if (tab === 'catalogo') carregarCatalogoVeiculos();
    });

    // Inicialização
    renderLucide();
    setTimeout(() => {
      renderLucide();
      executarConsultaPlaca('BRA2E19');
    }, 100);
  </script>

    <!-- Barra de Navegação Inferior Mobile Oficial -->
    <nav class="mobile-bottom-nav" id="mobile-bottom-nav" aria-label="Navegação mobile">
      <button class="mobile-nav-item is-active" data-tab="placas">
        <i data-lucide="car"></i><span>Placas</span>
      </button>
      <button class="mobile-nav-item " data-tab="chassi">
        <i data-lucide="scan"></i><span>Chassi</span>
      </button>
      <button class="mobile-nav-item " data-tab="renavam">
        <i data-lucide="file-check-2"></i><span>RENAVAM</span>
      </button>
      <button class="mobile-nav-item " data-tab="flex">
        <i data-lucide="fuel"></i><span>Flex</span>
      </button>
      <button class="mobile-nav-item " data-tab="graficos">
        <i data-lucide="pie-chart"></i><span>Gráficos</span>
      </button>
      <button class="mobile-nav-item " data-tab="catalogo">
        <i data-lucide="layers"></i><span>Catálogo</span>
      </button>
    </nav>

</body>
</html>
`;

fs.writeFileSync('index.html', html, 'utf8');

// Also update site-assets.js so the Cloudflare Worker serves this updated HTML!
const assetsPath = 'site-assets.js';
if (fs.existsSync(assetsPath)) {
  let assetsText = fs.readFileSync(assetsPath, 'utf8');
  const startTag = 'export const HTML_INDEX =';
  const startIdx = assetsText.indexOf(startTag);
  if (startIdx !== -1) {
    const endTag1 = 'export const CLIENT_JS';
    const endTag2 = 'export const OZPRO_MARK_SVG';
    const nextIdx1 = assetsText.indexOf(endTag1, startIdx);
    const nextIdx2 = assetsText.indexOf(endTag2, startIdx);
    const nextIdx = Math.min(nextIdx1 !== -1 ? nextIdx1 : Infinity, nextIdx2 !== -1 ? nextIdx2 : Infinity);
    if (nextIdx !== Infinity) {
      assetsText = assetsText.slice(0, startIdx) + `export const HTML_INDEX = ${JSON.stringify(html)};\r\n\r\n` + assetsText.slice(nextIdx);
      fs.writeFileSync(assetsPath, assetsText, 'utf8');
      console.log('site-assets.js updated with updated HTML_INDEX!');
    }
  }
}

console.log('placas-pro index.html updated with clean Lucide icons and icons-pro integration!');
