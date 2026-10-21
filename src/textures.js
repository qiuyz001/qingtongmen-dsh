import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

/* ------------------------------------------------------------------ *
 *  All textures are drawn procedurally on canvases. No external assets.
 * ------------------------------------------------------------------ */

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noiseA = createNoise2D(mulberry32(90210));
const noiseB = createNoise2D(mulberry32(1337));
const noiseC = createNoise2D(mulberry32(778899));

function fbm(x, y, oct = 4, n = noiseA) {
  let a = 0.5, f = 1, s = 0, norm = 0;
  for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f); norm += a; a *= 0.5; f *= 2.03; }
  return s / norm;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function makeTexture(cv, { srgb = true, repeat = [1, 1], wrap = THREE.MirroredRepeatWrapping, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = wrap;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

function noiseFill(cv, w, h, fn) {
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const c = fn(x, y);
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/* ------------------------------------------------------------------ *
 *  Bronze door — 云雷纹 / 饕餮式推演.  Colour + bump + roughness.
 * ------------------------------------------------------------------ */

const B = {
  base: '#3a3730', base2: '#4b4434', patina: '#405b4d', patina2: '#2c463d',
  dark: '#151710', raised: '#a08a5b', raisedHi: '#d4b97d', shadow: 'rgba(6,8,5,0.75)',
};

function strokeDual(c, h, build, lw, col = B.raised) {
  const p = new Path2D(); build(p);
  c.save(); c.translate(lw * 0.32 + 1, lw * 0.4 + 1.4);
  c.strokeStyle = B.shadow; c.lineWidth = lw + 2.4; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(p);
  c.restore();
  c.save(); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(p);
  c.globalAlpha = 0.45; c.strokeStyle = B.raisedHi; c.lineWidth = Math.max(0.8, lw * 0.28);
  c.translate(-0.8, -0.9); c.stroke(p); c.restore();
  h.save(); h.strokeStyle = '#e6e6e6'; h.lineWidth = lw; h.lineCap = 'round'; h.lineJoin = 'round'; h.stroke(p); h.restore();
}

function fillDual(c, h, build, col, hval = 215) {
  const p = new Path2D(); build(p);
  c.save(); c.fillStyle = col; c.fill(p); c.restore();
  h.save(); const v = Math.round(hval); h.fillStyle = `rgb(${v},${v},${v})`; h.fill(p); h.restore();
}

function bandMeander(c, h, x, y, w, hh, cell = 34, lw = 5) {
  c.save(); c.strokeStyle = B.dark; c.lineWidth = 1; c.strokeRect(x, y, w, hh); c.restore();
  const n = Math.max(1, Math.floor(w / cell));
  const s = Math.min(hh * 0.78, cell * 0.78);
  for (let i = 0; i < n; i++) {
    const cx = x + (i + 0.5) * (w / n);
    const cy = y + hh * 0.52;
    const flip = i % 2 ? -1 : 1;
    strokeDual(c, h, (p) => {
      const q = s * 0.42;
      p.moveTo(cx - flip * q, cy + q);
      p.lineTo(cx + flip * q, cy + q);
      p.lineTo(cx + flip * q, cy - q);
      p.lineTo(cx - flip * q * 0.62, cy - q);
      p.lineTo(cx - flip * q * 0.62, cy + q * 0.3);
      p.lineTo(cx + flip * q * 0.2, cy + q * 0.3);
      p.lineTo(cx + flip * q * 0.2, cy - q * 0.35);
    }, Math.max(2, lw * s / 34));
  }
}

function squareSpiral(c, h, cx, cy, s, lw, rot = 0) {
  strokeDual(c, h, (p) => {
    p.save?.(); // Path2D has no save; guard
    p.moveTo(-0.5 * s, 0.5 * s); p.lineTo(0.5 * s, 0.5 * s); p.lineTo(0.5 * s, -0.5 * s);
    p.lineTo(-0.28 * s, -0.5 * s); p.lineTo(-0.28 * s, 0.22 * s); p.lineTo(0.16 * s, 0.22 * s);
    p.lineTo(0.16 * s, -0.16 * s); p.lineTo(-0.02 * s, -0.16 * s);
    p.closePath();
  }, lw);
}

function drawSpiralAt(c, h, cx, cy, s, rot, lw) {
  c.save(); h.save(); c.translate(cx, cy); h.translate(cx, cy); c.rotate(rot); h.rotate(rot);
  squareSpiral(c, h, 0, 0, s, lw);
  c.restore(); h.restore();
}

function fineSpiral(c, h, cx, cy, s, rot, lw = 2.2) {
  c.save(); h.save(); c.translate(cx, cy); h.translate(cx, cy); c.rotate(rot); h.rotate(rot);
  const p = new Path2D();
  p.moveTo(-0.5 * s, 0.5 * s); p.lineTo(0.5 * s, 0.5 * s); p.lineTo(0.5 * s, -0.5 * s);
  p.lineTo(-0.28 * s, -0.5 * s); p.lineTo(-0.28 * s, 0.22 * s); p.lineTo(0.16 * s, 0.22 * s);
  p.lineTo(0.16 * s, -0.16 * s); p.lineTo(-0.02 * s, -0.16 * s);
  c.strokeStyle = 'rgba(186, 168, 116, 0.58)'; c.lineWidth = lw * 1.2; c.stroke(p);
  h.strokeStyle = 'rgb(148,148,148)'; h.lineWidth = lw * 1.2; h.stroke(p);
  c.restore(); h.restore();
}

function taotie(c, h, cx, cy, S, lw = 9) {
  // panel frame around the mask, with a dense cloud ground inside
  c.save(); h.save();
  c.beginPath(); c.rect(cx - S * 0.47, cy - S * 0.47, S * 0.94, S * 0.94); c.clip();
  h.beginPath(); h.rect(cx - S * 0.47, cy - S * 0.47, S * 0.94, S * 0.94); h.clip();
  const step = Math.max(13, S * 0.065);
  for (let yy = cy - S * 0.45; yy < cy + S * 0.45; yy += step) {
    for (let xx = cx - S * 0.44; xx < cx + S * 0.44; xx += step * 1.3) {
      fineSpiral(c, h, xx + (((yy / step) | 0) % 2 ? step * 0.5 : 0), yy, step * 0.55, Math.PI / 4, Math.max(1.2, S * 0.004));
    }
  }
  c.restore(); h.restore();
  c.save();
  c.strokeStyle = 'rgba(20,26,20,0.85)'; c.lineWidth = 2;
  c.strokeRect(cx - S * 0.49, cy - S * 0.49, S * 0.98, S * 0.98);
  c.restore();
  strokeDual(c, h, (p) => {
    p.rect(cx - S * 0.47, cy - S * 0.47, S * 0.94, S * 0.94);
  }, 4, B.raised);

  const drawHalf = (m) => {
    const X = (u) => cx + u * S * m;
    const Y = (v) => cy + v * S;
    // horn / brow sweep
    strokeDual(c, h, (p) => {
      p.moveTo(X(0.05), Y(-0.29)); p.bezierCurveTo(X(0.05), Y(-0.45), X(0.28), Y(-0.5), X(0.41), Y(-0.39));
      p.bezierCurveTo(X(0.45), Y(-0.35), X(0.42), Y(-0.3), X(0.35), Y(-0.31));
      p.bezierCurveTo(X(0.28), Y(-0.33), X(0.22), Y(-0.26), X(0.18), Y(-0.19));
    }, lw * 1.15);
    // heavy brow
    strokeDual(c, h, (p) => {
      p.moveTo(X(0.04), Y(-0.12)); p.bezierCurveTo(X(0.18), Y(-0.25), X(0.36), Y(-0.2), X(0.4), Y(-0.06));
    }, lw);
    // almond eye
    fillDual(c, h, (p) => {
      p.moveTo(X(0.06), Y(-0.03));
      p.bezierCurveTo(X(0.14), Y(-0.12), X(0.3), Y(-0.12), X(0.37), Y(-0.035));
      p.bezierCurveTo(X(0.3), Y(0.03), X(0.14), Y(0.03), X(0.06), Y(-0.03));
      p.closePath();
    }, '#10160f', 245);
    strokeDual(c, h, (p) => {
      p.moveTo(X(0.06), Y(-0.03));
      p.bezierCurveTo(X(0.14), Y(-0.12), X(0.3), Y(-0.12), X(0.37), Y(-0.035));
      p.bezierCurveTo(X(0.3), Y(0.03), X(0.14), Y(0.03), X(0.06), Y(-0.03));
    }, lw * 0.7);
    fillDual(c, h, (p) => { p.arc(X(0.215), Y(-0.045), S * 0.033, 0, Math.PI * 2); }, '#060806', 120);
    strokeDual(c, h, (p) => { p.arc(X(0.215), Y(-0.045), S * 0.055, 0, Math.PI * 2); }, lw * 0.45);
    // eyelids
    strokeDual(c, h, (p) => {
      p.moveTo(X(0.05), Y(-0.055)); p.bezierCurveTo(X(0.15), Y(-0.155), X(0.31), Y(-0.15), X(0.39), Y(-0.06));
      p.moveTo(X(0.07), Y(0.005)); p.bezierCurveTo(X(0.16), Y(0.075), X(0.3), Y(0.07), X(0.37), Y(0.0));
    }, lw * 0.45);
    // brow scales
    for (let i = 0; i < 3; i++) {
      strokeDual(c, h, (p) => {
        p.arc(X(0.2 + i * 0.055), Y(-0.19), S * 0.05, Math.PI * 1.1, Math.PI * 1.9);
      }, lw * 0.38);
    }
    // cheek scales
    for (let i = 0; i < 3; i++) {
      strokeDual(c, h, (p) => {
        p.arc(X(0.19 + i * 0.055), Y(0.17 + i * 0.02), S * 0.045, 0.2, Math.PI * 1.1);
      }, lw * 0.35);
    }
    // cheek spiral
    drawSpiralAt(c, h, X(0.3), Y(0.19), S * 0.2, 0, lw * 0.8);
    drawSpiralAt(c, h, X(0.36), Y(0.34), S * 0.12, Math.PI / 4, lw * 0.6);
    // fang
    fillDual(c, h, (p) => {
      p.moveTo(X(0.09), Y(0.13)); p.lineTo(X(0.14), Y(0.135)); p.lineTo(X(0.115), Y(0.33)); p.closePath();
    }, B.raised, 230);
    // jaw tendril
    strokeDual(c, h, (p) => {
      p.moveTo(X(0.05), Y(0.34)); p.bezierCurveTo(X(0.2), Y(0.43), X(0.34), Y(0.4), X(0.42), Y(0.31));
    }, lw * 0.9);
    // ear curl
    strokeDual(c, h, (p) => {
      p.moveTo(X(0.38), Y(-0.03)); p.bezierCurveTo(X(0.48), Y(0.02), X(0.44), Y(0.12), X(0.33), Y(0.1));
    }, lw * 0.75);
  };
  drawHalf(1);
  drawHalf(-1);

  // central nose / forehead
  fillDual(c, h, (p) => {
    p.moveTo(cx - S * 0.04, cy - S * 0.2);
    p.bezierCurveTo(cx - S * 0.11, cy - S * 0.08, cx - S * 0.09, cy + S * 0.08, cx - S * 0.04, cy + S * 0.16);
    p.lineTo(cx + S * 0.04, cy + S * 0.16);
    p.bezierCurveTo(cx + S * 0.09, cy + S * 0.08, cx + S * 0.11, cy - S * 0.08, cx + S * 0.04, cy - S * 0.2);
    p.closePath();
  }, B.raised, 230);
  strokeDual(c, h, (p) => {
    p.moveTo(cx - S * 0.075, cy - S * 0.27); p.lineTo(cx, cy - S * 0.33); p.lineTo(cx + S * 0.075, cy - S * 0.27);
  }, lw * 0.8);
  // forehead diamond crest
  strokeDual(c, h, (p) => {
    p.moveTo(cx, cy - S * 0.36); p.lineTo(cx + S * 0.045, cy - S * 0.27);
    p.lineTo(cx, cy - S * 0.18); p.lineTo(cx - S * 0.045, cy - S * 0.27); p.closePath();
  }, lw * 0.5);
  // nostrils and nose bridge ridges
  for (const sx of [-1, 1]) {
    strokeDual(c, h, (p) => { p.arc(cx + sx * S * 0.038, cy + S * 0.13, S * 0.022, 0.2, Math.PI * 1.4); }, lw * 0.4);
  }
  for (let i = 0; i < 4; i++) {
    strokeDual(c, h, (p) => {
      p.moveTo(cx - S * (0.035 - i * 0.006), cy - S * (0.13 - i * 0.045));
      p.lineTo(cx + S * (0.035 - i * 0.006), cy - S * (0.13 - i * 0.045));
    }, lw * 0.28);
  }
  // flanking flame tongue scrolls
  for (const sx of [-1, 1]) {
    drawSpiralAt(c, h, cx + sx * S * 0.52, cy + S * 0.08, S * 0.16, sx * 1.1, lw * 0.65);
  }
  strokeDual(c, h, (p) => {
    p.moveTo(cx - S * 0.19, cy + S * 0.26); p.lineTo(cx + S * 0.19, cy + S * 0.26);
  }, lw * 0.9);
  for (let i = -3; i <= 3; i++) {
    strokeDual(c, h, (p) => {
      p.moveTo(cx + i * S * 0.045, cy + S * 0.26); p.lineTo(cx + i * S * 0.045, cy + S * 0.3);
    }, lw * 0.4);
  }
  // corner cloud hooks
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    drawSpiralAt(c, h, cx + sx * S * 0.4, cy + sy * S * 0.42, S * 0.085, sx * sy * 0.7, lw * 0.5);
  }
}

function glyph(c, h, x, y, s, rnd) {
  // invented late-Shang style marks — deliberately not readable text.
  const segs = 3 + Math.floor(rnd() * 4);
  for (let i = 0; i < segs; i++) {
    const x1 = x + (rnd() - 0.5) * s, y1 = y + (rnd() - 0.5) * s;
    const x2 = x1 + (rnd() - 0.5) * s * 0.8, y2 = y1 + (rnd() - 0.5) * s * 0.8;
    strokeDual(c, h, (p) => { p.moveTo(x1, y1); p.lineTo(x2, y2); }, Math.max(2, s * 0.07));
  }
}

function rndForInscription(seed) { return mulberry32(seed * 7717 + 13); }

export function makeBronzeDoorTextures() {
  const W = 2048, H = 1024;
  const col = canvas(W, H);
  const hgt = canvas(W, H);
  const c = col.getContext('2d');
  const h = hgt.getContext('2d');
  c.lineCap = h.lineCap = 'round';
  c.lineJoin = h.lineJoin = 'round';

  // low-res base, upscaled
  const bw = 512, bh = 256;
  const baseC = canvas(bw, bh), baseH = canvas(bw, bh);
  noiseFill(baseC, bw, bh, (x, y) => {
    const n1 = fbm(x * 0.012, y * 0.024, 4, noiseA);
    const n2 = fbm(x * 0.07 + 11, y * 0.07, 3, noiseB);
    const t = Math.max(0, Math.min(1, n1 * 0.5 + 0.5));
    const verd = Math.max(0, Math.min(1, t * 0.9 + n2 * 0.18));
    const r = 52 + t * 34 + n2 * 8, g = 49 + t * 26 + verd * 20, b = 37 + t * 18 + verd * 14;
    return [r, g, b];
  });
  noiseFill(baseH, bw, bh, (x, y) => {
    const n = fbm(x * 0.03, y * 0.06, 4, noiseC) * 0.5 + 0.5;
    const v = 58 + n * 45;
    return [v, v, v];
  });
  c.imageSmoothingEnabled = true;
  c.drawImage(baseC, 0, 0, W, H);
  h.drawImage(baseH, 0, 0, W, H);

  // darken outer margins
  const grd = c.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, 'rgba(6,9,7,0.55)');
  grd.addColorStop(0.18, 'rgba(6,9,7,0.05)');
  grd.addColorStop(0.85, 'rgba(5,8,6,0.18)');
  grd.addColorStop(1, 'rgba(4,6,5,0.7)');
  c.fillStyle = grd; c.fillRect(0, 0, W, H);
  // slightly raise lower tarnish
  h.fillStyle = 'rgba(80,80,80,0.3)'; h.fillRect(0, H * 0.86, W, H * 0.14);

  // ------- layout -------
  const frame = 46;
  strokeDual(c, h, (p) => { p.rect(frame, frame, W - frame * 2, H - frame * 2); }, 12);
  strokeDual(c, h, (p) => { p.rect(frame + 22, frame + 22, W - (frame + 22) * 2, H - (frame + 22) * 2); }, 5);
  bandMeander(c, h, frame + 34, frame + 34, W - (frame + 34) * 2, 74, 40, 5);
  bandMeander(c, h, frame + 34, H - frame - 108, W - (frame + 34) * 2, 74, 40, 5);
  bandMeander(c, h, frame + 34, 560, W - (frame + 34) * 2, 54, 36, 4.5);

  // vertical border columns
  for (const x of [frame + 34, W - frame - 108]) {
    for (let y = 140; y < 530; y += 68) {
      drawSpiralAt(c, h, x + 37, y, 40, Math.PI / 4, 4.4);
    }
  }

  // center seam
  c.fillStyle = 'rgba(5,7,6,0.9)'; c.fillRect(W / 2 - 13, frame + 8, 26, H - frame * 2 - 16);
  h.fillStyle = 'rgb(22,22,22)'; h.fillRect(W / 2 - 13, frame + 8, 26, H - frame * 2 - 16);
  strokeDual(c, h, (p) => { p.moveTo(W / 2 - 20, frame + 12); p.lineTo(W / 2 - 20, H - frame - 12); }, 7);
  strokeDual(c, h, (p) => { p.moveTo(W / 2 + 20, frame + 12); p.lineTo(W / 2 + 20, H - frame - 12); }, 7);
  for (let y = 100; y < H - 80; y += 96) {
    for (const dx of [-8, 8]) {
      const g = c.createRadialGradient(W / 2 + dx - 3, y - 3, 1, W / 2 + dx, y, 10);
      g.addColorStop(0, '#a89464'); g.addColorStop(0.55, '#63583e'); g.addColorStop(1, '#141610');
      c.fillStyle = g; c.beginPath(); c.arc(W / 2 + dx, y, 8, 0, Math.PI * 2); c.fill();
      const hg = h.createRadialGradient(W / 2 + dx - 2, y - 2, 1, W / 2 + dx, y, 9);
      hg.addColorStop(0, '#fff'); hg.addColorStop(0.7, '#ccc'); hg.addColorStop(1, '#666');
      h.fillStyle = hg; h.beginPath(); h.arc(W / 2 + dx, y, 8, 0, Math.PI * 2); h.fill();
    }
  }

  // background fine meander in the middle frieze (between 620 and 840)
  c.save(); h.save();
  c.beginPath(); c.rect(frame + 120, 625, W - (frame + 120) * 2, 230); c.clip();
  h.beginPath(); h.rect(frame + 120, 625, W - (frame + 120) * 2, 230); h.clip();
  for (let y = 632; y < 850; y += 34) {
    for (let x = 160; x < W - 160; x += 44) {
      const off = ((y / 34) | 0) % 2 ? 22 : 0;
      drawSpiralAt(c, h, x + off, y, 20, Math.PI / 4, 2.6);
    }
  }
  c.restore(); h.restore();

  // ------- dense field: fine cloud-thunder across the whole face -------
  c.save(); h.save();
  c.beginPath(); c.rect(frame + 30, 136, W - (frame + 30) * 2, H - 136 - 142); c.clip();
  h.beginPath(); h.rect(frame + 30, 136, W - (frame + 30) * 2, H - 136 - 142); h.clip();
  for (let y = 150; y < H - 150; y += 30) {
    for (let x = 146; x < W - 140; x += 38) {
      const off = ((y / 30) | 0) % 2 ? 19 : 0;
      const s = 14 + ((x * 7 + y * 3) % 9);
      if ((x * 13 + y * 7) % 11 === 0) continue;
      fineSpiral(c, h, x + off, y, s, Math.PI / 4, 1.7);
      if ((x + y) % 3 === 0) {
        strokeDual(c, h, (p) => { p.moveTo(x + off - s * 0.7, y - s * 0.7); p.lineTo(x + off + s * 0.7, y - s * 0.7); }, 1.4);
      }
    }
  }
  c.restore(); h.restore();

  // additional narrow registers and stud rows
  bandMeander(c, h, frame + 80, 196, W - (frame + 80) * 2, 34, 26, 3.2);
  bandMeander(c, h, frame + 80, 636, W - (frame + 80) * 2, 30, 24, 3);
  bandMeander(c, h, frame + 80, 906, W - (frame + 80) * 2, 28, 24, 3);
  for (const yy of [655, 705, 755, 805]) {
    for (let x = frame + 140; x < W - frame - 120; x += 48) {
      const xx = x + ((yy / 50) | 0) % 2 * 22;
      const g = c.createRadialGradient(xx - 2, yy - 2, 1, xx, yy, 8);
      g.addColorStop(0, '#c0a978'); g.addColorStop(0.6, '#6d5d3f'); g.addColorStop(1, '#1b1d14');
      c.fillStyle = g; c.beginPath(); c.arc(xx, yy, 7, 0, 7); c.fill();
      h.fillStyle = '#d8d8d8'; h.beginPath(); h.arc(xx, yy, 7, 0, 7); h.fill();
    }
  }

  // large taotie panels, one per leaf
  taotie(c, h, 560, 390, 470, 9);
  taotie(c, h, W - 560, 390, 470, 9);
  // secondary masks in the lower register
  taotie(c, h, 286, 742, 230, 5.5);
  taotie(c, h, W - 286, 742, 230, 5.5);
  // corner guardian masks
  taotie(c, h, 285, 208, 138, 4.2);
  taotie(c, h, W - 285, 208, 138, 4.2);

  // serpentine kuilong winding beside the great masks
  for (const side of [-1, 1]) {
    const cx0 = side < 0 ? 208 : W - 208;
    const x = cx0;
    strokeDual(c, h, (p) => {
      p.moveTo(x, 150);
      p.bezierCurveTo(x + side * -70, 250, x + side * 62, 300, x + side * -6, 390);
      p.bezierCurveTo(x + side * -70, 470, x + side * 55, 500, x + side * -12, 590);
      p.bezierCurveTo(x + side * -60, 640, x + side * 36, 660, x + side * 6, 690);
    }, 7.5);
    for (let i = 0; i < 10; i++) {
      const y = 170 + i * 52;
      drawSpiralAt(c, h, x + Math.sin(i * 1.7) * 34, y, 26, i * 1.2, 3.2);
      strokeDual(c, h, (p) => {
        p.arc(x + Math.sin(i * 1.7) * 32, y + 16, 12, 0.2, Math.PI * 1.2);
      }, 2.2);
    }
  }
  // halo of bosses around each great mask
  for (const side of [-1, 1]) {
    const cxh = side < 0 ? 560 : W - 560;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const xx = cxh + Math.cos(a) * 300, yy = 390 + Math.sin(a) * 285;
      if (xx < 140 || xx > W - 140 || yy < 140 || yy > 900) continue;
      const g = c.createRadialGradient(xx - 2, yy - 2, 1, xx, yy, 10);
      g.addColorStop(0, '#c9b17c'); g.addColorStop(0.6, '#7d6a48'); g.addColorStop(1, '#202017');
      c.fillStyle = g; c.beginPath(); c.arc(xx, yy, 9, 0, 7); c.fill();
      h.fillStyle = '#e0e0e0'; h.beginPath(); h.arc(xx, yy, 9, 0, 7); h.fill();
    }
  }
  // top frieze of running cloud hooks, filling the high empty register
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 190 : W - 190;
    for (let i = 0; i < 9; i++) {
      const xx = x0 + side * (-1) * 0 + (side < 0 ? i * 58 : -i * 58);
      drawSpiralAt(c, h, xx, 176, 30, Math.PI / 4 * (i % 2), 3.2);
      strokeDual(c, h, (p) => {
        p.moveTo(xx - 22, 205); p.bezierCurveTo(xx - 8, 218, xx + 8, 218, xx + 22, 205);
      }, 2.2);
    }
  }
  // scattered bosses through the mid fields
  const rb = mulberry32(8811);
  for (let i = 0; i < 90; i++) {
    const xx = 150 + rb() * (W - 300), yy = 150 + rb() * 700;
    if (Math.abs(xx - W / 2) < 75) continue;
    if (Math.abs(xx - 560) < 260 && Math.abs(yy - 390) < 260) continue;
    if (Math.abs(xx - (W - 560)) < 260 && Math.abs(yy - 390) < 260) continue;
    const g = c.createRadialGradient(xx - 2, yy - 2, 1, xx, yy, 7);
    g.addColorStop(0, '#b49d6d'); g.addColorStop(0.6, '#66563a'); g.addColorStop(1, '#1b1d14');
    c.fillStyle = g; c.beginPath(); c.arc(xx, yy, 6, 0, 7); c.fill();
    h.fillStyle = '#c8c8c8'; h.beginPath(); h.arc(xx, yy, 6, 0, 7); h.fill();
  }
  // hairline casting seams
  for (let i = 0; i < 26; i++) {
    const xx = 150 + rb() * (W - 300);
    c.strokeStyle = 'rgba(20,24,18,0.4)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(xx, 150); c.lineTo(xx + (rb() - 0.5) * 19, 880); c.stroke();
  }

  // tiny inscription strips by the frame
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 118 : W - 118;
    for (let i = 0; i < 14; i++) glyph(c, h, x0, 240 + i * 32, 18, rndForInscription(i + (side > 0 ? 20 : 0)));
  }

  // narrow vertical kuilong borders beside masks
  for (const x of [frame + 126, W - frame - 150]) {
    strokeDual(c, h, (p) => {
      p.moveTo(x, 175); p.bezierCurveTo(x + 75, 240, x - 55, 330, x + 16, 420);
      p.bezierCurveTo(x + 80, 500, x - 45, 520, x + 24, 545);
    }, 8);
    for (let y = 190; y < 540; y += 56) drawSpiralAt(c, h, x + 20, y, 26, Math.PI / 2, 3.2);
  }

  // upper register cloud pattern flanking masks
  for (const cx of [frame + 250, W / 2 - 145, W / 2 + 145, W - frame - 250]) {
    for (let i = 0; i < 4; i++) drawSpiralAt(c, h, cx + (i % 2) * 34, 240 + i * 34, 30, Math.PI / 4 * (i % 2), 3.6);
  }

  // middle frieze raised roundels
  for (let i = 0; i < 20; i++) {
    const x = frame + 150 + i * ((W - frame * 2 - 300) / 19);
    const y = 860;
    const g = c.createRadialGradient(x - 5, y - 5, 2, x, y, 22);
    g.addColorStop(0, '#b5a170'); g.addColorStop(0.55, '#7d704f'); g.addColorStop(1, '#20261c');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, 20, 0, Math.PI * 2); c.fill();
    const hg = h.createRadialGradient(x - 4, y - 4, 2, x, y, 21);
    hg.addColorStop(0, '#fff'); hg.addColorStop(0.6, '#d8d8d8'); hg.addColorStop(1, '#555');
    h.fillStyle = hg; h.beginPath(); h.arc(x, y, 20, 0, Math.PI * 2); h.fill();
    strokeDual(c, h, (p) => { p.arc(x, y, 25, 0, Math.PI * 2); }, 3);
  }

  // lower glyph band
  const rnd = mulberry32(424242);
  for (let i = 0; i < 22; i++) {
    glyph(c, h, frame + 150 + i * 78, 945, 34, rnd);
  }

  // triangular thunder lappets around bottom corners
  for (const sx of [0, 1]) {
    for (let i = 0; i < 7; i++) {
      const x = (!sx ? frame + 74 : W - frame - 74) + (!sx ? i * 32 : -i * 32);
      const y = H - 152;
      strokeDual(c, h, (p) => { p.moveTo(x - 15, y); p.lineTo(x, y + 26); p.lineTo(x + 15, y); p.closePath(); }, 3.4);
    }
  }

  // patina blooms & drips over the whole surface
  const r2 = mulberry32(998877);
  c.save();
  c.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 90; i++) {
    const x = r2() * W, y = r2() * H, rad = 40 + r2() * 150;
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(58,104,84,${0.06 + r2() * 0.14})`);
    g.addColorStop(0.55, 'rgba(44,84,68,0.05)');
    g.addColorStop(1, 'rgba(30,60,50,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
  }
  for (let i = 0; i < 55; i++) {
    const x = r2() * W, y = r2() * H * 0.7, len = 40 + r2() * 220, w = 1 + r2() * 5;
    const g = c.createLinearGradient(x, y, x, y + len);
    g.addColorStop(0, 'rgba(22,44,38,0.16)'); g.addColorStop(1, 'rgba(22,44,38,0)');
    c.fillStyle = g; c.fillRect(x, y, w, len);
  }
  c.restore();

  // frost dusting at the base + seam
  for (let i = 0; i < 1300; i++) {
    const x = r2() * W, y = H - 60 - Math.pow(r2(), 2) * 180;
    c.fillStyle = `rgba(200,220,216,${0.04 + r2() * 0.16})`;
    const s = 0.5 + r2() * 2;
    c.fillRect(x, y, s, s);
  }
  // warm bronze cast — pull the whole surface away from pure green
  c.save();
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = 'rgba(218, 184, 140, 0.62)';
  c.fillRect(0, 0, W, H);
  c.restore();
  c.save();
  c.globalCompositeOperation = 'soft-light';
  c.fillStyle = 'rgba(90, 120, 104, 0.25)';
  c.fillRect(0, 0, W, H);
  c.restore();

  // global fine scratches
  for (let i = 0; i < 160; i++) {
    const x = r2() * W, y = r2() * H, len = 10 + r2() * 60;
    c.strokeStyle = `rgba(190,200,180,${0.02 + r2() * 0.05})`; c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y - len * 0.15); c.stroke();
  }

  const map = makeTexture(col, { srgb: true, wrap: THREE.ClampToEdgeWrapping, aniso: 16 });
  const bump = makeTexture(hgt, { srgb: false, wrap: THREE.ClampToEdgeWrapping, aniso: 16 });
  // roughness: recesses rougher than polished raised ridges
  const roughC = canvas(1024, 512);
  const rc = roughC.getContext('2d');
  rc.drawImage(hgt, 0, 0, 1024, 512);
  const rid = rc.getImageData(0, 0, 1024, 512);
  for (let i = 0; i < rid.data.length; i += 4) {
    const v = rid.data[i];
    const rough = 225 - v * 0.45;
    rid.data[i] = rid.data[i + 1] = rid.data[i + 2] = rough;
  }
  rc.putImageData(rid, 0, 0);
  const roughness = makeTexture(roughC, { srgb: false, wrap: THREE.ClampToEdgeWrapping, aniso: 8 });
  return { map, bump, roughness, heightCanvas: hgt, width: W, height: H };
}

/* ------------------------------------------------------------------ *
 *  Rock / snow / bones
 * ------------------------------------------------------------------ */

export function makeRockTextures(seed = 12) {
  const S = 512;
  const col = canvas(S, S), hgt = canvas(S, S), rgh = canvas(S, S);
  const c = col.getContext('2d'), h = hgt.getContext('2d'), r = rgh.getContext('2d');
  noiseFill(col, S, S, (x, y) => {
    const n = fbm(x * 0.014 + seed, y * 0.014, 5, noiseA) * 0.5 + 0.5;
    const m = fbm(x * 0.08, y * 0.06 + seed, 3, noiseB) * 0.5 + 0.5;
    const base = 15 + n * 26 + m * 7;
    const warm = 1 + (m - 0.5) * 0.15;
    return [base * 1.05 * warm, base * 1.02, base * 0.95];
  });
  noiseFill(hgt, S, S, (x, y) => {
    const n = fbm(x * 0.018 + seed, y * 0.02, 5, noiseA) * 0.5 + 0.5;
    const m = fbm(x * 0.08, y * 0.07, 3, noiseC) * 0.5 + 0.5;
    const v = 40 + n * 120 + m * 55;
    return [v, v, v];
  });
  noiseFill(rgh, S, S, (x, y) => {
    const n = fbm(x * 0.03, y * 0.03 + seed, 4, noiseB) * 0.5 + 0.5;
    const v = 195 + n * 45;
    return [v, v, v];
  });
  // strata + cracks
  const rnd = mulberry32(seed * 733 + 7);
  for (let k = 0; k < 10; k++) {
    let y = rnd() * S;
    c.strokeStyle = `rgba(58,58,54,${0.1 + rnd() * 0.14})`; c.lineWidth = 1 + rnd() * 3;
    h.strokeStyle = '#6a6a6a'; h.lineWidth = 2 + rnd() * 3;
    c.beginPath(); h.beginPath(); c.moveTo(0, y); h.moveTo(0, y);
    for (let x = 0; x <= S; x += 28) {
      y += (rnd() - 0.5) * 12;
      c.lineTo(x, y); h.lineTo(x, y);
    }
    c.stroke(); h.stroke();
  }
  for (let k = 0; k < 34; k++) {
    let x = rnd() * S, y = rnd() * S;
    c.beginPath(); h.beginPath(); c.moveTo(x, y); h.moveTo(x, y);
    const seg = 2 + Math.floor(rnd() * 6);
    for (let j = 0; j < seg; j++) {
      x += (rnd() - 0.5) * 60; y += (rnd() - 0.3) * 60;
      c.lineTo(x, y); h.lineTo(x, y);
    }
    c.strokeStyle = 'rgba(0,0,0,0.75)'; c.lineWidth = 1 + rnd() * 1.6; c.stroke();
    c.strokeStyle = 'rgba(80,84,76,0.24)'; c.lineWidth = 0.8; c.stroke();
    h.strokeStyle = '#111'; h.lineWidth = 2 + rnd() * 2; h.stroke();
  }
  // wet seams / mineral sheen
  for (let k = 0; k < 22; k++) {
    const x = rnd() * S, y = rnd() * S, rad = 10 + rnd() * 55;
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(40,58,56,0.18)'); g.addColorStop(1, 'rgba(30,40,38,0)');
    c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    r.fillStyle = 'rgba(118,118,118,0.35)'; r.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // pale mineral specks
  for (let k = 0; k < 450; k++) {
    c.fillStyle = `rgba(125,132,120,${0.05 + rnd() * 0.16})`;
    c.fillRect(rnd() * S, rnd() * S, 0.7 + rnd() * 1.6, 0.7 + rnd() * 1.3);
  }
  return {
    map: makeTexture(col, { repeat: [3, 3] }),
    bump: makeTexture(hgt, { srgb: false, repeat: [3, 3] }),
    roughness: makeTexture(rgh, { srgb: false, repeat: [3, 3] }),
  };
}

export function makeSnowTextures() {
  const S = 512;
  const col = canvas(S, S), hgt = canvas(S, S);
  const c = col.getContext('2d'), h = hgt.getContext('2d');
  noiseFill(col, S, S, (x, y) => {
    const n = fbm(x * 0.012, y * 0.012, 5, noiseB) * 0.5 + 0.5;
    const m = fbm(x * 0.06, y * 0.06, 3, noiseA) * 0.5 + 0.5;
    return [168 + n * 56 + m * 10, 184 + n * 48 + m * 8, 190 + n * 40 + m * 5];
  });
  noiseFill(hgt, S, S, (x, y) => {
    const n = fbm(x * 0.015, y * 0.02, 4, noiseC) * 0.5 + 0.5;
    const m = fbm(x * 0.09, y * 0.08, 2, noiseB) * 0.5 + 0.5;
    const v = 100 + n * 70 + m * 50;
    return [v, v, v];
  });
  const rnd = mulberry32(5512);
  for (let k = 0; k < 650; k++) {
    const x = rnd() * S, y = rnd() * S, s = 0.7 + rnd() * 2.6;
    c.fillStyle = `rgba(245,250,252,${0.15 + rnd() * 0.55})`;
    c.fillRect(x, y, s, s);
  }
  // wind ripples
  for (let k = 0; k < 18; k++) {
    const y = rnd() * S;
    c.strokeStyle = `rgba(120,145,155,${0.04 + rnd() * 0.07})`; c.lineWidth = 2 + rnd() * 6;
    c.beginPath(); c.moveTo(0, y);
    for (let x = 0; x < S; x += 30) c.lineTo(x, y + Math.sin(x * 0.03 + k) * 7);
    c.stroke();
  }
  return {
    map: makeTexture(col, { repeat: [5, 5] }),
    bump: makeTexture(hgt, { srgb: false, repeat: [5, 5] }),
  };
}

export function makeBoneTexture() {
  const S = 256, col = canvas(S, S);
  const c = col.getContext('2d');
  noiseFill(col, S, S, (x, y) => {
    const n = fbm(x * 0.03, y * 0.05, 4, noiseC) * 0.5 + 0.5;
    const v = 135 + n * 70;
    return [v * 1.02, v * 0.97, v * 0.86];
  });
  const rnd = mulberry32(99);
  for (let k = 0; k < 26; k++) {
    const x = rnd() * S, y = rnd() * S;
    const g = c.createRadialGradient(x, y, 0, x, y, 4 + rnd() * 18);
    g.addColorStop(0, 'rgba(40,34,26,0.35)'); g.addColorStop(1, 'rgba(40,34,26,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, 24, 0, 7); c.fill();
  }
  return { map: makeTexture(col) };
}

export function makeSkinTextures() {
  const W = 512, H = 1024;
  const col = canvas(W, H), hgt = canvas(W, H);
  const c = col.getContext('2d'), h = hgt.getContext('2d');
  noiseFill(col, W, H, (x, y) => {
    const n = fbm(x * 0.008, y * 0.014, 5, noiseA) * 0.5 + 0.5;
    const m = fbm(x * 0.04, y * 0.08, 3, noiseB) * 0.5 + 0.5;
    const v = 105 + n * 55 + m * 15;
    return [v * 0.82, v * 0.9, v * 0.87];
  });
  noiseFill(hgt, W, H, (x, y) => {
    const n = fbm(x * 0.01, y * 0.03, 4, noiseC) * 0.5 + 0.5;
    const m = fbm(x * 0.08, y * 0.06, 3, noiseB) * 0.5 + 0.5;
    const v = 90 + n * 60 + m * 35;
    return [v, v, v];
  });
  const rnd = mulberry32(31415);
  // translucent veins
  for (let k = 0; k < 46; k++) {
    let x = rnd() * W, y = rnd() * H;
    c.beginPath(); h.beginPath(); c.moveTo(x, y); h.moveTo(x, y);
    for (let j = 0; j < 7; j++) {
      x += (rnd() - 0.5) * 55; y += (rnd() - 0.35) * 40;
      c.lineTo(x, y); h.lineTo(x, y);
    }
    c.strokeStyle = `rgba(52,72,78,${0.14 + rnd() * 0.2})`; c.lineWidth = 0.7 + rnd() * 1.4; c.stroke();
    h.strokeStyle = 'rgba(60,60,60,0.5)'; h.lineWidth = 1.4; h.stroke();
  }
  // desiccated creases
  for (let k = 0; k < 90; k++) {
    const x = rnd() * W, y = rnd() * H;
    c.strokeStyle = `rgba(32,30,28,${0.08 + rnd() * 0.18})`; c.lineWidth = 0.6 + rnd() * 1.2;
    c.beginPath(); c.moveTo(x, y);
    c.quadraticCurveTo(x + (rnd() - 0.5) * 50, y + rnd() * 30, x + (rnd() - 0.5) * 80, y + rnd() * 60);
    c.stroke();
  }
  // frozen blood — dark maroon, drips from top and around the edges
  for (let k = 0; k < 34; k++) {
    const x = rnd() * W;
    let y = rnd() * H * 0.65;
    const len = 30 + rnd() * 280, w = 1 + rnd() * 13;
    const g = c.createLinearGradient(x, y, x, y + len);
    g.addColorStop(0, `rgba(45,12,10,${0.42 + rnd() * 0.35})`);
    g.addColorStop(0.6, `rgba(34,10,9,${0.25 + rnd() * 0.25})`);
    g.addColorStop(1, 'rgba(24,8,7,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x - w * 0.5, y);
    c.quadraticCurveTo(x - w * 0.7, y + len * 0.5, x - w * 0.25, y + len);
    c.quadraticCurveTo(x + w * 0.1, y + len * 0.6, x + w * 0.5, y);
    c.closePath(); c.fill();
  }
  for (let k = 0; k < 24; k++) {
    const x = rnd() * W, y = rnd() * H, rad = 6 + rnd() * 40;
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(48,14,11,${0.25 + rnd() * 0.3})`);
    g.addColorStop(0.7, 'rgba(40,12,10,0.06)'); g.addColorStop(1, 'rgba(30,8,7,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, 7); c.fill();
  }
  // ice crystals
  for (let k = 0; k < 800; k++) {
    c.fillStyle = `rgba(218,236,236,${0.05 + rnd() * 0.3})`;
    const x = rnd() * W, y = rnd() * H, s = 0.5 + rnd() * 2.2;
    c.fillRect(x, y, s, s);
  }
  return {
    map: makeTexture(col, { wrap: THREE.ClampToEdgeWrapping }),
    bump: makeTexture(hgt, { srgb: false, wrap: THREE.ClampToEdgeWrapping }),
  };
}

/* ------------------------------------------------------------------ *
 *  Cloth, mist, light sprites
 * ------------------------------------------------------------------ */

export function makeBannerTexture(seed = 7) {
  const W = 256, H = 384;
  const cv = canvas(W, H);
  const c = cv.getContext('2d');
  const rnd = mulberry32(seed * 31 + 5);
  c.fillStyle = '#2a1715'; c.fillRect(0, 0, W, H);
  const img = c.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const x = (i / 4) % W, y = ((i / 4) / W) | 0;
    const n = fbm(x * 0.03, y * 0.02, 4, noiseB) * 0.5 + 0.5;
    const fade = 0.55 + n * 0.6;
    img.data[i] = 46 * fade; img.data[i + 1] = 26 * fade; img.data[i + 2] = 23 * fade;
    img.data[i + 3] = 235;
  }
  c.putImageData(img, 0, 0);
  // ochre glyph
  c.strokeStyle = 'rgba(156,128,72,0.72)'; c.lineWidth = 7; c.lineCap = 'round';
  c.beginPath();
  c.moveTo(72, 96); c.lineTo(184, 96); c.moveTo(128, 60); c.lineTo(128, 250);
  c.moveTo(72, 150); c.lineTo(128, 196); c.lineTo(184, 150);
  c.moveTo(64, 250); c.lineTo(192, 250);
  c.stroke();
  c.strokeStyle = 'rgba(90,66,38,0.55)'; c.lineWidth = 3;
  c.strokeRect(52, 44, 152, 300);
  // frayed / torn border
  c.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 70; k++) {
    const edge = Math.floor(rnd() * 4);
    let x, y;
    if (edge === 0) { x = rnd() * W; y = rnd() * 18; }
    else if (edge === 1) { x = rnd() * W; y = H - rnd() * 24; }
    else if (edge === 2) { x = rnd() * 20; y = rnd() * H; }
    else { x = W - rnd() * 22; y = rnd() * H; }
    c.beginPath(); c.arc(x, y, 5 + rnd() * 20, 0, 7); c.fill();
  }
  for (let k = 0; k < 12; k++) {
    const x = rnd() * W, y = rnd() * H;
    c.beginPath(); c.ellipse(x, y, 2 + rnd() * 9, 3 + rnd() * 18, rnd() * 3, 0, 7); c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  return makeTexture(cv, { wrap: THREE.ClampToEdgeWrapping });
}

export function makeMistTexture(seed = 3, vertical = false) {
  const W = vertical ? 256 : 512, H = vertical ? 512 : 256;
  const cv = canvas(W, H);
  const c = cv.getContext('2d');
  const img = c.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H;
      const warp = fbm(x * 0.01 + seed, y * 0.01, 3, noiseA);
      let n = fbm(x * 0.012 + warp * 2, y * 0.02 + seed, 5, noiseB) * 0.5 + 0.5;
      n = Math.pow(n, 1.6);
      const edgeX = Math.min(1, Math.min(u, 1 - u) * 5.5);
      const edgeY = vertical ? Math.min(1, Math.min(v, 1 - v) * 3.0) : Math.min(1, Math.min(v, 1 - v) * 4.0);
      const a = Math.max(0, n * edgeX * edgeY);
      const i = (y * W + x) * 4;
      img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255;
      img.data[i + 3] = Math.min(255, a * 340);
    }
  }
  c.putImageData(img, 0, 0);
  return makeTexture(cv, { srgb: false, wrap: THREE.ClampToEdgeWrapping });
}

export function makeGlowTexture(power = 2.4) {
  const S = 128, cv = canvas(S, S);
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    g.addColorStop(t, `rgba(255,255,255,${Math.pow(1 - t, power)})`);
  }
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  return makeTexture(cv, { srgb: false, wrap: THREE.ClampToEdgeWrapping });
}

export function makeFlareTexture() {
  const S = 512, cv = canvas(S, S);
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.5);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.035, 'rgba(255,250,230,1)');
  g.addColorStop(0.07, 'rgba(255,222,160,0.35)');
  g.addColorStop(0.2, 'rgba(255,170,90,0.08)');
  g.addColorStop(1, 'rgba(255,120,50,0)');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  // horizontal anamorphic streak
  const lg = c.createLinearGradient(0, S / 2, S, S / 2);
  lg.addColorStop(0, 'rgba(255,180,100,0)');
  lg.addColorStop(0.4, 'rgba(255,220,170,0.18)');
  lg.addColorStop(0.5, 'rgba(255,250,235,0.8)');
  lg.addColorStop(0.6, 'rgba(255,220,170,0.18)');
  lg.addColorStop(1, 'rgba(255,180,100,0)');
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = lg; c.fillRect(0, S / 2 - 3, S, 6);
  c.globalCompositeOperation = 'source-over';
  return makeTexture(cv, { wrap: THREE.ClampToEdgeWrapping });
}

export function makeFrostTexture() {
  const S = 512, cv = canvas(S, S);
  const c = cv.getContext('2d');
  const img = c.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = fbm(x * 0.02, y * 0.02, 4, noiseC) * 0.5 + 0.5;
    const v = 180 + n * 65;
    const i = (y * S + x) * 4;
    img.data[i] = v; img.data[i + 1] = v + 8; img.data[i + 2] = v + 12; img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  return makeTexture(cv, { repeat: [2, 2] });
}

export function makeStoneCarvingTexture() {
  const { map, bump, roughness } = makeRockTextures(77);
  return { map, bump, roughness };
}

/* ------------------------------------------------------------------ *
 *  Small canvas helpers for labels inside the world
 * ------------------------------------------------------------------ */
export function makeTextTexture(text, { w = 512, h = 128, font = '42px serif', color = '#d9cda8' } = {}) {
  const cv = canvas(w, h);
  const c = cv.getContext('2d');
  c.clearRect(0, 0, w, h);
  c.font = font; c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, w / 2, h / 2);
  return makeTexture(cv, { wrap: THREE.ClampToEdgeWrapping });
}

export function makeFaceTexture() {
  const W = 256, H = 512;
  const cv = canvas(W, H);
  const c = cv.getContext('2d');
  const rnd = mulberry32(1618);
  c.clearRect(0, 0, W, H);
  // long, flat, papery face
  const face = new Path2D();
  face.moveTo(128, 18);
  face.bezierCurveTo(84, 18, 58, 92, 56, 210);
  face.bezierCurveTo(54, 330, 80, 430, 128, 470);
  face.bezierCurveTo(176, 430, 202, 330, 200, 210);
  face.bezierCurveTo(198, 92, 172, 18, 128, 18);
  c.save();
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#b7beb2'); g.addColorStop(0.45, '#cfd2c4');
  g.addColorStop(0.8, '#a4ac9f'); g.addColorStop(1, '#778077');
  c.fillStyle = g; c.fill(face); c.restore();
  c.save(); c.clip(face);
  // paper fibres
  for (let i = 0; i < 260; i++) {
    const x = rnd() * W, y = rnd() * H, len = 8 + rnd() * 55;
    c.strokeStyle = `rgba(60,66,58,${0.02 + rnd() * 0.06})`; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 6, y + len); c.stroke();
  }
  // hollow cheeks
  for (const sx of [-1, 1]) {
    const cx = 128 + sx * 62, cy = 290;
    const gg = c.createRadialGradient(cx, cy, 3, cx, cy, 55);
    gg.addColorStop(0, 'rgba(56,64,58,0.25)'); gg.addColorStop(1, 'rgba(56,64,58,0)');
    c.fillStyle = gg; c.beginPath(); c.arc(cx, cy, 55, 0, 7); c.fill();
  }
  // eye sockets — blank, no pupils
  for (const sx of [-1, 1]) {
    const ex = 128 + sx * 38, ey = 200;
    const eg = c.createRadialGradient(ex, ey, 1, ex, ey, 26);
    eg.addColorStop(0, 'rgba(18,22,19,0.92)');
    eg.addColorStop(0.55, 'rgba(35,42,37,0.55)');
    eg.addColorStop(1, 'rgba(80,88,80,0)');
    c.fillStyle = eg; c.beginPath(); c.ellipse(ex, ey, 23, 30, 0, 0, 7); c.fill();
    c.strokeStyle = 'rgba(40,46,40,0.5)'; c.lineWidth = 2.5;
    c.beginPath(); c.ellipse(ex, ey, 25, 32, 0, 0, 7); c.stroke();
  }
  // nose: two narrow slits
  c.strokeStyle = 'rgba(42,48,42,0.55)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(122, 240); c.lineTo(118, 292); c.moveTo(134, 240); c.lineTo(138, 292); c.stroke();
  c.beginPath(); c.moveTo(120, 300); c.quadraticCurveTo(128, 306, 136, 300); c.stroke();
  // thin, expressionless mouth
  c.strokeStyle = 'rgba(48,42,40,0.7)'; c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(96, 356); c.quadraticCurveTo(128, 359, 160, 356); c.stroke();
  c.strokeStyle = 'rgba(30,26,24,0.4)'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(100, 366); c.quadraticCurveTo(128, 369, 156, 366); c.stroke();
  // cracks / seams
  for (let i = 0; i < 7; i++) {
    let x = 40 + rnd() * 176, y = 40 + rnd() * 360;
    c.strokeStyle = `rgba(45,50,44,${0.18 + rnd() * 0.22})`; c.lineWidth = 0.8 + rnd();
    c.beginPath(); c.moveTo(x, y);
    for (let j = 0; j < 4; j++) { x += (rnd() - 0.5) * 30; y += rnd() * 24; c.lineTo(x, y); }
    c.stroke();
  }
  // frost at the jaw
  for (let i = 0; i < 160; i++) {
    c.fillStyle = `rgba(235,248,248,${0.1 + rnd() * 0.4})`;
    c.fillRect(rnd() * W, 380 + rnd() * 100, 0.8 + rnd() * 2, 0.8 + rnd() * 2);
  }
  c.restore();
  // slightly ragged / torn edge
  c.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 80; i++) {
    const t = rnd() * Math.PI * 2;
    const x = 128 + Math.cos(t) * (60 + rnd() * 45);
    const y = 245 + Math.sin(t) * (205 + rnd() * 40);
    c.beginPath(); c.arc(x, y, 1 + rnd() * 5, 0, 7); c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  return makeTexture(cv, { wrap: THREE.ClampToEdgeWrapping });
}

export function makeEnvCube() {
  const size = 128;
  const faces = [];
  for (let f = 0; f < 6; f++) {
    const cv = canvas(size, size);
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, '#16262a'); g.addColorStop(0.55, '#0a1113'); g.addColorStop(1, '#020303');
    c.fillStyle = g; c.fillRect(0, 0, size, size);
    if (f === 2) { // top face: faint cold light
      const r = c.createRadialGradient(80, 40, 2, 80, 40, 70);
      r.addColorStop(0, 'rgba(150,190,200,0.5)'); r.addColorStop(1, 'rgba(20,40,45,0)');
      c.fillStyle = r; c.fillRect(0, 0, size, size);
    }
    if (f === 4) { // positive Z: far warm door glow
      const r = c.createRadialGradient(64, 90, 2, 64, 90, 55);
      r.addColorStop(0, 'rgba(200,130,70,0.55)'); r.addColorStop(0.5, 'rgba(90,60,35,0.2)'); r.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = r; c.fillRect(0, 0, size, size);
    }
    faces.push(cv);
  }
  const cube = new THREE.CubeTexture(faces);
  cube.colorSpace = THREE.SRGBColorSpace;
  cube.needsUpdate = true;
  return cube;
}

/* ------------------------------------------------------------------ *
 *  A raised cast taotie medallion for the door, with its own relief.
 * ------------------------------------------------------------------ */
export function makeMedallionTexture() {
  const W = 1024, H = 1024;
  const col = canvas(W, H);
  const hgt = canvas(W, H);
  const c = col.getContext('2d');
  const h = hgt.getContext('2d');
  c.lineCap = h.lineCap = 'round';
  c.lineJoin = h.lineJoin = 'round';

  const bw = 256;
  const baseC = canvas(bw, bw), baseH = canvas(bw, bw);
  noiseFill(baseC, bw, bw, (x, y) => {
    const n = fbm(x * 0.026, y * 0.026, 4, noiseB) * 0.5 + 0.5;
    const m = fbm(x * 0.11, y * 0.11, 3, noiseC) * 0.5 + 0.5;
    const verd = Math.max(0, Math.min(1, n * 0.8 + m * 0.25));
    return [58 + n * 36 + m * 8, 52 + n * 30 + verd * 18, 38 + n * 20 + verd * 12];
  });
  noiseFill(baseH, bw, bw, (x, y) => {
    const n = fbm(x * 0.04, y * 0.05, 4, noiseA) * 0.5 + 0.5;
    const v = 70 + n * 38;
    return [v, v, v];
  });
  c.imageSmoothingEnabled = true;
  c.drawImage(baseC, 0, 0, W, H);
  h.drawImage(baseH, 0, 0, W, H);

  // dark recess + raised panel frame
  c.fillStyle = 'rgba(8,10,7,0.1)'; c.fillRect(0, 0, W, H);
  strokeDual(c, h, (p) => { p.rect(34, 34, W - 68, H - 68); }, 14);
  strokeDual(c, h, (p) => { p.rect(58, 58, W - 116, H - 116); }, 5);
  bandMeander(c, h, 74, 74, W - 148, 62, 32, 4.2);
  bandMeander(c, h, 74, H - 142, W - 148, 62, 32, 4.2);
  bandMeander(c, h, 74, 74, 62, H - 148, 32, 4.2);
  bandMeander(c, h, W - 142, 74, 62, H - 148, 32, 4.2);

  // dense fine cloud-thunder ground inside the panel
  c.save(); h.save();
  c.beginPath(); c.rect(150, 150, W - 300, H - 300); c.clip();
  h.beginPath(); h.rect(150, 150, W - 300, H - 300); h.clip();
  for (let y = 160; y < H - 150; y += 38) {
    for (let x = 158; x < W - 150; x += 46) {
      const off = ((y / 38) | 0) % 2 ? 22 : 0;
      drawSpiralAt(c, h, x + off, y, 22, Math.PI / 4, 2.2);
    }
  }
  c.restore(); h.restore();

  // concentric rings of bosses around the mask
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const x = W / 2 + Math.cos(a) * 385;
    const y = H / 2 + Math.sin(a) * 385;
    const g = c.createRadialGradient(x - 3, y - 3, 1, x, y, 15);
    g.addColorStop(0, '#b9a273'); g.addColorStop(0.6, '#726042'); g.addColorStop(1, '#211f16');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, 13, 0, 7); c.fill();
    const hg = h.createRadialGradient(x - 2, y - 2, 1, x, y, 14);
    hg.addColorStop(0, '#fff'); hg.addColorStop(1, '#555');
    h.fillStyle = hg; h.beginPath(); h.arc(x, y, 13, 0, 7); h.fill();
  }
  // central cast taotie, with an extra framing ring
  strokeDual(c, h, (p) => { p.arc(W / 2, H / 2, 410, 0, Math.PI * 2); }, 4.5);
  strokeDual(c, h, (p) => { p.arc(W / 2, H / 2, 348, 0, Math.PI * 2); }, 3.2);
  taotie(c, h, W / 2, H / 2 - 10, 610, 8.5);

  // tongues / flames under the mask
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      drawSpiralAt(c, h, W / 2 + sx * (170 + i * 55), H / 2 + 300 - i * 12, 60 - i * 8, sx * 0.5, 3.4);
    }
  }
  // inscription band bottom
  const rnd = mulberry32(635);
  for (let i = 0; i < 10; i++) glyph(c, h, 250 + i * 52, H - 190, 28, rnd);
  // patina blooms
  for (let i = 0; i < 42; i++) {
    const x = rnd() * W, y = rnd() * H, rad = 20 + rnd() * 90;
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(44,88,70,${0.04 + rnd() * 0.12})`);
    g.addColorStop(1, 'rgba(30,60,50,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, 7); c.fill();
  }
  // soot in the recesses
  c.fillStyle = 'rgba(6,8,5,0.1)'; c.fillRect(0, 0, W, H);
  c.save();
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = 'rgba(220, 190, 150, 0.7)';
  c.fillRect(0, 0, W, H);
  c.restore();
  // frost / dust
  for (let i = 0; i < 800; i++) {
    c.fillStyle = `rgba(200,215,205,${0.02 + rnd() * 0.12})`;
    c.fillRect(rnd() * W, rnd() * H, 0.6 + rnd() * 1.6, 0.6 + rnd() * 1.6);
  }

  const map = makeTexture(col, { srgb: true, wrap: THREE.ClampToEdgeWrapping, aniso: 16 });
  const bump = makeTexture(hgt, { srgb: false, wrap: THREE.ClampToEdgeWrapping, aniso: 16 });
  const roughC = canvas(512, 512);
  const rc = roughC.getContext('2d');
  rc.drawImage(hgt, 0, 0, 512, 512);
  const rd = rc.getImageData(0, 0, 512, 512);
  for (let i = 0; i < rd.data.length; i += 4) {
    const v = rd.data[i];
    const rough = 220 - v * 0.4;
    rd.data[i] = rd.data[i + 1] = rd.data[i + 2] = rough;
  }
  rc.putImageData(rd, 0, 0);
  return { map, bump, roughness: makeTexture(roughC, { srgb: false, wrap: THREE.ClampToEdgeWrapping }), heightCanvas: hgt, size: W };
}

export function makeFlameTexture() {
  const W = 128, H = 256;
  const cv = canvas(W, H);
  const c = cv.getContext('2d');
  c.clearRect(0, 0, W, H);
  // teardrop flame silhouette
  const path = new Path2D();
  path.moveTo(64, 12);
  path.bezierCurveTo(88, 58, 112, 104, 108, 156);
  path.bezierCurveTo(104, 214, 84, 242, 64, 246);
  path.bezierCurveTo(44, 242, 24, 214, 20, 156);
  path.bezierCurveTo(16, 104, 40, 58, 64, 12);
  const g = c.createRadialGradient(64, 190, 4, 64, 160, 120);
  g.addColorStop(0, 'rgba(255,255,240,1)');
  g.addColorStop(0.18, 'rgba(255,235,180,0.98)');
  g.addColorStop(0.45, 'rgba(255,168,74,0.8)');
  g.addColorStop(0.8, 'rgba(220,80,28,0.26)');
  g.addColorStop(1, 'rgba(120,30,10,0)');
  c.save(); c.clip(path); c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
  // hot inner tongue
  const gi = c.createRadialGradient(64, 200, 2, 64, 195, 55);
  gi.addColorStop(0, 'rgba(255,255,255,1)');
  gi.addColorStop(0.5, 'rgba(255,238,190,0.8)');
  gi.addColorStop(1, 'rgba(255,200,120,0)');
  c.save(); c.clip(path); c.fillStyle = gi; c.fillRect(0, 0, W, H); c.restore();
  return makeTexture(cv, { wrap: THREE.ClampToEdgeWrapping });
}
