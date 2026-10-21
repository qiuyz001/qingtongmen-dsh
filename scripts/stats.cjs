/** Pixel statistics for shots/*.png. Writes shots/stats.json. */
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'shots');
const files = fs.readdirSync(SHOTS)
  .filter(f => f.endsWith('.png') && /^(node\d|node6-(open|enter|close)|node3-flare)\.png$/.test(f))
  .sort();

const images = [];
for (const file of files) {
  const png = PNG.sync.read(fs.readFileSync(path.join(SHOTS, file)));
  const { width, height, data } = png;
  const total = width * height;
  let sum = 0, black = 0, over = 0, clipped = 0;
  const lums = new Float32Array(total);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lums[p] = l; sum += l;
    if (l < 8) black++;
    if (l >= 250) over++;
    if (r >= 254 || g >= 254 || b >= 254) clipped++;
  }
  lums.sort();
  const q = (f) => lums[Math.min(total - 1, Math.floor(total * f))];
  const mean = sum / total;
  const blackRatio = black / total;
  const overRatio = over / total;
  const clippedRatio = clipped / total;
  const ok = mean > 6 && blackRatio < 0.62 && overRatio < 0.02 && clippedRatio < 0.06;
  images.push({
    file, width, height, meanLuma: +mean.toFixed(2),
    blackRatio: +blackRatio.toFixed(4), overexposedRatio: +overRatio.toFixed(4),
    clippedRatio: +clippedRatio.toFixed(4),
    p05: +q(0.05).toFixed(1), p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1),
    max: +lums[total - 1].toFixed(1), ok,
  });
}

const failing = images.filter(i => !i.ok);
const report = {
  thresholds: {
    meanLumaGreaterThan: 6,
    pureBlackPixelRatioBelow: 0.62,
    overexposedRatioBelow: 0.02,
    clippedChannelRatioBelow: 0.06,
    pureBlackDefinition: 'relative luminance < 8/255',
    overexposedDefinition: 'relative luminance >= 250/255',
    clippedDefinition: 'any RGB channel >= 254',
  },
  summary: {
    shots: images.length,
    passed: images.length - failing.length,
    failed: failing.length,
    overallOk: failing.length === 0,
    meanLumaRange: images.length ? [Math.min(...images.map(i => i.meanLuma)), Math.max(...images.map(i => i.meanLuma))] : [0, 0],
  },
  images,
  capturedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(SHOTS, 'stats.json'), JSON.stringify(report, null, 2));
console.log('--- pixel stats ---');
for (const i of images) console.log(`${i.file.padEnd(18)} mean ${String(i.meanLuma).padStart(6)}  black ${i.blackRatio.toFixed(3)}  over ${i.overexposedRatio.toFixed(3)}  ${i.ok ? 'OK' : 'CHECK'}`);
console.log(`overall: ${report.summary.overallOk ? 'PASS' : 'FAIL'} (${report.summary.passed}/${report.summary.shots})`);
if (!report.summary.overallOk) process.exitCode = 1;
