/** Quick single-view screenshot for iteration (not part of final evidence). */
const { execSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'quick');
const PORT = 4175;
const URL = `http://127.0.0.1:${PORT}/?quality=high`;
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let preview = null;

process.on('exit', () => { if (preview) try { preview.kill('SIGTERM'); } catch (e) {} });

async function serverUp() {
  try { return (await fetch(`http://127.0.0.1:${PORT}/`, { signal: AbortSignal.timeout(1200) })).ok; } catch (e) { return false; }
}
async function ensureServer() {
  if (await serverUp()) return;
  preview = spawn(path.join(ROOT, 'node_modules', '.bin', 'vite'),
    ['preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  preview.stderr.on('data', d => process.stderr.write(d));
  for (let i = 0; i < 60; i++) { await sleep(400); if (await serverUp()) return; }
  throw new Error('preview failed');
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await ensureServer();
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e && e.stack || e)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  await sleep(1800);
  const args = process.argv.slice(2);
  if (!args.length) args.push('1');
  for (const a of args) {
    if (a === '3f2') {
      await page.evaluate(() => window.__goto(3));
      await page.waitForFunction(() => window.__nodeSettled === true && window.__node === 3, null, { timeout: 60000 });
      await sleep(1000);
      await page.evaluate(() => {
        window.__riftBeat('floor', true);
        const c = window.__three.camera;
        c.position.set(17, 5.2, 22);
        c.fov = 61; c.updateProjectionMatrix();
        c.lookAt(-3, 10.5, -50);
      });
      await sleep(2200);
      await page.screenshot({ path: path.join(SHOTS, '3f2.png'), timeout: 120000 });
      console.log('shot 3f2');
    } else if (a === '3f') {
      await page.evaluate(() => window.__goto(3));
      await page.waitForFunction(() => window.__nodeSettled === true && window.__node === 3, null, { timeout: 60000 });
      await sleep(1000);
      await page.evaluate(() => window.__riftBeat('floor', true));
      await sleep(2200);
      await page.screenshot({ path: path.join(SHOTS, '3f.png'), timeout: 120000 });
      console.log('shot 3f', await page.evaluate(() => ({ chain: window.__three.rift.chainGroup.visible, node: window.__node, beat: window.__riftBeatName })));
    } else if (a === '6open' || a === '6mid' || a === '6enter') {
      await page.evaluate(() => window.__goto(6));
      await page.waitForFunction(() => window.__nodeSettled === true && window.__node === 6, null, { timeout: 60000 });
      await sleep(900);
      const tt = a === '6open' ? 14.0 : a === '6mid' ? 24.5 : 30.5;
      await page.evaluate((tt) => window.__seek6(tt), tt);
      await sleep(2200);
      await page.screenshot({ path: path.join(SHOTS, `${a}.png`), timeout: 120000 });
      console.log('shot', a);
    } else if (a === '3') {
      await page.evaluate(() => window.__goto(3));
      await page.waitForFunction(() => window.__nodeSettled === true && window.__node === 3, null, { timeout: 60000 });
      await sleep(2400);
      await page.screenshot({ path: path.join(SHOTS, '3.png'), timeout: 120000 });
      console.log('shot 3');
    } else if (a === '3flare') {
      await page.evaluate(() => window.__goto(3));
      await page.waitForFunction(() => window.__nodeSettled === true && window.__node === 3, null, { timeout: 60000 });
      await sleep(1000);
      await page.evaluate(() => window.__flare());
      await sleep(2300);
      await page.screenshot({ path: path.join(SHOTS, '3flare.png'), timeout: 120000 });
      console.log('shot 3flare');
    } else {
      const n = Number(a);
      await page.evaluate((n) => window.__goto(n), n);
      await page.waitForFunction((n) => window.__nodeSettled === true && window.__node === n, n, { timeout: 60000 });
      await sleep(n === 2 ? 4500 : 2200);
      await page.screenshot({ path: path.join(SHOTS, `${n}.png`), timeout: 120000 });
      console.log('shot', n, await page.evaluate(() => { const R=window.__three.rift, C=window.__three.camera; const out={cam:C.position.toArray(),epi:R.epilogueGroup.visible,kids:[]}; R.epilogueGroup.children.slice(0,4).forEach((c,i)=>{ const v=c.position.clone(); if(c.parent) c.parent.localToWorld(v); const q=v.clone().project(C); out.kids.push({i,t:c.type,p:c.position.toArray(),w:v.toArray().map(x=>+x.toFixed(1)),scr:[+q.x.toFixed(2),+q.y.toFixed(2),+q.z.toFixed(2)],kids:c.children.map(k=>k.type+':'+k.position.toArray().map(x=>+x.toFixed(1)).join(','))}); }); return JSON.stringify(out); }));
    }
  }
  console.log('console errors:', errors.length, errors.slice(0, 5));
  await browser.close();
  if (preview) preview.kill('SIGTERM');
})().catch(e => { console.error(e); if (preview) preview.kill('SIGTERM'); process.exit(1); });
