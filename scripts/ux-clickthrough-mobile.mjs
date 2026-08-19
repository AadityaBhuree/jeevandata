#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// ux-clickthrough-mobile.mjs — mobile-viewport audit of Jeevandata UI.
//
// Runs the same page walk as ux-clickthrough.mjs but at 375x812 (iPhone X)
// to verify: sidebar hidden, kiosk layout fits, tap targets >=44px, no
// horizontal overflow, mobile brand visible, language selector accessible.
//
// Usage:
//   node scripts/ux-clickthrough-mobile.mjs
//   node scripts/ux-clickthrough-mobile.mjs --no-screenshot
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

// Mobile viewport (iPhone X)
const MOBILE_WIDTH = 375;
const MOBILE_HEIGHT = 812;
const MIN_TAP_TARGET = 44; // WCAG 2.5.5

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
  const profileDir = mkdtempSync(join(tmpdir(), 'jeevandata-mobile-'));
  const port = 9550 + Math.floor(Math.random() * 200);
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
      `--window-size=${MOBILE_WIDTH},${MOBILE_HEIGHT}`,
      // Simulate a mobile device (affects navigator.userAgent + touch events)
      '--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      
      
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

// ─── Mobile-specific audit ────────────────────────────────────────
async function auditMobilePage(name, cdp, notes = []) {
  const errorsBefore = cdp.consoleErrors.length;
  const netBefore = cdp.networkFailures.length;

  async function probe() {
    const issues = [];

    // 1. Horizontal overflow (the #1 mobile layout bug)
    const overflow = await cdp.evalJs('(document.documentElement.scrollWidth - window.innerWidth)');
    if (typeof overflow === 'number' && overflow > 2) issues.push(`horizontal overflow ${overflow}px`);

    // 2. Check viewport width matches expectation (sidebar must be hidden)
    const vpWidth = await cdp.evalJs('window.innerWidth');
    if (typeof vpWidth === 'number' && vpWidth > MOBILE_WIDTH + 20) {
      issues.push(`viewport too wide: ${vpWidth}px (expected ${MOBILE_WIDTH}px)`);
    }

    // 3. Sidebar must be hidden on mobile (hidden md:flex → display:none at <768px)
    const sidebarVisible = await cdp.evalJs(
      `(() => { const a = document.querySelector('aside'); if (!a) return 'NO_ASIDE'; const cs = getComputedStyle(a); return cs.display === 'none' ? 'hidden' : 'visible (BUG)'; })()`,
    );
    // Note: on pages without sidebar (landing, kiosk, login), NO_ASIDE is fine

    // 4. Tap targets >= 44px (WCAG 2.5.5) — only count visible interactive elements
    const smallTargets = await cdp.evalJs(
      `[...document.querySelectorAll('button,a[href],input,select,textarea,[role="button"]')].filter((el) => { const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') return false; if (el.classList.contains('sr-only') || el.closest('.sr-only')) return false; let p = el.parentElement; while (p) { if (getComputedStyle(p).display === 'none') return false; p = p.parentElement; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44); }).slice(0, 8).map((el) => { const r = el.getBoundingClientRect(); return el.tagName + ':' + Math.round(r.width) + 'x' + Math.round(r.height) + ':' + (el.innerText || el.placeholder || el.getAttribute('aria-label') || '').slice(0, 25); })`,
    );
    if (Array.isArray(smallTargets) && smallTargets.length) {
      issues.push(`small tap targets (<44px): ${smallTargets.join(' | ')}`);
    }

    // 5. Clipped / overflow:hidden text
    const clipped = await cdp.evalJs(
      `[...document.querySelectorAll('h1,h2,h3,button,p,span')].filter((el) => { const cs = getComputedStyle(el); if (cs.overflow !== 'hidden') return false; if (el.scrollWidth <= el.clientWidth + 2) return false; if (el.clientWidth <= 0) return false; return true; }).slice(0, 5).map((el) => el.tagName + ':' + (el.innerText || '').slice(0, 30))`,
    );
    if (Array.isArray(clipped) && clipped.length) issues.push(`clipped text: ${clipped.join(', ')}`);

    // 6. Fixed/sticky elements extending beyond viewport
    const offscreen = await cdp.evalJs(
      `[...document.querySelectorAll('header,nav,[class*="fixed"],[class*="sticky"],[role="dialog"]')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > window.innerWidth + 2 || r.left < -2); }).slice(0, 5).map((el) => el.tagName + ':' + (el.innerText || '').slice(0, 30))`,
    );
    if (Array.isArray(offscreen) && offscreen.length) issues.push(`off-screen elements: ${offscreen.join(', ')}`);

    return { issues, sidebarVisible };
  }

  let { issues, sidebarVisible } = await probe();
  // Re-probe after settle for transient issues
  if (issues.length) {
    await sleep(1200);
    const again = await probe();
    const persistent = issues.filter((i) => again.issues.some((a) => a.split(':')[0] === i.split(':')[0]));
    if (persistent.length < issues.length) {
      console.warn(`  [note] ${issues.length - persistent.length} transient layout issue(s) did not persist after settle`);
    }
    issues = persistent;
    sidebarVisible = again.sidebarVisible;
  }

  const errs = cdp.consoleErrors.slice(errorsBefore);
  const nets = cdp.networkFailures.slice(netBefore);
  const note = [
    issues.length ? `layout issues: ${issues.join('; ')}` : 'layout clean',
    errs.length ? `${errs.length} console error(s)` : '0 console errors',
    nets.length ? `${nets.length} network failure(s)` : '0 network failures',
    `sidebar=${sidebarVisible}`,
    ...notes,
  ].join(' · ');
  pageOk(name, issues.length === 0 && errs.length === 0 && nets.length === 0, { note, issues, consoleErrors: errs, networkFailures: nets });
  if (SCREENSHOTS) {
    const dir = join(process.cwd(), '.ux-shots-mobile');
    mkdirSync(dir, { recursive: true });
    await cdp.screenshot(join(dir, name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png'));
  }
  return { issues, errs, nets, sidebarVisible };
}

// Simple probe helpers
const PROBE = {
  buttons: `[...document.querySelectorAll('button')].map((b) => b.innerText.trim()).slice(0, 15)`,
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
    // Force mobile viewport via CDP (overrides window chrome)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
      deviceScaleFactor: 2,
      mobile: true,
    });

    console.log(`── Mobile click-through (${MOBILE_WIDTH}x${MOBILE_HEIGHT}) ────────────\n`);

    // ── 1. Landing page ────────────────────────────────────────────
    console.log('── Landing page (mobile) ──────────────────────────');
    await navigate(cdp, `${FRONTEND_URL}/`, PROBE.bodyHas('Jeevandata'), 'landing render');
    await sleep(2500);
    const landing = {
      cta: await cdp.evalJs(PROBE.anyButton('/start.*intake|new.*intake|begin/i')),
      brand: await cdp.evalJs(PROBE.bodyHas('Jeevandata')),
      langSelector: await cdp.evalJs(`document.querySelector('button[aria-label^="Select language"]') !== null`),
      mobileBrandVisible: await cdp.evalJs(
        `(() => { const b = document.querySelector('.md\\:hidden'); if (!b) return 'NO_MOBILE_BRAND'; const cs = getComputedStyle(b); return cs.display === 'none' ? 'hidden' : 'visible'; })()`,
      ),
      buttons: await cdp.evalJs(PROBE.buttons),
    };
    await auditMobilePage('landing', cdp, [
      `CTA=${landing.cta === true ? 'present' : 'MISSING'}`,
      `brand=${landing.brand === true ? 'ok' : 'MISSING'}`,
      `mobile-brand=${landing.mobileBrandVisible}`,
      `language-selector=${landing.langSelector === true ? 'present' : 'MISSING'}`,
      `buttons=${landing.buttons ?? '?'}`,
    ]);

    // ── 2. Kiosk intake page ───────────────────────────────────────
    console.log('── Kiosk intake (mobile) ─────────────────────────');
    await cdp.evalJs(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /start.*intake|new.*intake|begin/i.test(x.innerText)); if (b) b.click(); return b ? 'CLICKED' : 'NOT_FOUND'; })()`);
    await sleep(3500);
    const kioskPath = await cdp.evalJs(PROBE.path);
    const stepperText = await cdp.evalJs(`[...document.querySelectorAll('nav[aria-label="Intake progress"] li')].map((x) => x.innerText.trim()).filter(Boolean).slice(0, 8)`);
    const cancel = await cdp.evalJs(PROBE.anyButton('/cancel|restart|start over/i'));
    const steppers = Array.isArray(stepperText) ? stepperText : [];
    // Mobile-specific: check stepper fits horizontally
    const stepperOverflow = await cdp.evalJs(
      `(() => { const nav = document.querySelector('nav[aria-label="Intake progress"]'); if (!nav) return 'NO_STEPPER'; const r = nav.getBoundingClientRect(); return r.right <= window.innerWidth ? 'fits' : 'overflows by ' + Math.round(r.right - window.innerWidth) + 'px'; })()`,
    );
    await auditMobilePage('kiosk-intake', cdp, [
      `url=${kioskPath}`,
      `stepper=${steppers.length >= 3 ? steppers.join(' → ') : 'MISSING'}`,
      `stepper-fit=${stepperOverflow}`,
      `cancel-restart=${cancel === true ? 'present' : 'MISSING'}`,
    ]);

    // ── 3. Login page ──────────────────────────────────────────────
    console.log('── Login (mobile) ─────────────────────────────────');
    await navigate(cdp, `${FRONTEND_URL}/login`, 'document.body.innerText.length > 100', 'login form');
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
    // Mobile-specific: check input fields fill the width properly
    const inputWidth = await cdp.evalJs(
      `(() => { const el = document.querySelector('input[type="email"]'); if (!el) return 'NO_INPUT'; const r = el.getBoundingClientRect(); return Math.round(r.width) + 'px'; })()`,
    );
    await sleep(400);
    await cdp.evalJs(`(() => { const f = document.querySelector('form'); if (f) { f.requestSubmit(); return 'SUBMITTED'; } const b = [...document.querySelectorAll('button')].find((x) => /sign in/i.test(x.innerText)); if (b) { b.click(); return 'CLICKED'; } return 'NO_FORM'; })()`);
    const afterLogin = await pollJs(cdp, PROBE.path, (p) => typeof p === 'string' && p !== '/login', 15000, 'redirect after login');
    pageOk('login', filled === 'FILLED' && typeof afterLogin === 'string' && afterLogin !== '/login', {
      note: `${filled} → redirected to ${afterLogin ?? '?'} · email input width=${inputWidth}`,
    });

    // ── 4. Dashboard (mobile) ──────────────────────────────────────
    console.log('── Dashboard (mobile) ─────────────────────────────');
    await navigate(cdp, `${FRONTEND_URL}/dashboard`, `location.pathname === '/dashboard'`, 'dashboard nav');
    await sleep(2500);
    // Mobile: sidebar should be HIDDEN, check for hamburger menu
    const hamburger = await cdp.evalJs(
      `document.querySelector('button[aria-label*="menu" i], button[aria-label*="Menu" i], button[aria-label*="navigation" i], [class*="hamburger"]') !== null`,
    );
    const sidebarCheck = await cdp.evalJs(
      `(() => { const a = document.querySelector('aside'); if (!a) return 'NO_ASIDE'; const cs = getComputedStyle(a); return cs.display === 'none' ? 'hidden (correct)' : 'visible (BUG: should be hidden on mobile)'; })()`,
    );
    const dashboardContent = await cdp.evalJs(`document.querySelector('main') !== null || document.querySelector('[class*="content"]') !== null`);
    const statCards = await cdp.evalJs(`[...document.querySelectorAll('div')].map((x) => x.innerText.trim()).filter((t) => t.length > 0 && t.length < 60 && /^(active sessions|ready for review|in progress|started today)/i.test(t)).slice(0, 6)`);
    await auditMobilePage('dashboard', cdp, [
      `sidebar=${sidebarCheck}`,
      `hamburger=${hamburger === true ? 'present' : 'MISSING'}`,
      `content-area=${dashboardContent === true ? 'present' : 'MISSING'}`,
      `stats=${Array.isArray(statCards) && statCards.length ? statCards.join(' | ').slice(0, 80) : 'none'}`,
    ]);

    // ── 5. Admin surfaces (mobile — expect sidebar hidden) ─────────
    console.log('── Admin surfaces (mobile) ────────────────────────');
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
      const sidebar = await cdp.evalJs(
        `(() => { const a = document.querySelector('aside'); if (!a) return 'NO_ASIDE'; return getComputedStyle(a).display === 'none' ? 'hidden (correct)' : 'visible (BUG)'; })()`,
      );
      await auditMobilePage(label, cdp, [
        `heading="${heading ?? '?'}"`,
        `sidebar=${sidebar}`,
      ]);
    }

    // ── Final report ───────────────────────────────────────────────
    console.log('');
    console.log('══════════════════════════════════════════════════════');
    console.log(`viewport: ${MOBILE_WIDTH}x${MOBILE_HEIGHT} (iPhone X emulation)`);
    console.log(`console errors total: ${cdp.consoleErrors.length}`);
    cdp.consoleErrors.forEach((e) => console.log(`  • ${e}`));
    console.log(`network failures total: ${cdp.networkFailures.length}`);
    cdp.networkFailures.forEach((e) => console.log(`  • ${e}`));
    console.log(`exceptions total: ${cdp.exceptions.length}`);
    const failed = report.pages.filter((p) => !p.ok);
    console.log(`\nRESULT: ${report.pages.length - failed.length}/${report.pages.length} pages clean`);
    if (failed.length) {
      console.log('\nFAILED PAGES:');
      failed.forEach((p) => console.log(`  ✗ ${p.name}: ${p.note}`));
    }
    if (SCREENSHOTS) console.log('Screenshots saved to .ux-shots-mobile/');
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
