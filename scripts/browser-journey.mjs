#!/usr/bin/env node
/**
 * browser-journey.mjs — CDP-driven UI verification of the Jeevandata kiosk flow.
 *
 * Drives a REAL Chrome (headless by default) through the exact steps a kiosk
 * user performs and reports what actually rendered:
 *
 *   1. Landing page loads (title + CTA present)
 *   2. "Start New Intake Session" is clicked  ->  navigates to /intake/<uuid>
 *   3. Intake page settles (idle camera state)
 *   4. "Start Camera" is clicked -> the video stream goes live and the UI
 *      advances to the liveness challenge ("Please blink naturally")
 *   5. Console errors / failed network requests are collected
 *   6. A screenshot is saved (optional)
 *
 * A fake camera/mic is injected (--use-fake-device-for-media-stream), so the
 * stream starts but a face is NOT detected — face matching needs a real webcam.
 *
 * Requirements: Node >= 22 (global WebSocket + fetch), Chrome or Chromium.
 *
 * Usage:
 *   node scripts/browser-journey.mjs
 *   FRONTEND_URL=http://localhost:3000 BACKEND_URL=http://localhost:4000 node scripts/browser-journey.mjs
 *   CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" node scripts/browser-journey.mjs
 *   node scripts/browser-journey.mjs --no-headless --screenshot /tmp/journey.png
 *   node scripts/browser-journey.mjs --fail-on-console-errors
 *
 * Exit codes: 0 = journey verified, 1 = verification failed, 2 = setup error.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ─── Config ────────────────────────────────────────────────────────
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';
const HEADLESS = !process.argv.includes('--no-headless');
const FAIL_ON_CONSOLE_ERRORS = process.argv.includes('--fail-on-console-errors');
const SCREENSHOT_ARG = process.argv.indexOf('--screenshot');
const SCREENSHOT_PATH = SCREENSHOT_ARG >= 0 ? process.argv[SCREENSHOT_ARG + 1] : undefined;
const SCREENSHOT = process.argv.includes('--no-screenshot')
  ? false
  : (SCREENSHOT_PATH ?? join(process.cwd(), `browser-journey-${Date.now()}.png`));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Chrome discovery ──────────────────────────────────────────────
function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const candidates =
    process.platform === 'win32'
      ? [
          join(
            process.env.PROGRAMFILES ?? 'C:/Program Files',
            'Google/Chrome/Application/chrome.exe',
          ),
          join(
            process.env['PROGRAMFILES(X86)'] ?? 'C:/Program Files (x86)',
            'Google/Chrome/Application/chrome.exe',
          ),
          join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe'),
        ]
      : process.platform === 'darwin'
        ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
        : [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
          ];
  return candidates.find((p) => p && existsSync(p));
}

// ─── Tiny CDP client ───────────────────────────────────────────────
class Cdp {
  constructor(wsUrl) {
    this.pending = new Map();
    this.msgId = 0;
    this.consoleErrors = [];
    this.networkFailures = [];
    this.exceptions = [];
    this.ws = new WebSocket(wsUrl);
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        this.pending.get(msg.id)(msg);
        this.pending.delete(msg.id);
        return;
      }
      this.collect(msg);
    };
  }

  collect(msg) {
    if (msg.method === 'Runtime.exceptionThrown') {
      this.exceptions.push(
        (
          msg.params.exceptionDetails?.exception?.description ??
          msg.params.exceptionDetails?.text ??
          ''
        ).slice(0, 300),
      );
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      this.consoleErrors.push(
        msg.params.args
          .map((a) => a.value ?? a.description ?? '')
          .join(' ')
          .slice(0, 300),
      );
    }
    if (msg.method === 'Network.loadingFailed' && !msg.params.errorText?.includes('ERR_ABORTED')) {
      this.networkFailures.push(`${msg.params.errorText} (${msg.params.type ?? 'other'})`);
    }
  }

  send(method, params = {}) {
    return new Promise((resolve) => {
      const id = ++this.msgId;
      this.pending.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evalJs(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.result?.exceptionDetails) return `EVAL_ERR: ${r.result.exceptionDetails.text}`;
    return r.result?.result?.value;
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

// ─── Chrome lifecycle ──────────────────────────────────────────────
function launchChrome(chromePath) {
  const profileDir = mkdtempSync(join(tmpdir(), 'jeevandata-journey-'));
  const port = 9222 + Math.floor(Math.random() * 200); // avoid collisions with other runs
  const child = spawn(
    chromePath,
    [
      ...(HEADLESS ? ['--headless=new'] : []),
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
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
  return { child, port, profileDir };
}

// ─── Helpers ───────────────────────────────────────────────────────
async function waitForDebugger(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return true;
    } catch {}
    await sleep(300);
  }
  return false;
}

async function getPageTarget(port) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find((t) => t.type === 'page');
  if (!target) console.error('ERROR: no page target exposed by Chrome DevTools.');
  return target;
}

async function pollJs(cdp, expression, predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await cdp.evalJs(expression);
    if (predicate(last)) return last;
    await sleep(500);
  }
  console.warn(`[warn] timed out waiting for: ${label} (last: ${JSON.stringify(last)})`);
  return last;
}

async function clickButton(cdp, text) {
  return cdp.evalJs(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes(${JSON.stringify(text)}));
    if (!b) return 'NOT_FOUND';
    b.click();
    return 'CLICKED';
  })()`);
}

// ─── Journey ───────────────────────────────────────────────────────
async function runJourney(cdp) {
  const report = { steps: [] };
  const fail = (step, reason) => {
    report.steps.push({ step, ok: false, reason });
    report.passed = false;
  };
  const ok = (step, detail = {}) => {
    report.steps.push({ step, ok: true, ...detail });
  };
  report.passed = true;

  // Preflight: backend readiness (soft — just warn if down).
  try {
    const b = await fetch(`${BACKEND_URL}/health/ready`, { signal: AbortSignal.timeout(5000) });
    const body = await b.json();
    report.backend = body?.data?.status ?? body?.status ?? 'unknown';
  } catch {
    report.backend = 'unreachable (warn) — face-match/completion API calls will fail';
    console.warn('[warn] backend not reachable; face-match/completion API calls will fail');
  }

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('Browser.grantPermissions', {
    permissions: ['audioCapture', 'videoCapture'],
    origin: new URL(FRONTEND_URL).origin,
  });

  // 1. Landing page.
  await cdp.send('Page.navigate', { url: FRONTEND_URL });
  await pollJs(cdp, 'document.readyState', (s) => s === 'complete', 20000, 'landing load');
  await sleep(3000);
  const title = await cdp.evalJs('document.title');
  const bodyText = (await cdp.evalJs('document.body.innerText')) ?? '';
  const ctaVisible = bodyText.includes('Start New Intake Session');
  if (!ctaVisible) fail('landing', 'CTA text not found on landing page');
  else ok('landing', { title, ctaVisible });

  // 2. Click the CTA and wait for /intake/<uuid>.
  const click = await clickButton(cdp, 'Start New Intake Session');
  if (click !== 'CLICKED') fail('click-cta', `button not found (${click})`);
  else ok('click-cta');
  const path = await pollJs(
    cdp,
    'location.pathname',
    (p) => typeof p === 'string' && p.startsWith('/intake/'),
    20000,
    'navigation to /intake/<uuid>',
  );
  if (!path?.startsWith('/intake/')) {
    fail('navigation', `expected /intake/<uuid>, got ${path ?? 'no navigation'}`);
  } else {
    ok('navigation', { path });
  }

  // 3. Intake page idle state.
  await sleep(8000);
  const idle = JSON.parse(
    (await cdp.evalJs(`JSON.stringify({
      hasVideo: !!document.querySelector('video'),
      bodyText: document.body.innerText.slice(0, 600),
    })`)) ?? '{}',
  );
  ok('intake-idle', {
    cameraPromptVisible: idle.bodyText.includes('Start Camera'),
    bodyPreview: idle.bodyText.replaceAll('\n', ' | ').slice(0, 180),
  });

  // 4. Start the camera and wait for the stream to go live.
  const camClick = await clickButton(cdp, 'Start Camera');
  if (camClick !== 'CLICKED') {
    console.warn(
      '[warn] Start Camera button not found — checking whether the stream already started',
    );
  }

  const cam = await pollJs(
    cdp,
    `JSON.stringify((() => {
      const v = document.querySelector('video');
      return { readyState: v ? v.readyState : -1, paused: v ? v.paused : true, dim: v ? v.videoWidth + 'x' + v.videoHeight : 'n/a' };
    })())`,
    (s) => {
      try {
        const d = JSON.parse(s);
        return d.readyState >= 2 && d.paused === false && d.dim !== '0x0' && d.dim !== 'n/a';
      } catch {
        return false;
      }
    },
    25000,
    'camera stream playing',
  );
  let camState;
  try {
    camState = JSON.parse(cam);
  } catch {
    camState = { raw: String(cam) };
  }
  if (camState.readyState >= 2 && camState.paused === false) {
    ok('camera', camState);
  } else {
    fail('camera', `video not playing: ${JSON.stringify(camState)}`);
  }

  // 5. Liveness / detection UI after the stream is live.
  await sleep(3000);
  const live = JSON.parse(
    (await cdp.evalJs(`JSON.stringify({
      bodyText: document.body.innerText.slice(0, 600),
    })`)) ?? '{}',
  );
  const inLiveness = /blink/i.test(live.bodyText);
  report.steps.push({
    step: 'liveness-challenge',
    ok: true,
    note: inLiveness
      ? 'liveness prompt visible'
      : 'not visible (expected: the fake camera cannot produce a face to blink)',
  });
  if (!inLiveness)
    console.warn('[warn] liveness prompt not visible (camera may be live without face detection)');

  // 6. Screenshot.
  if (SCREENSHOT) {
    try {
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(SCREENSHOT, Buffer.from(shot.result.data, 'base64'));
      report.screenshot = SCREENSHOT;
    } catch (e) {
      console.warn(`[warn] screenshot failed: ${e.message}`);
    }
  }

  // 7. Diagnostics.
  const realErrors = cdp.consoleErrors.filter((e) => !e.startsWith('INFO:'));
  report.consoleErrors = cdp.consoleErrors;
  report.realConsoleErrors = realErrors;
  report.networkFailures = cdp.networkFailures;
  report.exceptions = cdp.exceptions;
  if (realErrors.length > 0) {
    if (FAIL_ON_CONSOLE_ERRORS) fail('console-errors', realErrors.join(' | '));
    else
      console.warn(
        `[warn] ${realErrors.length} console error(s) — use --fail-on-console-errors to make this fatal`,
      );
  }
  if (cdp.networkFailures.length > 0) fail('network', cdp.networkFailures.join(' | '));
  if (cdp.exceptions.length > 0) fail('exceptions', cdp.exceptions.join(' | '));

  return report;
}

// ─── Main ──────────────────────────────────────────────────────────

// ─── Main ──────────────────────────────────────────────────────────
let chrome;
let cdp;
let setupError = null;
try {
  const chromePath = findChrome();
  if (!chromePath) {
    console.error('ERROR: Chrome/Chromium not found. Set CHROME_PATH to the executable.');
    setupError = 'chrome-not-found';
  } else {
    chrome = launchChrome(chromePath);
    const debugUp = await waitForDebugger(chrome.port);
    if (!debugUp) {
      console.error('ERROR: Chrome DevTools endpoint did not come up.');
      setupError = 'devtools-not-up';
    } else {
      const target = await getPageTarget(chrome.port);
      if (!target) {
        setupError = 'no-page-target';
      } else {
        cdp = new Cdp(target.webSocketDebuggerUrl);
        await cdp.open();

        const report = await runJourney(cdp);
        cdp.close();

        console.log('');
        console.log('=== BROWSER JOURNEY REPORT ===');
        for (const s of report.steps) {
          console.log(`  ${s.ok ? 'PASS' : 'FAIL'}  ${s.step}${s.reason ? ` — ${s.reason}` : ''}`);
        }
        if (report.screenshot) console.log(`  screenshot: ${report.screenshot}`);
        console.log(
          `  console errors: ${report.consoleErrors.length} (${report.realConsoleErrors.length} real)`,
        );
        console.log(`  network failures: ${report.networkFailures.length}`);
        console.log(`  exceptions: ${report.exceptions.length}`);
        console.log('=================================');

        // NOTE: assign exitCode instead of process.exit() — process.exit()
        // terminates without unwinding the stack, so the finally block (kill
        // Chrome + clean the profile dir) would be skipped and every run would
        // leak an orphaned Chrome process.
        process.exitCode = report.passed ? 0 : 1;
      }
    }
  }
  if (setupError) process.exitCode = 2;
} catch (e) {
  console.error(`ERROR: ${e?.message ?? e}`);
  process.exitCode = 2;
} finally {
  if (cdp) {
    try {
      cdp.close();
    } catch {}
  }
  if (chrome) {
    try {
      chrome.child.kill();
    } catch {}
    // Let Chrome release the profile dir, then clean it up. This timer also
    // keeps the event loop alive long enough for the exitCode to be honored.
    setTimeout(() => {
      try {
        rmSync(chrome.profileDir, { recursive: true, force: true });
      } catch {}
    }, 1500);
  }
}
