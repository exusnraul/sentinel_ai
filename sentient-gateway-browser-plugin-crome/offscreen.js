const OLLAMA = 'http://localhost:11434';

function xhrFetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(opts.method || 'GET', url);
    if (opts.headers) {
      for (const [k, v] of Object.entries(opts.headers)) {
        xhr.setRequestHeader(k, v);
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { resolve(xhr.responseText); }
      } else {
        const body = xhr.responseText || xhr.statusText;
        reject(new Error(`Ollama error (${xhr.status}): ${body}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error connecting to Ollama'));
    xhr.ontimeout = () => reject(new Error('Ollama request timed out'));
    xhr.timeout = 30000;
    xhr.send(opts.body || null);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  if (message.type === 'OLLAMA_GENERATE') {
    xhrFetch(`${OLLAMA}/api/generate`, {
      method: 'POST',
      body: JSON.stringify({ model: message.model, prompt: message.prompt, stream: false }),
    })
      .then(data => sendResponse({ success: true, response: data.response || '' }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'PING_OLLAMA') {
    xhrFetch(`${OLLAMA}/api/tags`)
      .then(data => sendResponse({ success: true, models: (data.models || []).map(m => m.name) }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'OLLAMA_TAGS') {
    xhrFetch(`${OLLAMA}/api/tags`)
      .then(data => sendResponse({ success: true, models: data.models || [] }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
