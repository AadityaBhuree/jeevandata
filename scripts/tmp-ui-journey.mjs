// Direct CDP browser automation for the Jeevandata clinic journey.
// Launches headless Chrome with a fake camera/mic, drives the landing ->
// session creation -> intake page flow, and reports UI state + console errors.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9222;
const BASE = `http://localhost:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Launch Chrome headless with fake media devices
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=C:/Users/Aditya/AppData/Local/Temp/chrome-jeevandata',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--no-first-run',
    '--disable-gpu',
    '--window-size=1400,900',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

// 2. Wait for the DevTools endpoint
let version = null;
for (let i = 0; i < 40; i++) {
  try {
    const r = await fetch(`${BASE}/json/version`);
    if (r.ok) {
      version = await r.json();
      break;
    }
  } catch {}
  await sleep(500);
}
if (!version) {
  console.log(JSON.stringify({ error: 'NO_DEBUGGER_ENDPOINT' }));
  chrome.kill();
  process.exit(1);
}

// 3. Connect to the page target
const targets = await (await fetch(`${BASE}/json/list`)).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);

let msgId = 0;
const pending = new Map();
const consoleErrors = [];
const networkFailures = [];
const exceptions = [];

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
    return;
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    exceptions.push((msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text ?? '').slice(0, 300));
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
  }
  if (msg.method === 'Network.loadingFailed') {
    networkFailures.push(`${msg.params.errorText} (${msg.params.type ?? 'other'})`);
  }
};

await new Promise((resolve) => (ws.onopen = resolve));

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalJs(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return `EVAL_ERR: ${r.result.exceptionDetails.text}`;
  return r.result?.result?.value;
}

const report = {};

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Browser.grantPermissions', {
    permissions: ['audioCapture', 'videoCapture'],
    origin: 'http://localhost:3000',
  });

  // ── Landing page ──────────────────────────────────────────────
  await send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(8000);
  report.landing = {
    title: await evalJs('document.title'),
    body: (await evalJs('document.body.innerText'))?.slice(0, 500),
  };

  // ── Click the CTA (same handler as a human click) ─────────────
  report.click = await evalJs(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('Start New Intake Session'));
    if (!b) return 'CTA_NOT_FOUND';
    b.click();
    return 'CLICKED';
  })()`);
  await sleep(7000);
  report.afterClickPath = await evalJs('location.pathname');

  // ── Intake page settle (MediaPipe WASM + camera) ──────────────
  await sleep(15000);
  report.intake = JSON.parse(
    (await evalJs(`JSON.stringify({
      path: location.pathname,
      hasVideo: !!document.querySelector('video'),
      videoReadyState: document.querySelector('video') ? document.querySelector('video').readyState : -1,
      videoPlaying: document.querySelector('video') ? !document.querySelector('video').paused : false,
      videoDim: document.querySelector('video') ? document.querySelector('video').videoWidth + 'x' + document.querySelector('video').videoHeight : 'n/a',
      bodyText: document.body.innerText.slice(0, 1100),
      buttons: [...document.querySelectorAll('button')].map((b) => b.innerText.trim()).filter(Boolean).slice(0, 12),
    })`)) ?? '{}',
  );

  // ── Screenshot ────────────────────────────────────────────────
  try {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync('/tmp/ui-journey.png', Buffer.from(shot.result.data, 'base64'));
    report.screenshot = '/tmp/ui-journey.png';
  } catch (e) {
    report.screenshot = `FAILED: ${e.message}`;
  }
} catch (e) {
  report.fatal = e.message;
}

report.consoleErrors = consoleErrors;
report.networkFailures = networkFailures.slice(0, 10);
report.exceptions = exceptions.slice(0, 5);

console.log(JSON.stringify(report, null, 2));
chrome.kill();
process.exit(0);
