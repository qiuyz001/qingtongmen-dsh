import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { createNoise2D, createNoise3D } from 'simplex-noise';
import { mulberry32, makeRockTextures, makeSnowTextures, makeGlowTexture, makeMistTexture, makeTextTexture } from './textures.js';
import { Snowfall, SnowStreaks, SnowVeil, MistField, SoftPuffs } from './particles.js';

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
    // v3: macro mass + meso crags + fine grain + stratified ledges + vertical
    // erosion channels.  The 30 m face must read as rock in raking light,
    // not as a displaced plane.
    const macro = fbm3(x * 0.021 + seed, y * 0.036, seed * 3, 5);
    const meso = fbm3(x * 0.072 + seed * 2, y * 0.105, seed, 4);
    const fine = fbm3(x * 0.26, y * 0.34, seed * 5, 3);
    const strata = Math.sin(y * 0.46 + fbm3(x * 0.05, y * 0.02, seed, 2) * 3.4) * 0.62
      + Math.sin(y * 0.17 + 1.7) * 0.4;
    const channel = -Math.pow(Math.abs(fbm3(x * 0.15 + 8, y * 0.018, seed * 2, 3)), 1.6) * 3.2;
    let d = macro * amp * 1.35 + meso * amp * 0.62 + fine * amp * 0.2 + strata * 1.15 + channel;
    d *= (0.35 + edge * 0.65);
    // push the crevice bay back so the mouth slabs sit in a recess
    d -= Math.exp(-Math.pow(x / 13, 2) - Math.pow((y + 6) / 13, 2)) * 2.4 * (0.4 + edge * 0.6);
    p.setZ(i, d);
  }
  geo.computeVertexNormals();
  return geo;
}

function makeFigure(material) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.55, 3, 6), material);
  torso.position.y = 1.13; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 8, 6), material);
  head.position.y = 1.57; g.add(head);
  const limbGeo = new THREE.CapsuleGeometry(0.058, 0.5, 2, 5);
  const legL = new THREE.Mesh(limbGeo, material); legL.position.set(-0.09, 0.38, 0); g.add(legL);
  const legR = new THREE.Mesh(limbGeo, material); legR.position.set(0.09, 0.38, 0); g.add(legR);
  const armGeo = new THREE.CapsuleGeometry(0.047, 0.46, 2, 5);
  const armL = new THREE.Mesh(armGeo, material); armL.position.set(-0.22, 1.14, 0); armL.rotation.z = 0.08; g.add(armL);
  const armR = new THREE.Mesh(armGeo, material); armR.position.set(0.22, 1.14, 0); armR.rotation.z = -0.08; g.add(armR);
  return g;
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
        uTime: { value: 0 }, uTop: { value: new THREE.Color(0x1a262d) },
        uHorizon: { value: new THREE.Color(0x4d5d65) }, uGlow: { value: new THREE.Color(0x415a66) },
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
          col = mix(col, vec3(0.05,0.075,0.09), smoothstep(0.38, 0.5, h)*0.35);
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
    this.snowMat = snowMaterial(this.tex.snow, [16, 14], 0xd4e1e6);
    this.snowMat.vertexColors = true;
    const ground = new THREE.Mesh(geo, this.snowMat);
    ground.position.z = 0;
    this.group.add(ground);
    this.ground = ground;

    // wind-carved drifts
    const driftMat = new THREE.MeshStandardMaterial({ color: 0xd8e4e8, roughness: 0.9, metalness: 0, map: cloneTex(this.tex.snow.map, [4, 2]), bumpMap: cloneTex(this.tex.snow.bump, [4, 2]), bumpScale: 0.5 });
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
      color: 0x424a46, map: cloneTex(this.tex.rock.map, [9, 3]),
      roughnessMap: cloneTex(this.tex.rock.roughness, [9, 3]),
      bumpMap: cloneTex(this.tex.rock.bump, [9, 3]), bumpScale: 2.6,
      normalMap: cloneTex(this.tex.rock.normal, [9, 3]),
      normalScale: new THREE.Vector2(1.35, 1.35),
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
          vec3 snowCol = vec3(0.40, 0.48, 0.54);
          csm_DiffuseColor.rgb = mix(csm_DiffuseColor.rgb, snowCol, snow);
          csm_Roughness = mix(csm_Roughness, 0.94, snow);
        }`,
      uniforms: {},
    });
    this.cliffMat = csm;

    const geo = makeRidge({ width: 200, height: 38, segX: this.low ? 100 : 240, segY: this.low ? 40 : 96, seed: 4, amp: 5.6 });
    const cliff = new THREE.Mesh(geo, csm);
    cliff.position.set(0, 18.5, -33);
    cliff.receiveShadow = true;
    cliff.castShadow = true;
    this.group.add(cliff);
    this.cliff = cliff;
    // fill the base below the displaced plane
    const base = new THREE.Mesh(new THREE.BoxGeometry(200, 14, 9), rockBase);
    base.position.set(0, 0, -35);
    base.receiveShadow = true;
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
    const topMat = snowMaterial(this.tex.snow, [16, 6], 0xd3e0e5);
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.set(0, 34.2, -62);
    this.group.add(top);
    this.cliffTop = top;

    // heavy buttresses / rime-covered ledges on the face
    const buttMat = new THREE.MeshStandardMaterial({ color: 0x202624, roughness: 0.92, metalness: 0.02, flatShading: true, map: cloneTex(this.tex.rock.map, [2, 4]) });
    const rndB = mulberry32(2024);
    const buttGeo = new THREE.DodecahedronGeometry(1, 1);
    for (let i = 0; i < 9; i++) {
      if (i === 3 || i === 4 || i === 5) continue; // keep the sightline to the tear open
      const b = new THREE.Mesh(buttGeo, buttMat);
      const x = -84 + i * 21 + (rndB() - 0.5) * 9;
      const h = 15 + rndB() * 22;
      b.position.set(x, h * 0.48 - 1.5, -25 - rndB() * 5);
      b.scale.set(4.5 + rndB() * 5.5, h * 0.6, 7 + rndB() * 8);
      b.rotation.set((rndB() - 0.5) * 0.24, rndB() * 3, (rndB() - 0.5) * 0.18);
      this.group.add(b);
      // snow shelf on top of each buttress
      const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), snowMaterial(this.tex.snow, [2, 1], 0xdde8ec));
      cap.position.set(x + (rndB() - 0.5) * 2, h * 0.48 - 1.5 + h * 0.31, -26 - rndB() * 3);
      cap.scale.set(3.6 + rndB() * 3.2, 0.34 + rndB() * 0.4, 3.2 + rndB() * 2.6);
      cap.rotation.y = rndB() * 3;
      this.group.add(cap);
    }
    // tall vertical ribs, silhouette variation against the storm sky
    for (let i = 0; i < 22; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (18 + Math.pow(rndB(), 0.8) * 78);
      const y = 6 + rndB() * 25;
      const rib = new THREE.Mesh(buttGeo, buttMat);
      rib.position.set(x, y, -29.8 - rndB() * 4.5);
      rib.scale.set(1.1 + rndB() * 1.8, 3.5 + rndB() * 8.5, 1.6 + rndB() * 2.4);
      rib.rotation.set((rndB() - 0.5) * 0.25, rndB() * 6, (rndB() - 0.5) * 0.25);
      this.group.add(rib);
    }
    // a heavy overhang near the top: the cliff leans over the entrance
    const overhang = new THREE.Mesh(buttGeo, buttMat);
    overhang.position.set(-25, 31.0, -27.5);
    overhang.scale.set(15, 3.6, 6.5);
    overhang.rotation.set(0.08, 0.2, -0.04);
    this.group.add(overhang);
    const ohSnow = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), snowMaterial(this.tex.snow, [3, 1], 0xd6e3e8));
    ohSnow.position.set(-25, 33.0, -26.6);
    ohSnow.scale.set(13, 0.8, 4.8);
    this.group.add(ohSnow);
    // foreground framing crags, kept clear of the sightline to the slit
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x161b1a, roughness: 0.96, metalness: 0.02, flatShading: true });
    for (const [x, z, s] of [[26, -8, 4.2], [31, 5, 5.6], [-28, 2, 4.4], [-34, 14, 3.4], [17, -20, 5.2], [-21, -22, 5.8]]) {
      const crag = new THREE.Mesh(buttGeo, frameMat);
      const y = terrainHeight(x, z);
      crag.position.set(x, y + s * 0.35, z);
      crag.scale.set(s * 0.85, s * 0.55, s);
      crag.rotation.set(rndB(), rndB() * 6, rndB() * 0.5);
      this.group.add(crag);
    }

    // a bright snow cornice makes the 30 m top edge read against the storm
    const corniceMat = snowMaterial(this.tex.snow, [6, 1], 0xe2edf1);
    const cornice = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 10), corniceMat);
    cornice.position.set(0, 36.9, -34.5);
    cornice.scale.set(64, 1.15, 3.2);
    this.group.add(cornice);
    const cornice2 = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 8), corniceMat);
    cornice2.position.set(-32, 35.6, -31.8);
    cornice2.scale.set(18, 0.8, 2.2);
    cornice2.rotation.z = -0.04;
    this.group.add(cornice2);
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
    // v3: the snow-buried slit must be the first thing read in the frame.
    // Two 13 m leaning slabs frame a 7 m mouth; the throat is a real recessed
    // cavity with lit inner walls, layered heat glow and steam, not a decal.
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x343b38, map: cloneTex(this.tex.rock.map, [2.6, 4.2]),
      bumpMap: cloneTex(this.tex.rock.bump, [2.6, 4.2]), bumpScale: 3.2,
      normalMap: cloneTex(this.tex.rock.normal, [2.6, 4.2]),
      normalScale: new THREE.Vector2(1.6, 1.6),
      roughness: 0.94, metalness: 0.02, flatShading: true,
    });
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x5e4f3f, map: cloneTex(this.tex.rock.map, [2, 4]),
      bumpMap: cloneTex(this.tex.rock.bump, [2, 4]), bumpScale: 2.2,
      normalMap: cloneTex(this.tex.rock.normal, [2, 4]),
      roughness: 0.96, metalness: 0.02, side: THREE.DoubleSide,
    });
    const shardGeo = new THREE.DodecahedronGeometry(1, 2);
    const rnd = mulberry32(811);

    function slabGeometry(seed) {
      const g = new THREE.BoxGeometry(1, 1, 1, 9, 22, 7);
      const p = g.attributes.position;
      const n = g.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const d = fbm3(x * 1.9 + seed, y * 1.55, z * 1.9, 4) * 0.115
          + fbm3(x * 5.2, y * 4.6 + seed, z * 5.2, 2) * 0.03;
        p.setXYZ(i,
          x + n.getX(i) * d,
          y + n.getY(i) * d * 0.55,
          z + n.getZ(i) * d);
      }
      g.computeVertexNormals();
      return g;
    }

    const slabL = new THREE.Mesh(slabGeometry(3.1), rockMat);
    slabL.position.set(-5.8, 6.3, -26.0);
    slabL.scale.set(4.6, 13.0, 6.5);
    slabL.rotation.set(0.03, 0.14, -0.24);
    slabL.castShadow = true;
    slabL.receiveShadow = true;
    this.group.add(slabL);
    const slabR = new THREE.Mesh(slabGeometry(7.7), rockMat);
    slabR.position.set(5.7, 6.0, -26.4);
    slabR.scale.set(4.5, 12.3, 6.3);
    slabR.rotation.set(-0.02, -0.2, 0.22);
    slabR.castShadow = true;
    slabR.receiveShadow = true;
    this.group.add(slabR);
    // jagged shards break the straight inner edges of the two slabs
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const s = new THREE.Mesh(shardGeo, rockMat);
        s.position.set(side * (3.9 + rnd() * 0.8), 1.5 + rnd() * 10.5, -25.3 - rnd() * 1.2);
        s.scale.set(0.7 + rnd() * 0.8, 0.8 + rnd() * 1.6, 0.7 + rnd() * 0.8);
        s.rotation.set(rnd() * 0.5, rnd() * 5, (rnd() - 0.5) * 0.4);
        this.group.add(s);
      }
    }
    // broken shoulders soften the join into the main cliff
    for (const [x, y, z, sx, sy, sz, ry] of [
      [-9.8, 2.0, -23.0, 4.6, 3.5, 4.2, 0.4], [10.2, 1.8, -23.4, 4.8, 3.3, 4.0, -0.2],
      [-10.6, 8.0, -25.0, 4.0, 5.6, 4.6, 0.8], [10.8, 7.5, -25.4, 4.2, 5.2, 4.4, 0.3],
    ]) {
      const s = new THREE.Mesh(shardGeo, rockMat);
      s.position.set(x, y, z);
      s.scale.set(sx, sy, sz);
      s.rotation.set(rnd() * 0.3, ry, rnd() * 0.2);
      this.group.add(s);
    }

    // ---- recessed throat: dark back, lit inner walls, heat glow ----
    const throatDark = new THREE.Mesh(
      new THREE.PlaneGeometry(7.6, 13.6),
      new THREE.MeshBasicMaterial({ color: 0x010202, fog: false }),
    );
    throatDark.position.set(0, 6.3, -32.3);
    this.group.add(throatDark);
    // inner walls catching the buried heat source; their vanishing edges
    // give the slit actual depth
    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 12.6, 10, 18), innerMat);
      const wp = w.geometry.attributes.position;
      for (let i = 0; i < wp.count; i++) {
        wp.setZ(i, fbm3(wp.getX(i) * 0.8 + side * 3, wp.getY(i) * 0.8, 4.2, 3) * 0.35);
      }
      w.geometry.computeVertexNormals();
      w.rotation.y = side * Math.PI / 2;
      w.position.set(side * 2.85, 6.1, -29.3);
      this.group.add(w);
    }
    const throatFloor = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 6.4, 8, 8), innerMat);
    throatFloor.rotation.x = -Math.PI / 2;
    throatFloor.position.set(0, 0.38, -29.3);
    this.group.add(throatFloor);

    const glowTex = makeGlowTexture(2.2);
    const addGlow = (x, y, z, sx, sy, op, col = 0xff7830) => {
      const gsp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: col, transparent: true, opacity: op,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      }));
      gsp.position.set(x, y, z);
      gsp.scale.set(sx, sy, 1);
      this.group.add(gsp);
      return gsp;
    };
    const deepGlow = addGlow(0, 5.8, -30.8, 6.6, 13.0, 0.82, 0xff6a24);
    const midGlow = addGlow(0, 4.2, -29.8, 4.6, 8.6, 0.66, 0xff8a3a);
    const mouthGlow = addGlow(0, 2.0, -28.2, 3.0, 4.4, 0.55, 0xffa050);
    this.mouthGlow = mouthGlow;
    this.deepGlow = deepGlow;

    // diffuse heat column deep in the cavity — soft, never a flame shape
    const seam = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 9.6), new THREE.MeshBasicMaterial({
      map: glowTex, color: 0xff7a34, transparent: true, opacity: 0.34,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    seam.position.set(0, 4.2, -30.9);
    this.group.add(seam);
    this.mouthSeam = seam;

    // dark rock teeth hang into the slit from both walls; they break the
    // rectangular doorway silhouette and catch a rim of heat light
    const toothMat = new THREE.MeshStandardMaterial({
      color: 0x171b19, roughness: 0.97, metalness: 0.02, flatShading: true,
      map: cloneTex(this.tex.rock.map, [1.5, 1.5]),
      normalMap: cloneTex(this.tex.rock.normal, [1.5, 1.5]),
    });
    for (const [x, y, z, sx, sy, sz, rz] of [
      [-2.4, 9.9, -27.4, 1.1, 2.4, 0.9, 0.3],
      [0.5, 10.7, -27.9, 1.15, 2.0, 0.9, -0.2],
      [2.7, 9.4, -27.2, 1.0, 1.9, 0.8, 0.45],
      [-3.5, 6.4, -26.9, 0.9, 1.5, 0.8, 0.5],
      [3.4, 7.1, -27.1, 1.0, 1.8, 0.8, -0.4],
      [-1.2, 4.1, -27.0, 0.7, 1.1, 0.6, 0.2],
    ]) {
      const tooth = new THREE.Mesh(shardGeo, toothMat);
      tooth.position.set(x, y, z);
      tooth.scale.set(sx, sy, sz);
      tooth.rotation.set(rnd() * 0.2, rnd() * 5, rz);
      this.group.add(tooth);
    }

    const heat = new THREE.PointLight(0xff8a3e, 85, 22, 2);
    heat.position.set(0, 4.0, -29.5);
    this.group.add(heat);
    this.throatHeat = heat;
    const heatUpper = new THREE.PointLight(0xff9a50, 48, 15, 2);
    heatUpper.position.set(0, 8.6, -29.1);
    this.group.add(heatUpper);
    this.heatUpper = heatUpper;
    const rimHeat = new THREE.PointLight(0xffa35c, 10, 7, 2);
    rimHeat.position.set(0.1, 1.4, -26.0);
    this.group.add(rimHeat);
    this.rimHeat = rimHeat;

    // ---- snow half-burying the mouth ----
    const snowMat = snowMaterial(this.tex.snow, [2.4, 1.4], 0xd3e0e6);
    const banks = [
      [-5.4, 0.46, -23.6, 3.5, 1.25, 2.9, 0.22],
      [5.1, 0.40, -23.9, 3.3, 1.15, 2.7, -0.38],
      [-8.4, 0.34, -21.9, 3.1, 0.75, 2.2, 0.5],
      [8.0, 0.32, -22.4, 3.0, 0.7, 2.3, -0.2],
      [0.1, 0.06, -23.2, 4.3, 0.5, 2.6, 0.05],
      [-2.8, 0.30, -24.1, 1.5, 0.42, 0.9, 0.3],
      [2.7, 0.28, -24.0, 1.4, 0.4, 0.9, -0.25],
    ];
    for (const [x, y, z, sx, sy, sz, ry] of banks) {
      const bank = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), snowMat);
      bank.position.set(x, terrainHeight(x, z) + y, z);
      bank.scale.set(sx, sy, sz);
      bank.rotation.y = ry;
      this.group.add(bank);
    }
    // dark debris breaks the smooth white drift lip
    const lipRockMat = new THREE.MeshStandardMaterial({
      color: 0x242a27, roughness: 0.96, metalness: 0.02, flatShading: true,
      map: cloneTex(this.tex.rock.map, [1, 1]),
    });
    for (let i = 0; i < 14; i++) {
      const x = (rnd() - 0.5) * 8.0;
      const z = -22.0 - rnd() * 2.6;
      const s = 0.14 + Math.pow(rnd(), 1.8) * 0.55;
      const rock = new THREE.Mesh(shardGeo, lipRockMat);
      rock.position.set(x, terrainHeight(x, z) + 0.3 + rnd() * 0.25, z);
      rock.scale.set(s * (0.8 + rnd()), s * (0.6 + rnd() * 0.8), s * (0.8 + rnd()));
      rock.rotation.set(rnd() * 2, rnd() * 6, rnd() * 2);
      this.group.add(rock);
    }
    // snow patches settle into the broken slab tops (no wide floating discs)
    for (const [x, y, z, sx, sy, sz, ry] of [
      [-7.4, 12.05, -26.3, 1.7, 0.28, 1.5, 0.7],
      [7.1, 11.65, -26.5, 1.6, 0.27, 1.4, 0.4],
    ]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 8), snowMat);
      cap.position.set(x, y, z);
      cap.scale.set(sx, sy, sz);
      cap.rotation.y = ry;
      this.group.add(cap);
    }

    // icicles hanging at the slit lip
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xb9d2d5, roughness: 0.22, metalness: 0.05, transparent: true, opacity: 0.62 });
    for (let i = 0; i < 8; i++) {
      const ic = new THREE.Mesh(new THREE.ConeGeometry(0.05 + rnd() * 0.1, 0.45 + rnd() * 1.1, 5), iceMat);
      ic.position.set(-2.4 + i * 0.68 + (rnd() - 0.5) * 0.3, 11.4 - rnd() * 0.5, -25.7 + rnd() * 0.4);
      ic.rotation.z = Math.PI;
      this.group.add(ic);
    }

    // warm slit rupture on the snow surface itself, so the eye connects
    // snow drift → black mouth → glow
    const gashGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 1.7), new THREE.MeshBasicMaterial({
      color: 0xff8b45, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    gashGlow.position.set(0.1, 0.8, -23.8);
    this.group.add(gashGlow);
    this.gashGlow = gashGlow;

    // 1.70 m expedition silhouette, for the cliff to be read as 30 m
    const figMat = new THREE.MeshStandardMaterial({ color: 0x050808, roughness: 0.98, metalness: 0 });
    const fig = makeFigure(figMat);
    fig.position.set(-1.8, terrainHeight(-1.8, -8.6) + 0.02, -8.6);
    fig.rotation.y = 0.34;
    fig.scale.setScalar(1.0);
    this.group.add(fig);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.2), new THREE.MeshStandardMaterial({ color: 0x101513, roughness: 0.95 }));
    pack.position.set(-0.02, 1.25, 0.2);
    fig.add(pack);
    const labelTex = makeTextTexture('1.7 m', { w: 256, h: 64, font: '500 34px serif', color: '#a9c7c3' });
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, opacity: 0.5, depthTest: false, fog: false }));
    label.position.set(-0.3, terrainHeight(-1.8, -8.6) + 1.75, -8.3);
    label.scale.set(1.8, 0.45, 1);
    label.renderOrder = 21;
    this.group.add(label);

    // 30 m cliff ruler: an authored annotation the brief explicitly keeps.
    // It runs from the snow surface to 30 m up the face, left of the slit.
    const rulerMat = new THREE.LineBasicMaterial({ color: 0xbfe6da, transparent: true, opacity: 0.9, depthTest: false });
    const rulerZ = -20.0, rulerX = -12.6;
    const rulerBase = terrainHeight(rulerX, rulerZ) + 0.15;
    const ruler = (pts) => {
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(...p))), rulerMat);
      l.renderOrder = 20;
      this.group.add(l);
    };
    ruler([[rulerX, rulerBase, rulerZ], [rulerX, rulerBase + 30, rulerZ]]);
    ruler([[rulerX - 0.7, rulerBase, rulerZ], [rulerX + 0.7, rulerBase, rulerZ]]);
    ruler([[rulerX - 0.7, rulerBase + 30, rulerZ], [rulerX + 0.7, rulerBase + 30, rulerZ]]);
    for (let i = 1; i < 6; i++) {
      ruler([[rulerX, rulerBase + i * 5, rulerZ], [rulerX + 0.85, rulerBase + i * 5, rulerZ]]);
    }
    const rulerTex = makeTextTexture('30 m', { w: 256, h: 64, font: '600 40px serif', color: '#d8efe7' });
    const rulerLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: rulerTex, transparent: true, opacity: 0.92, depthTest: false, fog: false }));
    rulerLabel.position.set(rulerX + 3.0, rulerBase + 30.3, rulerZ);
    rulerLabel.scale.set(4.6, 1.15, 1);
    rulerLabel.renderOrder = 21;
    this.group.add(rulerLabel);

    // broken trunk: a second scale cue and a sign that the storm has been here
    const trunkGrp = new THREE.Group();
    const barkMat = new THREE.MeshStandardMaterial({ color: 0x241f1a, roughness: 0.95, metalness: 0.02 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.36, 5.2, 7), barkMat);
    trunk.position.y = 2.6;
    trunkGrp.add(trunk);
    for (const [x, y, z, rz] of [[0.25, 4.2, 0.05, -0.9], [-0.3, 3.4, -0.1, 1.05], [0.1, 4.8, 0.12, -0.4]]) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.11, 1.8, 5), barkMat);
      br.position.set(x, y, z);
      br.rotation.z = rz;
      br.rotation.x = rnd() * 0.4;
      trunkGrp.add(br);
    }
    const snowCap = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6), snowMaterial(this.tex.snow, [1, 1], 0xe4edf0));
    snowCap.position.set(0.1, 5.15, 0.02);
    snowCap.scale.set(0.42, 0.12, 0.3);
    trunkGrp.add(snowCap);
    trunkGrp.position.set(15.5, terrainHeight(15.5, -12.5), -12.5);
    trunkGrp.rotation.set(0.08, 0.4, 0.28);
    this.group.add(trunkGrp);

    // heat vapour crawling out of the slit
    this.mouthSteam = new SoftPuffs({
      count: this.low ? 24 : 52, box: [3.8, 6.4, 1.8], center: [0.1, 1.0, -26.1],
      size: 2.2, color: 0xd1c6b6, opacity: 0.075, rise: 0.6,
      tex: makeMistTexture(7, true),
    });
    this.group.add(this.mouthSteam.points);

    // foreground wind drifts to break the smooth snow apron
    for (const [x, z, sx, sy, sz, ry] of [[-15, -3.5, 7.5, 1.1, 4.2, 0.4], [14, -5.5, 6.5, 0.9, 3.8, -0.3]]) {
      const drift = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 12), snowMat);
      drift.position.set(x, terrainHeight(x, z) - 0.1, z);
      drift.scale.set(sx, sy, sz);
      drift.rotation.y = ry;
      this.group.add(drift);
    }

    // large framing shard in the near left, giving the shot a foreground
    const fg = new THREE.Mesh(shardGeo, new THREE.MeshStandardMaterial({ color: 0x101514, roughness: 0.97, flatShading: true }));
    fg.position.set(-14.5, 1.2, -7);
    fg.scale.set(3.6, 1.5, 2.4);
    fg.rotation.set(0.2, 0.9, 0.15);
    this.group.add(fg);
  }

  buildCorridor() {
    this.corridor = new THREE.Group();
    this.group.add(this.corridor);
    const low = this.low;
    const rnd = mulberry32(928);

    // a descending ramp: the fissure falls away underfoot
    const floorAt = (x, z) => {
      const v = THREE.MathUtils.clamp((z + 56.5) / 32.0, 0, 1);
      return 0.08 + v * 3.05 + fbm2(x * 0.55 + 2.2, z * 0.4, 2) * 0.16;
    };
    this.corridorFloorAt = floorAt;

    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x687163, map: cloneTex(this.tex.rock.map, [3, 2]),
      bumpMap: cloneTex(this.tex.rock.bump, [3, 2]), bumpScale: 0.65,
      roughness: 0.52, metalness: 0.06,
      emissive: 0x1c1008, emissiveIntensity: 1.05, side: THREE.DoubleSide,
    });
    this.corridorMat = rockMat;

    const floorGeo = new THREE.PlaneGeometry(5.2, 32, low ? 14 : 22, low ? 26 : 42);
    floorGeo.rotateX(-Math.PI / 2);
    const fp = floorGeo.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      const x = fp.getX(i), z = fp.getZ(i) - 40.5;
      fp.setY(i, floorAt(x, z));
    }
    floorGeo.computeVertexNormals();
    const floor = new THREE.Mesh(floorGeo, rockMat);
    floor.position.z = -40.5;
    this.corridor.add(floor);

    for (const side of [-1, 1]) {
      const wgeo = new THREE.PlaneGeometry(34, 12, low ? 16 : 26, low ? 8 : 12);
      const wp = wgeo.attributes.position;
      for (let i = 0; i < wp.count; i++) {
        const u = wp.getX(i), v = wp.getY(i);
        wp.setZ(i, fbm2(u * 0.33, v * 0.3 + side * 3, 3) * 0.55 + Math.sin(u * 0.5 + v) * 0.12);
        if (v > 1) wp.setX(i, u + side * (v - 1) * 0.045);
      }
      wgeo.computeVertexNormals();
      const wall = new THREE.Mesh(wgeo, rockMat);
      wall.rotation.y = side * Math.PI / 2;
      wall.position.set(side * 2.35, 5.6, -40.5);
      this.corridor.add(wall);
    }

    for (const side of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.8, 34, 1, 1, 12), rockMat);
      c.position.set(side * 1.7, 8.55, -40.5);
      c.rotation.z = side * 0.11;
      this.corridor.add(c);
    }
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 25), new THREE.MeshBasicMaterial({
      color: 0xa9c6c7, transparent: true, opacity: 0.30, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0.05, 8.62, -42);
    this.corridor.add(strip);
    this.crackStrip = strip;

    const back = new THREE.Mesh(new THREE.BoxGeometry(7.2, 12, 1.6), rockMat);
    back.position.set(0, 5.6, -56.8);
    this.corridor.add(back);
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.2), new THREE.MeshBasicMaterial({ color: 0x010201, fog: false }));
    hole.position.set(0.1, 1.35, -55.98);
    this.corridor.add(hole);

    const shardGeo = new THREE.DodecahedronGeometry(1, 0);
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x353d35, map: cloneTex(this.tex.rock.map, [2, 2]),
      bumpMap: cloneTex(this.tex.rock.bump, [2, 2]), bumpScale: 0.7,
      roughness: 0.44, metalness: 0.09, flatShading: true, side: THREE.DoubleSide,
    });
    for (let i = 0; i < 26; i++) {
      const z = -25 - rnd() * 30;
      const side = rnd() > 0.5 ? 1 : -1;
      const m = new THREE.Mesh(shardGeo, slabMat);
      const s = 0.35 + rnd() * 1.1;
      m.position.set(side * (1.55 + rnd() * 0.55), floorAt(0, z) + 0.6 + rnd() * 6.2, z);
      m.scale.set(s * (0.5 + rnd() * 0.8), s * (0.7 + rnd() * 1.3), s * (0.5 + rnd() * 0.8));
      m.rotation.set(rnd() * 3, rnd() * 6, rnd() * 3);
      this.corridor.add(m);
    }
    for (let i = 0; i < 14; i++) {
      const z = -27 - rnd() * 27;
      const x = (rnd() - 0.5) * 3.6;
      const s = 0.15 + Math.pow(rnd(), 1.7) * 0.55;
      const m = new THREE.Mesh(shardGeo, slabMat);
      m.position.set(x, floorAt(x, z) + s * 0.2, z);
      m.scale.set(s * 1.4, s * 0.5, s * 1.1);
      m.rotation.set(rnd() * 0.4, rnd() * 6, rnd() * 0.3);
      this.corridor.add(m);
    }

    this.steamEmitters = [];
    this.ventGlows = [];
    const crackBlack = new THREE.MeshBasicMaterial({ color: 0x050302, fog: false });
    const crackPos = [
      [-1, 3.6, -31.5, 1.5], [1, 2.4, -36.5, 1.8], [-1, 1.5, -41.5, 1.2],
      [1, 4.1, -45.0, 1.4], [-1, 2.8, -49.0, 1.6], [1, 1.2, -52.0, 1.1],
    ];
    for (let i = 0; i < crackPos.length; i++) {
      const [side, y, z, len] = crackPos[i];
      const tear = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.07), crackBlack);
      tear.rotation.y = side * Math.PI / 2;
      tear.position.set(side * 2.28, y, z);
      this.corridor.add(tear);
      const line = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.9, 0.032), new THREE.MeshBasicMaterial({
        color: 0xff9a50, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      }));
      line.rotation.y = side * Math.PI / 2;
      line.position.set(side * 2.27, y, z);
      this.corridor.add(line);
      this.ventGlows.push(line);
      if (i % 2 === 0) {
        const st = new SoftPuffs({
          count: low ? 4 : 6, box: [0.4, 3.8, 0.6], center: [side * 2.0, y - 0.2, z],
          size: 1.15, color: 0xd4cdb7, opacity: 0.075, rise: 0.55,
          tex: makeMistTexture(6, true),
        });
        this.corridor.add(st.points);
        this.steamEmitters.push(st);
      }
    }
    for (const [x, z, len] of [[-0.8, -38, 1.8], [0.9, -46, 1.4]]) {
      const y = floorAt(x, z) + 0.02;
      const tear = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.1), crackBlack);
      tear.rotation.x = -Math.PI / 2;
      tear.position.set(x, y, z);
      this.corridor.add(tear);
      const line = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.9, 0.04), new THREE.MeshBasicMaterial({
        color: 0xff8a45, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      }));
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, y + 0.005, z);
      this.corridor.add(line);
      this.ventGlows.push(line);
    }
    this.sulfurFog = new MistField({
      count: low ? 2 : 3, center: [0, 1.6, -48], extent: [2.6, 3.6, 7], size: [2.6, 3.0],
      color: 0xb8bc83, opacity: 0.05, rise: 0.28, mode: 'billboard',
      texture: makeMistTexture(8, true),
    });
    this.corridor.add(this.sulfurFog.group);

    const poolZ = -51.5;
    const poolY = floorAt(0, poolZ) + 0.08;
    const poolGeo = new THREE.CircleGeometry(1.25, 36);
    const pp = poolGeo.attributes.position;
    for (let i = 1; i < pp.count; i++) {
      const a = Math.atan2(pp.getY(i), pp.getX(i));
      const r = 0.8 + fbm2(Math.cos(a) * 2.1, Math.sin(a) * 2.1, 3) * 0.22;
      pp.setXY(i, pp.getX(i) * r, pp.getY(i) * r);
    }
    poolGeo.computeVertexNormals();
    this.waterMat = new THREE.MeshStandardMaterial({
      color: 0x12241a, roughness: 0.14, metalness: 0.25, transparent: true, opacity: 0.86,
    });
    const water = new THREE.Mesh(poolGeo, this.waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, poolY, poolZ);
    this.corridor.add(water);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x2a322a, roughness: 0.34, metalness: 0.08, flatShading: true });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const r = 1.25 + rnd() * 0.3;
      const x = Math.cos(a) * r, z = poolZ + Math.sin(a) * r;
      const rock = new THREE.Mesh(shardGeo, rimMat);
      rock.position.set(x, floorAt(x, z) + 0.04, z);
      const s = 0.14 + rnd() * 0.22;
      rock.scale.set(s * 1.3, s * 0.55, s);
      rock.rotation.set(rnd(), rnd() * 6, rnd());
      this.corridor.add(rock);
    }

    this.hemi2 = new THREE.HemisphereLight(0x7f8871, 0x0d0e08, 1.65);
    this.corridor.add(this.hemi2);
    this.corridorAmbient = new THREE.AmbientLight(0x4c543f, 1.55);
    this.corridor.add(this.corridorAmbient);
    this.corridorDir = new THREE.DirectionalLight(0xa8b294, 1.75);
    this.corridorDir.position.set(3, 15, -22);
    this.corridorDir.target.position.set(0, 0, -44);
    this.corridor.add(this.corridorDir, this.corridorDir.target);
    this.corridorFill = new THREE.PointLight(0xb8ad8a, 45, 16, 2);
    this.corridorFill.position.set(0, 5.2, -34);
    this.corridor.add(this.corridorFill);
    this.warmLight = new THREE.PointLight(0xff8a50, 26, 10, 2);
    this.warmLight.position.set(0, 1.5, -40);
    this.corridor.add(this.warmLight);
    this.poolLight = new THREE.PointLight(0x84a082, 28, 8, 2);
    this.poolLight.position.set(0, poolY + 0.7, poolZ);
    this.corridor.add(this.poolLight);
    this.crackSpot = new THREE.SpotLight(0xa6c6cc, 200, 20, 0.34, 0.95, 1.5);
    this.crackSpot.position.set(0.1, 8.6, -34);
    this.crackSpot.target.position.set(0, 0.2, -43);
    this.corridor.add(this.crackSpot, this.crackSpot.target);
    this.corridorSideL = new THREE.DirectionalLight(0xff9e6a, 0.6);
    this.corridorSideL.position.set(-8, 4, -25);
    this.corridorSideL.target.position.set(0, 3, -45);
    this.corridor.add(this.corridorSideL, this.corridorSideL.target);
    this.corridorSideR = new THREE.DirectionalLight(0x9fc4cc, 0.6);
    this.corridorSideR.position.set(8, 6, -25);
    this.corridorSideR.target.position.set(0, 2, -45);
    this.corridor.add(this.corridorSideR, this.corridorSideR.target);
  }

  buildAtmosphere() {
    // big, fast, side-blown snow — the storm is the subject, not decoration
    this.snow = new Snowfall({
      count: this.low ? 2600 : 7200, box: [150, 72, 140], size: 1.35, color: 0xdbe8ee,
      opacity: 0.64, speed: 5.4, wind: 20.0, maxSize: 8,
    });
    this.snow.points.position.set(0, 30, 16);
    this.group.add(this.snow.points);
    // close to the lens: fat, fast flakes that sweep across the frame
    this.nearSnow = new Snowfall({
      count: this.low ? 240 : 560, box: [44, 28, 48], size: 1.6, color: 0xe2edf1,
      opacity: 0.38, speed: 6.8, wind: 26.0, maxSize: 12,
    });
    this.nearSnow.points.position.set(10, 14, 12);
    this.group.add(this.nearSnow.points);
    // horizontal streaks, two depths
    this.streaks = new SnowStreaks({
      count: this.low ? 60 : 140, box: [150, 48, 140], color: 0xcfe2e8, opacity: 0.020,
      length: [0.3, 0.9], speed: 26, fall: 8, turbulence: 3.0,
    });
    this.streaks.lines.position.set(0, 24, 14);
    this.group.add(this.streaks.lines);
    this.nearStreaks = new SnowStreaks({
      count: this.low ? 50 : 120, box: [54, 26, 52], color: 0xdfeef2, opacity: 0.06,
      length: [0.25, 0.7], speed: 32, fall: 11, turbulence: 1.2,
    });
    this.nearStreaks.lines.position.set(10, 13, 12);
    this.group.add(this.nearStreaks.lines);
    // broad snow veils crossing the frame
    this.veil = new SnowVeil({ count: this.low ? 9 : 18, box: [135, 42, 120], color: 0xdfeef2, opacity: 0.075 });
    this.veil.group.position.set(0, 14, 10);
    this.group.add(this.veil.group);
    // low spindrift on the valley floor
    this.spindrift = new SoftPuffs({
      count: this.low ? 110 : 240, box: [130, 6, 95], center: [0, 0.6, 18],
      size: 20, color: 0xd1e1e4, opacity: 0.09, rise: 0.0, blending: THREE.AdditiveBlending,
      tex: makeMistTexture(12, false),
    });
    this.group.add(this.spindrift.points);
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0x8fa8bb, 0x0a1116, 0.66);
    this.outside.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0xa9c4da, 1.05);
    this.moon.position.set(52, 92, 44);
    this.outside.add(this.moon);
    this.rim = new THREE.DirectionalLight(0x7694a8, 0.55);
    this.rim.position.set(-90, 40, -50);
    this.outside.add(this.rim);
    this.creviceFill = new THREE.PointLight(0xffb478, 26, 11, 2);
    this.creviceFill.position.set(0, 2.6, -26.2);
    this.outside.add(this.creviceFill);
    this.cliffSpot = new THREE.SpotLight(0x9fc0d0, 4200, 240, 0.6, 0.92, 1.3);
    this.cliffSpot.position.set(36, 22, 34);
    this.cliffSpot.target.position.set(-6, 22, -31);
    this.outside.add(this.cliffSpot, this.cliffSpot.target);
    // low raking light across the face: reveals the new ledges/strata/normal detail
    this.cliffRake = new THREE.SpotLight(0x8fa9b8, 3400, 190, 0.62, 0.95, 1.35);
    this.cliffRake.position.set(-78, 12, 14);
    this.cliffRake.target.position.set(2, 20, -31);
    this.outside.add(this.cliffRake, this.cliffRake.target);
    this.mouthGlowLight = new THREE.PointLight(0xffa768, 42, 15, 2);
    this.mouthGlowLight.position.set(0, 4.0, -28.8);
    this.outside.add(this.mouthGlowLight);
  }

  setNode(node) {
    this.node = node;
    const outside = node === 1;
    this.outside.visible = outside;
    this.sky.visible = outside;
    this.corridor.visible = node === 2;
    this.snow.points.visible = outside;
    this.nearSnow.points.visible = outside;
    this.streaks.lines.visible = false;
    this.nearStreaks.lines.visible = false;
    this.veil.group.visible = outside;
    this.spindrift.points.visible = outside;
    this.mouthSteam.points.visible = outside;
    this.hemi.intensity = 0.66;
    this.moon.intensity = 1.05;
    this.rim.intensity = 0.55;
    this.creviceFill.intensity = 26;
    this.cliffSpot.intensity = 4200;
    this.cliffRake.intensity = 3400;
    this.mouthGlowLight.intensity = 42;
  }

  update(t, dt, camera, node) {
    this.time = t;
    this.skyMat.uniforms.uTime.value = t;
    if (node === 1) {
      this.snow.update(t);
      this.nearSnow.update(t);
      if (this.streaks.lines.visible) this.streaks.update(t);
      this.veil.update(t);
      this.spindrift.update(t);
      this.mouthSteam.update(t);
      const flick = 0.86 + Math.sin(t * 1.7) * 0.08 + Math.sin(t * 5.3) * 0.04;
      this.mouthGlow.material.opacity = 0.40 * flick;
      this.deepGlow.material.opacity = 0.58 * flick;
      this.mouthSeam.material.opacity = 0.58 * flick;
      this.gashGlow.material.opacity = 0.46 * flick;
      this.mouthGlowLight.intensity = 42 * flick;
      this.creviceFill.intensity = 25 * flick;
      if (this.throatHeat) this.throatHeat.intensity = 82 * flick;
      if (this.heatUpper) this.heatUpper.intensity = 46 * flick;
      if (this.rimHeat) this.rimHeat.intensity = 9 * flick;
    } else {
      for (const st of this.steamEmitters) st.update(t);
      if (this.sulfurFog) this.sulfurFog.update(t, camera);
      this.poolLight.intensity = 24 + Math.sin(t * 1.1) * 4;
      this.warmLight.intensity = 22 + Math.sin(t * 2.6) * 7;
      this.ventGlows.forEach((g, i) => { g.material.opacity = 0.30 + Math.sin(t * 2.2 + i * 1.7) * 0.11; });
      this.corridorFill.intensity = 40 + Math.sin(t * 0.8) * 6;
      this.crackStrip.material.opacity = 0.24 + Math.sin(t * 1.7) * 0.05;
    }
  }
}

export { ORIGIN as VALLEY_ORIGIN };
