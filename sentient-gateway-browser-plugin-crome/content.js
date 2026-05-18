(() => {
  const PLATFORMS = {
    chatgpt: {
      hostnames: ['chat.openai.com', 'chatgpt.com'],
      selectors: { textarea: '#prompt-textarea', sendButton: 'button[data-testid="send-button"]' },
    },
    claude: {
      hostnames: ['claude.ai'],
      selectors: { textarea: 'div[contenteditable="true"]', sendButton: 'button[aria-label="Send message"]' },
    },
    gemini: {
      hostnames: ['gemini.google.com'],
      selectors: { textarea: 'textarea[name="question"]', sendButton: 'button[aria-label="Send"]' },
    },
  };

  const SENSITIVE_PATTERNS = [
    { pattern: /sk-[A-Za-z0-9]{20,}/g, label: 'OpenAI API Key' },
    { pattern: /AIza[0-9A-Za-z\-_]{35}/g, label: 'Google API Key' },
    { pattern: /gh[pousr]_[A-Za-z0-9]{36,}/g, label: 'GitHub Token' },
    { pattern: /[\w.+-]+@[\w.-]+\.\w{2,}/g, label: 'Email Address' },
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, label: 'SSN' },
    { pattern: /\b(?:\d[ -]?){13,16}\b/g, label: 'Card Number' },
    { pattern: /-----BEGIN .*? PRIVATE KEY-----/g, label: 'Private Key' },
    { pattern: /AKIA[0-9A-Z]{16}/g, label: 'AWS Access Key' },
    { pattern: /(?:password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, label: 'Credential' },
  ];

  let platform = null;
  let isActive = true;
  let state = { dangerActive: false, sensitiveTypes: [], acknowledged: false, localMode: false };
  let bannerEl = null;
  let modalEl = null;

  function safeStorageGet(keys, fallback = {}) {
    if (!isActive) return Promise.resolve(typeof keys === 'string' ? { [keys]: fallback } : fallback);
    return chrome.storage.local.get(keys).catch(err => {
      if (err.message?.includes('Extension context invalidated') || err.message?.includes('context invalidated')) {
        isActive = false;
        teardown();
      }
      return typeof keys === 'string' ? { [keys]: fallback } : fallback;
    });
  }

  function safeStorageSet(data) {
    if (!isActive) return Promise.resolve();
    return chrome.storage.local.set(data).catch(err => {
      if (err.message?.includes('Extension context invalidated') || err.message?.includes('context invalidated')) {
        isActive = false;
        teardown();
      }
    });
  }

  function safeSendMessage(msg, fallback = null) {
    if (!isActive) return Promise.resolve(fallback);
    return chrome.runtime.sendMessage(msg).catch(err => {
      if (err.message?.includes('Extension context invalidated') || err.message?.includes('context invalidated') || err.message?.includes('Receiving end does not exist')) {
        isActive = false;
        teardown();
      }
      return fallback;
    });
  }

  function teardown() {
    removeBanner();
    closeModal();
    hideChatPanel();
    hideLoadingOverlay();
    const ro = document.getElementById('sg-response');
    if (ro) ro.remove();
    const eo = document.getElementById('sg-error');
    if (eo) eo.remove();
    enableSend();
  }

  function detectPlatform() {
    const host = location.hostname;
    for (const [key, cfg] of Object.entries(PLATFORMS)) {
      if (cfg.hostnames.some(h => host.includes(h))) return { key, ...cfg };
    }
    return null;
  }

  function getText(el) {
    if (!el) return '';
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return el.value;
    return el.textContent || '';
  }

  function setText(el, text) {
    if (!el) return;
    if (el.tagName === 'TEXTAREA') { el.value = text; return; }
    el.textContent = text;
  }

  function detectSensitiveData(text) {
    const found = [];
    for (const { pattern, label } of SENSITIVE_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) found.push(label);
    }
    return [...new Set(found)];
  }

  function injectBanner(types) {
    removeBanner();
    bannerEl = document.createElement('div');
    bannerEl.id = 'sg-banner';
    bannerEl.innerHTML = `
      <style>
        @keyframes sg-countdown-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes sg-banner-slide { from{transform:translateY(-100%)} to{transform:translateY(0)} }
      </style>
      <div style="animation:sg-banner-slide 0.35s cubic-bezier(0.16,1,0.3,1) forwards;position:fixed;top:0;left:0;right:0;z-index:999999;background:rgba(15,23,42,0.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid rgba(244,63,94,0.35);padding:10px 16px;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;box-shadow:0 8px 32px rgba(244,63,94,0.15);">
        <div style="display:flex;align-items:center;justify-content:space-between;max-width:900px;margin:0 auto;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#f43f5e,#e11d48);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:11px;font-weight:800;color:#f43f5e;letter-spacing:0.04em;text-transform:uppercase;">Sensitive Data Detected</span>
                <span style="background:#f43f5e;color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;letter-spacing:0.03em;">THREAT</span>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px;">${types.map(t => `<span style="background:rgba(244,63,94,0.15);color:#fb7185;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:600;">${t}</span>`).join('')}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <span id="sg-countdown" style="font-size:11px;font-weight:700;color:#94a3b8;min-width:16px;text-align:center;animation:sg-countdown-pulse 1s ease-in-out infinite;">3</span>
            <button id="sg-ignore-btn" disabled style="background:rgba(244,63,94,0.1);color:#94a3b8;border:1px solid rgba(244,63,94,0.2);padding:5px 12px;border-radius:6px;font-size:10px;font-weight:700;cursor:not-allowed;transition:all 0.2s;text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap;">
              Ignore &amp; Send
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.prepend(bannerEl);
    document.body.style.paddingTop = '54px';
    startCountdown();
  }

  function startCountdown() {
    let count = 3;
    const cdEl = document.getElementById('sg-countdown');
    const btn = document.getElementById('sg-ignore-btn');
    if (!cdEl || !btn) return;
    const interval = setInterval(() => {
      count--;
      if (cdEl) cdEl.textContent = count;
      if (count <= 0) {
        clearInterval(interval);
        if (btn) {
          btn.disabled = false;
          btn.style.background = '#f43f5e';
          btn.style.color = '#fff';
          btn.style.cursor = 'pointer';
          btn.style.borderColor = '#f43f5e';
          btn.onclick = () => {
            state.acknowledged = true;
            removeBanner();
            enableSend();
          };
        }
        if (cdEl) { cdEl.style.display = 'none'; }
      }
    }, 1000);
  }

  function removeBanner() {
    if (bannerEl) { bannerEl.remove(); bannerEl = null; }
    document.body.style.paddingTop = '';
  }

  function disableSend() {
    const btn = document.querySelector(platform.selectors.sendButton);
    if (btn) { btn.disabled = true; btn.style.opacity = '0.4'; btn.style.cursor = 'not-allowed'; }
  }

  function enableSend() {
    const btn = document.querySelector(platform.selectors.sendButton);
    if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; }
  }

  function showWarningModal(types) {
    if (modalEl) return;
    modalEl = document.createElement('div');
    Object.assign(modalEl.style, {
      position: 'fixed', inset: '0', zIndex: '9999999',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif',
    });
    modalEl.innerHTML = `
      <div style="background:rgba(15,23,42,0.95);backdrop-filter:blur(24px);border-radius:18px;padding:28px 32px;max-width:420px;width:88%;border:1px solid rgba(244,63,94,0.2);box-shadow:0 24px 80px rgba(0,0,0,0.6);animation:sg-modal-in 0.3s cubic-bezier(0.16,1,0.3,1);">
        <style>@keyframes sg-modal-in{from{opacity:0;transform:scale(0.95) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}</style>
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
          <div style="width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#f43f5e,#e11d48);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(244,63,94,0.3);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <h2 style="margin:0;font-size:15px;font-weight:800;color:#fff;letter-spacing:0.02em;">Data Loss Prevention Alert</h2>
            <p style="margin:2px 0 0;font-size:11px;color:#f43f5e;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Threat Level: Critical</p>
          </div>
        </div>
        <div style="background:rgba(244,63,94,0.06);border:1px solid rgba(244,63,94,0.12);border-radius:10px;padding:12px 14px;margin-bottom:16px;">
          <p style="margin:0 0 6px;font-size:10px;color:#94a3b8;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Flagged Content</p>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">${types.map(t => `<span style="background:rgba(244,63,94,0.12);color:#fb7185;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;">${t}</span>`).join('')}</div>
        </div>
        <p style="margin:0 0 22px;font-size:12px;color:#94a3b8;line-height:1.6;">
          Transmitting sensitive data to external AI services may violate corporate security policies.
          Review your input before proceeding.
        </p>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="sg-cancel" style="background:rgba(51,65,85,0.5);color:#cbd5e1;border:1px solid rgba(51,65,85,0.3);padding:8px 18px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;transition:all 0.15s;">Cancel</button>
          <button id="sg-acknowledge" style="background:linear-gradient(135deg,#f43f5e,#e11d48);color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(244,63,94,0.3);transition:all 0.15s;">Send Anyway</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);
    document.getElementById('sg-cancel').onclick = closeModal;
    document.getElementById('sg-acknowledge').onclick = () => {
      state.acknowledged = true;
      closeModal();
      removeBanner();
      enableSend();
    };
  }

  function closeModal() {
    if (modalEl) { modalEl.remove(); modalEl = null; }
  }

  function showResponseOverlay(text) {
    const overlay = document.createElement('div');
    overlay.id = 'sg-response';
    overlay.innerHTML = `
      <style>@keyframes sg-overlay-in{from{opacity:0;transform:translateY(12px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}</style>
      <div style="animation:sg-overlay-in 0.3s cubic-bezier(0.16,1,0.3,1) forwards;position:fixed;bottom:100px;right:20px;width:420px;max-height:520px;background:rgba(15,23,42,0.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(16,185,129,0.2);border-radius:16px;padding:20px;color:#e2e8f0;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;font-size:13px;line-height:1.6;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,0.5);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid rgba(51,65,85,0.3);">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,#10b981,#059669);display:flex;align-items:center;justify-content:center;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span style="font-weight:700;font-size:13px;color:#e2e8f0;">Local AI Response</span>
          </div>
          <button id="sg-overlay-close" style="background:rgba(51,65,85,0.3);border:none;color:#94a3b8;cursor:pointer;width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all 0.15s;">✕</button>
        </div>
        <div style="white-space:pre-wrap;word-break:break-word;color:#cbd5e1;">${escapeHtml(text)}</div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('sg-overlay-close').onclick = () => overlay.remove();
  }

  function showLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'sg-loading';
    overlay.innerHTML = `
      <style>@keyframes sg-spin{to{transform:rotate(360deg)}}@keyframes sg-overlay-in{from{opacity:0;transform:translateY(12px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}</style>
      <div style="animation:sg-overlay-in 0.25s cubic-bezier(0.16,1,0.3,1) forwards;position:fixed;bottom:100px;right:20px;background:rgba(15,23,42,0.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(59,130,246,0.2);border-radius:14px;padding:18px 24px;z-index:999999;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;font-size:13px;box-shadow:0 24px 80px rgba(0,0,0,0.5);display:flex;align-items:center;gap:14px;">
        <span style="width:14px;height:14px;border-radius:50%;border:2px solid rgba(59,130,246,0.2);border-top-color:#3b82f6;animation:sg-spin 0.8s linear infinite;display:inline-block;"></span>
        <div>
          <span style="font-weight:600;">Routing through local AI</span>
          <p style="margin:1px 0 0;font-size:11px;color:#64748b;">Ollama is generating a response...</p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function hideLoadingOverlay() {
    const el = document.getElementById('sg-loading');
    if (el) el.remove();
  }

  function showErrorOverlay(error) {
    const overlay = document.createElement('div');
    overlay.id = 'sg-error';
    overlay.innerHTML = `
      <style>@keyframes sg-overlay-in{from{opacity:0;transform:translateY(12px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}</style>
      <div style="animation:sg-overlay-in 0.3s cubic-bezier(0.16,1,0.3,1) forwards;position:fixed;bottom:100px;right:20px;width:380px;background:rgba(15,23,42,0.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(244,63,94,0.25);border-radius:14px;padding:18px 20px;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;font-size:13px;box-shadow:0 24px 80px rgba(0,0,0,0.5);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <div style="width:24px;height:24px;border-radius:6px;background:linear-gradient(135deg,#f43f5e,#e11d48);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
          <span style="font-weight:700;color:#f43f5e;">Local Mode Error</span>
        </div>
        <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">${escapeHtml(error)}</p>
        <p style="margin:6px 0 0;font-size:11px;color:#64748b;">Ensure Ollama is running on <span style="font-family:monospace;">localhost:11434</span></p>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => { const el = document.getElementById('sg-error'); if (el) el.remove(); }, 8000);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getPlatformName() {
    const h = location.hostname;
    if (h.includes('chat.openai.com') || h.includes('chatgpt.com')) return 'ChatGPT';
    if (h.includes('claude.ai')) return 'Claude';
    if (h.includes('gemini.google.com')) return 'Gemini';
    return 'Unknown';
  }

  function logSecurityEvent(labels) {
    if (!isActive || !labels || labels.length === 0) return;
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const platform = getPlatformName();
    safeStorageGet('securityEvents').then(({ securityEvents = [] }) => {
      for (const label of labels) {
        securityEvents.push({ label, timestamp: ts, platform });
      }
      if (securityEvents.length > 100) securityEvents = securityEvents.slice(-100);
      safeStorageSet({ securityEvents });
    });
  }

  function trackTraffic(type) {
    if (!isActive) return;
    safeStorageGet('trafficStats').then(({ trafficStats = { localCount: 0, cloudCount: 0 } }) => {
      if (type === 'local') trafficStats.localCount++;
      else trafficStats.cloudCount++;
      safeStorageSet({ trafficStats });
    });
  }

  let chatPanel = null;
  let panelConversation = [];

  async function routeToOllamaViaBg(prompt) {
    const result = await safeSendMessage({ type: 'ROUTE_TO_OLLAMA', prompt }, { success: false, error: 'Extension context lost' });
    if (!result || !result.success) throw new Error(result?.error || 'Unknown error');
    return result;
  }

  function getPanelStyles() {
    return {
      container: 'position:fixed;bottom:20px;right:20px;width:380px;height:520px;z-index:999998;background:rgba(15,23,42,0.96);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(51,65,85,0.4);border-radius:16px;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,0.6);font-family:-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif;overflow:hidden;animation:sg-panel-in 0.3s cubic-bezier(0.16,1,0.3,1);',
      msgUser: 'background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.15);border-radius:10px 10px 2px 10px;padding:10px 14px;margin-bottom:8px;align-self:flex-end;max-width:85%;color:#e2e8f0;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word;',
      msgAI: 'background:rgba(30,41,59,0.5);border:1px solid rgba(51,65,85,0.2);border-radius:10px 10px 10px 2px;padding:10px 14px;margin-bottom:8px;align-self:flex-start;max-width:85%;color:#cbd5e1;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word;',
    };
  }

  function showChatPanel() {
    if (chatPanel) return;
    const s = getPanelStyles();
    chatPanel = document.createElement('div');
    chatPanel.id = 'sg-chat-panel';
    chatPanel.innerHTML = `
      <style>
        @keyframes sg-panel-in{from{opacity:0;transform:translateY(16px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes sg-pulse-dot{0%,100%{opacity:1}50%{opacity:0.3}}
        #sg-chat-panel textarea:focus{outline:none}
        #sg-chat-panel ::-webkit-scrollbar{width:3px}
        #sg-chat-panel ::-webkit-scrollbar-thumb{background:#334155;border-radius:99px}
      </style>
      <div style="${s.container}">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px 12px;border-bottom:1px solid rgba(51,65,85,0.3);flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 8px rgba(16,185,129,0.5);"></span>
            <span style="font-weight:700;font-size:13px;color:#e2e8f0;">Local AI</span>
            <span id="sg-panel-model" style="font-size:10px;color:#64748b;font-weight:500;">connecting...</span>
          </div>
          <button id="sg-panel-close" style="background:rgba(51,65,85,0.3);border:none;color:#94a3b8;width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;transition:all 0.15s;">✕</button>
        </div>
        <div id="sg-panel-msgs" style="flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:2px;">
          <div id="sg-panel-welcome" style="text-align:center;padding:40px 20px 20px;color:#475569;">
            <div style="font-size:28px;margin-bottom:8px;opacity:0.4;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            <p style="font-size:12px;font-weight:600;margin:0 0 4px;">Local AI Chat</p>
            <p style="font-size:10px;margin:0;color:#334155;">Start a conversation below</p>
          </div>
        </div>
        <div id="sg-panel-loading" style="display:none;padding:0 16px 4px;">
          <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(30,41,59,0.5);border-radius:8px;">
            <span style="width:10px;height:10px;border-radius:50%;background:#10b981;animation:sg-pulse-dot 1.2s ease-in-out infinite;"></span>
            <span style="font-size:11px;color:#64748b;">Thinking...</span>
          </div>
        </div>
        <div style="padding:12px 16px 14px;border-top:1px solid rgba(51,65,85,0.3);display:flex;gap:8px;flex-shrink:0;">
          <textarea id="sg-panel-input" rows="1" placeholder="Type a message..." style="flex:1;background:rgba(30,41,59,0.5);border:1px solid rgba(51,65,85,0.3);border-radius:10px;padding:9px 12px;color:#e2e8f0;font-size:12px;font-family:inherit;resize:none;line-height:1.5;max-height:80px;"></textarea>
          <button id="sg-panel-send" style="background:linear-gradient(135deg,#10b981,#059669);border:none;color:#fff;width:36px;height:36px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s;box-shadow:0 2px 8px rgba(16,185,129,0.3);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(chatPanel);
    document.getElementById('sg-panel-close').onclick = hideChatPanel;
    document.getElementById('sg-panel-send').onclick = handlePanelSend;
    const input = document.getElementById('sg-panel-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePanelSend(); }
      setTimeout(autoResizeInput, 0);
    });
    input.addEventListener('input', autoResizeInput);
    setTimeout(() => input.focus(), 300);
    fetchModelName();
  }

  function hideChatPanel() {
    if (!chatPanel) return;
    chatPanel.remove();
    chatPanel = null;
  }

  function autoResizeInput() {
    const el = document.getElementById('sg-panel-input');
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 80) + 'px';
  }

  function fetchModelName() {
    safeSendMessage({ type: 'GET_MODEL' }).then(r => {
      const el = document.getElementById('sg-panel-model');
      if (el && r?.model) el.textContent = r.model;
      else if (el) el.textContent = 'local';
    });
  }

  function setPanelLoading(on) {
    const el = document.getElementById('sg-panel-loading');
    if (el) el.style.display = on ? 'block' : 'none';
  }

  function addPanelMessage(role, content) {
    const container = document.getElementById('sg-panel-msgs');
    if (!container) return;
    const welcome = document.getElementById('sg-panel-welcome');
    if (welcome) welcome.remove();
    const s = getPanelStyles();
    const div = document.createElement('div');
    div.style.cssText = role === 'user' ? s.msgUser : s.msgAI;
    div.textContent = content;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function setPanelError(msg) {
    const container = document.getElementById('sg-panel-msgs');
    if (!container) return;
    const div = document.createElement('div');
    div.style.cssText = 'background:rgba(244,63,94,0.08);border:1px solid rgba(244,63,94,0.15);border-radius:10px;padding:10px 14px;margin-bottom:8px;align-self:flex-start;max-width:85%;color:#fb7185;font-size:12px;line-height:1.5;';
    div.textContent = '⚠ ' + msg;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  async function handlePanelSend() {
    const input = document.getElementById('sg-panel-input');
    if (!input || !input.value.trim()) return;
    const prompt = input.value.trim();
    input.value = '';
    input.style.height = 'auto';
    panelConversation.push({ role: 'user', content: prompt });
    addPanelMessage('user', prompt);
    setPanelLoading(true);
    try {
      const result = await routeToOllamaViaBg(prompt);
      setPanelLoading(false);
      panelConversation.push({ role: 'assistant', content: result.response });
      addPanelMessage('assistant', result.response);
      trackTraffic('local');
    } catch (err) {
      setPanelLoading(false);
      setPanelError(err.message);
    }
    setTimeout(() => input.focus(), 100);
  }

  function toggleChatPanel(show) {
    if (show) showChatPanel();
    else hideChatPanel();
  }

  function handleInput(e) {
    const text = getText(e.target);
    const found = detectSensitiveData(text);
    if (found.length > 0) {
      if (!state.dangerActive) {
        state.dangerActive = true;
        state.sensitiveTypes = found;
        injectBanner(found);
        disableSend();
        logSecurityEvent(found);
      } else {
        const newTypes = found.filter(t => !state.sensitiveTypes.includes(t));
        if (newTypes.length > 0) {
          state.sensitiveTypes = found;
          injectBanner(found);
          logSecurityEvent(newTypes);
          if (state.acknowledged) {
            const btn = document.getElementById('sg-ignore-btn');
            if (btn) { btn.disabled = true; btn.style.background = 'rgba(244,63,94,0.1)'; btn.style.color = '#94a3b8'; btn.style.cursor = 'not-allowed'; btn.style.borderColor = 'rgba(244,63,94,0.2)'; }
            startCountdown();
            state.acknowledged = false;
          }
        }
      }
    } else if (found.length === 0 && state.dangerActive) {
      state.dangerActive = false;
      state.sensitiveTypes = [];
      state.acknowledged = false;
      removeBanner();
      enableSend();
    }
  }

  function handlePaste(e) {
    setTimeout(() => {
      if (!isActive) return;
      const textarea = document.querySelector(platform.selectors.textarea);
      if (!textarea) return;
      const text = getText(textarea);
      const found = detectSensitiveData(text);
      if (found.length > 0) {
        if (!state.dangerActive) {
          state.dangerActive = true;
          state.sensitiveTypes = found;
          injectBanner(found);
          disableSend();
          logSecurityEvent(found);
        } else {
          const newTypes = found.filter(t => !state.sensitiveTypes.includes(t));
          if (newTypes.length > 0) {
            state.sensitiveTypes = found;
            injectBanner(found);
            logSecurityEvent(newTypes);
            if (state.acknowledged) {
              const btn = document.getElementById('sg-ignore-btn');
              if (btn) { btn.disabled = true; btn.style.background = 'rgba(244,63,94,0.1)'; btn.style.color = '#94a3b8'; btn.style.cursor = 'not-allowed'; btn.style.borderColor = 'rgba(244,63,94,0.2)'; }
              startCountdown();
              state.acknowledged = false;
            }
          }
        }
      }
    }, 50);
  }

  async function handleSend(e) {
    if (!isActive) return;

    if (state.dangerActive && !state.acknowledged) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      showWarningModal(state.sensitiveTypes);
      return false;
    }

    if (state.dangerActive && state.acknowledged) {
      state.dangerActive = false;
      state.sensitiveTypes = [];
      state.acknowledged = false;
    }
  }

  async function handleKeydown(e) {
    if (!isActive || e.key !== 'Enter' || e.shiftKey) return;

    if (state.dangerActive && !state.acknowledged) {
      e.preventDefault();
      e.stopPropagation();
      showWarningModal(state.sensitiveTypes);
      return;
    }

    if (state.dangerActive && state.acknowledged) {
      state.dangerActive = false;
      state.sensitiveTypes = [];
      state.acknowledged = false;
    }
  }

  function setupTextareaListeners(textarea) {
    if (textarea._sg_monitored) return;
    textarea._sg_monitored = true;
    textarea.addEventListener('input', handleInput);
    textarea.addEventListener('paste', handlePaste);
    textarea.addEventListener('keydown', handleKeydown, true);
  }

  function observeDynamicDOM() {
    const observer = new MutationObserver(() => {
      const ta = document.querySelector(platform.selectors.textarea);
      if (ta && !ta._sg_monitored) setupTextareaListeners(ta);
      const btn = document.querySelector(platform.selectors.sendButton);
      if (btn && !btn._sg_handled) {
        btn._sg_handled = true;
        btn.addEventListener('click', handleSend, true);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function waitForElement(selector, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) { observer.disconnect(); resolve(found); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); reject(new Error('timeout')); }, timeout);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    platform = detectPlatform();
    if (!platform) return;
    init();
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    platform = detectPlatform();
    if (platform) init();
  }

  function init() {
    const ta = document.querySelector(platform.selectors.textarea);
    if (ta) setupTextareaListeners(ta);
    const btn = document.querySelector(platform.selectors.sendButton);
    if (btn) { btn._sg_handled = true; btn.addEventListener('click', handleSend, true); }
    observeDynamicDOM();
    safeStorageGet('localMode').then(({ localMode }) => {
      state.localMode = !!localMode;
      toggleChatPanel(state.localMode);
    });
    if (!chrome.storage) return;
    try {
      chrome.storage.onChanged.addListener(changes => {
        if (!isActive) return;
        if (changes.localMode) {
          state.localMode = changes.localMode.newValue;
          toggleChatPanel(state.localMode);
        }
      });
    } catch {}
  }
})();
