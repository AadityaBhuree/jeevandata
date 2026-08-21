#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// ux-clickthrough.mjs — click-through audit of the redesigned Jeevandata UI.
//
// Walks: landing → kiosk (start session) → login → dashboard → admin surfaces.
// Per page it records console errors / network failures / exceptions and runs a
// layout audit (horizontal overflow, clipped text, zero-size interactive
// elements). Prints a PASS/FAIL report per step.
//
// Usage:
//   node scripts/ux-clickthrough.mjs
//   node scripts/ux-clickthrough.mjs --no-screenshot
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';
const EMAIL = process.env.STAFF_EMAIL ?? 'doctor@jeevandata.com';
const PASSWORD = process.env.STAFF_PASSWORD ?? 'Doctor@123';
const HEADLESS = process.env.HEADLESS !== '0';
const SCREENSHOTS = process.argv.includes('--no-screenshot') ? false : true;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Chrome discovery ──────────────────────────────────────────────
function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const candidates =
    process.platform === 'win32'
      ? [
          join(process.env.PROGRAMFILES ?? 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
          join(process.env['PROGRAMFILES(X86)'] ?? 'C:/Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
          join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe'),
        ]
      : process.platform === 'darwin'
        ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
        : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium'];
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
    this.currentUrl = null;
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
    if (msg.method === 'Page.frameNavigated' && msg.params.frame.parentId === undefined) {
      this.currentUrl = msg.params.frame.url;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      this.exceptions.push(
        (msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text ?? '').slice(0, 300),
      );
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      this.consoleErrors.push(
        `[${this.currentUrl ?? '?'}] ` +
          msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300),
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
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) {
      const d = (r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text ?? '').slice(0, 300);
      return { __evalError: d };
    }
    return r.result?.result?.value;
  }
  async screenshot(path) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    if (!r.result?.data) return false;
    writeFileSync(path, Buffer.from(r.result.data, 'base64'));
    return true;
  }
  close() {
    try { this.ws.close(); } catch {}
  }
}

function launchChrome(chromePath) {
  const profileDir = mkdtempSync(join(tmpdir(), 'jeevandata-ux-'));
  const port = 9442 + Math.floor(Math.random() * 200);
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
      '--window-size=1440,900',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  return { child, port, profileDir };
}

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
  return targets.find((t) => t.type === 'page');
}

async function pollJs(cdp, expression, predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await cdp.evalJs(expression);
    if (predicate(last)) return last;
    await sleep(500);
  }
  console.warn(`  [warn] timed out waiting: ${label}`);
  return last;
}

// ─── Main ─────────────────────────────────────────────────────────
const report = { pages: [] };
let cdp;

function pageOk(name, ok, detail = {}) {
  report.pages.push({ name, ok, ...detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail.note ? ' — ' + detail.note : ''}`);
}

async function navigate(cdp, url, waitExpr, waitLabel, timeoutMs = 20000) {
  await cdp.send('Page.navigate', { url });
  return pollJs(cdp, waitExpr, (v) => Boolean(v), timeoutMs, waitLabel);
}

// All audits use SIMPLE single-purpose expressions (multi-line template
// literals with regex literals came back empty from Runtime.evaluate).
async function auditPage(name, cdp, notes = []) {
  const errorsBefore = cdp.consoleErrors.length;
  const netBefore = cdp.networkFailures.length;

  async function probe() {
    const issues = [];
    const overflow = await cdp.evalJs('(document.documentElement.scrollWidth - window.innerWidth)');
    if (typeof overflow === 'number' && overflow > 2) issues.push(`horizontal overflow ${overflow}px`);

    const zeroSize = await cdp.evalJs(
      `[...document.querySelectorAll('button,a,input,select,textarea,[role="button"]')].filter((el) => { const r = el.getBoundingClientRect(); if (r.width >= 4 && r.height >= 4) return false; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return false; if (el.classList.contains('sr-only') || el.closest('.sr-only')) return false; let p = el.parentElement; while (p) { if (getComputedStyle(p).display === 'none') return false; p = p.parentElement; } return true; }).slice(0, 5).map((el) => el.tagName + ':' + (el.innerText || el.placeholder || el.getAttribute('aria-label') || '').slice(0, 30))`,
    );
    if (Array.isArray(zeroSize) && zeroSize.length) issues.push(`zero-size controls: ${zeroSize.join(', ')}`);

    const clipped = await cdp.evalJs(
      `[...document.querySelectorAll('h1,h2,h3,button')].filter((el) => { const cs = getComputedStyle(el); return cs.overflow === 'hidden' && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0; }).slice(0, 5).map((el) => el.tagName + ':' + (el.innerText || '').slice(0, 30))`,
    );
    if (Array.isArray(clipped) && clipped.length) issues.push(`clipped text: ${clipped.join(', ')}`);

    const offscreen = await cdp.evalJs(
      `[...document.querySelectorAll('header,nav,[class*="fixed"],[class*="sticky"],[role="dialog"]')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > window.innerWidth + 2 || r.left < -2 || r.top < -2); }).slice(0, 5).map((el) => el.tagName + ':' + (el.innerText || '').slice(0, 30))`,
    );
    if (Array.isArray(offscreen) && offscreen.length) issues.push(`off-screen: ${offscreen.join(', ')}`);
    return issues;
  }

  let issues = await probe();
  if (issues.length) {
    await sleep(1200);
    const again = await probe();
    const persistent = issues.filter((i) => again.some((a) => a.split(':')[0] === i.split(':')[0]));
    if (persistent.length < issues.length) {
      console.warn(`  [note] ${issues.length - persistent.length} transient layout issue(s) did not persist after settle`);
    }
    issues = persistent;
  }

  const errs = cdp.consoleErrors.slice(errorsBefore);
  const nets = cdp.networkFailures.slice(netBefore);
  const note = [
    issues.length ? `layout issues: ${issues.join('; ')}` : 'layout clean',
    errs.length ? `${errs.length} console error(s)` : '0 console errors',
    nets.length ? `${nets.length} network failure(s)` : '0 network failures',
    ...notes,
  ].join(' · ');
  pageOk(name, issues.length === 0 && errs.length === 0 && nets.length === 0, { note, issues, consoleErrors: errs, networkFailures: nets });
  if (SCREENSHOTS) {
    const dir = join(process.cwd(), '.ux-shots');
    mkdirSync(dir, { recursive: true });
    await cdp.screenshot(join(dir, name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png'));
  }
  return { issues, errs, nets };
}

// Simple probe helpers — each returns a plain serializable value.
const PROBE = {
  buttons: `[...document.querySelectorAll('button')].map((b) => b.innerText.trim()).slice(0, 15)`,
  links: `[...document.querySelectorAll('a')].map((a) => a.getAttribute('href')).filter(Boolean).slice(0, 20)`,
  bodyHas: (t) => `document.body.innerText.includes(${JSON.stringify(t)})`,
  anyButton: (re) => `[...document.querySelectorAll('button')].some((b) => ${re}.test(b.innerText))`,
  anyLink: (re) => `[...document.querySelectorAll('a')].some((a) => ${re}.test(a.innerText))`,
  path: `location.pathname`,
};

async function run() {
  const chromePath = findChrome();
  if (!chromePath) {
    console.error('ERROR: Chrome/Chromium not found. Set CHROME_PATH.');
    process.exit(1);
  }
  const { child, port, profileDir } = launchChrome(chromePath);
  try {
    if (!(await waitForDebugger(port))) {
      console.error('ERROR: Chrome DevTools endpoint did not come up.');
      process.exit(1);
    }
    const target = await getPageTarget(port);
    cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    console.log('── Landing page ──────────────────────────────────');
    await navigate(cdp, `${FRONTEND_URL}/`, PROBE.bodyHas('Jeevandata'), 'landing render');
    await sleep(2500);
    const landing = {
      cta: await cdp.evalJs(PROBE.anyButton('/start.*intake|new.*intake|begin/i')),
      loginLink: await cdp.evalJs(PROBE.anyLink('/login|staff|sign in/i')),
      langSelector: await cdp.evalJs(`document.querySelector('button[aria-label^="Select language"]') !== null`),
      brand: await cdp.evalJs(PROBE.bodyHas('Jeevandata')),
      trust: await cdp.evalJs(PROBE.bodyHas('Privacy') === true ? PROBE.bodyHas('Privacy') : PROBE.bodyHas('secure')),
      buttons: await cdp.evalJs(PROBE.buttons),
    };
    await auditPage('landing', cdp, [
      `CTA=${landing.cta === true ? 'present' : 'MISSING'}`,
      `staff-login-link=${landing.loginLink === true ? 'present' : 'MISSING'}`,
      `language-selector=${landing.langSelector === true ? 'present' : 'MISSING'}`,
      `brand=${landing.brand === true ? 'ok' : 'MISSING'}`,
      `buttons=${landing.buttons ?? '?'}`,
    ]);

    console.log('── Kiosk flow ─────────────────────────────────────');
    await cdp.evalJs(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /start.*intake|new.*intake|begin/i.test(x.innerText)); if (b) b.click(); return b ? 'CLICKED' : 'NOT_FOUND'; })()`);
    await sleep(3500);
    const kioskPath = await cdp.evalJs(PROBE.path);
    const stepperText = await cdp.evalJs(`[...document.querySelectorAll('nav[aria-label="Intake progress"] li')].map((x) => x.innerText.trim()).filter(Boolean).slice(0, 8)`);
    const cancel = await cdp.evalJs(PROBE.anyButton('/cancel|restart|start over/i'));
    const steppers = Array.isArray(stepperText) ? stepperText : [];
    await auditPage('kiosk-intake', cdp, [
      `url=${kioskPath}`,
      `stepper=${steppers.length >= 3 ? steppers.join(' → ') : 'MISSING'}`,
      `cancel-restart=${cancel === true ? 'present' : 'MISSING'}`,
    ]);

    console.log('── Login ──────────────────────────────────────────');
    await navigate(cdp, `${FRONTEND_URL}/login`, `document.body.innerText.length > 100`, 'login form');
    await sleep(1500);
    const filled = await cdp.evalJs(`(() => {
      const setVal = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
      const email = document.querySelector('input[type="email"]');
      const pass = document.querySelector('input[type="password"]');
      if (!email || !pass) return 'NO_INPUTS';
      setVal(email, ${JSON.stringify(EMAIL)});
      setVal(pass, ${JSON.stringify(PASSWORD)});
      return 'FILLED';
    })()`);
    await sleep(400);
    await cdp.evalJs(`(() => { const f = document.querySelector('form'); if (f) { f.requestSubmit(); return 'SUBMITTED'; } const b = [...document.querySelectorAll('button')].find((x) => /sign in/i.test(x.innerText)); if (b) { b.click(); return 'CLICKED'; } return 'NO_FORM'; })()`);
    const afterLogin = await pollJs(cdp, PROBE.path, (p) => typeof p === 'string' && p !== '/login', 15000, 'redirect after login');
    pageOk('login', filled === 'FILLED' && typeof afterLogin === 'string' && afterLogin !== '/login', {
      note: `${filled} → redirected to ${afterLogin ?? '?'}`,
    });

    console.log('── Dashboard ──────────────────────────────────────');
    await navigate(cdp, `${FRONTEND_URL}/dashboard`, PROBE.path === undefined ? 'true' : `location.pathname === '/dashboard'`, 'dashboard nav');
    await pollJs(cdp, `document.querySelector('aside a') !== null`, (v) => v === true, 15000, 'dashboard sidebar render');
    await sleep(1000);
    const sidebarLinks = await cdp.evalJs(`[...document.querySelectorAll('a')].filter((a) => /dashboard|analytics|audit log|health|clinics|api keys/i.test(a.innerText)).map((a) => a.innerText.trim()).slice(0, 8)`);
    const newIntake = await cdp.evalJs(PROBE.anyButton('/new intake|start intake|new session/i'));
    const live = await cdp.evalJs(`[...document.querySelectorAll('span,div,button')].filter((x) => /^Live$/i.test(x.innerText.trim()) && x.children.length <= 1).map((x) => x.innerText.trim()).slice(0, 3)`);
    const statCards = await cdp.evalJs(`[...document.querySelectorAll('div')].map((x) => x.innerText.trim()).filter((t) => t.length > 0 && t.length < 60 && /^(active sessions|ready for review|in progress|started today)/i.test(t)).slice(0, 6)`);
    const sLinks = Array.isArray(sidebarLinks) ? sidebarLinks : [];
    await auditPage('dashboard', cdp, [
      `sidebar=${sLinks.length ? sLinks.join('|') : 'MISSING (doctor: only Dashboard is RBAC-visible)'}`,
      `new-intake=${newIntake === true ? 'present' : 'MISSING'}`,
      `live=${Array.isArray(live) && live.length ? live.join(',') : 'MISSING'}`,
      `stats=${Array.isArray(statCards) && statCards.length ? statCards.join(' | ').slice(0, 80) : 'none'}`,
    ]);

    console.log('── Admin surfaces ─────────────────────────────────');
    const adminPages = [
      ['/admin', 'admin-analytics', 'analytics'],
      ['/admin/audit', 'admin-audit', 'audit'],
      ['/admin/health', 'admin-health', 'health'],
      ['/clinics', 'admin-clinics', 'clinic'],
      ['/api-keys', 'admin-api-keys', 'api key'],
    ];
    for (const [path, label, headingRe] of adminPages) {
      await navigate(cdp, `${FRONTEND_URL}${path}`, `location.pathname === ${JSON.stringify(path)} || document.body.innerText.length > 100`, `${label} nav`);
      await sleep(2500);
      const heading = await cdp.evalJs(`(document.querySelector('h1,h2')?.innerText ?? '').slice(0, 60)`);
      const sidebar = await cdp.evalJs(PROBE.anyLink('/dashboard|/admin|/clinics|/api-keys'));
      const action = await cdp.evalJs(PROBE.anyButton('/create|new|add|refresh|export|generate|revoke|delete/i'));
      await auditPage(label, cdp, [
        `heading="${heading ?? '?'}"`,
        `sidebar-nav=${sidebar === true ? 'present' : 'MISSING'}`,
        `action=${action === true ? 'present' : 'MISSING'}`,
      ]);
    }

    // ── Final totals ─────────────────────────────────────────────
    console.log('');
    console.log('══════════════════════════════════════════════════════');
    console.log(`console errors total: ${cdp.consoleErrors.length}`);
    cdp.consoleErrors.forEach((e) => console.log(`  • ${e}`));
    console.log(`network failures total: ${cdp.networkFailures.length}`);
    cdp.networkFailures.forEach((e) => console.log(`  • ${e}`));
    console.log(`exceptions total: ${cdp.exceptions.length}`);
    const failed = report.pages.filter((p) => !p.ok);
    console.log(`\nRESULT: ${report.pages.length - failed.length}/${report.pages.length} pages clean`);
    if (SCREENSHOTS) console.log('Screenshots saved to .ux-shots/');
    process.exitCode = failed.length ? 1 : 0;
  } finally {
    if (cdp) cdp.close();
    child.kill();
    try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
  }
}

run().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
