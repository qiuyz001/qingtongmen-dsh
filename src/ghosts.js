import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeBannerTexture, makeFaceTexture, makeGlowTexture, mulberry32 } from './textures.js';
import { riftFloorHeight } from './rift.js';

const ROWS = 12;
const COLS = [-2.55, -0.85, 0.85, 2.55];
const ROW_GAP = 3.2;
const START_Z = 28;
const START_TIME = 13;
const SPEED = 4.2;

const tmpM = new THREE.Matrix4();
const tmpM2 = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

function localMatrix(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const e = new THREE.Euler(rx, ry, rz);
  tmpQ.setFromEuler(e);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), tmpQ.clone(), new THREE.Vector3(sx, sy, sz));
}

function jaggedRobeGeometry() {
  const g = new THREE.CylinderGeometry(0.26, 0.42, 1.56, 9, 4, true);
  const pos = g.attributes.position;
  const rnd = mulberry32(88);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const a = Math.atan2(pos.getZ(i), pos.getX(i));
    if (y < -0.5) {
      pos.setY(i, y - (0.05 + rnd() * 0.18));
      const r = 1 + Math.sin(a * 9) * 0.07 + rnd() * 0.04;
      pos.setX(i, pos.getX(i) * r); pos.setZ(i, pos.getZ(i) * r);
    }
    if (y > 0.3) { pos.setX(i, pos.getX(i) * 0.92); pos.setZ(i, pos.getZ(i) * 0.92); }
  }
  g.computeVertexNormals();
  return g;
}

function makeHornGeometry() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.18, 0.12, -0.18),
    new THREE.Vector3(0.42, 0.08, -0.3), new THREE.Vector3(0.62, -0.04, -0.24),
  ]);
  const tube = new THREE.TubeGeometry(curve, 12, 0.055, 6, false);
  const bell = new THREE.CylinderGeometry(0.17, 0.07, 0.28, 10, 1, true);
  bell.rotateZ(Math.PI / 2.2);
  bell.translate(0.72, -0.07, -0.2);
  const band = new THREE.TorusGeometry(0.07, 0.018, 4, 10);
  band.rotateY(Math.PI / 2);
  band.translate(0.18, 0.1, -0.16);
  const g = mergeGeometries([tube, bell, band], false);
  return g;
}

export class GhostProcession {
  constructor(scene, { quality = 'high' } = {}) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'ghost-procession';
    scene.add(this.group);
    this.quality = quality;
    this.time = 0;
    this.shown = false;

    const armor = new THREE.MeshStandardMaterial({ color: 0x4b4230, metalness: 0.62, roughness: 0.64, flatShading: true });
    const armorDark = new THREE.MeshStandardMaterial({ color: 0x2b2620, metalness: 0.5, roughness: 0.78, flatShading: true });
    const trim = new THREE.MeshStandardMaterial({ color: 0x7b6742, metalness: 0.85, roughness: 0.42 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x171a17, roughness: 0.96, side: THREE.DoubleSide });
    const pale = new THREE.MeshStandardMaterial({ color: 0xb7bfb1, roughness: 0.9, emissive: 0x0a0e0b, emissiveIntensity: 1 });
    const faceTex = makeFaceTexture();
    const faceMat = new THREE.MeshStandardMaterial({
      map: faceTex, transparent: true, alphaTest: 0.28, side: THREE.DoubleSide,
      roughness: 1, metalness: 0, emissive: 0x101511, emissiveIntensity: 0.75,
      polygonOffset: true, polygonOffsetFactor: -2,
    });
    this.materials = { armor, armorDark, trim, cloth, pale, faceMat };

    const N = ROWS * COLS.length;
    this.N = N;
    this.soldiers = [];
    const rnd = mulberry32(707);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS.length; c++) {
        const isBanner = (c === 0 || c === 3) && (r === 0 || r === 2 || r === 5 || r === 8 || r === 11);
        const isHorn = (c === 1 || c === 2) && (r === 0 || r === 3 || r === 6 || r === 9);
        this.soldiers.push({
          row: r, col: c, x: COLS[c], phase: rnd() * Math.PI * 2,
          isBanner, isHorn, height: 0.96 + rnd() * 0.07,
        });
      }
    }
    // 张起灵 is row 7, left-inner column
    this.zhangRow = 11;
    this.zhang = this.soldiers[11 * 4 + 1];
    this.zhang.isZhang = true;

    const makeInstanced = (geo, mat, count = N) => {
      const m = new THREE.InstancedMesh(geo, mat, count);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.visible = false;
      this.group.add(m);
      return m;
    };

    // ---- shared geometries ----
    const torsoGeo = new THREE.CylinderGeometry(0.26, 0.31, 0.68, 7, 1);
    const plateGeo = new THREE.BoxGeometry(0.54, 0.5, 0.13);
    plateGeo.translate(0, 0, -0.19);
    const waistGeo = new THREE.CylinderGeometry(0.3, 0.34, 0.15, 8);
    const skirtGeo = jaggedRobeGeometry();
    skirtGeo.translate(0, -0.72, 0);
    const shoulderGeo = new THREE.BoxGeometry(0.23, 0.13, 0.38);
    const headGeo = new THREE.SphereGeometry(0.175, 12, 14);
    headGeo.scale(0.78, 2.15, 0.78);
    const faceGeo = new THREE.PlaneGeometry(0.32, 0.66);
    faceGeo.rotateY(Math.PI);
    faceGeo.translate(0, 0, -0.145);
    faceGeo.translate(0, 0, 0);
    const helmetGeo = new THREE.SphereGeometry(0.19, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
    helmetGeo.scale(1, 0.9, 1);
    const crestGeo = new THREE.BoxGeometry(0.035, 0.2, 0.32);
    const armGeo = new THREE.CylinderGeometry(0.062, 0.052, 0.62, 5);
    armGeo.translate(0, -0.31, 0);
    const handGeo = new THREE.SphereGeometry(0.072, 6, 5);
    handGeo.scale(0.8, 1.2, 0.8);
    const beltGeo = new THREE.BoxGeometry(0.56, 0.055, 0.36);

    this.meshes = {
      torso: makeInstanced(torsoGeo, cloth),
      plate: makeInstanced(plateGeo, armor),
      skirt: makeInstanced(skirtGeo, cloth),
      waist: makeInstanced(waistGeo, armorDark),
      belt: makeInstanced(beltGeo, trim),
      shoulderL: makeInstanced(shoulderGeo, armor),
      shoulderR: makeInstanced(shoulderGeo, armor),
      head: makeInstanced(headGeo, pale),
      face: makeInstanced(faceGeo, faceMat),
      helmet: makeInstanced(helmetGeo, armorDark),
      crest: makeInstanced(crestGeo, trim),
      armL: makeInstanced(armGeo, armorDark),
      armR: makeInstanced(armGeo, armorDark),
      handL: makeInstanced(handGeo, pale),
      handR: makeInstanced(handGeo, pale),
    };

    // ---- banners ----
    const flagTex = makeBannerTexture(7);
    this.flagMats = [];
    this.banners = [];
    const poleGeo = new THREE.CylinderGeometry(0.032, 0.045, 3.9, 6);
    poleGeo.translate(0, 1.8, 0);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c241a, roughness: 0.9 });
    const bannerSoldiers = this.soldiers.filter(s => s.isBanner && !s.isZhang);
    for (let i = 0; i < bannerSoldiers.length; i++) {
      const s = bannerSoldiers[i];
      const g = new THREE.Group();
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(0.45, 0.55, 0.02);
      g.add(pole);
      const flagMat = new THREE.ShaderMaterial({
        transparent: true, side: THREE.DoubleSide, depthWrite: false,
        uniforms: { uTime: { value: 0 }, uMap: { value: flagTex }, uColor: { value: new THREE.Color(0x9b705a) }, uOpacity: { value: 1.0 } },
        vertexShader: `
          uniform float uTime; varying vec2 vUv; varying float vShade;
          void main(){
            vUv = uv;
            vec3 p = position;
            float w = uv.x;
            p.z += sin(uTime*2.0 + uv.x*5.0 + uv.y*3.0)*0.16*w + sin(uTime*3.1 + uv.y*6.0)*0.04;
            p.x -= 0.1*(1.0-uv.y)*w;
            vShade = 0.5 + 0.5*cos(uTime*2.0 + uv.x*5.0);
            gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);
          }`,
        fragmentShader: `
          uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity;
          varying vec2 vUv; varying float vShade;
          void main(){
            vec4 t = texture2D(uMap, vUv);
            if(t.a < 0.35) discard;
            vec3 col = t.rgb * uColor * (0.9 + 0.35*vShade);
            gl_FragColor = vec4(col, t.a*uOpacity);
          }`,
      });
      this.flagMats.push(flagMat);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.6, 6, 8), flagMat);
      flag.position.set(0.45 + 0.92, 2.9, 0.03);
      flag.rotation.y = -0.15;
      g.add(flag);
      g.visible = false;
      this.group.add(g);
      this.banners.push({ group: g, soldier: s, flag });
    }

    // ---- horns ----
    this.horns = [];
    const hornGeo = makeHornGeometry();
    const hornMat = new THREE.MeshStandardMaterial({ color: 0x9a8d74, roughness: 0.72, metalness: 0.15 });
    const hornBandMat = new THREE.MeshStandardMaterial({ color: 0x7b6742, metalness: 0.8, roughness: 0.45 });
    const hornSoldiers = this.soldiers.filter(s => s.isHorn);
    for (const s of hornSoldiers) {
      const g = new THREE.Group();
      const horn = new THREE.Mesh(hornGeo, hornMat);
      horn.position.set(0.12, 1.5, -0.42);
      horn.rotation.set(0.1, -0.3, -0.45);
      horn.scale.setScalar(1.25);
      g.add(horn);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.016, 5, 10), hornBandMat);
      band.position.copy(horn.position);
      band.rotation.copy(horn.rotation);
      g.add(band);
      g.visible = false;
      this.group.add(g);
      this.horns.push({ group: g, soldier: s });
    }

    // ---- 张起灵 ----
    this.buildZhang();

    this.group.visible = false;
  }

  buildZhang() {
    const root = new THREE.Group();
    const robeMat = new THREE.MeshStandardMaterial({ color: 0x141c22, roughness: 0.92, metalness: 0.05 });
    const robeMat2 = new THREE.MeshStandardMaterial({ color: 0x1d2930, roughness: 0.88 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xb9b2a2, roughness: 0.82, emissive: 0x070908, emissiveIntensity: 1 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x0a0c0d, roughness: 0.7 });
    const blackGold = new THREE.MeshStandardMaterial({ color: 0x0b0d0d, metalness: 0.85, roughness: 0.32 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xa8823e, metalness: 0.95, roughness: 0.28, emissive: 0x241607, emissiveIntensity: 0.6 });
    const jade = new THREE.MeshStandardMaterial({ color: 0x2e5045, metalness: 0.35, roughness: 0.42, emissive: 0x123a2f, emissiveIntensity: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0d1113, roughness: 0.8 });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.72, 8), robeMat);
    torso.position.y = 1.34; root.add(torso);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.36, 0.26), robeMat2);
    chest.position.set(0, 1.44, -0.05); root.add(chest);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.78, 8, 2), robeMat);
    lower.position.y = 0.78; root.add(lower);
    const legs = new THREE.Group();
    const legGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.72, 5);
    legGeo.translate(0, -0.36, 0);
    const bootGeo = new THREE.BoxGeometry(0.14, 0.11, 0.27);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, dark);
      leg.position.set(sx * 0.11, 0.78, 0);
      legs.add(leg);
      const boot = new THREE.Mesh(bootGeo, dark);
      boot.position.set(sx * 0.11, 0.06, -0.05);
      legs.add(boot);
    }
    root.add(legs);
    legs.userData = { l: legs.children[0], r: legs.children[2] };

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.78, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 12), skin);
    head.scale.set(0.92, 1.18, 0.95); head.position.y = 0.12; headPivot.add(head);
    const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hair);
    hairMesh.scale.set(1.02, 1.05, 1.02); hairMesh.position.y = 0.135; headPivot.add(hairMesh);
    // simple face shadow: dark eye band
    const eyeBand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.026, 0.02), hair);
    eyeBand.position.set(0, 0.12, -0.105); headPivot.add(eyeBand);
    root.add(headPivot);

    const armGeo = new THREE.CylinderGeometry(0.055, 0.045, 0.62, 6);
    armGeo.translate(0, -0.31, 0);
    const leftArm = new THREE.Mesh(armGeo, robeMat);
    leftArm.position.set(-0.31, 1.54, 0); leftArm.rotation.z = 0.12; root.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, robeMat);
    rightArm.position.set(0.31, 1.54, 0);
    rightArm.rotation.set(-0.62, 0, 0.2); root.add(rightArm);
    const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), skin);
    rightHand.position.set(0.36, 1.16, -0.28); root.add(rightHand);

    // 黑金古刀 — scabbard diagonally across the back
    const sword = new THREE.Group();
    const scabbard = new THREE.Mesh(new THREE.BoxGeometry(0.085, 1.86, 0.045), blackGold);
    scabbard.position.y = 0.0;
    sword.add(scabbard);
    for (const y of [-0.72, 0.0, 0.72]) {
      const ring = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.055, 0.055), gold);
      ring.position.y = y; sword.add(ring);
    }
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.34, 6), blackGold);
    hilt.position.y = 1.05; sword.add(hilt);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.08), gold);
    guard.position.y = 0.88; sword.add(guard);
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), gold);
    pommel.position.y = 1.23; sword.add(pommel);
    sword.position.set(0.04, 1.13, 0.24);
    sword.rotation.z = -0.42; sword.rotation.x = 0.08;
    root.add(sword);

    // 鬼玺 — seal on the right palm
    const seal = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.2), jade);
    seal.add(base);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.15, 6), jade);
    knob.position.y = 0.13; seal.add(knob);
    const sealBand = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.025, 0.215), gold);
    sealBand.position.y = 0.055; seal.add(sealBand);
    const sigil = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.012), gold);
    sigil.position.set(0, 0.16, 0.055); seal.add(sigil);
    seal.position.set(0.38, 1.31, -0.3);
    seal.scale.setScalar(1.1);
    root.add(seal);
    this.seal = seal;
    const sealGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(1.8), color: 0x7ad9bb, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    sealGlow.scale.set(0.9, 0.9, 1);
    sealGlow.position.copy(seal.position);
    root.add(sealGlow);
    this.sealGlow = sealGlow;
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.018, 1.78, 0.012), gold);
    edge.position.set(0.045, 0, 0.028);
    sword.add(edge);

    // faint cool key just on him, so the seal + black-gold sword read
    const key = new THREE.PointLight(0xa9c6ba, 4.0, 8.5, 2);
    key.position.set(0.6, 1.9, 1.1);
    root.add(key);

    root.visible = false;
    this.group.add(root);
    this.zhangRoot = root;
    this.zhangHead = headPivot;
    this.zhangLegs = legs;
    this.zhangSword = sword;
  }

  setQuality(q) {
    this.quality = q;
    this.flagMats.forEach(m => { /* particle count can stay */ });
  }

  _soldierTransform(s, t, zOverride = null) {
    const active = t > START_TIME;
    const z = zOverride !== null ? zOverride : START_Z + s.row * ROW_GAP - Math.max(0, t - START_TIME) * SPEED;
    const bob = Math.sin(t * 0.72 + s.phase) * 0.045 + Math.sin(t * 1.7 + s.phase * 2) * 0.012;
    const sway = Math.sin(t * 0.5 + s.phase) * 0.075;
    const yaw = Math.sin(t * 0.34 + s.phase) * 0.05;
    let x = s.x + sway;
    // narrow into the doorway as they reach it
    const narrow = THREE.MathUtils.smoothstep(z, -30, -54);
    x *= 1 - narrow * 0.25;
    // v3: the valley floor is now ridged/steps 1-3 m high; sample it so the
    // procession stands on the bone carpet instead of sinking into the rock.
    const ground = riftFloorHeight(x, z);
    return { x, y: ground + 0.05 + bob, z, yaw, active: active && z > -63 };
  }

  setTime(t) {
    this.time = t;
    const show = t > 12.6;
    this.group.visible = show;
    if (!show) {
      this.zhangRoot.visible = false;
      for (const b of this.banners) b.group.visible = false;
      for (const h of this.horns) h.group.visible = false;
      return;
    }
    const meshes = this.meshes;
    for (const m of Object.values(meshes)) m.visible = true;
    for (let i = 0; i < this.N; i++) {
      const s = this.soldiers[i];
      if (s.isZhang) {
        for (const name of Object.keys(meshes)) {
          meshes[name].setMatrixAt(i, tmpM.makeScale(0, 0, 0));
        }
        continue;
      }
      const tr = this._soldierTransform(s, t);
      const active = tr.active;
      if (!active) {
        for (const name of Object.keys(meshes)) meshes[name].setMatrixAt(i, tmpM.makeScale(0, 0, 0));
        continue;
      }
      const root = new THREE.Matrix4().compose(
        new THREE.Vector3(tr.x, tr.y, tr.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, tr.yaw, Math.sin(t * 0.4 + s.phase) * 0.018)),
        new THREE.Vector3(1, s.height, 1)
      );
      const setPart = (mesh, local, name) => {
        tmpM2.multiplyMatrices(root, local);
        mesh.setMatrixAt(i, tmpM2);
      };
      setPart(meshes.torso, localMatrix(0, 1.32, 0), 'torso');
      setPart(meshes.plate, localMatrix(0, 1.42, 0), 'plate');
      setPart(meshes.waist, localMatrix(0, 0.98, 0), 'waist');
      setPart(meshes.belt, localMatrix(0, 1.04, 0), 'belt');
      setPart(meshes.skirt, localMatrix(0, 1.48, 0), 'skirt');
      const shL = localMatrix(-0.35, 1.62, 0, 0, 0, 0.18);
      const shR = localMatrix(0.35, 1.62, 0, 0, 0, -0.18);
      setPart(meshes.shoulderL, shL, 'shoulderL');
      setPart(meshes.shoulderR, shR, 'shoulderR');
      const headTurn = -0.5 + Math.sin(s.phase) * 0.14;
      setPart(meshes.head, localMatrix(0, 2.04, 0, 0, headTurn, 0), 'head');
      setPart(meshes.face, localMatrix(0, 2.045, 0, 0, headTurn, 0), 'face');
      setPart(meshes.helmet, localMatrix(0, 2.28, 0), 'helmet');
      setPart(meshes.crest, localMatrix(0, 2.44, -0.02), 'crest');
      // arms
      if (s.isBanner) {
        setPart(meshes.armL, localMatrix(-0.34, 1.55, 0, 0.1, 0, 0.36), 'armL');
        setPart(meshes.armR, localMatrix(0.33, 1.58, -0.02, -0.9, 0, -0.2), 'armR');
        setPart(meshes.handL, localMatrix(-0.42, 1.22, 0.05), 'handL');
        setPart(meshes.handR, localMatrix(0.42, 2.13, 0.02), 'handR');
      } else if (s.isHorn) {
        setPart(meshes.armL, localMatrix(-0.33, 1.56, 0, -0.95, 0, 0.32), 'armL');
        setPart(meshes.armR, localMatrix(0.33, 1.56, 0, -0.95, 0, -0.32), 'armR');
        setPart(meshes.handL, localMatrix(-0.2, 1.94, -0.4), 'handL');
        setPart(meshes.handR, localMatrix(0.2, 1.94, -0.4), 'handR');
      } else {
        const swing = Math.sin(t * 1.4 + s.phase) * 0.16;
        setPart(meshes.armL, localMatrix(-0.35, 1.56, 0, swing, 0, 0.18), 'armL');
        setPart(meshes.armR, localMatrix(0.35, 1.56, 0, -swing, 0, -0.18), 'armR');
        setPart(meshes.handL, localMatrix(-0.37, 0.97, -0.03), 'handL');
        setPart(meshes.handR, localMatrix(0.37, 0.97, -0.03), 'handR');
      }
    }
    for (const [name, m] of Object.entries(meshes)) m.instanceMatrix.needsUpdate = true;
    // flags
    for (const b of this.banners) {
      const tr = this._soldierTransform(b.soldier, t);
      b.group.visible = tr.active;
      b.group.position.set(tr.x, tr.y, tr.z);
      b.group.rotation.y = tr.yaw;
    }
    for (const h of this.horns) {
      const tr = this._soldierTransform(h.soldier, t);
      h.group.visible = tr.active;
      h.group.position.set(tr.x, tr.y, tr.z);
      h.group.rotation.y = tr.yaw;
    }
    for (const m of this.flagMats) m.uniforms.uTime.value = t;
    // 张起灵
    const st = this._soldierTransform(this.zhang, t);
    const zExtra = t > 34 ? Math.min(0, (t - 34) * 0.7) : 0;
    const z = st.z + zExtra;
    this.zhangRoot.visible = t > 12.6 && z > -62;
    this.zhangRoot.position.set(st.x, st.y, z);
    this.zhangRoot.rotation.y = st.yaw;
    const turn = THREE.MathUtils.smoothstep(t, 20.5, 23.5) * (1 - THREE.MathUtils.smoothstep(t, 27.5, 30.5));
    this.zhangHead.rotation.y = -turn * 1.15;
    this.zhangHead.rotation.z = turn * 0.06;
    const walk = t * 2.6;
    this.zhangLegs.userData.l.rotation.x = Math.sin(walk) * 0.28;
    this.zhangLegs.userData.r.rotation.x = -Math.sin(walk) * 0.28;
    this.zhangRoot.position.y += Math.abs(Math.sin(walk)) * 0.018;
    this.seal.rotation.y = Math.sin(t * 0.8) * 0.05;
  }
}

export const GHOST_TIMELINE = {
  duration: 52,
  openAt: 7.5,
  mistAt: 9.5,
  armyAt: 13,
  goodbyeAt: 24.5,
  closeAt: 45.5,
  impactAt: 48.4,
  endAt: 52,
  /** camera keys for the node 6 cinematic */
  cameraKeys: [
    { t: 0, p: [34, 9.5, 40], l: [0, 13, -50], fov: 46 },
    { t: 7, p: [28, 7.5, 30], l: [0, 13, -50], fov: 46 },
    { t: 12, p: [13.5, 6.4, 25], l: [0, 12, -50], fov: 50 },
    { t: 18, p: [12, 4.8, 28], l: [0, 8, -34], fov: 48 },
    { t: 23, p: [19, 5.4, 25], l: [-2.0, 3.6, 10], fov: 50 },
    { t: 28, p: [15, 5.0, 20], l: [0, 5, -16], fov: 48 },
    { t: 34, p: [20, 5.8, 17], l: [0, 9, -46], fov: 47 },
    { t: 44, p: [29, 7.4, 24], l: [0, 12, -50], fov: 47 },
    { t: 52, p: [34, 9.2, 34], l: [0, 13, -50], fov: 46 },
  ],
};
