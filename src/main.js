import './style.css';
import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode,
  VignetteEffect, NoiseEffect, BlendFunction, BrightnessContrastEffect, HueSaturationEffect, FXAAEffect,
} from 'postprocessing';
import CameraControls from 'camera-controls';
import { Rift } from './rift.js';
import { Valley, VALLEY_ORIGIN } from './valley.js';
import { GhostProcession, GHOST_TIMELINE } from './ghosts.js';
import { Flare } from './particles.js';
import { AudioEngine } from './audio.js';

CameraControls.install({ THREE });

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches || innerWidth < 820;
const quality = params.get('quality') === 'low' || params.get('quality') === 'mobile'
  ? 'low' : (isTouch ? 'low' : 'high');
const low = quality === 'low';
const D2R = THREE.MathUtils.degToRad;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x, a, b) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/*  Node scripts — quotes are taken from SCENE_SOURCE.md only.         */
/* ------------------------------------------------------------------ */
const SRC = {
  sanyewu: 'https://www.sanyewu.com/0/965/586561.html',
  sanyewu55: 'https://www.sanyewu.com/0/965/586566.html',
  daomu: 'https://www.daomubiji.com/yun-ding-tian-gong-55.html',
  finale: 'https://m.tedu.cc/newbook/1417370/17850380.html',
  ten: 'http://media.people.com.cn/n/2015/0818/c40606-27480994.html',
};

const NODES = {
  1: {
    title: '雪谷入口', env: 'valley', envName: '雪谷', short: '雪谷',
    chapter: '大结局（下）第二十九章「故地」',
    quote: '「雪谷」「三十米高的悬崖」「暴风雪」',
    note: '被雪掩埋的缝隙就在崖底，缝隙后方是温泉。入口段落在本章由吴邪、胖子重赴长白山的行程中引出。',
    source: '大结局（下）第二十九章 · 网络转载', url: SRC.finale,
    pos: new THREE.Vector3(VALLEY_ORIGIN.x + 24, 3.0, 62), target: new THREE.Vector3(VALLEY_ORIGIN.x - 2, 11.5, -29), fov: 55,
    extra: '<div class="extra-row"><b>入口</b> 雪谷 · 三十米崖壁 · 暴风雪</div><div class="extra-row"><b>去处</b> 崖底被雪埋住的缝隙</div>',
  },
  2: {
    title: '岩缝温泉', env: 'valley', envName: '岩缝', short: '温泉',
    chapter: '大结局（下）第二十九章「故地」',
    quote: '「被雪掩埋的缝隙」「温泉」',
    note: '穿过雪下的窄缝，热气从岩壁深处涌出。此段是进入地下裂谷前的最后一个暖处。',
    source: '大结局（下）第二十九章 · 网络转载', url: SRC.finale,
    pos: new THREE.Vector3(VALLEY_ORIGIN.x + 0.9, 1.75, -31.5), target: new THREE.Vector3(VALLEY_ORIGIN.x - 0.5, 1.0, -49.5), fov: 62,
    extra: '<div class="extra-row"><b>环境</b> 窄岩缝 · 温泉蒸汽 · 顶隙冷光</div><div class="extra-row"><b>交互</b> 底部按钮或 ←/→ 继续深入</div>',
  },
  3: {
    title: '地下裂谷', env: 'rift', envName: '裂谷', short: '裂谷',
    chapter: '云顶天宫篇 第五十章「守护神」的巢穴',
    quote: '「这条地下裂谷太大」<br>「谷底…全是极度不平整的黑色的火山岩块」<br>「从上面跌落的尸骨，层层叠叠」',
    note: '黑暗中只有手电。照明弹可以把整个谷底照得清清楚楚，也照出那些层层叠叠的尸骨。',
    source: '三叶屋 · 第五十章', url: SRC.sanyewu,
    pos: new THREE.Vector3(42, 17, 54), target: new THREE.Vector3(12, 7, -24), fov: 54,
    extra: '<div class="extra-row"><b>手电</b> 移动鼠标，光柱跟随</div><div class="extra-row"><b>照明弹</b> 按 F 或点击右下按钮</div>',
  },
  4: {
    title: '青铜门 · 全景', env: 'rift', envName: '巨门', short: '巨门',
    chapter: '云顶天宫篇 第五十章「守护神」的巢穴',
    quote: '「门高在三十米所有，宽度将近六十米」<br>「十层楼这么高」<br>「上万吨重」<br>「看上去竟然像是整体铸造起来的」',
    note: '两扇式青铜巨门嵌在裂谷一侧的崖壁上。画面中的人物剪影高 1.75 米，用作比例尺；门外框上标有 30 m / 60 m 尺度线。',
    source: '三叶屋 · 第五十章', url: SRC.sanyewu,
    pos: new THREE.Vector3(12, 8.6, 16), target: new THREE.Vector3(14, 15, -52), fov: 48,
    extra: '<div class="extra-row"><b>尺度</b> 高 30 m · 宽近 60 m · 上万吨重</div><div class="extra-row"><b>比例</b> 人物剪影 1.75 m · 门缝人皮封条</div>',
  },
  5: {
    title: '门纹 · 特写', env: 'rift', envName: '纹饰', short: '门纹',
    chapter: '云顶天宫篇 第五十章「守护神」的巢穴',
    quote: '「极其精美的花纹」<br>「复杂程度简直让人头皮发麻」',
    note: '<span class="tag">推演</span>原文没有写明门纹的具体图样。此处的云雷纹、饕餮式构图与铭文带，是以商周青铜器纹样作的程序化推演，不是影视改编造型。',
    source: '三叶屋 · 第五十章', url: SRC.sanyewu,
    pos: new THREE.Vector3(4.5, 22.5, -30.0), target: new THREE.Vector3(13.6, 19.0, -51.0), fov: 45,
    extra: '<div class="extra-row"><b>纹样</b> 云雷纹 · 饕餮式 · 铭文带</div><div class="extra-row"><b>观察</b> 拖拽旋转 · 滚轮缩放 · 双击复位</div>',
  },
  6: {
    title: '阴兵借道', env: 'rift', envName: '借道', short: '借道',
    chapter: '云顶天宫（下）第四十五章 永远无法解开的谜团',
    quote: '「排成一列长队」「四人一行，行走极为整齐」<br>「奇长的人脸…长度要比普通人长一倍」<br>「脸色极度苍白」「好像是纸糊的一样」<br>「一连串鹿角号声从裂谷的一端传来」',
    note: '人皮封条爆裂、门向外挪开、缝内亮起火光、淡蓝薄雾涌出；张起灵背黑金古刀、右手托鬼玺混在队中，回头说「再见」，随后门合拢。',
    source: '大道不孤 · 第四十五章', url: SRC.daomu,
    pos: null, target: null, fov: 46,
    extra: `
      <div class="extra-row"><b>进度</b><span id="phase6">封门人皮</span></div>
      <div class="timeline"><i id="bar6"></i></div>
      <button class="replay" id="replay6">重播 · 52 秒</button>
      <div class="extra-row"><b>要素</b> 人皮 / 门开 / 蓝雾 / 阴兵 / 鬼玺 / 闭门</div>`,
  },
  7: {
    title: '尾声 · 十年', env: 'rift', envName: '十年', short: '十年',
    chapter: '《十年》2015-08-17（转引自人民网）',
    quote: '「走吧」',
    note: '2015 年 8 月 17 日，南派三叔以《十年》补完结局：吴邪与胖子再赴长白山，小哥从青铜门内出来。此句转引自新闻报道，原微博全文待核实。',
    source: '人民网 · 2015-08-18 报道', url: SRC.ten,
    pos: new THREE.Vector3(-10, 3.6, -10), target: new THREE.Vector3(1.5, 9.5, -50), fov: 52,
    extra: '<div class="extra-row"><b>2015 · 拾年</b> 长白山 · 青铜门前</div><div class="extra-row"><b>原文</b> 转引自人民网报道，原微博全文待核实</div>',
  },
};

/* ------------------------------------------------------------------ */
/*  Renderer / scene                                                    */
/* ------------------------------------------------------------------ */
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
const pixelRatio = () => Math.min(devicePixelRatio || 1, low ? 1 : 1.6);
renderer.setPixelRatio(pixelRatio());
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05090b);
scene.fog = new THREE.FogExp2(0x0a1214, 0.0095);
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.08, 1400);
camera.position.set(10, 2.4, 30);
camera.lookAt(0, 8, -25);

/* ------------------------------------------------------------------ */
/*  HUD                                                                */
/* ------------------------------------------------------------------ */
const ui = {
  card: $('#card'), nodeIndex: $('#node-index'), nodeEnv: $('#node-env'), title: $('#node-title'),
  chapter: $('#node-chapter'), quote: $('#node-quote'), note: $('#node-note'),
  source: $('#node-source'), extra: $('#node-extra'), scale: $('#scale-card'),
  orbitHint: $('#orbit-hint'), flareBtn: $('#flare-btn'), fade: $('#fade'),
  subtitle: $('#subtitle'), toast: $('#toast'), dots: $('#dots'),
  loader: $('#loader'), loadbar: $('#loadbar'), loadnote: $('#loadnote'),
  hintExtra: $('#hint-extra'), progress: $('#progress i'), sound: $('#sound'),
  prev: $('#prev'), next: $('#next'), flareCooldown: $('#flare-btn .cooldown'), zhangTag: $('#zhang-tag'),
};
let toastTimer = 0;
function toast(text, ms = 2200) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), ms);
}
let subtitleTimer = 0;
function showSubtitle(text, sub = '', ms = 5200) {
  ui.subtitle.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
  ui.subtitle.classList.add('show');
  clearTimeout(subtitleTimer);
  if (ms > 0) subtitleTimer = setTimeout(() => ui.subtitle.classList.remove('show'), ms);
}
function hideSubtitle() { ui.subtitle.classList.remove('show'); clearTimeout(subtitleTimer); }

let lastCardNode = 0;
function setCard(n) {
  if (lastCardNode === n) return;
  lastCardNode = n;
  const d = NODES[n];
  ui.nodeIndex.textContent = String(n).padStart(2, '0');
  ui.nodeEnv.textContent = d.envName;
  ui.title.textContent = d.title;
  ui.chapter.textContent = d.chapter;
  ui.quote.innerHTML = d.quote;
  ui.note.innerHTML = d.note;
  ui.source.textContent = d.source;
  ui.source.href = d.url;
  ui.extra.innerHTML = d.extra;
  ui.dots.querySelectorAll('.dot').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === n);
    el.style.setProperty('--c', i + 1 === n ? '#7fb3a2' : '');
  });
  if (n === 6) {
    const btn = $('#replay6');
    if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); replay6(); });
  }
}

function nodeHud(n) {
  ui.scale.classList.toggle('hidden', n !== 4);
  ui.orbitHint.classList.toggle('hidden', n !== 5);
  ui.flareBtn.classList.toggle('hidden', n !== 3);
  ui.hintExtra.textContent = n === 3 ? 'F 照明弹' : n === 5 ? '拖拽环视' : n === 6 ? '动画 52s' : '';
  ui.progress.style.width = `${(n / 7) * 100}%`;
}

for (let i = 1; i <= 7; i++) {
  const b = document.createElement('button');
  b.className = 'dot';
  b.textContent = String(i).padStart(2, '0');
  b.title = NODES[i].title;
  b.addEventListener('click', () => goTo(i));
  ui.dots.appendChild(b);
}

/* ------------------------------------------------------------------ */
/*  Audio                                                              */
/* ------------------------------------------------------------------ */
const audio = new AudioEngine();
ui.sound.addEventListener('click', async () => {
  try {
    const on = await audio.toggle();
    ui.sound.classList.toggle('on', on);
    ui.sound.querySelector('.sound-label').textContent = on ? '音效开' : '音效关';
    ui.sound.querySelector('.sound-icon').textContent = on ? '◉' : '◌';
    if (on) { audio.setScene(state.node); toast('音效已开启 · 全部为程序合成'); }
  } catch (e) {
    toast('音频初始化失败');
  }
});

/* ------------------------------------------------------------------ */
/*  World                                                              */
/* ------------------------------------------------------------------ */
let rift, valley, ghosts, flare, composer, bloomPass, finalPass, bloom;
let flashlight, flashlightTarget;
let cameraControls;
const state = {
  node: 0, env: null, transitioning: false, token: 0, tween: null,
  controls: false, t6: 0, paused: false, quality,
};
const tl = { burst: false, horn1: false, horn2: false, rumbleOpen: false, rumbleClose: false, impact: false };
const mouse = new THREE.Vector2(0, 0);
const smoothMouse = new THREE.Vector2(0, 0);
const lookTarget = new THREE.Vector3();
const tmpV = new THREE.Vector3();

function setupPost() {
  composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  const toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  const brightness = new BrightnessContrastEffect({ brightness: -0.012, contrast: 0.075 });
  const hue = new HueSaturationEffect({ hue: 0.0, saturation: -0.14 });
  const vignette = new VignetteEffect({ offset: 0.2, darkness: 0.45 });
  const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
  noise.blendMode.opacity.value = 0.055;
  if (!low) {
    bloom = new BloomEffect({
      mipmapBlur: true, luminanceThreshold: 0.95, luminanceSmoothing: 0.24,
      intensity: 0.4, radius: 0.62,
    });
    bloomPass = new EffectPass(camera, bloom);
    composer.addPass(bloomPass);
  }
  const finalEffects = [toneMapping, hue, brightness, vignette, noise];
  if (!low) finalEffects.push(new FXAAEffect());
  finalPass = new EffectPass(camera, ...finalEffects);
  composer.addPass(finalPass);
  composer.setSize(innerWidth, innerHeight);
}

function setupFlashlight() {
  flashlight = new THREE.SpotLight(0xfff0d6, 4200, 140, D2R(25), 0.5, 1.4);
  flashlight.position.set(0, 0, 0);
  flashlightTarget = new THREE.Object3D();
  flashlightTarget.position.set(0, 6, -30);
  flashlight.target = flashlightTarget;
  flashlight.visible = false;
  rift.group.add(flashlight, flashlightTarget);
}

/* ------------------------------------------------------------------ */
/*  Environment switching                                              */
/* ------------------------------------------------------------------ */
function setEnv(env) {
  state.env = env;
  valley.group.visible = env === 'valley';
  rift.group.visible = env === 'rift';
  ghosts.group.visible = false;
  rift.snow.points.visible = false;
  if (env === 'valley') {
    scene.background.set(0x1f2b33);
    scene.fog.color.set(0x80949d);
    scene.fog.density = 0.007;
    valley.setNode(state.node === 2 ? 2 : 1);
    rift.setEpilogue(false);
    rift.epilogueGroup.visible = false;
    if (flashlight) flashlight.visible = false;
    flare.reset();
  } else {
    scene.background.set(0x05090b);
    scene.fog.color.set(0x0d1a1d);
    scene.fog.density = 0.011;
  }
}

function setRiftMood(n) {
  if (!rift) return;
  const high = n === 7;
  const close = n === 5;
  rift.hemi.intensity = high ? 1.1 : n === 3 ? 1.1 : close ? 0.3 : 0.95;
  rift.ambient.intensity = high ? 0.95 : n === 3 ? 1.0 : close ? 0.26 : 0.82;
  rift.fill.intensity = high ? 1000 : n === 3 ? 2200 : close ? 340 : 780;
  rift.shaftSpot.intensity = high ? 15000 : n === 3 ? 12000 : 8500;
  rift.frameWash.intensity = high ? 2200 : n === 3 ? 1800 : close ? 500 : 4200;
  rift.lintelWash.intensity = high ? 3000 : n === 3 ? 1600 : close ? 900 : 8500;
  rift.thresholdPool.intensity = high ? 2000 : n === 3 ? 1800 : close ? 400 : 3000;
  rift.doorSpotL.intensity = high ? 3000 : close ? 1600 : n === 3 ? 3400 : 4400;
  rift.doorSpotR.intensity = high ? 2400 : close ? 1000 : n === 3 ? 2600 : 3100;
  rift.thresholdLight.intensity = high ? 160 : 120;
  rift.forecourt.intensity = high ? 2600 : close ? 1200 : n === 3 ? 2400 : 5200;
  rift.pillarSpots.forEach(p => { p.intensity = high ? 2200 : close ? 1300 : n === 3 ? 1200 : 5200; });
  rift.medallionFill.intensity = high ? 500 : close ? 140 : n === 3 ? 250 : 1500;
  rift.medallionSpots.forEach(p => { p.intensity = high ? 500 : close ? 300 : n === 3 ? 250 : 1400; p.color.set(close ? 0xb9c9c1 : 0xd2c8ab); });
  rift.ghostFill.intensity = n === 6 ? 900 : high ? 240 : 0;
  rift.seamFill.intensity = n === 4 ? 420 : close ? 260 : high ? 80 : 0;
}

function applyNodeView(n, immediate = false) {
  const d = NODES[n];
  state.node = n;
  window.__node = n;
  setCard(n);
  nodeHud(n);
  if (cameraControls) cameraControls.enabled = false;
  state.controls = false;

  if (d.env === 'valley') {
    if (state.env !== 'valley') setEnv('valley');
    valley.setNode(n);
    valley.group.visible = true;
    rift.group.visible = false;
    ghosts.group.visible = false;
    flare.reset();
    if (flashlight) flashlight.visible = false;
    scene.fog.density = n === 1 ? 0.007 : 0.022;
    scene.fog.color.set(n === 1 ? 0x80949d : 0x44564d);
    scene.background.set(n === 1 ? 0x1f2b33 : 0x050807);
  } else {
    if (state.env !== 'rift') setEnv('rift');
    valley.group.visible = false;
    rift.group.visible = true;
    setRiftMood(n);
    rift.setEpilogue(false);
    rift.epilogueGroup.visible = false;
    rift.setSkinVisible(true);
    rift.setDoorOpen(0);
    rift.setTorchLevel(0);
    rift.setMistLevel(0);
    rift.setScaleVisible(n === 4);
    rift.snow.points.visible = false;
    ghosts.group.visible = n === 6;
    if (n === 6) {
      resetTimeline();
    } else {
      ghosts.setTime(0);
      ghosts.group.visible = false;
    }
    if (n === 7) {
      rift.setEpilogue(true);
      rift.setSkinVisible(false);
      setRiftMood(7);
      scene.fog.color.set(0x20373b);
      scene.fog.density = 0.011;
      scene.background.set(0x0d191c);
      showSubtitle('走吧', '二〇一五 · 十年', 7200);
    } else {
      hideSubtitle();
    }
    if (n === 3) {
      flashlight.visible = true;
      flare.reset();
      rift.snow.points.visible = false;
      scene.background.set(0x0a171b);
      scene.fog.color.set(0x182e33);
      scene.fog.density = 0.015;
    } else {
      flashlight.visible = false;
      flare.reset();
    }
  }

  if (immediate) {
    setCameraImmediate(n);
  }
}

function setCameraImmediate(n) {
  const d = NODES[n];
  if (n === 6) {
    const k = sampleCamera(GHOST_TIMELINE.cameraKeys, state.t6);
    camera.position.set(k.p[0], k.p[1], k.p[2]);
    lookTarget.set(k.l[0], k.l[1], k.l[2]);
    camera.fov = k.fov;
  } else {
    camera.position.copy(d.pos);
    lookTarget.copy(d.target);
    camera.fov = d.fov;
  }
  camera.updateProjectionMatrix();
  camera.lookAt(lookTarget);
}

function startCameraTween(toNode, duration = 2200) {
  const from = {
    pos: camera.position.clone(), target: lookTarget.clone(), fov: camera.fov,
  };
  let to;
  if (toNode === 6) {
    const k = sampleCamera(GHOST_TIMELINE.cameraKeys, 0);
    to = { pos: new THREE.Vector3(...k.p), target: new THREE.Vector3(...k.l), fov: k.fov };
  } else {
    const d = NODES[toNode];
    to = { pos: d.pos.clone(), target: d.target.clone(), fov: d.fov };
  }
  state.tween = { from, to, start: performance.now(), dur: duration };
}

function updateTween() {
  if (!state.tween) return;
  const { from, to, start, dur } = state.tween;
  const k = clamp01((performance.now() - start) / dur);
  const e = k < 0.5 ? 8 * k * k * k * k : 1 - Math.pow(-2 * k + 2, 4) / 2;
  camera.position.lerpVectors(from.pos, to.pos, e);
  lookTarget.lerpVectors(from.target, to.target, e);
  const fov = THREE.MathUtils.lerp(from.fov, to.fov, e);
  if (Math.abs(camera.fov - fov) > 0.001) { camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.lookAt(lookTarget);
  if (k >= 1) state.tween = null;
}

async function goTo(n, { immediate = false } = {}) {
  if (!NODES[n]) return;
  if (state.node === n && !immediate) return;
  const myToken = ++state.token;
  state.transitioning = true;
  window.__nodeSettled = false;
  ui.card.classList.add('out');
  const prevEnv = state.env;
  const d = NODES[n];
  const envChange = prevEnv !== d.env;

  if (immediate) {
    applyNodeView(n, true);
    state.transitioning = false;
    window.__nodeSettled = true;
    window.__ready = true;
    ui.card.classList.remove('out');
    audio.setScene(n);
    return;
  }

  if (cameraControls) cameraControls.enabled = false;
  state.controls = false;
  setCard(n);
  nodeHud(n);
  state.node = n;
  window.__node = n;

  if (envChange) {
    ui.fade.style.opacity = '1';
    await wait(430);
    if (myToken !== state.token) return;
    applyNodeView(n, true);
    ui.fade.style.opacity = '0';
    await wait(700);
  } else {
    applyNodeView(n, false);
    setCard(n);
    nodeHud(n);
    startCameraTween(n, 2250);
    await wait(2280);
  }
  if (myToken !== state.token) return;
  if (n === 6) {
    resetTimeline();
    state.t6 = 0;
    state.paused = false;
    applyTimeline(0);
    setCameraImmediate(6);
  }
  if (n === 7) {
    applyNodeView(7, true);
  }
  if (n === 5) {
    camera.position.copy(NODES[5].pos);
    lookTarget.copy(NODES[5].target);
    camera.fov = NODES[5].fov;
    camera.updateProjectionMatrix();
    camera.lookAt(lookTarget);
    setupOrbit();
    enableOrbit();
  }
  state.transitioning = false;
  window.__nodeSettled = true;
  ui.card.classList.remove('out');
  audio.setScene(n);
}

/* ------------------------------------------------------------------ */
/*  Orbit (camera-controls) for node 5                                 */
/* ------------------------------------------------------------------ */
const ORBIT_TARGET = new THREE.Vector3(13.6, 19.0, -51.0);
function setupOrbit() {
  if (!cameraControls) {
    cameraControls = new CameraControls(camera, renderer.domElement);
    cameraControls.smoothTime = 0.45;
    cameraControls.draggingSmoothTime = 0.22;
    cameraControls.minDistance = 6;
    cameraControls.maxDistance = 33;
    cameraControls.minPolarAngle = D2R(38);
    cameraControls.maxPolarAngle = D2R(112);
    cameraControls.minAzimuthAngle = D2R(-62);
    cameraControls.maxAzimuthAngle = D2R(62);
    cameraControls.mouseButtons.left = CameraControls.ACTION.ROTATE;
    cameraControls.mouseButtons.middle = CameraControls.ACTION.NONE;
    cameraControls.mouseButtons.right = CameraControls.ACTION.NONE;
    cameraControls.mouseButtons.wheel = CameraControls.ACTION.DOLLY;
    cameraControls.touches.one = CameraControls.ACTION.TOUCH_ROTATE;
    cameraControls.touches.two = CameraControls.ACTION.TOUCH_DOLLY;
    cameraControls.addEventListener('dblclick', () => resetOrbit());
    renderer.domElement.addEventListener('dblclick', resetOrbit);
  }
  cameraControls.enabled = false;
  cameraControls.minDistance = 6;
  cameraControls.maxDistance = 33;
  cameraControls.setLookAt(
    NODES[5].pos.x, NODES[5].pos.y, NODES[5].pos.z,
    ORBIT_TARGET.x, ORBIT_TARGET.y, ORBIT_TARGET.z, false
  );
  cameraControls.saveState();
  ui.orbitHint.classList.remove('hidden');
}
function enableOrbit() {
  if (!cameraControls) return;
  cameraControls.enabled = true;
  state.controls = true;
  ui.orbitHint.classList.remove('hidden');
}
function resetOrbit() {
  if (state.node !== 5 || !cameraControls) return;
  cameraControls.setLookAt(
    NODES[5].pos.x, NODES[5].pos.y, NODES[5].pos.z,
    ORBIT_TARGET.x, ORBIT_TARGET.y, ORBIT_TARGET.z, true
  );
}

/* ------------------------------------------------------------------ */
/*  Node 6 — the 52 second cut                                         */
/* ------------------------------------------------------------------ */
function sampleCamera(keys, t) {
  if (t <= keys[0].t) return keys[0];
  if (t >= keys[keys.length - 1].t) return keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t >= a.t && t <= b.t) {
      const k = smooth(t, a.t, b.t);
      return {
        p: [THREE.MathUtils.lerp(a.p[0], b.p[0], k), THREE.MathUtils.lerp(a.p[1], b.p[1], k), THREE.MathUtils.lerp(a.p[2], b.p[2], k)],
        l: [THREE.MathUtils.lerp(a.l[0], b.l[0], k), THREE.MathUtils.lerp(a.l[1], b.l[1], k), THREE.MathUtils.lerp(a.l[2], b.l[2], k)],
        fov: THREE.MathUtils.lerp(a.fov, b.fov, k),
      };
    }
  }
  return keys[keys.length - 1];
}

function resetTimeline() {
  state.t6 = 0;
  state.paused = false;
  Object.assign(tl, { burst: false, horn1: false, horn2: false, rumbleOpen: false, rumbleClose: false, impact: false });
  if (!rift) return;
  rift.setDoorOpen(0);
  rift.setSkinVisible(true);
  rift.setTorchLevel(0);
  rift.setMistLevel(0);
  rift.skinBurst.hide();
  ghosts.setTime(0);
  hideSubtitle();
  updateTimelineUI();
}
function replay6() {
  if (state.node !== 6) return;
  resetTimeline();
  state.paused = false;
  toast('阴兵借道 · 重新开始');
}

function applyTimeline(t) {
  if (!rift) return;
  const T = t;
  const openUp = smooth(T, GHOST_TIMELINE.openAt, 14.6);
  const close = smooth(T, GHOST_TIMELINE.closeAt, GHOST_TIMELINE.closeAt + 3.2);
  const open = Math.max(0, openUp * (1 - close));
  rift.setDoorOpen(open);
  const skins = T < 7.9;
  rift.setSkinVisible(skins);
  if (T >= 7.85 && !tl.burst) {
    tl.burst = true;
    if (T < 10.5) { rift.burstSkins(); audio.crack(); }
    else rift.skinBurst.hide();
  }
  if (T < 7.85 && tl.burst) tl.burst = false;
  const torch = smooth(T, 8.5, 12.5) * (1 - smooth(T, 46.2, 49.2));
  rift.setTorchLevel(torch);
  const mist = smooth(T, 9.2, 16) * (1 - smooth(T, 43, 48.5));
  rift.setMistLevel(mist);
  ghosts.group.visible = T > 12.6;
  if (T > 12.6) ghosts.setTime(T);
  // cinematic camera + door-closing shake
  const k = sampleCamera(GHOST_TIMELINE.cameraKeys, T);
  const shake = T > GHOST_TIMELINE.closeAt && T < GHOST_TIMELINE.closeAt + 4.4
    ? Math.pow(1 - clamp01((T - GHOST_TIMELINE.closeAt) / 4.4), 2) : 0;
  const sh = shake * 0.14;
  camera.position.set(
    k.p[0] + Math.sin(T * 41.0) * sh,
    k.p[1] + Math.sin(T * 33.7 + 2.1) * sh * 0.7,
    k.p[2] + Math.cos(T * 39.0) * sh * 0.6
  );
  lookTarget.set(
    k.l[0] + Math.sin(T * 29.3) * sh * 0.4,
    k.l[1] + Math.cos(T * 31.1) * sh * 0.4,
    k.l[2]
  );
  if (Math.abs(camera.fov - k.fov) > 0.001) { camera.fov = k.fov; camera.updateProjectionMatrix(); }
  camera.lookAt(lookTarget);
  // performance cues (only once)
  if (T > 13 && !tl.horn1) { tl.horn1 = true; audio.hornCall(); }
  if (T > 23 && !tl.horn2) { tl.horn2 = true; audio.hornCall(); }
  if (T > GHOST_TIMELINE.openAt && !tl.rumbleOpen) { tl.rumbleOpen = true; audio.doorRumble(true); }
  if (T > GHOST_TIMELINE.closeAt && !tl.rumbleClose) { tl.rumbleClose = true; audio.doorRumble(false); }
  if (T > 48.2 && !tl.impact) { tl.impact = true; audio.impact(); }
  // goodbye subtitle
  if (T > 23.2 && T < 29.2) {
    if (!ui.subtitle.classList.contains('show')) showSubtitle('再见', '张起灵', 6200);
  } else if (T < 22.8 || T > 30) {
    if (ui.subtitle.classList.contains('show') && !(state.node === 7)) hideSubtitle();
  }
  updateTimelineUI(T);
}
function updateTimelineUI(T = state.t6) {
  const bar = $('#bar6'), phase = $('#phase6');
  if (!bar || !phase) return;
  bar.style.width = `${clamp01(T / GHOST_TIMELINE.duration) * 100}%`;
  let text = '封门人皮';
  if (T >= 7.5 && T < 14.6) text = '人皮爆裂 · 门向外挪开';
  else if (T >= 14.6 && T < 24.5) text = '门缝火光 · 淡蓝薄雾';
  else if (T >= 24.5 && T < 30) text = '「再见」';
  else if (T >= 30 && T < 45.5) text = '四人一行 · 入门';
  else if (T >= 45.5) text = '地面震动 · 门合拢';
  if (phase.textContent !== text) phase.textContent = text;
}

/* ------------------------------------------------------------------ */
/*  Flare                                                              */
/* ------------------------------------------------------------------ */
let flareCooldownUntil = 0;
function triggerFlare() {
  if (state.node !== 3 || !flare) return;
  if (performance.now() < flareCooldownUntil) {
    toast('照明弹还在燃烧');
    return;
  }
  flare.trigger();
  flareCooldownUntil = performance.now() + 10500;
  ui.flareBtn.classList.add('cool');
  toast('照明弹 · 全谷照亮');
  audio.impact();
  setTimeout(() => {
    ui.flareBtn.classList.remove('cool');
    if (state.node === 3) toast('照明弹已熄灭');
  }, 10000);
}
ui.flareBtn.addEventListener('click', triggerFlare);

/* ------------------------------------------------------------------ */
/*  Input                                                              */
/* ------------------------------------------------------------------ */
let wheelLock = 0;
addEventListener('wheel', (e) => {
  if (state.transitioning) return;
  if (state.node === 5) return; // camera-controls owns the wheel for dolly
  const now = performance.now();
  if (now < wheelLock) return;
  if (Math.abs(e.deltaY) < 18) return;
  wheelLock = now + 900;
  goTo(clampNode(state.node + (e.deltaY > 0 ? 1 : -1)));
}, { passive: true });

function clampNode(n) { return Math.max(1, Math.min(7, n)); }
ui.prev.addEventListener('click', () => goTo(clampNode(state.node - 1)));
ui.next.addEventListener('click', () => goTo(clampNode(state.node + 1)));

addEventListener('keydown', (e) => {
  if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
    e.preventDefault();
    if (!state.transitioning) goTo(clampNode(state.node + 1));
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
    e.preventDefault();
    if (!state.transitioning) goTo(clampNode(state.node - 1));
  } else if (e.key === 'f' || e.key === 'F') {
    triggerFlare();
  } else if (e.key === 'r' || e.key === 'R') {
    if (state.node === 6) replay6();
  } else if (/^[1-7]$/.test(e.key)) {
    if (!state.transitioning) goTo(Number(e.key));
  }
});

addEventListener('pointermove', (e) => {
  const w = innerWidth, h = innerHeight;
  if (e.pointerType === 'mouse') {
    mouse.x = (e.clientX / w) * 2 - 1;
    mouse.y = -((e.clientY / h) * 2 - 1);
  } else {
    mouse.x = 0; mouse.y = 0;
  }
});
addEventListener('pointerleave', () => { mouse.x = 0; mouse.y = 0; });

/* ------------------------------------------------------------------ */
/*  Animation                                                          */
/* ------------------------------------------------------------------ */
let last = performance.now();
let elapsed = 0;
const clock = new THREE.Clock();
let snapFrame = 0;

function updateFlashlight(dt) {
  if (!flashlight || !flashlight.visible) return;
  smoothMouse.lerp(mouse, Math.min(1, dt * 4.5));
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
  const up = new THREE.Vector3().crossVectors(right, dir).normalize();
  flashlight.position.copy(camera.position).addScaledVector(dir, 0.6).addScaledVector(up, -0.25);
  const target = new THREE.Vector3().copy(camera.position)
    .addScaledVector(dir, 34)
    .addScaledVector(right, smoothMouse.x * 24)
    .addScaledVector(up, smoothMouse.y * 15 + 6.0);
  flashlightTarget.position.lerp(target, Math.min(1, dt * 3.2));
  flashlightTarget.updateMatrixWorld();
  // keep the beam from pointing into the ceiling
  if (flashlightTarget.position.y > camera.position.y + 15) flashlightTarget.position.y = camera.position.y + 15;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  const t = elapsed;

  if (state.tween) updateTween();
  if (state.node === 6 && !state.transitioning && !state.paused) {
    state.t6 = Math.min(GHOST_TIMELINE.duration, state.t6 + Math.max(dt, 0.0001));
    applyTimeline(state.t6);
    if (state.t6 >= GHOST_TIMELINE.duration) state.paused = true;
  }
  if (state.controls && cameraControls) cameraControls.update(dt);

  updateFlashlight(dt);
  if (flare) flare.update(dt);
  if (state.node === 6 && ghosts && ghosts.zhangRoot.visible) {
    const T = state.t6;
    const wp = ghosts.zhangRoot.position.clone();
    wp.y += 2.4;
    wp.project(camera);
    if (wp.z < 1 && wp.x > -1.1 && wp.x < 1.1 && T > 20 && T < 29.5) {
      ui.zhangTag.classList.add('show');
      const tx = Math.min(innerWidth - 200, Math.max(24, (wp.x * 0.5 + 0.5) * innerWidth));
      const ty = Math.max(80, (-wp.y * 0.5 + 0.5) * innerHeight - 10);
      ui.zhangTag.style.left = `${tx}px`;
      ui.zhangTag.style.top = `${ty}px`;
    } else {
      ui.zhangTag.classList.remove('show');
    }
  } else if (ui.zhangTag) {
    ui.zhangTag.classList.remove('show');
  }
  if (rift) rift.update(t, dt, camera, {});
  if (valley) valley.update(t, dt, camera, state.node);
  if (ghosts && state.node === 6 && !state.transitioning) {
    // timeline seeks / pauses still need a pose update for deterministic shots
    if (state.paused) ghosts.setTime(state.t6);
  }
  if (state.node === 5 && cameraControls && !state.controls) {
    // during the entrance tween leave the authored camera alone
  }

  if (composer) composer.render();
  else renderer.render(scene, camera);
  if (!window.__ready && snapFrame++ > 1) {
    window.__ready = true;
  }
}

/* ------------------------------------------------------------------ */
/*  Seek / replay hooks for the screenshot harness                     */
/* ------------------------------------------------------------------ */
function seek6(t) {
  if (state.node !== 6) return;
  t = Math.max(0, Math.min(GHOST_TIMELINE.duration, t));
  state.t6 = t;
  state.paused = true;
  // fast-forward one-shot cues without firing all of them again
  tl.burst = t >= 7.85;
  tl.horn1 = t >= 13;
  tl.horn2 = t >= 23;
  tl.rumbleOpen = t >= GHOST_TIMELINE.openAt;
  tl.rumbleClose = t >= GHOST_TIMELINE.closeAt;
  tl.impact = t >= 48.2;
  if (t > 11) rift.skinBurst.hide();
  else rift.skinBurst.hide();
  applyTimeline(t);
  updateTimelineUI(t);
  if (ui.zhangTag && (t < 20 || t > 29.5)) ui.zhangTag.classList.remove('show');
}

window.__goto = (n) => goTo(Number(n));
window.__seek6 = seek6;
window.__flare = triggerFlare;
window.__replay6 = replay6;
window.__quality = quality;
window.__three = { THREE, scene, camera, renderer, get rift() { return rift; }, get valley() { return valley; }, get ghosts() { return ghosts; } };

/* ------------------------------------------------------------------ */
/*  Resize                                                             */
/* ------------------------------------------------------------------ */
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(innerWidth, innerHeight);
  if (composer) composer.setSize(innerWidth, innerHeight);
});

/* ------------------------------------------------------------------ */
/*  Boot                                                               */
/* ------------------------------------------------------------------ */
async function tick(ms = 24) { await wait(ms); }

async function boot() {
  try {
    const setProgress = (p, note) => {
      ui.loadbar.style.width = `${p}%`;
      if (note) ui.loadnote.textContent = note;
    };
    setProgress(8, '读取山体 · 雪与骨');
    await tick(30);
    rift = new Rift(scene, renderer, { quality });
    setProgress(42, '铸造巨门 · 云雷纹与饕餮式推演');
    await tick(30);
    valley = new Valley(scene, renderer, { quality });
    setProgress(70, '堆雪成谷 · 凿开崖底缝隙');
    await tick(30);
    ghosts = new GhostProcession(scene, { quality });
    ghosts.group.visible = false;
    setProgress(84, '阴兵列队 · 纸脸长如旧梦');
    await tick(30);
    flare = new Flare(rift.group);
    setupFlashlight();
    setupPost();
    setProgress(92, '点灯 · 调色 · 落雪');
    await tick(50);

    applyNodeView(1, true);
    setCard(1);
    state.node = 1;
    state.env = 'valley';
    state.transitioning = false;
    window.__node = 1;
    window.__nodeSettled = true;
    setCameraImmediate(1);
    ui.progress.style.width = `${100 / 7}%`;
    nodeHud(1);
    ui.card.classList.remove('out');
    // render a warm-up frame before revealing
    composer.render();
    setProgress(100, '门在裂谷尽头');
    await tick(120);
    ui.loader.classList.add('done');
    window.__ready = true;
    animate();
  } catch (err) {
    console.error(err);
    $('#error-msg').textContent = String(err && err.stack || err);
    $('#error-panel').classList.remove('hidden');
    ui.loader.classList.add('done');
  }
}

boot();
