import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { createNoise2D, createNoise3D } from 'simplex-noise';
import { mulberry32, makeRockTextures, makeSnowTextures, makeGlowTexture, makeMistTexture } from './textures.js';
import { Snowfall, SnowStreaks, MistField, SoftPuffs } from './particles.js';

const n2 = createNoise2D(mulberry32(5150));
const n3 = createNoise3D(mulberry32(6151));
function fbm2(x, y, oct = 4) {
  let a = 0.5, f = 1, s = 0, norm = 0;
  for (let i = 0; i < oct; i++) { s += a * n2(x * f, y * f); norm += a; a *= 0.5; f *= 2.01; }
  return s / norm;
}
function fbm3(x, y, z, oct = 4) {
  let a = 0.5, f = 1, s = 0, norm = 0;
  for (let i = 0; i < oct; i++) { s += a * n3(x * f, y * f, z * f); norm += a; a *= 0.5; f *= 2.02; }
  return s / norm;
}
function cloneTex(t, r) { const c = t.clone(); c.repeat.set(r[0], r[1]); c.needsUpdate = true; return c; }

const ORIGIN = new THREE.Vector3(-700, 0, 0);

function terrainHeight(x, z) {
  let h = fbm2(x * 0.026, z * 0.026, 4) * 3.3 + fbm2(x * 0.11, z * 0.1, 2) * 0.45;
  const back = THREE.MathUtils.smoothstep(-z, 12, 30);
  h += back * 1.7;
  const side = THREE.MathUtils.smoothstep(Math.abs(x), 34, 100);
  h += side * (5.5 + fbm2(x * 0.022, z * 0.03, 3) * 7.5) * (0.35 + back * 0.9);
  h += Math.exp(-Math.pow((x - 0) / 14, 2) - Math.pow((z + 24) / 8, 2)) * -0.6;
  h += Math.exp(-Math.pow((x + 18) / 16, 2) - Math.pow((z - 10) / 24, 2)) * 1.2;
  h += Math.exp(-Math.pow((x - 22) / 15, 2) - Math.pow((z - 22) / 22, 2)) * 0.9;
  return h;
}

function makeRidge({ width = 180, height = 52, segX = 100, segY = 48, seed = 2, amp = 5 } = {}) {
  const geo = new THREE.PlaneGeometry(width, height, segX, segY);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const edge = Math.min(1, (height / 2 - Math.abs(y)) / 7);
    const d = (fbm3(x * 0.035 + seed, y * 0.055, seed * 3, 5) * amp + fbm3(x * 0.13, y * 0.17, seed, 3) * amp * 0.35 + 1.6) * (0.35 + edge * 0.65);
    p.setZ(i, d);
  }
  geo.computeVertexNormals();
  return geo;
}

function snowMaterial(snowTex, repeat = [10, 4], color = 0xdfe9ee) {
  return new THREE.MeshStandardMaterial({
    map: cloneTex(snowTex.map, repeat), bumpMap: cloneTex(snowTex.bump, repeat), bumpScale: 0.35,
    color, roughness: 0.93, metalness: 0.01,
  });
}

export class Valley {
  constructor(scene, renderer, { quality = 'high' } = {}) {
    this.scene = scene;
    this.low = quality === 'low';
    this.group = new THREE.Group();
    this.group.position.copy(ORIGIN);
    this.group.name = 'valley';
    scene.add(this.group);
    this.time = 0;
    this.node = 1;

    this.tex = {
      rock: makeRockTextures(12),
      snow: makeSnowTextures(),
    };
    this.buildSky();
    this.buildTerrain();
    this.buildCliff();
    this.buildMountains();
    this.buildCrevice();
    this.outside = new THREE.Group();
    while (this.group.children.length) this.outside.add(this.group.children[0]);
    this.group.add(this.outside);
    this.buildCorridor();
    this.buildAtmosphere();
    this.buildLights();
    this.group.visible = false;
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(460, 40, 24);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uTime: { value: 0 }, uTop: { value: new THREE.Color(0x40525c) },
        uHorizon: { value: new THREE.Color(0xaab9c0) }, uGlow: { value: new THREE.Color(0x5a7784) },
      },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float uTime; uniform vec3 uTop, uHorizon, uGlow;
        varying vec3 vP;
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
        float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.03; a*=.5; } return s; }
        void main(){
          float h = clamp(vP.y*0.5+0.5, 0.0, 1.0);
          vec3 col = mix(uHorizon, uTop, smoothstep(0.02, 0.72, h));
          float band = fbm(vec2(vP.x*2.6 + uTime*0.004, vP.z*2.6 - vP.y*1.5));
          float cloud = smoothstep(0.38, 0.78, band) * smoothstep(0.0, 0.3, h) * (1.0 - smoothstep(0.55, 0.95, h));
          col = mix(col, vec3(0.42,0.49,0.53), cloud*0.42);
          float glow = pow(max(0.0, dot(normalize(vP), normalize(vec3(-0.55,0.25,-0.8)))), 12.0);
          col += uGlow * glow * 0.28;
          col = mix(col, vec3(0.09,0.13,0.15), smoothstep(0.38, 0.5, h)*0.25);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(geo, this.skyMat);
    this.sky.renderOrder = -10;
    this.group.add(this.sky);
  }

  buildTerrain() {
    const geo = new THREE.PlaneGeometry(260, 240, this.low ? 70 : 120, this.low ? 65 : 110);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const colors = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const y = terrainHeight(x, z);
      p.setY(i, y);
      const c = 0.75 + fbm2(x * 0.06, z * 0.06, 3) * 0.2;
      colors[i * 3] = c * 0.94; colors[i * 3 + 1] = c * 0.97; colors[i * 3 + 2] = c;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    this.snowMat = snowMaterial(this.tex.snow, [16, 14], 0xe1ebef);
    this.snowMat.vertexColors = true;
    const ground = new THREE.Mesh(geo, this.snowMat);
    ground.position.z = 0;
    this.group.add(ground);
    this.ground = ground;

    // wind-carved drifts
    const driftMat = new THREE.MeshStandardMaterial({ color: 0xe8f0f2, roughness: 0.88, metalness: 0, map: cloneTex(this.tex.snow.map, [4, 2]), bumpMap: cloneTex(this.tex.snow.bump, [4, 2]), bumpScale: 0.5 });
    const driftGeo = new THREE.SphereGeometry(1, 24, 12);
    const rnd = mulberry32(303);
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(driftGeo, driftMat);
      const x = (rnd() - 0.5) * 150, z = -10 + rnd() * 100;
      const s = 3 + rnd() * 12;
      m.position.set(x, terrainHeight(x, z) - s * 0.35, z);
      m.scale.set(s, s * (0.12 + rnd() * 0.12), s * (0.45 + rnd() * 0.5));
      m.rotation.y = rnd() * 3;
      this.group.add(m);
    }

    // dark outcrops pushing through the snow on both flanks
    const rockGeo = new THREE.DodecahedronGeometry(1, 1);
    const rockM = new THREE.MeshStandardMaterial({ color: 0x3a4140, roughness: 0.93, metalness: 0.02, flatShading: true, map: cloneTex(this.tex.rock.map, [1, 1]) });
    const snowCapless = new THREE.MeshStandardMaterial({ color: 0xd9e5e9, roughness: 0.9 });
    for (let i = 0; i < 22; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (36 + rnd() * 48);
      const z = -8 + rnd() * 62;
      const y = terrainHeight(x, z);
      const sc = 1.2 + rnd() * 4.6;
      const rock = new THREE.Mesh(rockGeo, rockM);
      rock.position.set(x, y + sc * 0.28, z);
      rock.scale.set(sc * (0.7 + rnd() * 0.8), sc * (0.5 + rnd() * 0.9), sc * (0.8 + rnd() * 0.7));
      rock.rotation.set(rnd() * 0.5, rnd() * 6, rnd() * 0.4);
      this.group.add(rock);
      const cap = new THREE.Mesh(rockGeo, snowCapless);
      cap.position.set(x, y + sc * 0.55, z);
      cap.scale.set(sc * 0.6, sc * 0.16, sc * 0.55);
      cap.rotation.y = rnd() * 3;
      this.group.add(cap);
    }
  }

  buildCliff() {
    const rockBase = new THREE.MeshStandardMaterial({
      color: 0x78807b, map: cloneTex(this.tex.rock.map, [9, 3]),
      roughnessMap: cloneTex(this.tex.rock.roughness, [9, 3]),
      bumpMap: cloneTex(this.tex.rock.bump, [9, 3]), bumpScale: 1.2,
      roughness: 0.92, metalness: 0.03, vertexColors: false,
    });
    // CSM adds wind-packed snow on upward normals and ledges
    const csm = new CustomShaderMaterial({
      baseMaterial: rockBase,
      vertexShader: `
        varying vec3 vWPos;
        varying vec3 vWNormal;
        void main(){
          vWPos = (modelMatrix * vec4(position, 1.0)).xyz;
          vWNormal = normalize(mat3(modelMatrix) * normal);
        }`,
      fragmentShader: `
        varying vec3 vWPos;
        varying vec3 vWNormal;
        float hash31(vec3 p){ p = fract(p*0.1031); p += dot(p, p.yzx+33.33); return fract((p.x+p.y)*p.z); }
        float vnoise(vec3 p){
          vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          float n000=hash31(i), n100=hash31(i+vec3(1,0,0)), n010=hash31(i+vec3(0,1,0)), n110=hash31(i+vec3(1,1,0));
          float n001=hash31(i+vec3(0,0,1)), n101=hash31(i+vec3(1,0,1)), n011=hash31(i+vec3(0,1,1)), n111=hash31(i+vec3(1,1,1));
          return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y), mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y), f.z);
        }
        void main(){
          float n = vnoise(vWPos*0.17)*0.55 + vnoise(vWPos*0.55)*0.3;
          float snow = smoothstep(0.38, 0.78, vWNormal.y + (n-0.5)*0.22);
          snow *= 0.55;
          vec3 snowCol = vec3(0.45, 0.54, 0.60);
          csm_DiffuseColor.rgb = mix(csm_DiffuseColor.rgb, snowCol, snow);
          csm_Roughness = mix(csm_Roughness, 0.94, snow);
        }`,
      uniforms: {},
    });
    this.cliffMat = csm;

    const geo = makeRidge({ width: 200, height: 38, segX: this.low ? 60 : 110, segY: this.low ? 24 : 44, seed: 4, amp: 4.8 });
    const cliff = new THREE.Mesh(geo, csm);
    cliff.position.set(0, 18.5, -33);
    this.group.add(cliff);
    this.cliff = cliff;
    // fill the base below the displaced plane
    const base = new THREE.Mesh(new THREE.BoxGeometry(200, 14, 9), rockBase);
    base.position.set(0, 0, -35);
    this.group.add(base);

    // snow cap / plateau top
    const topGeo = new THREE.PlaneGeometry(200, 70, this.low ? 40 : 80, this.low ? 20 : 30);
    topGeo.rotateX(-Math.PI / 2);
    const tp = topGeo.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i), z = tp.getZ(i);
      tp.setY(i, fbm2(x * 0.05, z * 0.06, 3) * 1.4 - Math.max(0, z + 10) * 0.18);
    }
    topGeo.computeVertexNormals();
    const topMat = snowMaterial(this.tex.snow, [16, 6], 0xdde8ec);
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.set(0, 34.2, -62);
    this.group.add(top);
    this.cliffTop = top;

    // heavy buttresses / rime-covered ledges on the face
    const buttMat = new THREE.MeshStandardMaterial({ color: 0x2a302e, roughness: 0.92, metalness: 0.02, flatShading: true });
    const rndB = mulberry32(2024);
    const buttGeo = new THREE.DodecahedronGeometry(1, 1);
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Mesh(buttGeo, buttMat);
      const x = -78 + i * 27 + (rndB() - 0.5) * 12;
      const h = 12 + rndB() * 19;
      b.position.set(x, h * 0.45 - 1, -28 - rndB() * 4);
      b.scale.set(5 + rndB() * 6, h * 0.6, 4 + rndB() * 5);
      b.rotation.set((rndB() - 0.5) * 0.25, rndB() * 3, (rndB() - 0.5) * 0.2);
      this.group.add(b);
    }

    // dark rock teeth breaking through the snowcap
    const toothMat = new THREE.MeshStandardMaterial({ color: 0x272b29, roughness: 0.94, flatShading: true });
    const rnd = mulberry32(3141);
    for (let i = 0; i < 0; i++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(2 + rnd() * 5, 3 + rnd() * 8, 5), toothMat);
      const x = -70 + i * 22 + rnd() * 8;
      tooth.position.set(x, 35 + rnd() * 2.5, -42 - rnd() * 12);
      tooth.rotation.y = rnd() * 3;
      this.group.add(tooth);
    }
  }

  buildMountains() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x6d818c, roughness: 0.95, flatShading: true, fog: true });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xc3d2d8, roughness: 0.9, flatShading: true, fog: true });
    const rnd = mulberry32(717);
    for (let i = 0; i < 0; i++) {
      const r = 45 + rnd() * 50;
      const h = 45 + rnd() * 55;
      const x = -170 + i * 55 + rnd() * 20;
      const z = -120 - rnd() * 80;
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mat);
      m.position.set(x, h * 0.5 - 8, z);
      m.rotation.y = rnd() * 3;
      this.group.add(m);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.62, h * 0.4, 6), snowMat);
      cap.position.set(x, h * 0.8 - 8, z);
      cap.rotation.y = m.rotation.y;
      this.group.add(cap);
    }
  }

  buildCrevice() {
    // rock porch around a narrow slit at the base of the 30m cliff
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x6f766f, map: cloneTex(this.tex.rock.map, [2, 2]),
      bumpMap: cloneTex(this.tex.rock.bump, [2, 2]), bumpScale: 0.9, roughness: 0.88, metalness: 0.03,
    });
    const boulderGeo = new THREE.DodecahedronGeometry(1, 1);
    const rnd = mulberry32(811);
    const slabs = [
      [-4.0, 2.6, -25.2, 3.2, 5.2, 2.6, 0.1, 0.5, 0.28],
      [3.9, 3.1, -25.0, 3.4, 6.2, 2.8, -0.15, -0.4, -0.25],
      [-0.2, 6.4, -26.4, 5.4, 2.2, 2.4, 0.4, 0.1, 0.06],
      [-5.4, 0.8, -23.8, 4.6, 2.4, 4.0, 0, 0.6, 0.1],
      [5.3, 0.9, -24.4, 4.2, 2.8, 3.5, 0, -0.7, -0.1],
    ];
    for (const s of slabs) {
      const m = new THREE.Mesh(boulderGeo, rockMat);
      m.position.set(s[0], s[1], s[2]);
      m.scale.set(s[3], s[4], s[5]);
      m.rotation.set(s[6], s[7], s[8]);
      this.group.add(m);
    }
    // black mouth
    const mouthShape = new THREE.Shape();
    const pts = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const r = 1 + 0.12 * Math.sin(a * 5 + 1.3) + 0.08 * Math.cos(a * 3);
      pts.push(new THREE.Vector2(Math.cos(a) * 2.35 * r, Math.sin(a) * 3.2 * r));
    }
    mouthShape.setFromPoints(pts);
    const mouth = new THREE.Mesh(new THREE.ShapeGeometry(mouthShape), new THREE.MeshBasicMaterial({ color: 0x020303 }));
    mouth.position.set(0, 3.1, -25.15);
    mouth.scale.setScalar(1.55);
    this.group.add(mouth);
    // warm glimmer deep inside
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(2.2), color: 0xffb47a, transparent: true, opacity: 0.32,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    glow.position.set(0, 2.2, -29.6);
    glow.scale.set(3.8, 3.2, 1);
    this.group.add(glow);
    this.mouthGlow = glow;

    // snow banked up against the mouth
    const snowMat = snowMaterial(this.tex.snow, [3, 2], 0xe8f1f4);
    const bank = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), snowMat);
    bank.position.set(-1.8, 0.1, -23.4);
    bank.scale.set(4.6, 0.9, 2.2);
    this.group.add(bank);
    const bank2 = bank.clone(); bank2.position.x = 2.6; bank2.scale.set(3.3, 0.7, 1.8); this.group.add(bank2);
    // icicles above the mouth
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xb9d2d5, roughness: 0.18, metalness: 0.05, transparent: true, opacity: 0.72 });
    for (let i = 0; i < 9; i++) {
      const ic = new THREE.Mesh(new THREE.ConeGeometry(0.12 + rnd() * 0.2, 0.5 + rnd() * 1.4, 5), iceMat);
      ic.position.set(-2.2 + i * 0.55, 5.4 - rnd() * 0.5, -24.5 + rnd() * 0.6);
      ic.rotation.z = Math.PI;
      this.group.add(ic);
    }
  }

  buildCorridor() {
    this.corridor = new THREE.Group();
    this.group.add(this.corridor);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x59625b, map: cloneTex(this.tex.rock.map, [2.4, 2.4]),
      bumpMap: cloneTex(this.tex.rock.bump, [2.4, 2.4]), bumpScale: 0.55,
      roughness: 0.74, metalness: 0.08,
    });
    this.corridorMat = rockMat;
    // floor
    const floorGeo = new THREE.PlaneGeometry(8.5, 40, 30, 70);
    floorGeo.rotateX(-Math.PI / 2);
    const fp = floorGeo.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      const x = fp.getX(i), z = -24 - (-fp.getZ(i) - 20);
      // gentle slope down to the spring
      const zz = fp.getZ(i) - 44;
      fp.setY(i, 0.05 + fbm2(x * 0.4, zz * 0.25, 2) * 0.18 - THREE.MathUtils.smoothstep(-zz, 0, 10) * 0.2);
    }
    floorGeo.computeVertexNormals();
    const floor = new THREE.Mesh(floorGeo, rockMat);
    floor.position.set(0, 0, -44);
    this.corridor.add(floor);

    // walls and ceiling
    const mk = (w, h, sy, ry, x, y, z) => {
      const geo = new THREE.PlaneGeometry(w, h, 24, sy);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        p.setZ(i, fbm3(p.getX(i) * 0.18, p.getY(i) * 0.18, z * 0.1, 3) * 0.75 + Math.sin(p.getY(i) * 0.7 + p.getX(i) * 0.2) * 0.2);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, rockMat);
      m.rotation.y = ry;
      m.position.set(x, y, z);
      this.corridor.add(m);
    };
    mk(40, 10, 24, Math.PI / 2, -3.8, 4.8, -44);
    mk(40, 10, 24, -Math.PI / 2, 3.8, 4.8, -44);
    // ceiling split, leaving a thin crack at the centre
    mk(3.2, 40, 24, Math.PI / 2, -2.1, 9.2, -44); // rotated so plane lies down? use custom below
    this.corridor.children.pop();
    const ceilGeo = new THREE.PlaneGeometry(7.8, 40, 18, 40);
    ceilGeo.rotateX(Math.PI / 2);
    const cp = ceilGeo.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      cp.setY(i, fbm2(cp.getX(i) * 0.3, cp.getZ(i) * 0.25, 3) * 0.9);
    }
    ceilGeo.computeVertexNormals();
    const ceil = new THREE.Mesh(ceilGeo, rockMat);
    ceil.position.set(0, 9.0, -44);
    this.corridor.add(ceil);
    // crack light strip
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 26), new THREE.MeshBasicMaterial({ color: 0x9fbdc4, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0.7, 8.95, -42);
    this.corridor.add(strip);
    this.crackStrip = strip;

    // ice teeth growing from the ceiling
    const rnd = mulberry32(928);
    const iceGeo = new THREE.ConeGeometry(0.16, 1.7, 5);
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xa9c6cb, roughness: 0.2, metalness: 0.06, transparent: true, opacity: 0.64 });
    const icicles = new THREE.InstancedMesh(iceGeo, iceMat, 34);
    const d = new THREE.Object3D();
    for (let i = 0; i < 34; i++) {
      const x = (rnd() - 0.5) * 7;
      const z = -29 - rnd() * 25;
      const s = 0.4 + rnd() * 1.1;
      d.position.set(x, 8.8 - (0.8 * s), z);
      d.rotation.set(0, rnd() * 3, Math.PI + (rnd() - 0.5) * 0.2);
      d.scale.set(s, s, s);
      d.updateMatrix(); icicles.setMatrixAt(i, d.matrix);
    }
    icicles.instanceMatrix.needsUpdate = true;
    this.corridor.add(icicles);

    // dead-end wall behind the spring
    const backGeo = new THREE.PlaneGeometry(9.6, 12, 20, 24);
    const bpp = backGeo.attributes.position;
    for (let i = 0; i < bpp.count; i++) {
      bpp.setZ(i, fbm3(bpp.getX(i) * 0.25, bpp.getY(i) * 0.25, 3, 3) * 0.9);
    }
    backGeo.computeVertexNormals();
    const backMesh = new THREE.Mesh(backGeo, rockMat);
    backMesh.position.set(0, 5.8, -63.5);
    this.corridor.add(backMesh);

    // hot spring pool
    const poolGeo = new THREE.CircleGeometry(4.15, 64, 0, Math.PI * 2);
    const pp = poolGeo.attributes.position;
    for (let i = 1; i < pp.count; i++) {
      const a = Math.atan2(pp.getY(i), pp.getX(i));
      const r = 0.9 + fbm2(Math.cos(a) * 2, Math.sin(a) * 2, 3) * 0.16;
      pp.setXY(i, pp.getX(i) * r, pp.getY(i) * r);
    }
    poolGeo.computeVertexNormals();
    this.waterMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: true,
      uniforms: {
        uTime: { value: 0 }, uDeep: { value: new THREE.Color(0x0c3a35) },
        uShallow: { value: new THREE.Color(0x74cbba) }, uLight: { value: new THREE.Vector3(0, 8, -42) },
      },
      vertexShader: `
        uniform float uTime; varying vec2 vUv; varying vec3 vW;
        void main(){
          vUv = uv;
          vec3 p = position;
          p.z += sin((p.x+position.y)*2.0 + uTime*1.1)*0.025 + cos(p.y*3.0 - uTime*0.8)*0.02;
          vW = (modelMatrix*vec4(p,1.0)).xyz;
          gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);
        }`,
      fragmentShader: `
        uniform float uTime; uniform vec3 uDeep, uShallow, uLight;
        varying vec2 vUv; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5); }
        float nz(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
        void main(){
          vec2 q = vW.xz*0.85;
          float r = nz(q*2.0 + vec2(uTime*0.15, uTime*0.08));
          float r2 = nz(q*4.0 - vec2(uTime*0.2, uTime*0.12));
          float n = r*0.6 + r2*0.4;
          float ripple = smoothstep(0.55, 0.9, n) * 0.5;
          float edge = smoothstep(4.15, 3.1, length(vW.xz - vec2(0.0,-50.0)));
          vec3 col = mix(uDeep, uShallow, 0.25 + n*0.42);
          float spec = pow(max(0.0, n), 7.0)*0.5;
          col += vec3(0.5,0.75,0.7)*ripple*0.25 + spec;
          float vig = smoothstep(0.0, 3.6, length(vW.xz - vec2(0.0,-50.0)));
          col = mix(col, uDeep*0.6, vig*0.4);
          gl_FragColor = vec4(col, 0.9*edge);
        }`,
    });
    this.water = new THREE.Mesh(poolGeo, this.waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(0, 0.16, -50);
    this.water.position.set(0, 0.28, -50);
    this.corridor.add(this.water);
    const waterGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(2.2), color: 0x6fc4b1, transparent: true, opacity: 0.02,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    waterGlow.position.set(0, 0.5, -50);
    waterGlow.scale.set(8, 6, 1);
    this.corridor.add(waterGlow);
    // wet rim rocks
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x464f47, roughness: 0.62, metalness: 0.08, flatShading: true });
    const rimGeo = new THREE.DodecahedronGeometry(1, 0);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      if (Math.sin(a) > 0.18) continue;
      const r = 4.6 + (i % 3) * 0.25;
      const rock = new THREE.Mesh(rimGeo, rimMat);
      rock.position.set(Math.cos(a) * r, 0.03 + rnd() * 0.12, -50 + Math.sin(a) * r);
      const s = 0.22 + rnd() * 0.38;
      rock.scale.set(s * 1.3, s * 0.6, s);
      rock.rotation.set(rnd(), rnd() * 6, rnd());
      this.corridor.add(rock);
    }
    // steam
    this.steam = new SoftPuffs({
      count: this.low ? 18 : 36, box: [6, 3.2, 6], center: [0, 0.25, -49.4],
      size: 4.2, color: 0xaebfb8, opacity: 0.018, rise: 0.6, blending: THREE.NormalBlending,
      tex: makeMistTexture(6, true),
    });
    this.corridor.add(this.steam.points);
    this.steam.points.visible = false;
    this.steamMist = new MistField({
      count: 3, center: [0, 1.4, -49], extent: [4, 2.4, 4], size: [3, 2], color: 0xb9cec5,
      opacity: 0.03, rise: 0.3, mode: 'billboard', texture: makeMistTexture(8, true),
    });
    this.corridor.add(this.steamMist.group);
    this.steamMist.group.visible = false;

    // warm + cold light inside the crevice
    this.poolLight = new THREE.PointLight(0x77c3ae, 210, 22, 2);
    this.poolLight.position.set(0, 1.4, -50);
    this.corridor.add(this.poolLight);
    this.warmLight = new THREE.PointLight(0xd78d55, 120, 17, 2);
    this.warmLight.position.set(-2.4, 0.7, -47);
    this.corridor.add(this.warmLight);
    this.crackSpot = new THREE.SpotLight(0xa6c6cc, 360, 22, 0.36, 0.9, 1.5);
    this.crackSpot.position.set(1, 13, -41);
    this.crackSpot.target.position.set(0.5, 0.5, -45);
    this.corridor.add(this.crackSpot, this.crackSpot.target);
    const corrFill = new THREE.PointLight(0x789c90, 95, 24, 2);
    corrFill.position.set(0, 4.5, -35);
    this.corridor.add(corrFill);
    const corrHemi = new THREE.HemisphereLight(0x3f6258, 0x090a07, 0.3);
    this.corridor.add(corrHemi);
    this.corridorFill = corrFill;
    // visible god ray through the crack
    const beamGeo = new THREE.CylinderGeometry(0.25, 2.8, 12, 16, 1, true);
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.012 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform float uTime, uOpacity; varying vec2 vUv;
        void main(){ float e=smoothstep(0.0,0.3,vUv.x)*smoothstep(1.0,0.7,vUv.x);
          float a=e*(0.6+0.4*sin(vUv.y*18.0-uTime*0.4))*uOpacity*(1.0-vUv.y*0.6);
          gl_FragColor=vec4(0.7,0.85,0.86,a); }`,
    });
    this.beamMat = beamMat;
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(1, 4.7, -40.5);
    beam.rotation.z = -0.12;
    beam.visible = false;
    this.corridor.add(beam);
  }

  buildAtmosphere() {
    this.snow = new Snowfall({
      count: this.low ? 1500 : 5200, box: [130, 62, 130], size: 0.62, color: 0xd7e6ea,
      opacity: 0.62, speed: 3.6, wind: 5.4,
    });
    this.snow.points.position.set(0, 26, 20);
    this.group.add(this.snow.points);
    this.streaks = new SnowStreaks({ count: this.low ? 70 : 150, box: [120, 45, 120], color: 0xb8d0d6, opacity: 0.10 });
    this.streaks.lines.position.set(0, 24, 20);
    this.group.add(this.streaks.lines);
    // low spindrift
    this.spindrift = new SoftPuffs({
      count: this.low ? 80 : 180, box: [120, 5, 90], center: [0, 0.3, 25],
      size: 24, color: 0xc9dade, opacity: 0.08, rise: 0.0, blending: THREE.AdditiveBlending,
      tex: makeMistTexture(12, false),
    });
    this.group.add(this.spindrift.points);
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xa8c1d4, 0x0e1518, 1.25);
    this.outside.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0xb4cbe2, 2.4);
    this.moon.position.set(70, 90, 60);
    this.outside.add(this.moon);
    this.rim = new THREE.DirectionalLight(0x8fa9bd, 1.0);
    this.rim.position.set(-80, 40, -40);
    this.outside.add(this.rim);
    this.creviceFill = new THREE.PointLight(0xffb478, 130, 28, 2);
    this.creviceFill.position.set(0, 2.2, -23.5);
    this.outside.add(this.creviceFill);
    this.cliffSpot = new THREE.SpotLight(0x9fc0d0, 10000, 230, 0.55, 0.9, 1.4);
    this.cliffSpot.position.set(34, 28, 46);
    this.cliffSpot.target.position.set(-14, 12, -32);
    this.outside.add(this.cliffSpot, this.cliffSpot.target);
    this.mouthGlowLight = new THREE.PointLight(0xffa768, 420, 34, 2);
    this.mouthGlowLight.position.set(0, 1.6, -23.0);
    this.outside.add(this.mouthGlowLight);
  }

  setNode(node) {
    this.node = node;
    this.snow.points.visible = node === 1;
    this.streaks.lines.visible = false;
    this.spindrift.points.visible = node === 1;
    this.corridor.visible = node === 2;
    this.outside.visible = node === 1;
    this.sky.visible = node === 1;
    this.hemi.intensity = 1.25;
    this.moon.intensity = 2.4;
    this.rim.intensity = 1.0;
    this.creviceFill.intensity = 130;
    this.cliffSpot.intensity = 10000;
    this.mouthGlowLight.intensity = 420;
  }

  update(t, dt, camera, node) {
    this.time = t;
    this.skyMat.uniforms.uTime.value = t;
    if (node === 1) {
      this.snow.update(t);
      this.spindrift.update(t);
      if (this.mouthSteam) this.mouthSteam.update(t, camera);
      this.mouthGlow.material.opacity = 0.22 + Math.sin(t * 1.7) * 0.05;
    } else {
      this.steam.update(t);
      this.steamMist.update(t, camera);
      this.waterMat.uniforms.uTime.value = t;
      this.beamMat.uniforms.uTime.value = t;
      this.poolLight.intensity = 260 + Math.sin(t * 1.4) * 20;
      this.warmLight.intensity = 120 + Math.sin(t * 2.3) * 12;
      this.steam.material.uniforms.uOpacity.value = 0.018 + Math.sin(t * 0.7) * 0.004;
    }
  }
}

export { ORIGIN as VALLEY_ORIGIN };
