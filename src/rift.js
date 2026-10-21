import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise3D, createNoise2D } from 'simplex-noise';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import {
  mulberry32, makeRockTextures, makeBronzeDoorTextures, makeSkinTextures, makeBoneTexture,
  makeGlowTexture, makeMistTexture, makeEnvCube, makeTextTexture, makeFlareTexture, makeMedallionTexture, makeFlameTexture,
} from './textures.js';
import { MistField, Snowfall, DustMotes, TorchEmbers, SkinBurst } from './particles.js';

const n3 = createNoise3D(mulberry32(20205));
const n2 = createNoise2D(mulberry32(4242));

function fbm3(x, y, z, oct = 4) {
  let a = 0.5, f = 1, s = 0, norm = 0;
  for (let i = 0; i < oct; i++) { s += a * n3(x * f, y * f, z * f); norm += a; a *= 0.5; f *= 2.02; }
  return s / norm;
}
function fbm2(x, y, oct = 4) {
  let a = 0.5, f = 1, s = 0, norm = 0;
  for (let i = 0; i < oct; i++) { s += a * n2(x * f + 22, y * f); norm += a; a *= 0.5; f *= 2.03; }
  return s / norm;
}

export function riftFloorHeight(x, z) {
  const d = fbm2(x * 0.03, z * 0.03, 4) * 1.5 + fbm2(x * 0.12, z * 0.11, 2) * 0.35;
  const flatten = THREE.MathUtils.smoothstep(z, -44, -8) * 0.7 + 1.0;
  return d / flatten + THREE.MathUtils.smoothstep(z, 50, 100) * 1.6 - 0.35;
}

function makeWallGeometry(w, h, sx, sy, disp, seed = 1) {
  const g = new THREE.PlaneGeometry(w, h, sx, sy);
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const d = disp(x, y);
    pos.setZ(i, d);
    const c = 0.62 + Math.max(0, Math.min(0.38, fbm2(x * 0.03 + seed, y * 0.03, 3) * 0.3 + 0.2));
    colors[i * 3] = c * 0.94; colors[i * 3 + 1] = c * 0.97; colors[i * 3 + 2] = c;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function cloneTex(t, repeat) {
  const c = t.clone();
  c.repeat.set(repeat[0], repeat[1]);
  c.needsUpdate = true;
  return c;
}

function rockMaterial(tex, repeat = [4, 2], color = 0xffffff, bump = 1.1) {
  return new THREE.MeshStandardMaterial({
    map: cloneTex(tex.map, repeat), bumpMap: cloneTex(tex.bump, repeat), bumpScale: bump,
    roughnessMap: cloneTex(tex.roughness, repeat), roughness: 0.92, metalness: 0.04,
    color, vertexColors: true, envMapIntensity: 0.15,
  });
}

function makeBoneGeometry() {
  const shaft = new THREE.CylinderGeometry(0.052, 0.072, 0.92, 6);
  shaft.rotateZ(Math.PI / 2);
  const a = new THREE.SphereGeometry(0.09, 6, 5); a.scale(1.25, 1, 1); a.translate(0.46, 0, 0);
  const b = new THREE.SphereGeometry(0.085, 6, 5); b.scale(1.25, 1, 1); b.translate(-0.46, 0, 0);
  return mergeGeometries([shaft, a, b], false);
}

function makeSkullGeometry() {
  const skull = new THREE.SphereGeometry(0.16, 8, 6);
  skull.scale(0.86, 1, 1.1);
  const jaw = new THREE.BoxGeometry(0.17, 0.08, 0.2);
  jaw.translate(0, -0.13, 0.04);
  return mergeGeometries([skull, jaw], false);
}

function makeFigure(material) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.55, 3, 6), material);
  torso.position.y = 1.13; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), material);
  head.position.y = 1.57; g.add(head);
  const limbGeo = new THREE.CapsuleGeometry(0.055, 0.5, 2, 5);
  const legL = new THREE.Mesh(limbGeo, material); legL.position.set(-0.09, 0.38, 0); g.add(legL);
  const legR = new THREE.Mesh(limbGeo, material); legR.position.set(0.09, 0.38, 0); g.add(legR);
  const armGeo = new THREE.CapsuleGeometry(0.045, 0.46, 2, 5);
  const armL = new THREE.Mesh(armGeo, material); armL.position.set(-0.21, 1.14, 0); armL.rotation.z = 0.08; g.add(armL);
  const armR = new THREE.Mesh(armGeo, material); armR.position.set(0.21, 1.14, 0); armR.rotation.z = -0.08; g.add(armR);
  return g;
}

export class Rift {
  constructor(scene, renderer, { quality = 'high' } = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.quality = quality;
    this.low = quality === 'low';
    this.group = new THREE.Group();
    this.group.name = 'rift';
    scene.add(this.group);
    this.time = 0;
    this.open = 0;
    this.torchLevel = 0;
    this.mistLevel = 0;

    this.tex = {
      rock: makeRockTextures(12),
      rockWarm: makeRockTextures(31),
      door: makeBronzeDoorTextures(),
      skin: makeSkinTextures(),
      bone: makeBoneTexture(),
      medallion: makeMedallionTexture(),
    };
    this.envCube = makeEnvCube();

    this.buildCave();
    this.buildLights();
    this.buildDoor();
    this.buildInterior();
    this.buildBones();
    this.buildAtmosphere();
    this.buildScale();
    this.buildEpilogue();
    this.group.visible = false;
  }

  /* ---------------- cave shell ---------------- */
  buildCave() {
    const seg = this.low ? 48 : 90;
    const wallSeg = this.low ? 40 : 80;
    const rockMat = rockMaterial(this.tex.rock, [5, 2.5], 0x8f9690, 1.4);
    const rockMat2 = rockMaterial(this.tex.rock, [3, 3], 0x7d8682, 1.0);
    this.rockMat = rockMat;
    this.rockMat2 = rockMat2;

    // floor
    const floorGeo = new THREE.PlaneGeometry(210, 230, seg, seg);
    const fp = floorGeo.attributes.position;
    const fc = new Float32Array(fp.count * 3);
    for (let i = 0; i < fp.count; i++) {
      const x = fp.getX(i), z = -fp.getY(i) + 25;
      const y = riftFloorHeight(x, z) + Math.max(0, fbm2(x * 0.09, z * 0.09, 2)) * 0.28;
      fp.setZ(i, y);
      const c = 0.62 + Math.max(0, Math.min(0.38, fbm2(x * 0.05, z * 0.05, 3) * 0.3 + 0.2));
      fc[i * 3] = c; fc[i * 3 + 1] = c; fc[i * 3 + 2] = c * 1.02;
    }
    floorGeo.setAttribute('color', new THREE.BufferAttribute(fc, 3));
    floorGeo.computeVertexNormals();
    const floor = new THREE.Mesh(floorGeo, rockMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 25);
    floor.receiveShadow = true;
    this.group.add(floor);

    // side walls
    const mkWall = (x, ry, seed, width = 230, height = 95) => {
      const geo = makeWallGeometry(width, height, wallSeg, this.low ? 28 : 50, (u, v) => {
        return fbm3(u * 0.035 + seed, v * 0.045, seed * 2, 5) * 7.5
          + fbm3(u * 0.11 + seed, v * 0.13, seed, 3) * 2.4
          + Math.sin(v * 0.08 + seed) * 1.5;
      }, seed);
      const m = new THREE.Mesh(geo, rockMat2);
      m.rotation.y = ry;
      m.position.set(x, height * 0.42, 16);
      m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    mkWall(-88, Math.PI / 2, 1.5, 230);
    mkWall(88, -Math.PI / 2, 5.2, 230);

    // back wall behind the door
    const backGeo = makeWallGeometry(230, 100, wallSeg, this.low ? 28 : 50, (u, v) => {
      return fbm3(u * 0.03, v * 0.05, 8, 5) * 6 + fbm3(u * 0.1, v * 0.12, 3, 3) * 2 + 2;
    }, 3.3);
    const back = new THREE.Mesh(backGeo, rockMat2);
    back.position.set(0, 40, -69);
    this.group.add(back);
    this.backWall = back;

    // ceiling
    const ceilGeo = makeWallGeometry(220, 220, this.low ? 40 : 80, this.low ? 40 : 80, (u, v) => {
      return fbm3(u * 0.025, v * 0.03, 17, 5) * 12 + fbm3(u * 0.08, v * 0.1, 4, 3) * 4;
    }, 7.1);
    const ceil = new THREE.Mesh(ceilGeo, rockMat2);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 74, 20);
    this.group.add(ceil);

    // deep floor boulders / silhouette shards
    const boulderGeo = new THREE.IcosahedronGeometry(1, 2);
    const bp = boulderGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const r = 1 + fbm3(bp.getX(i) * 2, bp.getY(i) * 2, bp.getZ(i) * 2, 3) * 0.36;
      bp.setXYZ(i, bp.getX(i) * r, bp.getY(i) * r, bp.getZ(i) * r);
    }
    boulderGeo.computeVertexNormals();
    const boulderMat = new THREE.MeshStandardMaterial({ color: 0x2a2c2a, roughness: 0.97, metalness: 0.02, flatShading: true, map: cloneTex(this.tex.rock.map, [2, 2]) });
    const rnd = mulberry32(4949);
    this.boulders = [];
    for (let i = 0; i < 0; i++) {
      const mesh = new THREE.Mesh(boulderGeo, boulderMat);
      const side = rnd() > 0.5 ? 1 : -1;
      const x = side * (60 + rnd() * 34);
      const z = rnd() > 0.55 ? (-30 + rnd() * 30) : (50 + rnd() * 60);
      const s = 2.2 + rnd() * 6.5;
      mesh.position.set(x, riftFloorHeight(x, z) + s * 0.35, z);
      mesh.scale.set(s, s * (0.5 + rnd() * 0.7), s * (0.8 + rnd() * 0.5));
      mesh.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      this.group.add(mesh);
      this.boulders.push(mesh);
    }
    // monumental shards near the door, like fallen cliff
    for (let i = 0; i < 0; i++) {
      const sx = (i % 2 ? 1 : -1);
      const mesh = new THREE.Mesh(boulderGeo, boulderMat);
      mesh.position.set(sx * (68 + rnd() * 14), riftFloorHeight(sx * 70, -40) + 1.5, -46 + rnd() * 10);
      mesh.scale.set(4 + rnd() * 5, 7 + rnd() * 9, 4 + rnd() * 5);
      mesh.rotation.set(rnd() * 0.5, rnd() * 3, rnd() * 0.4);
      this.group.add(mesh);
    }

    // distant rock spires framing the rift (scale, silhouette)
    const spireMat = new THREE.MeshStandardMaterial({ color: 0x1b211f, roughness: 0.96, metalness: 0.02, flatShading: true });
    const spireGeo = new THREE.ConeGeometry(1, 1, 7, 4);
    const sp = spireGeo.attributes.position;
    const rndS = mulberry32(6161);
    for (let i = 0; i < sp.count; i++) {
      const y = sp.getY(i);
      sp.setX(i, sp.getX(i) * (1 + Math.sin(y * 9 + i) * 0.18));
      sp.setZ(i, sp.getZ(i) * (1 + Math.cos(y * 7 + i) * 0.2));
    }
    spireGeo.computeVertexNormals();
    const spirePositions = [
      [-58, 36, 10, 8, 26], [64, 34, 6, 9, 30], [-70, 55, 14, 7, 22],
      [74, 52, 16, 6, 20], [-44, 70, 9, 5, 15], [52, 72, 8, 5, 17],
    ];
    for (const [x, z, y, r, h] of spirePositions) {
      const spire = new THREE.Mesh(spireGeo, spireMat);
      spire.position.set(x, riftFloorHeight(x, z) + h * 0.45, z);
      spire.scale.set(r, h, r * (0.7 + rndS() * 0.5));
      spire.rotation.y = rndS() * 6;
      spire.rotation.z = (rndS() - 0.5) * 0.12;
      this.group.add(spire);
    }

    // rubble instancing
    const rubbleGeo = new THREE.DodecahedronGeometry(1, 1);
    const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x171a18, roughness: 0.98, metalness: 0.03, flatShading: true });
    const count = this.low ? 90 : 190;
    const rubble = new THREE.InstancedMesh(rubbleGeo, rubbleMat, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const x = (rnd() - 0.5) * 150;
      const z = -35 + rnd() * 140;
      const s = 0.1 + Math.pow(rnd(), 2.8) * 1.25;
      dummy.position.set(x, riftFloorHeight(x, z) + s * 0.32, z);
      dummy.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      dummy.scale.set(s, s * (0.35 + rnd() * 0.7), s * (0.7 + rnd() * 0.8));
      dummy.updateMatrix();
      rubble.setMatrixAt(i, dummy.matrix);
    }
    rubble.instanceMatrix.needsUpdate = true;
    this.group.add(rubble);

    // physical door wall — heavy dressed stone frame around the bronze
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x6a6960, map: cloneTex(this.tex.rockWarm.map, [2, 2]),
      bumpMap: cloneTex(this.tex.rockWarm.bump, [2, 2]), bumpScale: 1.2,
      roughness: 0.95, metalness: 0.04,
    });
    this.stoneMat = stoneMat;
    // dressed stone façade with a real doorway cut through it
    const fh = 43;
    const openingW = 64, openingH = 33;
    const wingW = (96 - openingW) / 2;
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(wingW, fh, 7), stoneMat);
      wing.position.set(side * (openingW / 2 + wingW / 2), fh * 0.5 - 1, -57.4);
      this.group.add(wing);
    }
    const header = new THREE.Mesh(new THREE.BoxGeometry(openingW, fh - openingH, 7), stoneMat);
    header.position.set(0, openingH + (fh - openingH) / 2 - 1, -57.4);
    this.group.add(header);
  }

  buildLights() {
    const g = this.group;
    this.hemi = new THREE.HemisphereLight(0x33454e, 0x050707, 0.55);
    g.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0x233136, 0.55);
    g.add(this.ambient);

    // cold shaft from a crack overhead
    const shaftPos = new THREE.Vector3(22, 68, 12);
    this.shaftSpot = new THREE.SpotLight(0x8fb6cc, 9000, 170, 0.34, 0.9, 1.35);
    this.shaftSpot.position.copy(shaftPos);
    this.shaftSpot.target.position.set(-2, 0, -6);
    g.add(this.shaftSpot, this.shaftSpot.target);

    // door wash — two cold rakes from the sides
    const spotL = new THREE.SpotLight(0xaac3bd, 5200, 100, 0.46, 0.8, 1.15);
    spotL.position.set(-44, 3.2, -31);
    spotL.target.position.set(0, 18, -52);
    g.add(spotL, spotL.target);
    this.doorSpotL = spotL;
    const spotR = new THREE.SpotLight(0xc2ad8b, 3200, 100, 0.5, 0.9, 1.3);
    spotR.position.set(46, 26, -22);
    spotR.target.position.set(12, 14, -52);
    g.add(spotR, spotR.target);
    this.doorSpotR = spotR;

    // low warm bounce near the threshold
    this.ghostFill = new THREE.PointLight(0x9fbdc0, 0, 55, 2);
    this.ghostFill.position.set(16, 8.5, 14);
    g.add(this.ghostFill);

    this.thresholdLight = new THREE.PointLight(0xb27d4d, 120, 42, 2);
    this.thresholdLight.position.set(0, 3, -49);
    g.add(this.thresholdLight);

    // broad cool fill near the viewing positions
    const fill = new THREE.PointLight(0x6f8d94, 260, 120, 2);
    fill.position.set(18, 22, 44);
    g.add(fill);
    this.fill = fill;

    const frameWash = new THREE.PointLight(0x7f9da0, 2500, 140, 2);
    frameWash.position.set(-6, 24, -6);
    g.add(frameWash);
    this.frameWash = frameWash;

    const lintelWash = new THREE.SpotLight(0x8fabb1, 6000, 130, 0.55, 0.9, 1.4);
    lintelWash.position.set(-4, 58, 12);
    lintelWash.target.position.set(0, 30, -55);
    g.add(lintelWash, lintelWash.target);
    this.lintelWash = lintelWash;

    const thresholdPool = new THREE.SpotLight(0xa9c9c2, 2400, 46, 0.30, 0.85, 1.4);
    thresholdPool.position.set(-18, 22, -22);
    thresholdPool.target.position.set(-17, 0.4, -45);
    g.add(thresholdPool, thresholdPool.target);
    this.thresholdPool = thresholdPool;

    const medallionFill = new THREE.PointLight(0xd8cbae, 900, 38, 2);
    medallionFill.position.set(0, 20, -38);
    g.add(medallionFill);
    this.medallionFill = medallionFill;
    const seamFill = new THREE.PointLight(0xb9c6b8, 0, 22, 2);
    seamFill.position.set(0, 15, -47.5);
    g.add(seamFill);
    this.seamFill = seamFill;
    this.medallionSpots = [];
    for (const side of [-1, 1]) {
      const s2 = new THREE.SpotLight(0xd2c8ab, 1800, 34, 0.24, 0.9, 1.3);
      s2.position.set(side * 6, 11.5, -32);
      s2.target.position.set(side * 13.6, 19, -51.4);
      g.add(s2, s2.target);
      this.medallionSpots.push(s2);
    }

    const forecourt = new THREE.SpotLight(0x8fadb0, 5000, 90, 0.46, 0.9, 1.35);
    forecourt.position.set(2, 44, 16);
    forecourt.target.position.set(2, 0, -42);
    g.add(forecourt, forecourt.target);
    this.forecourt = forecourt;

    this.pillarSpots = [];
    for (const side of [-1, 1]) {
      const p = new THREE.SpotLight(0x93b2b4, 3600, 80, 0.36, 0.9, 1.35);
      p.position.set(side * 54, 24, -6);
      p.target.position.set(side * 33, 17, -55);
      g.add(p, p.target);
      this.pillarSpots.push(p);
    }
  }

  buildDoor() {
    const g = this.group;
    const doorTex = this.tex.door;
    const doorDetailFS = `
      uniform sampler2D uHeight;
      uniform float uOffset;
      varying vec2 vUv;
      varying vec3 vWPos;
      float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
      float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y); }
      float fbm2d(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=.5;} return s; }
      void main(){
        float h = texture2D(uHeight, vec2(vUv.x*0.5 + uOffset, vUv.y)).r;
        float macro = fbm2d(vWPos.xz*0.12 + vWPos.y*0.05);
        float grain = fbm2d(vWPos.xy*1.7 + vWPos.z*0.8);
        float recess = 1.0 - smoothstep(0.18, 0.58, h);
        vec3 patina = vec3(0.085, 0.155, 0.125);
        csm_DiffuseColor.rgb = mix(csm_DiffuseColor.rgb, patina, recess*0.18 + smoothstep(0.5,0.85,macro)*0.08);
        csm_DiffuseColor.rgb *= 0.78 + 0.38*macro + 0.08*(grain-0.5);
        csm_DiffuseColor.rgb += vec3(0.055,0.045,0.03) * smoothstep(0.62,0.9,h) * smoothstep(0.55,0.2,macro);
        csm_Roughness = clamp(csm_Roughness + (macro-0.5)*0.32 + recess*0.08, 0.22, 0.96);
      }`;
    const faceMat = (offset) => {
      const map = doorTex.map.clone(); map.offset.x = offset; map.repeat.x = 0.5; map.needsUpdate = true;
      const bump = doorTex.bump.clone(); bump.offset.x = offset; bump.repeat.x = 0.5; bump.needsUpdate = true;
      const rough = doorTex.roughness.clone(); rough.offset.x = offset; rough.repeat.x = 0.5; rough.needsUpdate = true;
      const base = new THREE.MeshStandardMaterial({
        map, bumpMap: bump, bumpScale: 0.95, roughnessMap: rough,
        color: 0xc0ad8e, metalness: 0.5, roughness: 0.62,
        envMap: this.envCube, envMapIntensity: 0.55,
      });
      return new CustomShaderMaterial({
        baseMaterial: base,
        vertexShader: `varying vec2 vUv; varying vec3 vWPos; void main(){ vUv = uv; vWPos = (modelMatrix*vec4(position,1.0)).xyz; }`,
        fragmentShader: doorDetailFS,
        uniforms: { uHeight: { value: doorTex.bump }, uOffset: { value: offset } },
      });
    };
    this.doorFaceL = faceMat(0);
    this.doorFaceR = faceMat(0.5);
    const hctx = doorTex.heightCanvas.getContext('2d');
    const hdata = hctx.getImageData(0, 0, doorTex.width, doorTex.height).data;
    const sideMat = new THREE.MeshStandardMaterial({
      color: 0x2b2f26, metalness: 0.75, roughness: 0.68, envMap: this.envCube, envMapIntensity: 0.35,
    });
    this.bronzeMat = sideMat;

    const makeLeaf = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 30, 0.42, -52.75);
      const centerX = side < 0 ? 15 : -15;
      const body = new THREE.Mesh(new THREE.BoxGeometry(30, 30, 1.55), [sideMat, sideMat, sideMat, sideMat, sideMat, sideMat]);
      body.position.set(centerX, 15, 0);
      pivot.add(body);
      const seg = this.low ? 100 : 200;
      const fgeo = new THREE.PlaneGeometry(29.86, 29.86, seg, seg);
      const fp = fgeo.attributes.position;
      const fuv = fgeo.attributes.uv;
      const ox = side < 0 ? 0 : 0.5;
      for (let vi = 0; vi < fp.count; vi++) {
        const u = fuv.getX(vi), v = fuv.getY(vi);
        const px = Math.min(doorTex.width - 1, Math.floor((ox + u * 0.5) * doorTex.width));
        const py = Math.min(doorTex.height - 1, Math.floor((1 - v) * doorTex.height));
        const hv = hdata[(py * doorTex.width + px) * 4] / 255;
        fp.setZ(vi, (hv - 0.34) * 0.62);
      }
      fgeo.computeVertexNormals();
      const face = new THREE.Mesh(fgeo, side < 0 ? this.doorFaceL : this.doorFaceR);
      face.position.set(centerX, 15, 0.98);
      pivot.add(face);

      // raised cast taotie medallion, with genuine relief
      const med = this.tex.medallion;
      const mctx = med.heightCanvas.getContext('2d');
      const mdata = mctx.getImageData(0, 0, med.size, med.size).data;
      const mseg = this.low ? 70 : 150;
      const mgeo = new THREE.PlaneGeometry(9.6, 9.6, mseg, mseg);
      const mp = mgeo.attributes.position;
      const muv = mgeo.attributes.uv;
      for (let vi = 0; vi < mp.count; vi++) {
        const u = muv.getX(vi), v = muv.getY(vi);
        const px = Math.min(med.size - 1, Math.floor(u * med.size));
        const py = Math.min(med.size - 1, Math.floor((1 - v) * med.size));
        const hv = mdata[(py * med.size + px) * 4] / 255;
        mp.setZ(vi, (hv - 0.36) * 0.28);
      }
      mgeo.computeVertexNormals();
      const mbase = new THREE.MeshStandardMaterial({
        map: med.map, bumpMap: med.bump, bumpScale: 0.32, roughnessMap: med.roughness,
        color: 0xe2d4b4, metalness: 0.28, roughness: 0.48, envMap: this.envCube, envMapIntensity: 0.7,
      });
      const mmat = new CustomShaderMaterial({
        baseMaterial: mbase,
        vertexShader: `varying vec2 vUv; varying vec3 vWPos; void main(){ vUv = uv; vWPos = (modelMatrix*vec4(position,1.0)).xyz; }`,
        fragmentShader: `
          uniform sampler2D uHeight; varying vec2 vUv; varying vec3 vWPos;
          float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
          float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
          float fb(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vn(p); p*=2.03; a*=.5;} return s; }
          void main(){
            float h = texture2D(uHeight, vUv).r;
            float n = fb(vWPos.xz*0.4 + vWPos.y*0.18);
            float recess = 1.0 - smoothstep(0.2,0.6,h);
            csm_DiffuseColor.rgb = mix(csm_DiffuseColor.rgb, vec3(0.1,0.17,0.13), recess*0.1);
            csm_DiffuseColor.rgb *= 0.98 + 0.22*n;
            csm_DiffuseColor.rgb += vec3(0.06,0.05,0.03)*smoothstep(0.6,0.95,h);
            csm_Roughness = clamp(csm_Roughness + (n-0.5)*0.25, 0.2, 0.9);
          }`,
        uniforms: { uHeight: { value: med.bump } },
      });
      const medallion = new THREE.Mesh(mgeo, mmat);
      const mx = centerX + (side < 0 ? 1.4 : -1.4);
      medallion.position.set(mx, 19.0, 1.92);
      pivot.add(medallion);
      const mframeMat = new THREE.MeshStandardMaterial({ color: 0x71603f, metalness: 0.72, roughness: 0.46, envMap: this.envCube, envMapIntensity: 0.55 });
      const mf = (w, hh, x, y) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, 0.26), mframeMat);
        m.position.set(mx + x, 19.0 + y, 1.94); pivot.add(m);
      };
      mf(10.3, 0.36, 0, 4.85);
      mf(10.3, 0.36, 0, -4.85);
      mf(0.36, 10.0, -4.97, 0);
      mf(0.36, 10.0, 4.97, 0);
      // cast frame ribs, made as a single heavy border
      const ribMat = new THREE.MeshStandardMaterial({ color: 0x4a4a36, metalness: 0.8, roughness: 0.52, envMap: this.envCube, envMapIntensity: 0.4 });
      const addRib = (w, h, d, x, y, z) => {
        const r = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), ribMat);
        r.position.set(centerX + x, y, z);
        pivot.add(r);
      };
      addRib(29.9, 0.7, 0.34, 0, 0.65, 0.9);
      addRib(29.9, 0.7, 0.34, 0, 29.35, 0.9);
      addRib(0.7, 30, 0.34, -14.6, 15, 0.9);
      addRib(0.7, 30, 0.34, 14.6, 15, 0.9);
      // horizontal casting ribs aligned to the registers of the texture
      addRib(29.9, 0.24, 0.22, 0, 16.7, 0.86);
      addRib(29.9, 0.18, 0.2, 0, 8.1, 0.85);
      addRib(29.9, 0.16, 0.2, 0, 4.7, 0.85);
      // door studs
      const studGeo = new THREE.SphereGeometry(0.26, 6, 5);
      const studMat = new THREE.MeshStandardMaterial({ color: 0x7c6a45, metalness: 0.9, roughness: 0.35, envMap: this.envCube, envMapIntensity: 0.5 });
      const studs = new THREE.InstancedMesh(studGeo, studMat, 56);
      const d = new THREE.Object3D();
      let k = 0;
      for (let row = 0; row < 4; row++) {
        for (let i = 0; i < 14; i++) {
          const x = -14 + i * 2.16;
          const y = [1.1, 3.1, 27.2, 28.9][row];
          d.position.set(centerX + x, y, 1.0);
          d.updateMatrix(); studs.setMatrixAt(k++, d.matrix);
        }
      }
      studs.instanceMatrix.needsUpdate = true;
      pivot.add(studs);
      // hinge barrels on the outside edge
      const hingeMat = new THREE.MeshStandardMaterial({ color: 0x1e211d, metalness: 0.75, roughness: 0.6 });
      for (const y of [4, 15, 26]) {
        const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.4, 10), hingeMat);
        hinge.position.set(-side * 15.2, y, 0.4);
        hinge.rotation.z = 0;
        pivot.add(hinge);
      }
      this.group.add(pivot);
      return pivot;
    };
    this.leafL = makeLeaf(-1);
    this.leafR = makeLeaf(1);

    // dressed stone frame: pillars, lintel, thresholds and layered mouldings
    const frame = new THREE.Group();
    const sm = this.stoneMat;
    const addStone = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), sm);
      m.position.set(x, y, z); frame.add(m);
    };
    addStone(6.2, 41, 8.5, -33.4, 20, -56.3);
    addStone(6.2, 41, 8.5, 33.4, 20, -56.3);
    addStone(73, 6.8, 9, 0, 36.6, -56.3);
    addStone(66, 1.6, 9.2, 0, 33.1, -56.1);
    addStone(66, 1.2, 8.4, 0, 0.1, -54.8);
    // vertical fluting / recesses
    for (const sx of [-1, 1]) {
      addStone(1.1, 34, 0.4, sx * 30.6, 17, -51.6);
      addStone(2.8, 0.7, 0.7, sx * 30.6, 33.8, -51.6);
      addStone(2.8, 0.3, 0.7, sx * 30.6, 11, -51.6);
      addStone(2.8, 0.3, 0.7, sx * 30.6, 23, -51.6);
    }
    // lintel glyph band
    const glyphBand = new THREE.Mesh(new THREE.BoxGeometry(58, 2.2, 0.6), this.stoneMat);
    glyphBand.position.set(0, 35.4, -51.7);
    frame.add(glyphBand);
    // corbels around frame
    for (let i = 0; i < 6; i++) {
      addStone(1.4, 1.2, 2.6, -25 + i * 10, 32.6, -51.9);
    }
    frame.position.z = 0.7;
    this.group.add(frame);
    this.frame = frame;

    // darkness seam + seals
    this.sealGroup = new THREE.Group();
    this.buildSkinSeals();
    this.group.add(this.sealGroup);

    // shadow gap at threshold
    const gapGlow = new THREE.Mesh(new THREE.PlaneGeometry(9, 29), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.85, depthWrite: false }));
    gapGlow.position.set(0, 15.5, -51.72);
    this.gapGlow = gapGlow;
    this.group.add(gapGlow);

    // A black depth plane behind the seam so the opened gap reads as darkness,
    // with its own small fires just inside the crack.
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x020202, fog: false });
    this.gapVoid = new THREE.Mesh(new THREE.PlaneGeometry(26, 30), voidMat);
    this.gapVoid.position.set(0, 15, -51.9);
    this.gapVoid.visible = false;
    this.group.add(this.gapVoid);
    this.gapFires = [];
    this.gapFireLights = [];
    const fireTex = makeFlameTexture();
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Sprite(new THREE.SpriteMaterial({
        map: fireTex, color: i % 2 ? 0xffb066 : 0xff8d45, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, fog: false,
      }));
      f.position.set([-3.7, -1.2, 1.4, 3.8][i], [3.0, 4.8, 7.4, 10.4][i], -51.2);
      f.scale.set(1.5 + i * 0.22, 3.2 + i * 0.5, 1);
      this.group.add(f);
      this.gapFires.push(f);
    }
    for (const x of [-1.8, 2.0]) {
      const l = new THREE.PointLight(0xff9a55, 0, 22, 2);
      l.position.set(x, 5.2, -50.8);
      this.group.add(l);
      this.gapFireLights.push(l);
    }

    // door audio visual dust on the threshold
    this.doorDust = new DustMotes({ count: this.low ? 100 : 220, box: [50, 22, 40], size: 1, color: 0xaec0bc, opacity: 0.28 });
    this.doorDust.points.position.set(0, 8, -36);
    this.group.add(this.doorDust.points);
  }

  buildSkinSeals() {
    const rnd = mulberry32(9091);
    const baseMat = (off, tint) => {
      const map = this.tex.skin.map.clone(); map.offset.set(off, 0); map.needsUpdate = true;
      const bump = this.tex.skin.bump.clone(); bump.offset.set(off, 0); bump.needsUpdate = true;
      return new THREE.MeshStandardMaterial({
        map, bumpMap: bump, bumpScale: 0.3, color: tint, roughness: 0.86, metalness: 0.02,
        side: THREE.DoubleSide,
      });
    };
    const mats = [baseMat(0, 0x5f6b60), baseMat(0.31, 0x4d584f), baseMat(0.63, 0x69736a)];
    // continuous frozen-skin backing so the seal reads as one petrified sheet
    const backingGeo = new THREE.PlaneGeometry(4.1, 29.2, 16, 56);
    const bp = backingGeo.attributes.position;
    const brnd = mulberry32(7788);
    for (let v = 0; v < bp.count; v++) {
      const x = bp.getX(v), y = bp.getY(v);
      bp.setZ(v, Math.sin(y * 2.2 + x * 1.7) * 0.06 + (brnd() - 0.5) * 0.04);
      const edge = Math.min(2.05 - Math.abs(x), 14.6 - Math.abs(y));
      if (edge < 0.35) {
        bp.setX(v, x + (brnd() - 0.5) * 0.18);
        bp.setY(v, y + (brnd() - 0.5) * 0.22);
      }
    }
    backingGeo.computeVertexNormals();
    const backingMat = new THREE.MeshStandardMaterial({
      map: this.tex.skin.map, bumpMap: this.tex.skin.bump, bumpScale: 0.28,
      color: 0x9aa79c, roughness: 0.9, metalness: 0.0, emissive: 0x0a0e0b, emissiveIntensity: 0.6,
      side: THREE.DoubleSide,
    });
    const backing = new THREE.Mesh(backingGeo, backingMat);
    backing.position.set(0, 15, -51.58);
    this.sealGroup.add(backing);
    const buckets = [[], [], []];
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const w = 2.2 + rnd() * 1.6;
      const h = 1.5 + rnd() * 2.6;
      const geo = new THREE.PlaneGeometry(w, h, 7, 10);
      const p = geo.attributes.position;
      const seed = rnd() * 50;
      for (let v = 0; v < p.count; v++) {
        const x = p.getX(v), y = p.getY(v);
        const edge = Math.min(
          (x / w + 0.5), (0.5 - x / w), (y / h + 0.5), (0.5 - y / h)
        );
        if (edge < 0.14) {
          p.setX(v, x + (rnd() - 0.5) * w * 0.16);
          p.setY(v, y + (rnd() - 0.5) * h * 0.16);
        }
        p.setZ(v, Math.sin(x * 2.4 + seed) * 0.055 + Math.cos(y * 3.1 + seed * 1.7) * 0.035 + (rnd() - 0.5) * 0.035);
      }
      geo.computeVertexNormals();
      const y = 0.9 + (i / 26) * 27.6 + (rnd() - 0.5) * 1.2;
      const x = side * (0.35 + rnd() * 0.75);
      const m = new THREE.Mesh(geo, mats[i % 3]);
      m.position.set(x, y, 1.07 + rnd() * 0.06);
      m.rotation.z = (rnd() - 0.5) * 0.12;
      m.rotation.y = (rnd() - 0.5) * 0.05;
      // door is at -52.75; local z is +1.07 from front. Mesh is in world space, so add door plane z
      m.position.z = -51.62 + rnd() * 0.08;
      // patches are placed in the seal group (world coordinates)
      this.sealGroup.add(m);
      // merge-friendly buckets unused for now
    }
    // long frozen drips down the seam
    const dripMat = new THREE.MeshStandardMaterial({ color: 0x4b3a30, roughness: 0.9 });
    for (let i = 0; i < 16; i++) {
      const h = 0.5 + rnd() * 3;
      const drip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.01, h, 4), dripMat);
      drip.position.set((rnd() - 0.5) * 4.2, 3 + rnd() * 26, -51.55);
      this.sealGroup.add(drip);
    }
    // frozen blood staining over the skins
    const bloodTex = makeGlowTexture(1.1);
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.25 + rnd() * 0.9, 0.5 + rnd() * 2.2), new THREE.MeshBasicMaterial({
        map: bloodTex, color: i % 3 ? 0x2a0c09 : 0x3d120d, transparent: true,
        opacity: 0.4 + rnd() * 0.4, depthWrite: false, blending: THREE.NormalBlending,
      }));
      m.position.set((rnd() - 0.5) * 3.8, 1 + rnd() * 27, -51.5);
      m.rotation.z = (rnd() - 0.5) * 0.2;
      this.sealGroup.add(m);
    }
    // icy staples
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xd2e2e2, roughness: 0.2, metalness: 0.05, transparent: true, opacity: 0.7 });
    for (let i = 0; i < 30; i++) {
      const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.06 + rnd() * 0.16, 0), iceMat);
      s.position.set((rnd() - 0.5) * 4.4, 1 + rnd() * 28, -51.4);
      s.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6);
      this.sealGroup.add(s);
    }
    this.skinBurst = new SkinBurst(this.group, new THREE.Vector3(0, 15, -51.3));
  }

  buildInterior() {
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x030404, roughness: 1, metalness: 0.0 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(62, 34, 1), dark);
    back.position.set(0, 16.5, -92); g.add(back);
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(1, 34, 44), dark);
    sideL.position.set(-30, 16.5, -70); g.add(sideL);
    const sideR = sideL.clone(); sideR.position.x = 30; g.add(sideR);
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(62, 1, 44), dark);
    ceiling.position.set(0, 29.8, -70); g.add(ceiling);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(62, 1, 44), dark);
    floor.position.set(0, 0.2, -70); g.add(floor);
    g.visible = true;
    this.group.add(g);
    this.interior = g;

    // torches inside the dark, only firelight is visible through the gap
    this.torches = [];
    const flameTex = makeGlowTexture(1.5);
    const flameRnd = mulberry32(713);
    const positions = [
      [-9.2, 4.2, -63], [9.4, 5.0, -63.5], [-10.4, 10.0, -70], [10.2, 11.0, -70], [-3.0, 15.5, -80], [3.6, 16.5, -82],
    ];
    for (let i = 0; i < positions.length; i++) {
      const [x, y, z] = positions[i];
      const sMat = new THREE.SpriteMaterial({
        map: makeFlareTexture(), color: i % 2 ? 0xffa04e : 0xffbf72, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
      });
      const sprite = new THREE.Sprite(sMat);
      sprite.position.set(x, y, z);
      sprite.scale.setScalar(2.4 + flameRnd() * 2);
      sprite.visible = false;
      this.group.add(sprite);
      this.torches.push({ sprite, base: 1, phase: flameRnd() * 10, mat: sMat, x, y, z });
      if (i < 4) {
        const l = new THREE.PointLight(0xff9a4a, 0, 26, 2);
        l.position.set(x, y, z);
        this.group.add(l);
        this.torches[this.torches.length - 1].light = l;
      }
    }
    // warm spill plane that only appears in the crack
    const spillMat = new THREE.MeshBasicMaterial({ color: 0xff9a52, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 28), spillMat);
    spill.position.set(0, 15.2, -52.1);
    this.group.add(spill);
    this.spill = spill;
    this.spillMat = spillMat;

    this.embers = new TorchEmbers({ count: 100, center: [0, 2, -57], spread: 13, color: 0xff9150 });
    const fireGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(1.5), color: 0xffa25c, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    fireGlow.position.set(0, 6, -60);
    fireGlow.scale.set(16, 18, 1);
    this.group.add(fireGlow);
    this.fireGlow = fireGlow;
    this.group.add(this.embers.points);
  }

  buildBones() {
    const boneMat = new THREE.MeshStandardMaterial({
      color: 0x9d9888, map: this.tex.bone.map, roughness: 0.93, metalness: 0.02,
    });
    const boneGeo = makeBoneGeometry();
    const skullGeo = makeSkullGeometry();
    const ribGeo = new THREE.TorusGeometry(0.42, 0.038, 4, 8, Math.PI * 1.25);
    const rnd = mulberry32(8821);
    const N = this.low ? 150 : 330;
    const bones = new THREE.InstancedMesh(boneGeo, boneMat, N);
    const d = new THREE.Object3D();
    for (let i = 0; i < N; i++) {
      const cluster = i % 6;
      const cx = [-38, 34, -12, 48, -55, 8][cluster];
      const cz = [22, 36, 55, 62, -8, 75][cluster];
      const x = cx + (rnd() - 0.5) * 26;
      const z = cz + (rnd() - 0.5) * 24;
      d.position.set(x, riftFloorHeight(x, z) + 0.08, z);
      d.rotation.set(rnd() * 0.8, rnd() * 6, rnd() * 0.8);
      const s = 0.8 + rnd() * 1.1;
      d.scale.set(s, s, s);
      d.updateMatrix();
      bones.setMatrixAt(i, d.matrix);
    }
    bones.instanceMatrix.needsUpdate = true;
    this.group.add(bones);

    const skullN = this.low ? 16 : 38;
    const skulls = new THREE.InstancedMesh(skullGeo, boneMat, skullN);
    for (let i = 0; i < skullN; i++) {
      const x = (rnd() - 0.5) * 110, z = -20 + rnd() * 110;
      d.position.set(x, riftFloorHeight(x, z) + 0.16, z);
      d.rotation.set(rnd() * 0.6, rnd() * 6, rnd() * 0.6);
      const s = 0.9 + rnd() * 0.7;
      d.scale.set(s, s, s);
      d.updateMatrix(); skulls.setMatrixAt(i, d.matrix);
    }
    skulls.instanceMatrix.needsUpdate = true;
    this.group.add(skulls);

    const ribN = 46;
    const ribs = new THREE.InstancedMesh(ribGeo, boneMat, ribN);
    for (let i = 0; i < ribN; i++) {
      const x = (rnd() - 0.5) * 90, z = -20 + rnd() * 100;
      d.position.set(x, riftFloorHeight(x, z) + 0.22, z);
      d.rotation.set(Math.PI / 2 + (rnd() - 0.5) * 0.5, rnd() * 6, rnd() * 0.3);
      const s = 0.7 + rnd() * 0.8;
      d.scale.set(s, s, s); d.updateMatrix();
      ribs.setMatrixAt(i, d.matrix);
    }
    ribs.instanceMatrix.needsUpdate = true;
    this.group.add(ribs);
  }

  buildAtmosphere() {
    // pale blue mist rising out of the door crack
    this.doorMist = new MistField({
      count: this.low ? 12 : 20, center: [0, 8, -44], extent: [20, 27, 14],
      size: [8, 15], color: 0x8ec4d2, opacity: 0.145, rise: 1.35, mode: 'billboard',
      texture: makeMistTexture(9, true),
    });
    this.group.add(this.doorMist.group);
    this.doorMist.setIntensity(0);

    this.gapMistGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(2.0), color: 0x8ecbdd, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    this.gapMistGlow.position.set(0, 11, -47);
    this.gapMistGlow.scale.set(34, 36, 1);
    this.group.add(this.gapMistGlow);

    // wide low fog across the rift floor
    this.groundMist = new MistField({
      count: this.low ? 8 : 14, center: [0, 1.6, 18], extent: [140, 5, 150],
      size: [34, 24], color: 0x5e7f83, opacity: 0.07, rise: 0.10, mode: 'ground',
      blending: THREE.NormalBlending,
    });
    this.group.add(this.groundMist.group);

    // dust in the beam and around the camera
    this.dust = new DustMotes({ count: this.low ? 140 : 320, box: [50, 26, 60], size: 1.0, color: 0x9ab4b0, opacity: 0.34 });
    this.dust.points.position.set(6, 12, -8);
    this.group.add(this.dust.points);

    // volumetric god-shaft geometry
    const shaftGeo = new THREE.CylinderGeometry(4.0, 24, 72, 22, 1, true);
    this.shaftMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.055 }, uColor: { value: new THREE.Color(0x8fb8c6) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float uTime, uOpacity; uniform vec3 uColor; varying vec2 vUv;
        void main(){
          float edge = smoothstep(0.0,0.18,vUv.x)*smoothstep(1.0,0.82,vUv.x);
          float beam = smoothstep(0.0,0.25,vUv.y)*smoothstep(1.0,0.6,vUv.y);
          float n = 0.7+0.3*sin(vUv.y*13.0-uTime*0.25+sin(vUv.x*18.0)*2.0);
          float a = edge*beam*n*uOpacity;
          gl_FragColor = vec4(uColor, a);
        }`,
    });
    const shaft = new THREE.Mesh(shaftGeo, this.shaftMat);
    shaft.position.set(14, 35, 6);
    shaft.rotation.z = -0.16; shaft.rotation.x = 0.05;
    shaft.visible = false;
    this.group.add(shaft);
    this.shaft = shaft;

    const crackGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(2.2), color: 0x9fc8d4, transparent: true, opacity: 0.45,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    crackGlow.position.set(24, 70, 10);
    crackGlow.scale.set(20, 12, 1);
    this.group.add(crackGlow);

    // gentle snow drifting down into the rift for the 2015 epilogue
    this.snow = new Snowfall({ count: this.low ? 500 : 1600, box: [80, 55, 110], size: 1.0, color: 0xd4e3e6, opacity: 0.5, speed: 1.3, wind: 1.3 });
    this.snow.points.position.set(0, 30, -12);
    this.snow.points.visible = false;
    this.group.add(this.snow.points);

    this.mistLevel = 0;
  }

  buildScale() {
    const g = new THREE.Group();
    g.visible = false;
    this.scaleGroup = g;
    const lineMat = new THREE.LineBasicMaterial({ color: 0x9fc7b8, transparent: true, opacity: 0.45, depthTest: false });
    const mkLine = (pts) => {
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const l = new THREE.Line(geo, lineMat);
      l.renderOrder = 20;
      g.add(l);
    };
    mkLine([new THREE.Vector3(-35, 0.5, -50.5), new THREE.Vector3(-35, 30.5, -50.5)]);
    mkLine([new THREE.Vector3(-35.8, 30.5, -50.5), new THREE.Vector3(-34.2, 30.5, -50.5)]);
    mkLine([new THREE.Vector3(-35.8, 0.5, -50.5), new THREE.Vector3(-34.2, 0.5, -50.5)]);
    mkLine([new THREE.Vector3(-21.4, 0.4, -44.6), new THREE.Vector3(-21.4, 2.2, -44.6)]);
    mkLine([new THREE.Vector3(-21.9, 0.4, -44.6), new THREE.Vector3(-20.9, 0.4, -44.6)]);
    mkLine([new THREE.Vector3(-21.9, 2.2, -44.6), new THREE.Vector3(-20.9, 2.2, -44.6)]);
    const label = (text, x, y, z, scale = 4.6) => {
      const tex = makeTextTexture(text, { w: 512, h: 128, font: '500 64px serif', color: '#bcd6c9' });
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.75, depthTest: false, fog: false }));
      s.position.set(x, y, z); s.scale.set(scale, scale / 4, 1); s.renderOrder = 21;
      g.add(s);
    };
    label('30 m', -31.8, 24, -50.5, 4.2);
    label('60 m', 3, -2.2, -45.5, 5.0);
    label('1.75 m', -20.2, 1.35, -44.4, 3.0);
    const mat = new THREE.MeshBasicMaterial({ color: 0x050807, fog: true });
    const figure = makeFigure(mat);
    figure.position.set(-20.2, riftFloorHeight(-20.2, -45) + 0.02, -45);
    figure.scale.setScalar(1.04);
    g.add(figure);
    // faint pool of light so the silhouette reads against the bronze
    const poolTex = makeGlowTexture(2.6);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({
      map: poolTex, color: 0x9fc3b8, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(-20.2, riftFloorHeight(-20.2, -45) + 0.03, -45);
    g.add(pool);
    this.group.add(g);
  }

  buildEpilogue() {
    const g = new THREE.Group();
    g.visible = false;
    this.epilogueGroup = g;
    const mat = new THREE.MeshBasicMaterial({ color: 0x040707, fog: true });
    const a = makeFigure(mat);
    a.position.set(-9.0, 0.02, -44.2);
    a.rotation.y = 0.45;
    g.add(a);
    const b = makeFigure(mat);
    b.position.set(-5.8, 0.02, -44.6);
    b.rotation.y = -0.35;
    g.add(b);
    const c = makeFigure(mat);
    c.position.set(1.2, 0.02, -49.7);
    c.rotation.y = 0.15;
    g.add(c);
    const rim = new THREE.SpotLight(0xa9c8d4, 900, 28, 0.34, 0.9, 1.4);
    rim.position.set(-4, 18, 2);
    rim.target.position.set(-7.5, 1, -45);
    g.add(rim, rim.target);
    this.epilogueRim = rim;
    const back = new THREE.PointLight(0xffa363, 200, 14, 2);
    back.position.set(0, 4, -56);
    g.add(back);
    // a thin pale light from above, snow drifting through it
    const epiSnow = new Snowfall({ count: this.low ? 400 : 1100, box: [55, 50, 70], size: 1.0, color: 0xdde9ea, opacity: 0.55, speed: 0.9, wind: 0.8 });
    epiSnow.points.position.set(0, 28, -20);
    epiSnow.setPixelRatio(1);
    g.add(epiSnow.points);
    this.epiSnow = epiSnow;
    this.group.add(g);
  }

  /* ---------------- state ---------------- */
  setDoorOpen(k) {
    this.open = k;
    const ang = THREE.MathUtils.degToRad(2.7) * k;
    const slide = k * 7.4;
    this.leafL.position.x = -30 - slide;
    this.leafR.position.x = 30 + slide;
    this.leafL.rotation.y = -ang;
    this.leafR.rotation.y = ang;
    this.gapGlow.visible = false;
    this.gapVoid.visible = k > 0.015;
    this.spillMat.opacity = Math.min(0.22, k * 0.22);
  }
  setSkinVisible(v) { this.sealGroup.visible = v; }
  setTorchLevel(k) {
    this.torchLevel = k;
    for (const t of this.torches) {
      t.mat.opacity = k * (0.65 + 0.35 * Math.sin(this.time * 9 + t.phase));
      if (t.light) t.light.intensity = k * (210 + 90 * Math.sin(this.time * 11 + t.phase) + 45 * Math.sin(this.time * 23 + t.phase * 2));
    }
    this.embers.material.uniforms.uOpacity.value = k * 0.85;
    if (this.fireGlow) this.fireGlow.material.opacity = 0;
    if (this.gapFires) this.gapFires.forEach((f, i) => { f.material.opacity = k * (0.6 + 0.25 * Math.sin(this.time * 9 + i * 2.1)); });
    if (this.gapFireLights) this.gapFireLights.forEach((l, i) => { l.intensity = k * (140 + 40 * Math.sin(this.time * 11 + i * 2.4)); });
    this.thresholdLight.intensity = 120 + k * 200;
  }
  setMistLevel(k) {
    this.mistLevel = k;
    this.doorMist.setIntensity(Math.min(1, k * 1.7));
    this.doorMist.group.visible = k > 0.01;
    if (this.gapMistGlow) this.gapMistGlow.material.opacity = k * 0.28;
  }
  setScaleVisible(v) { this.scaleGroup.visible = v; }
  setEpilogue(v) {
    this.epilogueGroup.visible = v;
    this.epiSnow.points.visible = v;
    this.snow.points.visible = false;
    this.setTorchLevel(v ? 0.8 : 0);
    this.setDoorOpen(v ? 0.32 : 0);
    this.setMistLevel(v ? 0.18 : 0);
    this.setSkinVisible(!v);
  }
  burstSkins() {
    this.skinBurst.burst();
  }
  update(t, dt, camera, { flare = 0 } = {}) {
    this.time = t;
    this.doorMist.update(t, camera);
    this.groundMist.update(t, camera);
    this.dust.update(t);
    this.embers.update(t);
    this.skinBurst.update(dt);
    this.doorDust.update(t);
    this.shaftMat.uniforms.uTime.value = t;
    // torch flicker
    if (this.torchLevel > 0.01) {
      for (const tr of this.torches) {
        const flick = 0.72 + 0.28 * Math.sin(t * 13 + tr.phase) * Math.sin(t * 7.1 + tr.phase * 2);
        tr.mat.opacity = this.torchLevel * flick;
        tr.sprite.scale.setScalar((2.4 + Math.sin(t * 9 + tr.phase) * 0.5) * (0.7 + this.torchLevel * 0.3));
        if (tr.light) tr.light.intensity = this.torchLevel * 320 * flick;
      }
    }
    // tiny ember drift near the threshold
    this.embers.points.position.y = 2 + Math.sin(t * 0.2) * 0.3;
    if (this.snow.points.visible) this.snow.update(t);
    if (this.epilogueGroup.visible) {
      this.epilogueGroup.children.forEach((c, i) => {
        if (c.isGroup) c.position.y = 0.02 + Math.sin(t * 0.6 + i * 2) * 0.012;
      });
      this.epiSnow.update(t);
    }
  }
}
