document.addEventListener('DOMContentLoaded', () => {
  const els = {
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    modeLocal: document.getElementById('modeLocal'),
    modeCloud: document.getElementById('modeCloud'),
    modeDescription: document.getElementById('modeDescription'),
    dollarsSaved: document.getElementById('dollarsSaved'),
    localPercent: document.getElementById('localPercent'),
    localBar: document.getElementById('localBar'),
    cloudPercent: document.getElementById('cloudPercent'),
    cloudBar: document.getElementById('cloudBar'),
    eventList: document.getElementById('eventList'),
    eventEmpty: document.getElementById('eventEmpty'),
    eventCount: document.getElementById('eventCount'),
    clearEvents: document.getElementById('clearEvents'),
    resetStats: document.getElementById('resetStats'),
    ollamaFooterStatus: document.getElementById('ollamaFooterStatus'),
  };

  let currentMode = 'local';
  let targetDollars = 0;
  let displayedDollars = 0;

  function animateValue(el, target) {
    const start = displayedDollars;
    targetDollars = target;
    if (start === target) return;
    const duration = 800;
    const startTime = performance.now();
    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (targetDollars - start) * eased;
      el.textContent = `$${current.toFixed(2)}`;
      if (progress < 1) requestAnimationFrame(tick);
      else displayedDollars = targetDollars;
    }
    requestAnimationFrame(tick);
  }

  function updateModeUI(local) {
    currentMode = local ? 'local' : 'cloud';
    els.modeLocal.className = local ? 'active-local' : '';
    els.modeCloud.className = local ? '' : 'active-cloud';
    els.modeDescription.textContent = local
      ? 'Privacy First \u2014 Data stays on this Mac'
      : 'Performance First \u2014 Using Premium Cloud';
    els.statusText.textContent = local ? 'Local' : 'Cloud';
    setDotStatus('idle', local);
  }

  function setDotStatus(state, isLocal) {
    if (state === 'connected') {
      els.statusDot.style.background = '#10b981';
      els.statusDot.className = 'w-2.5 h-2.5 rounded-full glow-emerald';
      els.ollamaFooterStatus.textContent = 'online';
      els.ollamaFooterStatus.style.color = '#10b981';
    } else if (state === 'disconnected') {
      els.statusDot.style.background = '#ef4444';
      els.statusDot.className = 'w-2.5 h-2.5 rounded-full glow-red';
      els.ollamaFooterStatus.textContent = 'offline';
      els.ollamaFooterStatus.style.color = '#ef4444';
    } else {
      const col = isLocal ? '#10b981' : '#3b82f6';
      els.statusDot.style.background = col;
      els.statusDot.className = `w-2.5 h-2.5 rounded-full`;
      els.ollamaFooterStatus.textContent = isLocal ? 'standby' : 'remote';
      els.ollamaFooterStatus.style.color = '#64748b';
    }
    if (state === 'connected' && !currentMode.startsWith('local')) {
      els.statusDot.style.background = '#3b82f6';
      els.statusDot.className = `w-2.5 h-2.5 rounded-full`;
      els.ollamaFooterStatus.textContent = 'remote';
      els.ollamaFooterStatus.style.color = '#64748b';
    }
  }

  function renderEvents(events) {
    if (!events || events.length === 0) {
      els.eventList.innerHTML = `<div class="text-[10px] text-gray-600 text-center py-4" id="eventEmpty">No security events</div>`;
      els.eventCount.textContent = '0';
      return;
    }
    els.eventList.innerHTML = events.slice(-20).reverse().map(e => `
      <div class="event-enter flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors">
        <svg class="mt-0.5 flex-shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="text-[9px] font-bold text-rose-400 uppercase tracking-wider">Blocked</span>
            <span class="text-[10px] text-gray-300 truncate">${e.label}</span>
          </div>
          <div class="flex items-center gap-2 text-[9px] text-gray-600 mt-0.5">
            <span>${e.timestamp}</span>
            <span>·</span>
            <span>${e.platform}</span>
          </div>
        </div>
      </div>
    `).join('');
    els.eventCount.textContent = events.length.toString();
  }

  function updateGauges(localCount, cloudCount) {
    const total = localCount + cloudCount || 1;
    const localPct = Math.round((localCount / total) * 100);
    const cloudPct = 100 - localPct;
    els.localPercent.textContent = `${localPct}%`;
    els.cloudPercent.textContent = `${cloudPct}%`;
    els.localBar.style.width = `${localPct}%`;
    els.cloudBar.style.width = `${cloudPct}%`;
  }

  async function loadFullState() {
    const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    const events = await chrome.runtime.sendMessage({ type: 'GET_EVENTS' });
    const traffic = await chrome.runtime.sendMessage({ type: 'GET_TRAFFIC' });

    updateModeUI(state.localMode);
    animateValue(els.dollarsSaved, state.dollarsSaved || 0);
    displayedDollars = state.dollarsSaved || 0;
    updateGauges(traffic.localCount || 0, traffic.cloudCount || 0);
    renderEvents(events || []);

    if (state.localMode) checkOllama(state.ollamaModel);
    return state;
  }

  async function checkOllama(detectedModel) {
    if (detectedModel) {
      setDotStatus('connected', true);
      els.statusText.textContent = detectedModel;
      els.ollamaFooterStatus.textContent = detectedModel;
      return;
    }
    try {
      const res = await fetch('http://127.0.0.1:11434/api/tags');
      if (res.ok) {
        const data = await res.json();
        const models = data.models || [];
        if (models.length > 0) {
          setDotStatus('connected', true);
          els.statusText.textContent = models[0].name;
          els.ollamaFooterStatus.textContent = models[0].name;
        } else {
          setDotStatus('disconnected', true);
          els.statusText.textContent = 'No Models';
          els.ollamaFooterStatus.textContent = 'no models';
        }
      } else {
        setDotStatus('disconnected', true);
        els.statusText.textContent = 'Offline';
      }
    } catch {
      setDotStatus('disconnected', true);
      els.statusText.textContent = 'Offline';
    }
  }

  els.modeLocal.addEventListener('click', async () => {
    if (currentMode === 'local') return;
    updateModeUI(true);
    await chrome.runtime.sendMessage({ type: 'SET_LOCAL_MODE', enabled: true });
    checkOllama();
  });

  els.modeCloud.addEventListener('click', async () => {
    if (currentMode === 'cloud') return;
    updateModeUI(false);
    await chrome.runtime.sendMessage({ type: 'SET_LOCAL_MODE', enabled: false });
    setDotStatus('idle', false);
  });

  els.clearEvents.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'CLEAR_EVENTS' });
    renderEvents([]);
  });

  els.resetStats.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'RESET_STATS' });
    await chrome.runtime.sendMessage({ type: 'RESET_TRAFFIC' });
    animateValue(els.dollarsSaved, 0);
    displayedDollars = 0;
    updateGauges(0, 0);
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.dollarsSaved) {
      animateValue(els.dollarsSaved, changes.dollarsSaved.newValue || 0);
    }
    if (changes.localMode) {
      updateModeUI(changes.localMode.newValue);
      if (changes.localMode.newValue) checkOllama();
    }
    if (changes.securityEvents) {
      renderEvents(changes.securityEvents.newValue || []);
    }
    if (changes.trafficStats) {
      const t = changes.trafficStats.newValue || { localCount: 0, cloudCount: 0 };
      updateGauges(t.localCount, t.cloudCount);
    }
  });

  loadFullState();
});
