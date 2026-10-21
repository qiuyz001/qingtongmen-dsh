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
    note: '镜头在谷底斜仰：三十米崖壁竖直压下来。雪堆半掩一道约七米宽、十三米深的竖缝，裂缝里透出暖光与蒸汽；崖壁由噪声位移、分层岩脊与法线贴图构成。1.70 m 人影与断树是比例尺。',
    source: '大结局（下）第二十九章 · 网络转载', url: SRC.finale,
    pos: new THREE.Vector3(VALLEY_ORIGIN.x + 5.0, 2.2, 8.0), target: new THREE.Vector3(VALLEY_ORIGIN.x - 0.6, 14.5, -27.0), fov: 58,
    extra: '<div class="extra-row"><b>构图</b> 崖底斜仰 · 30 m 竖直崖壁</div><div class="extra-row"><b>缝口</b> 雪堆半掩竖缝 · 缝内暖光/蒸汽</div><div class="extra-row"><b>比例</b> 1.70 m 人影 · 30 m 崖面标尺</div><div class="extra-row"><b>天气</b> 侧向暴风雪 · 低能见度 · 前景雪粒</div>',
  },
  2: {
    title: '岩缝温泉', env: 'valley', envName: '岩缝', short: '温泉',
    chapter: '大结局（下）第二十九章「故地」',
    quote: '「被雪掩埋的缝隙」「温泉」',
    note: '原文此处只写「温泉」。按大结局「雪谷→温泉→裂谷」的缝隙语境，本场景处理为<b>地热岩缝</b>：窄陡下爬、岩壁湿亮发烫、硫磺雾从壁缝与地缝冒出；积水只是底部一汪浅水，不是景区温泉。<span class="tag">场景处理</span>',
    source: '大结局（下）第二十九章 · 网络转载', url: SRC.finale,
    pos: new THREE.Vector3(VALLEY_ORIGIN.x + 0.0, 4.4, -25.5), target: new THREE.Vector3(VALLEY_ORIGIN.x + 0.15, 0.4, -44.0), fov: 66,
    extra: '<div class="extra-row"><b>地热岩缝</b> 湿亮岩壁 · 约三十度下爬</div><div class="extra-row"><b>热源</b> 壁缝 / 地缝蒸汽 · 硫磺雾 · 石头烫手</div><div class="extra-row"><b>水</b> 底部浅积水（弱化，不设泉眼）</div>',
  },
  3: {
    title: '地下裂谷', env: 'rift', envName: '裂谷', short: '裂谷',
    chapter: '云顶天宫篇 第五十章「守护神」的巢穴',
    quote: '「这条地下裂谷太大」<br>「谷底…全是极度不平整的黑色的火山岩块」<br>「从上面跌落的尸骨，层层叠叠」',
    note: '两拍：3A 挂在尸链间从裂谷高处下望，按 F 打照明弹，整谷骨堆与角砾岩瞬间照亮；3B 切到谷底低机位，踩着骨头走向嵌在火山岩崖壁里的门。',
    source: '三叶屋 · 第五十章', url: SRC.sanyewu,
    pos: new THREE.Vector3(17, 34, 38), target: new THREE.Vector3(-1, 6, -44), fov: 56,
    posWide: new THREE.Vector3(31, 38, 45), targetWide: new THREE.Vector3(0, 5, -42), fovWide: 58,
    posFloor: new THREE.Vector3(10.5, 4.6, 28), targetFloor: new THREE.Vector3(-2, 10.5, -50), fovFloor: 61,
    extra: `<div class="rift-beat">
        <button class="beat active" data-beat="high">3A · 锁链俯视</button>
        <button class="beat" data-beat="floor">3B · 谷底行走</button>
      </div>
      <div class="extra-row"><b>照明弹</b> 按 F / 右下按钮 · 全谷照亮</div>
      <div class="extra-row"><b>切换</b> 点击 3A / 3B · 或按 B</div>
      <div class="extra-row"><b>谷底</b> 黑色火山角砾 · 层叠尸骨 · 尸链</div>`,
  },
  4: {
    title: '青铜门 · 全景', env: 'rift', envName: '巨门', short: '巨门',
    chapter: '云顶天宫篇 第五十章「守护神」的巢穴',
    quote: '「门高在三十米所有，宽度将近六十米」<br>「十层楼这么高」<br>「上万吨重」<br>「看上去竟然像是整体铸造起来的」',
    note: '两扇式青铜巨门嵌在裂谷一侧的崖壁上。画面中的人物剪影高 1.75 米，用作比例尺；门外框上标有 30 m / 60 m 尺度线。',
    source: '三叶屋 · 第五十章', url: SRC.sanyewu,
    pos: new THREE.Vector3(11, 9.0, 16), target: new THREE.Vector3(2, 14.5, -52), fov: 52,
    extra: '<div class="extra-row"><b>尺度</b> 高 30 m · 宽近 60 m · 上万吨重</div><div class="extra-row"><b>崖壁</b> 粗糙火山岩 · 角砾门套 · 与节点 3 同一套谷底</div><div class="extra-row"><b>比例</b> 人物剪影 1.75 m · 门缝人皮封条</div>',
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
    note: '与节点 3 同一套黑色火山岩谷底与尸骨层。人皮封条爆裂、门向外挪开、缝内亮起火光、淡蓝薄雾涌出；张起灵背黑金古刀、右手托鬼玺混在队中，回头说「再见」，随后门合拢。',
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
    pos: new THREE.Vector3(0, 8.5, 6), target: new THREE.Vector3(0, 13.0, -50), fov: 60,
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
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = true;

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
  if (n === 3) {
    ui.card.querySelectorAll('.rift-beat .beat').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        setRiftBeat(b.dataset.beat);
      });
    });
    updateRiftUI(state.riftBeat);
  }
}

function updateRiftUI(beat) {
  if (state.node !== 3) return;
  const idx = $('#node-index');
  if (idx) idx.textContent = beat === 'floor' ? '03B' : '03A';
  const title = $('#node-title');
  if (title) title.textContent = beat === 'floor' ? '谷底行走' : '锁链俯视 · 照明弹';
  ui.card.querySelectorAll('.rift-beat .beat').forEach((b) => {
    b.classList.toggle('active', b.dataset.beat === beat);
  });
  window.__riftBeatName = beat + (state.riftWide ? '-wide' : '');
}

function nodeHud(n) {
  ui.scale.classList.toggle('hidden', n !== 4);
  ui.orbitHint.classList.toggle('hidden', n !== 5);
  ui.flareBtn.classList.toggle('hidden', n !== 3);
  ui.hintExtra.textContent = n === 3 ? 'F 照明弹 · B 切换 3A/3B' : n === 5 ? '拖拽环视' : n === 6 ? '动画 52s' : '';
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
let flashlight, flashlightTarget, valleyLamp, valleyLampTarget;
let cameraControls;
const state = {
  node: 0, env: null, transitioning: false, token: 0, tween: null,
  controls: false, t6: 0, paused: false, quality,
  riftBeat: 'high', riftWide: false, postEnabled: params.get('nopost') !== '1',
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
  flashlight = new THREE.SpotLight(0xd9e7e0, 420, 70, D2R(27), 0.5, 1.4);
  flashlight.position.set(0, 0, 0);
  flashlightTarget = new THREE.Object3D();
  flashlightTarget.position.set(0, 6, -30);
  flashlight.target = flashlightTarget;
  flashlight.visible = false;
  flashlight.castShadow = true;
  flashlight.shadow.mapSize.set(512, 512);
  flashlight.shadow.camera.near = 0.5;
  flashlight.shadow.camera.far = 60;
  flashlight.shadow.bias = -0.0008;
  flashlight.shadow.normalBias = 0.035;
  rift.group.add(flashlight, flashlightTarget);
}

function setupValleyLamp() {
  valleyLamp = new THREE.SpotLight(0xffe0bd, 900, 42, D2R(34), 0.65, 1.4);
  valleyLampTarget = new THREE.Object3D();
  valleyLamp.target = valleyLampTarget;
  valleyLamp.visible = false;
  scene.add(valleyLamp, valleyLampTarget);
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
    scene.background.set(0x131c22);
    scene.fog.color.set(0x56686f);
    scene.fog.density = 0.015;
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
  // explicit per-node exposure so 4–7 share one readable base instead of
  // inheriting the old bright "door showcase" wash
  const V = (a, b, c, d, e) => (n === 3 ? a : n === 4 ? b : n === 5 ? c : n === 6 ? d : e);
  rift.hemi.intensity = V(0.72, 0.78, 0.32, 0.78, 1.02);
  rift.ambient.intensity = V(0.55, 0.58, 0.28, 0.55, 0.88);
  rift.fill.intensity = V(3000, 900, 320, 900, 1200);
  rift.shaftSpot.intensity = V(11000, 7000, 6000, 7500, 14000);
  rift.frameWash.intensity = V(1600, 700, 400, 1200, 1800);
  rift.lintelWash.intensity = V(1500, 2600, 800, 2800, 3200);
  rift.thresholdPool.intensity = V(1600, 900, 300, 1500, 1800);
  rift.doorSpotL.intensity = V(2200, 1200, 900, 1800, 2400);
  rift.doorSpotR.intensity = V(1500, 800, 500, 1200, 1600);
  rift.thresholdLight.intensity = V(95, 90, 70, 110, 140);
  rift.forecourt.intensity = V(1800, 1800, 800, 2400, 3000);
  rift.pillarSpots.forEach(p => { p.intensity = V(900, 1800, 1000, 2000, 2400); });
  rift.medallionFill.intensity = V(150, 80, 120, 200, 350);
  rift.medallionSpots.forEach(p => {
    p.intensity = V(200, 160, 260, 350, 450);
    p.color.set(n === 5 ? 0xb9c9c1 : 0xd2c8ab);
  });
  rift.ghostFill.intensity = V(0, 0, 0, 1700, 200);
  if (rift.chainRim) rift.chainRim.intensity = V(650, 0, 0, 1500, 200);
  rift.seamFill.intensity = V(0, 260, 200, 0, 60);
  rift.boneRake.intensity = V(3200, 2200, 300, 2200, 2200);
  rift.boneFill.intensity = V(650, 800, 0, 600, 700);
  rift.gateUnder.intensity = V(75, 160, 20, 90, 140);
  rift.doorRake.intensity = V(2600, 3400, 200, 2200, 3000);
  rift.portalKeyL.intensity = V(2200, 4300, 300, 2000, 2400);
  rift.portalKeyR.intensity = V(1600, 3300, 220, 1500, 1800);
  rift.lintelKey.intensity = V(1800, 3700, 300, 2000, 2600);
  rift.nearFill.intensity = V(200, 450, 0, 300, 500);
  if (rift.portalReveals) {
    rift.portalReveals.forEach((l, i) => {
      l.intensity = i % 2 === 0 ? V(240, 360, 45, 280, 380) : V(90, 150, 20, 110, 170);
    });
  }
  if (rift.portalHalo) rift.portalHalo.material.opacity = V(0.24, 0.16, 0.06, 0.16, 0.26);
  if (rift.shaft) rift.shaft.visible = n === 3;
}

function applyNodeView(n, immediate = false) {
  const d = NODES[n];
  state.node = n;
  window.__node = n;
  setCard(n);
  nodeHud(n);
  if (cameraControls) cameraControls.enabled = false;
  state.controls = false;

  if (n === 3) updateRiftUI(state.riftBeat);
  if (d.env === 'valley') {
    if (state.env !== 'valley') setEnv('valley');
    valley.setNode(n);
    valley.group.visible = true;
    rift.group.visible = false;
    ghosts.group.visible = false;
    flare.reset();
    if (flashlight) flashlight.visible = false;
    scene.fog.density = n === 1 ? 0.013 : 0.034;
    scene.fog.color.set(n === 1 ? 0x4f616a : 0x46462f);
    scene.background.set(n === 1 ? 0x131c22 : 0x070805);
  } else {
    if (state.env !== 'rift') setEnv('rift');
    if (valleyLamp) valleyLamp.visible = false;
    valley.group.visible = false;
    rift.group.visible = true;
    setRiftMood(n);
    rift.setEpilogue(false);
    rift.epilogueGroup.visible = false;
    rift.setSkinVisible(true);
    rift.setDoorOpen(0);
    rift.setTorchLevel(0);
    rift.setMistLevel(0);
    if (n === 3) applyBeatMood(state.riftBeat);
    rift.setScaleVisible(n === 4);
    rift.snow.points.visible = false;
    ghosts.group.visible = n === 6;
    ghosts.group.position.y = 0;
    if (rift.chainGroup) rift.chainGroup.visible = n === 3;
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
      showSubtitle('走吧', '二〇一五 · 十年', 30000);
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
      if (immediate) window.__riftBeatName = state.riftBeat;
    } else {
      flashlight.visible = false;
      flare.reset();
      if (rift) {
        rift.setFlare(0);
        if (n !== 3) setRiftMood(n);
      }
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

function applyBeatMood(beat) {
  if (!rift || state.node !== 3) return;
  const f = beat === 'floor';
  rift.hemi.intensity = f ? 0.44 : 0.72;
  rift.ambient.intensity = f ? 0.26 : 0.55;
  rift.fill.intensity = f ? 600 : 3200;
  rift.forecourt.intensity = f ? 450 : 2400;
  rift.shaftSpot.intensity = f ? 3200 : 12000;
  rift.boneRake.intensity = f ? 6800 : 3200;
  rift.boneFill.intensity = f ? 2000 : 650;
  rift.gateUnder.intensity = f ? 210 : 75;
  rift.doorSpotL.intensity = f ? 550 : 3000;
  rift.doorSpotR.intensity = f ? 300 : 2200;
  rift.doorRake.intensity = f ? 5200 : 2800;
  rift.portalKeyL.intensity = f ? 6200 : 2400;
  rift.portalKeyR.intensity = f ? 4600 : 1800;
  rift.lintelKey.intensity = f ? 5000 : 2000;
  rift.nearFill.intensity = f ? 1000 : 200;
  if (rift.portalReveals) {
    rift.portalReveals.forEach((l, i) => { l.intensity = i % 2 === 0 ? (f ? 420 : 240) : (f ? 150 : 90); });
  }
  if (rift.shaft) {
    rift.shaft.visible = f;
    rift.shaftMat.uniforms.uOpacity.value = 0.035;
  }
  rift.frameWash.intensity = f ? 350 : 1800;
  rift.lintelWash.intensity = f ? 500 : 1600;
  rift.thresholdPool.intensity = f ? 220 : 1800;
  rift.thresholdLight.intensity = f ? 90 : 120;
  rift.medallionFill.intensity = f ? 35 : 250;
  rift.medallionSpots.forEach(p => { p.intensity = f ? 45 : 250; });
  rift.pillarSpots.forEach(p => { p.intensity = f ? 550 : 1200; });
  rift.groundMist.setIntensity(f ? 1.5 : 1.0);
  rift.doorMist.setIntensity(f ? 0.22 : 0);
  rift.doorMist.group.visible = f;
  if (rift.portalHalo) rift.portalHalo.material.opacity = f ? 0.26 : 0.24;
  if (flashlight) {
    flashlight.intensity = f ? 150 : 420;
    flashlight.angle = f ? D2R(36) : D2R(27);
    flashlight.distance = f ? 48 : 70;
  }
}

function riftCamera(beat, wide = false) {
  const d = NODES[3];
  if (beat === 'floor') return { pos: d.posFloor, target: d.targetFloor, fov: d.fovFloor };
  if (wide) return { pos: d.posWide, target: d.targetWide, fov: d.fovWide };
  return { pos: d.pos, target: d.target, fov: d.fov };
}

function setRiftBeat(beat = 'high', { immediate = false, wide = false } = {}) {
  if (!NODES[3]) return;
  beat = (beat === 'floor' || beat === 0 || beat === 'b' || beat === 2) ? 'floor' : 'high';
  state.riftBeat = beat;
  state.riftWide = !!wide && beat === 'high';
  const cam = riftCamera(beat, state.riftWide);
  if (immediate || state.node !== 3) {
    if (state.node === 3) {
      camera.position.copy(cam.pos);
      lookTarget.copy(cam.target);
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
      camera.lookAt(lookTarget);
      state.tween = null;
    }
  } else {
    state.tween = {
      from: { pos: camera.position.clone(), target: lookTarget.clone(), fov: camera.fov },
      to: { pos: cam.pos.clone(), target: cam.target.clone(), fov: cam.fov },
      start: performance.now(), dur: 1150,
    };
  }
  updateRiftUI(beat);
  if (state.node === 3) {
    applyBeatMood(beat);
    if (rift.chainGroup) rift.chainGroup.visible = beat !== 'floor';
    if (beat === 'floor' && flare) {
      flare.reset();
      if (rift) rift.setFlare(0);
    }
  }
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
  if (state.node === n && !immediate) {
    if (n === 3) setRiftBeat('high');
    return;
  }
  if (n === 3) { state.riftBeat = 'high'; state.riftWide = false; }
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
  } else if (e.key === 'b' || e.key === 'B') {
    if (state.node === 3) setRiftBeat(state.riftBeat === 'floor' ? 'high' : 'floor');
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
    .addScaledVector(dir, state.riftBeat === 'floor' ? 22 : 34)
    .addScaledVector(right, smoothMouse.x * 24)
    .addScaledVector(up, smoothMouse.y * 15 + (state.riftBeat === 'floor' ? 0.6 : 6.0));
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
  if (valleyLamp && valleyLamp.visible) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    valleyLamp.position.copy(camera.position).addScaledVector(dir, 0.5);
    valleyLampTarget.position.copy(camera.position).addScaledVector(dir, 14);
    valleyLampTarget.position.y -= 2.4;
    valleyLampTarget.updateMatrixWorld();
  }
  if (flare) {
    flare.update(dt);
    if (rift && state.node === 3) {
      rift.setFlare(flare.level || 0);
      const fogBase = state.riftBeat === 'floor' ? 0.017 : 0.015;
      scene.fog.density = fogBase - 0.0018 * (flare.level || 0);
    }
  }
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

  if (composer && state.postEnabled) composer.render();
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
window.__riftBeat = (b, immediate = false) => setRiftBeat(b, { immediate });
window.__riftView = (v) => {
  if (v === 'floor' || v === '3b' || v === 2) setRiftBeat('floor', { immediate: true });
  else if (v === 'wide' || v === 'overhead') setRiftBeat('high', { immediate: true, wide: true });
  else setRiftBeat('high', { immediate: true });
};
window.__setPost = (on) => { state.postEnabled = !!on; };
window.__postEnabled = () => state.postEnabled;
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
    setupValleyLamp();
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
