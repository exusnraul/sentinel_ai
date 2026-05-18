let ollamaModel = null;
let modelCacheTime = 0;

const OLLAMA = 'http://127.0.0.1:11434';

async function ollamaFetch(path, opts = {}) {
  const url = `${OLLAMA}${path}`;
  const res = await fetch(url, {
    method: opts.method || 'GET',
    body: opts.body || undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama error (${res.status}): ${text || res.statusText}`);
  }
  return res.json();
}

async function detectOllamaModel() {
  if (ollamaModel && Date.now() - modelCacheTime < 30000) return ollamaModel;
  try {
    const data = await ollamaFetch('/api/tags');
    if (data.models && data.models.length > 0) {
      ollamaModel = data.models[0].name;
      modelCacheTime = Date.now();
      return ollamaModel;
    }
  } catch {}
  return null;
}

async function routeToOllama(prompt) {
  const model = await detectOllamaModel();
  if (!model) throw new Error('No Ollama model available. Pull a model first (e.g. `ollama pull llama3.2`).');
  const data = await ollamaFetch('/api/generate', {
    method: 'POST',
    body: JSON.stringify({ model, prompt, stream: false }),
  });
  const response = data.response || '';
  const tokenCount = Math.max(1, Math.round((prompt.length + response.length) / 4));
  const { tokensSaved = 0, dollarsSaved = 0 } = await chrome.storage.local.get(['tokensSaved', 'dollarsSaved']);
  await chrome.storage.local.set({
    tokensSaved: tokensSaved + tokenCount,
    dollarsSaved: dollarsSaved + (tokenCount / 1000) * 0.03,
  });
  return { success: true, response };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_STATE':
      chrome.storage.local.get(['localMode', 'tokensSaved', 'dollarsSaved']).then(async data => {
        const model = await detectOllamaModel();
        sendResponse({
          localMode: data.localMode || false,
          tokensSaved: data.tokensSaved || 0,
          dollarsSaved: data.dollarsSaved || 0,
          ollamaModel: model,
        });
      });
      return true;

    case 'SET_LOCAL_MODE':
      chrome.storage.local.set({ localMode: message.enabled }).then(() => {
        sendResponse({ success: true });
      });
      return true;

    case 'ADD_TOKENS':
      chrome.storage.local.get(['tokensSaved', 'dollarsSaved']).then(async (data) => {
        const tokensSaved = (data.tokensSaved || 0) + message.count;
        const dollarsSaved = (data.dollarsSaved || 0) + (message.count / 1000) * 0.03;
        await chrome.storage.local.set({ tokensSaved, dollarsSaved });
        sendResponse({ tokensSaved, dollarsSaved });
      });
      return true;

    case 'RESET_STATS':
      chrome.storage.local.set({ tokensSaved: 0, dollarsSaved: 0 }).then(() => {
        sendResponse({ success: true });
      });
      return true;

    case 'ROUTE_TO_OLLAMA':
      routeToOllama(message.prompt)
        .then(r => sendResponse(r))
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;

    case 'GET_EVENTS':
      chrome.storage.local.get('securityEvents').then(data => {
        sendResponse(data.securityEvents || []);
      });
      return true;

    case 'CLEAR_EVENTS':
      chrome.storage.local.set({ securityEvents: [] }).then(() => {
        sendResponse({ success: true });
      });
      return true;

    case 'GET_TRAFFIC':
      chrome.storage.local.get('trafficStats').then(data => {
        sendResponse(data.trafficStats || { localCount: 0, cloudCount: 0 });
      });
      return true;

    case 'RESET_TRAFFIC':
      chrome.storage.local.set({ trafficStats: { localCount: 0, cloudCount: 0 } }).then(() => {
        sendResponse({ success: true });
      });
      return true;

    case 'PING_OLLAMA':
      detectOllamaModel()
        .then(model => sendResponse({ success: true, model }))
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;

    case 'GET_MODEL':
      detectOllamaModel().then(model => sendResponse({ model }));
      return true;
  }
});
