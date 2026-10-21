/**
 * Headless screenshot harness for the 7-node 青铜门 experience.
 *
 *   node scripts/shoot.cjs
 *
 * Requires a completed `pnpm build`. Starts `vite preview`, drives the page
 * through window.__goto()/__seek6()/__flare(), captures every required view,
 * records console errors, then runs scripts/stats.cjs.
 */
const { execSync, spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'verify-shots');
const PORT = 4173;
const URL = `http://127.0.0.1:${PORT}/?quality=high`;
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let preview = null;
let ownsPreview = false;

function cleanup() {
  if (preview && ownsPreview) { try { preview.kill('SIGTERM'); } catch (e) {} }
  preview = null;
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });

async function serverUp() {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch (e) { return false; }
}

async function ensureServer() {
  if (await serverUp()) { console.log('using existing preview server'); return; }
  const vite = path.join(ROOT, 'node_modules', '.bin', 'vite');
  preview = spawn(vite, ['preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: ROOT, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  ownsPreview = true;
  preview.stdout.on('data', () => {});
  preview.stderr.on('data', (d) => process.stderr.write(d));
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    if (await serverUp()) return;
  }
  throw new Error('vite preview did not start');
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  // Only final names are retained; remove debug/test artefacts.
  for (const f of fs.readdirSync(SHOTS)) {
    if (f.endsWith('.png') && !/^(node\d|node6-(open|enter|close)|node3-flare)\.png$/.test(f)) {
      fs.unlinkSync(path.join(SHOTS, f));
    }
  }
  await ensureServer();

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  const pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(String(e && e.stack || e)));

  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  await sleep(2500);
  console.log(`booted in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const shot = async (name) => {
    await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
    console.log('shot', name);
  };

  for (let n = 1; n <= 7; n++) {
    await page.evaluate((n) => window.__goto(n), n);
    await page.waitForFunction((n) => window.__nodeSettled === true && window.__node === n, n, { timeout: 60000 });
    await sleep(2600);
    if (n === 3) {
      await shot('node3');
      await page.evaluate(() => window.__flare());
      await sleep(1600);
      await shot('node3-flare');
      continue;
    }
    if (n === 6) {
      await page.evaluate(() => window.__seek6(14.0));
      await sleep(1800);
      await shot('node6-open');
      await page.evaluate(() => window.__seek6(24.5));
      await sleep(1800);
      await shot('node6');
      await page.evaluate(() => window.__seek6(30.5));
      await sleep(1600);
      await shot('node6-enter');
      await page.evaluate(() => window.__seek6(49.8));
      await sleep(1800);
      await shot('node6-close');
      continue;
    }
    await shot(`node${n}`);
  }

  await page.waitForTimeout(400);
  const consoleReport = {
    errors,
    pageErrors,
    total: errors.length + pageErrors.length,
    note: 'console error / pageerror only. WebGL performance warnings are not errors.',
    capturedAt: new Date().toISOString(),
    url: URL,
  };
  fs.writeFileSync(path.join(SHOTS, 'console.json'), JSON.stringify(consoleReport, null, 2));
  console.log(`console errors: ${errors.length}, pageerrors: ${pageErrors.length}`);

  await browser.close();
  cleanup();

  const statsRun = spawnSync(process.execPath, [path.join(__dirname, 'stats.cjs')], { cwd: ROOT, encoding: 'utf8' });
  if (statsRun.stdout) process.stdout.write(statsRun.stdout);
  if (statsRun.stderr) process.stderr.write(statsRun.stderr);
  if (consoleReport.total > 0) process.exitCode = 1;
  if (statsRun.status !== 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  cleanup();
  process.exit(1);
});
