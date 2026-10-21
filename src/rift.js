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
  // v3: genuinely broken black volcanic floor — ridged noise, sharp steps and
  // a fine broken crust. The central approach is only partly levelled, so the
  // 3B camera is always standing on rubble, never on a flat plane.
  const macro = fbm2(x * 0.015, z * 0.014, 4) * 4.2;
  const ridged = Math.pow(1 - Math.abs(fbm2(x * 0.046 + 7.3, z * 0.043, 4)), 1.7) * 4.2;
  const peaks = Math.abs(fbm2(x * 0.115, z * 0.105, 3)) * 2.6;
  const detail = fbm2(x * 0.36, z * 0.34, 2) * 0.72
    + Math.abs(fbm2(x * 0.78, z * 0.72, 2)) * 0.4;
  let h = macro + ridged * 0.72 + peaks + detail;
  const terrace = (fbm2(x * 0.062 + 3.7, z * 0.06, 3) + 1) * 3.0;
  h += (Math.floor(terrace) / 3.0 - 1.0) * 1.0;
  // a narrow walkable trace toward the door, still visibly lumpy
  const path = Math.exp(-Math.pow(x / 7.8, 2)) * (1 - THREE.MathUtils.smoothstep(z, 50, 88));
  h = THREE.MathUtils.lerp(h, h * 0.55 + 0.35, path * 0.7);
  // the valley rises toward both side walls
  const side = THREE.MathUtils.smoothstep(Math.abs(x), 52, 95);
  h += side * (3.0 + fbm2(x * 0.02, z * 0.03, 3) * 2.8);
  h += THREE.MathUtils.smoothstep(z, 55, 105) * 2.2;
  return h - 0.32;
}

// bone drifts, used to stack bones on top of the lava blocks
const BONE_HEAPS = [
  [-13, -18, 9.5, 2.3], [9, -36, 12.5, 1.9], [-6, -46, 8.0, 1.4],
  [21, 9, 13.0, 2.1], [-27, 28, 12.0, 1.8], [5, 56, 15.0, 1.6],
  [13, 21, 8.0, 1.15], [-2, 4, 7.0, 0.9], [36, -8, 10.0, 1.3],
  [10, 28, 7.5, 0.9], [-14, 12, 9.0, 1.1], [7, -44, 7.0, 1.0],
  [-34, -4, 11.0, 1.5], [31, 34, 12.0, 1.6], [-24, 52, 14.0, 1.4],
  [45, 14, 13.0, 1.2], [-48, 24, 12.0, 1.1], [18, -22, 9.0, 1.3],
  [-40, -26, 10.0, 1.2], [27, 66, 13.0, 1.2], [-15, 72, 12.0, 1.0],
];
function bonePile(x, z) {
  let pile = 0;
  for (const [cx, cz, r, h] of BONE_HEAPS) {
    const d = Math.hypot(x - cx, z - cz);
    if (d < r) pile = Math.max(pile, h * Math.pow(1 - d / r, 1.45));
  }
  return pile;
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
    normalMap: cloneTex(tex.normal, repeat), normalScale: new THREE.Vector2(1.25, 1.25),
    roughnessMap: cloneTex(tex.roughness, repeat), roughness: 0.92, metalness: 0.04,
    color, vertexColors: true, envMapIntensity: 0.15,
  });
}

function makeBoneGeometry() {
  const shaft = new THREE.CylinderGeometry(0.052, 0.072, 0.92, 5);
  shaft.rotateZ(Math.PI / 2);
  const a = new THREE.SphereGeometry(0.09, 5, 4); a.scale(1.25, 1, 1); a.translate(0.46, 0, 0);
  const b = new THREE.SphereGeometry(0.085, 5, 4); b.scale(1.25, 1, 1); b.translate(-0.46, 0, 0);
  return mergeGeometries([shaft, a, b], false);
}

function makeSkullGeometry() {
  const skull = new THREE.SphereGeometry(0.16, 7, 5);
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
    this.buildRockField();
    this.buildLights();
    this.buildDoor();
    this.buildPortalFrame();
    this.buildDoorCliff();
    this.buildInterior();
    this.buildChains();
    this.buildBones();
    this.buildAtmosphere();
    this.buildScale();
    this.buildEpilogue();
    this.group.visible = false;
  }

  /* ---------------- cave shell ---------------- */
  buildCave() {
    const seg = this.low ? 110 : 240;
    const wallSeg = this.low ? 40 : 80;
    const rockMat = rockMaterial(this.tex.rock, [5, 2.5], 0x4b524d, 1.7);
    rockMat.flatShading = true;
    const rockMat2 = rockMaterial(this.tex.rock, [3, 3], 0x444c48, 1.35);
    rockMat2.flatShading = true;
    this.rockMat = rockMat;
    this.rockMat2 = rockMat2;

    // floor — dense enough to hold the ridged/steps field, flat shaded so the
    // 240-segment displacement reads as broken slabs rather than a smooth hill
    const floorMat = rockMaterial(this.tex.rock, [9, 9], 0x252b27, 2.4);
    floorMat.flatShading = true;
    floorMat.color.setHex(0x2b302c);
    floorMat.normalScale.set(1.7, 1.7);
    this.floorMat = floorMat;
    const floorGeo = new THREE.PlaneGeometry(230, 250, seg, seg);
    const fp = floorGeo.attributes.position;
    const fc = new Float32Array(fp.count * 3);
    for (let i = 0; i < fp.count; i++) {
      const x = fp.getX(i), z = -fp.getY(i) + 25;
      const y = riftFloorHeight(x, z);
      fp.setZ(i, y);
      const n = fbm2(x * 0.06, z * 0.055, 3) * 0.5 + 0.5;
      const c = 0.16 + n * 0.22;
      fc[i * 3] = c * 0.88; fc[i * 3 + 1] = c * 0.96; fc[i * 3 + 2] = c;
    }
    floorGeo.setAttribute('color', new THREE.BufferAttribute(fc, 3));
    floorGeo.computeVertexNormals();
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 25);
    floor.receiveShadow = true;
    this.group.add(floor);
    this.floor = floor;

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

    // the door wall is now a rough volcanic cliff (built in buildDoorCliff)
    this.stoneMat = new THREE.MeshStandardMaterial({
      color: 0x3d423c, map: cloneTex(this.tex.rockWarm.map, [2, 2]),
      bumpMap: cloneTex(this.tex.rockWarm.bump, [2, 2]), bumpScale: 1.7,
      roughness: 0.97, metalness: 0.03, flatShading: true,
    });
  }

  buildRockField() {
    const rnd = mulberry32(12987);
    const rough = (geo, amt = 0.42) => {
      const g = geo.index ? geo.toNonIndexed() : geo;
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const r = 1 + fbm3(x * 2.1, y * 2.1, z * 2.1, 2) * amt;
        p.setXYZ(i, x * r, y * r * 0.8, z * r);
      }
      g.computeVertexNormals();
      return g;
    };
    // five angular families so the field never repeats visibly
    const geos = [
      rough(new THREE.DodecahedronGeometry(1, 0)),
      new THREE.TetrahedronGeometry(1, 0),
      rough(new THREE.IcosahedronGeometry(1, 0)),
      rough(new THREE.OctahedronGeometry(1, 0), 0.55),
      new THREE.ConeGeometry(1, 1.5, 5, 1),
    ];
    const mat = new THREE.MeshStandardMaterial({
      color: 0x9aa39d, map: cloneTex(this.tex.rock.map, [1.6, 1.6]),
      bumpMap: cloneTex(this.tex.rock.bump, [1.6, 1.6]), bumpScale: 1.6,
      normalMap: cloneTex(this.tex.rock.normal, [1.6, 1.6]),
      normalScale: new THREE.Vector2(1.5, 1.5),
      roughness: 0.97, metalness: 0.03, flatShading: true,
    });
    this.lavaMat = mat;
    // keep authored camera positions clear of large boulders
    const safeZones = [
      [17, 38, 9], [5, 30, 9], [19, 25, 9], [15, 20, 8], [29, 24, 8],
      [34, 34, 8], [11, 16, 9], [-12, -14, 9], [-12, -22, 9], [4.5, -30, 7],
      [12, 8, 6], [-6.5, 17, 6], [11, 5, 7], [-6, -40, 7], [-18, 10, 10], [16, 24, 8], [0, 8, 7],
    ];
    const nearSafe = (x, z, pad = 0) => safeZones.some(([sx, sz, r]) => Math.hypot(x - sx, z - sz) < r + pad);
    const total = this.low ? 2800 : 8600;
    this.rockField = [];
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    for (let gi = 0; gi < geos.length; gi++) {
      const geo = geos[gi];
      const n = Math.floor(total / geos.length);
      const mesh = new THREE.InstancedMesh(geo, mat, n);
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      for (let i = 0; i < n; i++) {
        // 62 % packed into the readable mid-ground, 38 % spread to the walls
        const clustered = rnd() < 0.62;
        let x, z;
        if (clustered) {
          x = (rnd() - 0.5) * 96;
          z = -56 + rnd() * 148;
        } else {
          x = (rnd() - 0.5) * 215;
          z = -66 + rnd() * 186;
        }
        let s = 0.14 + Math.pow(rnd(), 2.35) * 2.75;
        if (rnd() < 0.045) s *= 1.7;
        if (nearSafe(x, z)) s = Math.min(s, 0.48);
        // thin the direct 3B sightline so the floor stays readable
        if (x > -5 && x < 14 && z > -54 && z < 38) s = Math.min(s, 1.05);
        const y = riftFloorHeight(x, z) + s * (0.06 + rnd() * 0.16);
        dummy.position.set(x, y, z);
        dummy.rotation.set(rnd() * 3, rnd() * 6.28, rnd() * 3);
        dummy.scale.set(
          s * (0.55 + rnd() * 1.0),
          s * (0.3 + rnd() * 0.75),
          s * (0.55 + rnd() * 0.95),
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        const c = 0.42 + rnd() * 0.5;
        col.setRGB(c * 0.86, c * 0.94, c * 0.9);
        mesh.setColorAt(i, col);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.group.add(mesh);
      this.rockField.push(mesh);
    }

    // flat shattered slabs standing on edge — the "极度不平整" silhouette layer
    const slabGeo = rough(new THREE.BoxGeometry(1, 1, 1, 2, 1, 2), 0.3);
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x8b948e, map: cloneTex(this.tex.rock.map, [1, 1]),
      normalMap: cloneTex(this.tex.rock.normal, [1, 1]),
      bumpMap: cloneTex(this.tex.rock.bump, [1, 1]), bumpScale: 1.8,
      roughness: 0.96, metalness: 0.03, flatShading: true,
    });
    const slabs = new THREE.InstancedMesh(slabGeo, slabMat, this.low ? 240 : 720);
    slabs.frustumCulled = false; slabs.castShadow = true; slabs.receiveShadow = true;
    for (let i = 0; i < slabs.count; i++) {
      let x = (rnd() - 0.5) * 150;
      let z = -58 + rnd() * 160;
      if (Math.abs(x) < 6) x += Math.sign(x || 1) * (6 + rnd() * 8);
      const s = 0.45 + Math.pow(rnd(), 1.7) * 2.8;
      dummy.position.set(x, riftFloorHeight(x, z) + s * 0.08, z);
      dummy.rotation.set((rnd() - 0.5) * 0.9, rnd() * 6.28, (rnd() - 0.5) * 0.8);
      dummy.scale.set(s * (0.7 + rnd() * 1.1), s * (0.16 + rnd() * 0.35), s * (0.6 + rnd() * 1.0));
      dummy.updateMatrix();
      slabs.setMatrixAt(i, dummy.matrix);
      const c = 0.36 + rnd() * 0.42;
      col.setRGB(c * 0.82, c * 0.92, c * 0.88);
      slabs.setColorAt(i, col);
    }
    slabs.instanceMatrix.needsUpdate = true;
    if (slabs.instanceColor) slabs.instanceColor.needsUpdate = true;
    this.group.add(slabs);
    this.rockSlabs = slabs;

    // grit: tiny fragments catch the flashlight/flare and sell the broken crust
    const crumbGeo = new THREE.TetrahedronGeometry(1, 0);
    const crumbs = new THREE.InstancedMesh(crumbGeo, mat, this.low ? 1400 : 5200);
    crumbs.frustumCulled = false;
    for (let i = 0; i < crumbs.count; i++) {
      const x = (rnd() - 0.5) * 150;
      const z = -54 + rnd() * 150;
      const s = 0.05 + Math.pow(rnd(), 2.1) * 0.23;
      dummy.position.set(x, riftFloorHeight(x, z) + s * 0.25, z);
      dummy.rotation.set(rnd() * 3, rnd() * 6, rnd() * 3);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      crumbs.setMatrixAt(i, dummy.matrix);
      const c = 0.4 + rnd() * 0.45;
      col.setRGB(c * 0.86, c * 0.94, c * 0.9);
      crumbs.setColorAt(i, col);
    }
    crumbs.instanceMatrix.needsUpdate = true;
    if (crumbs.instanceColor) crumbs.instanceColor.needsUpdate = true;
    this.group.add(crumbs);
    this.rockCrumbs = crumbs;

    // a few monumental outcrops at the flanks, never in the central sightline
    const bigMat = new THREE.MeshStandardMaterial({
      color: 0x2c322e, map: cloneTex(this.tex.rock.map, [1, 1]),
      normalMap: cloneTex(this.tex.rock.normal, [1, 1]),
      roughness: 0.96, metalness: 0.03, flatShading: true,
    });
    const bigs = [
      [-56, -40, 7, 10, 8, 0.2], [52, -38, 8, 11, 9, 0.1],
      [-62, 16, 8, 7, 10, 0.4], [61, 24, 7, 9, 8, 0.2],
      [-31, 48, 5, 6, 6, 0.3], [33, 54, 6, 7, 8, 0.5],
      [-63, 58, 9, 8, 9, 0.1], [58, 66, 8, 9, 8, 0.6],
    ];
    for (const [x, z, sx, sy, sz, ry] of bigs) {
      const m = new THREE.Mesh(geos[2], bigMat);
      const y = riftFloorHeight(x, z) + sy * 0.28;
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.rotation.set((rnd() - 0.5) * 0.35, ry * 3, (rnd() - 0.5) * 0.25);
      m.castShadow = true; m.receiveShadow = true;
      this.group.add(m);
    }
    // broken spine down the middle; low and half-buried so it does not wall
    // off the 3B floor
    for (let i = 0; i < 9; i++) {
      const z = -18 + i * 7.5;
      const x = Math.sin(i * 1.7) * 3.4;
      const s = 1.0 + (i % 3) * 0.42;
      const m = new THREE.Mesh(geos[2], bigMat);
      m.position.set(x, riftFloorHeight(x, z) + s * 0.1, z);
      m.scale.set(s * 1.5, s * 0.32, s * 1.1);
      m.rotation.set(0.2, i * 1.3, 0.1);
      m.castShadow = true; m.receiveShadow = true;
      this.group.add(m);
    }

    // charcoal cracks and black organic stains between the stones
    const stainMat = new THREE.MeshBasicMaterial({
      map: makeMistTexture(11, false), color: 0x080604, transparent: true,
      opacity: 0.55, depthWrite: false, blending: THREE.NormalBlending, fog: true,
    });
    for (let i = 0; i < (this.low ? 8 : 20); i++) {
      const x = (rnd() - 0.5) * 90, z = -34 + rnd() * 100;
      const s = 1.6 + rnd() * 5.2;
      const stain = new THREE.Mesh(new THREE.PlaneGeometry(s, s * (0.5 + rnd() * 0.7)), stainMat);
      stain.rotation.x = -Math.PI / 2;
      stain.rotation.z = rnd() * 6;
      stain.position.set(x, riftFloorHeight(x, z) + 0.06, z);
      stain.renderOrder = 2;
      this.group.add(stain);
    }
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

    // 3B key: a cold raking spot that pulls the bone carpet out of the black
    // and throws long shadows across the lava blocks
    this.boneRake = new THREE.SpotLight(0xb4d0d1, 0, 165, 0.56, 0.88, 1.5);
    this.boneRake.position.set(42, 50, 22);
    this.boneRake.target.position.set(-6, 0, -38);
    g.add(this.boneRake, this.boneRake.target);
    this.boneFill = new THREE.PointLight(0x7fa2a8, 0, 110, 2);
    this.boneFill.position.set(10, 18, 10);
    g.add(this.boneFill);
    this.gateUnder = new THREE.PointLight(0xffb276, 0, 34, 2);
    this.gateUnder.position.set(0, 2.2, -44);
    g.add(this.gateUnder);
    // raking key on the bronze face + two keys on the carved jambs; without
    // these the 60 m leaf reads as one uniformly lit panel
    this.doorRake = new THREE.SpotLight(0x9dbfba, 0, 135, 0.52, 0.9, 1.3);
    this.doorRake.position.set(-54, 9, -18);
    this.doorRake.target.position.set(4, 17, -52);
    this.doorRake.castShadow = true;
    this.doorRake.shadow.mapSize.set(1024, 1024);
    this.doorRake.shadow.camera.near = 1;
    this.doorRake.shadow.camera.far = 150;
    this.doorRake.shadow.bias = -0.0012;
    this.doorRake.shadow.normalBias = 0.05;
    g.add(this.doorRake, this.doorRake.target);
    this.portalKeyL = new THREE.SpotLight(0xaec8c4, 0, 140, 0.52, 0.9, 1.4);
    this.portalKeyL.position.set(-54, 26, 24);
    this.portalKeyL.target.position.set(-34, 17, -48);
    g.add(this.portalKeyL, this.portalKeyL.target);
    this.portalKeyR = new THREE.SpotLight(0xd0b58b, 0, 140, 0.52, 0.9, 1.4);
    this.portalKeyR.position.set(56, 32, 28);
    this.portalKeyR.target.position.set(34, 17, -48);
    g.add(this.portalKeyR, this.portalKeyR.target);
    this.lintelKey = new THREE.SpotLight(0xb7c9c4, 0, 130, 0.5, 0.9, 1.35);
    this.lintelKey.position.set(0, 54, 24);
    this.lintelKey.target.position.set(0, 32, -50);
    g.add(this.lintelKey, this.lintelKey.target);
    this.nearFill = new THREE.PointLight(0x8fa9ad, 0, 42, 2);
    this.nearFill.position.set(4, 5.5, 22);
    g.add(this.nearFill);

    this.pillarSpots = [];
    for (const side of [-1, 1]) {
      const p = new THREE.SpotLight(0x93b2b4, 3600, 80, 0.36, 0.9, 1.35);
      p.position.set(side * 54, 24, -6);
      p.target.position.set(side * 33, 17, -55);
      g.add(p, p.target);
      this.pillarSpots.push(p);
    }

    // flare flood: dedicated lights, zero until the flare is burning
    this.flareA = new THREE.PointLight(0xffe5c8, 0, 300, 1.15);
    this.flareA.position.set(0, 30, 16);
    g.add(this.flareA);
    this.flareB = new THREE.PointLight(0xffd6a8, 0, 240, 1.2);
    this.flareB.position.set(-34, 24, -26);
    g.add(this.flareB);
    this.flareC = new THREE.PointLight(0xffd9b4, 0, 240, 1.2);
    this.flareC.position.set(38, 26, -16);
    g.add(this.flareC);
    this.flareDoor = new THREE.DirectionalLight(0xffe2bd, 0);
    this.flareDoor.position.set(65, 40, 38);
    this.flareDoor.target.position.set(-2, 4, -34);
    this.flareDoor.castShadow = true;
    this.flareDoor.visible = false;
    this.flareDoor.shadow.mapSize.set(1024, 1024);
    this.flareDoor.shadow.camera.left = -95;
    this.flareDoor.shadow.camera.right = 95;
    this.flareDoor.shadow.camera.top = 82;
    this.flareDoor.shadow.camera.bottom = -58;
    this.flareDoor.shadow.camera.near = 1;
    this.flareDoor.shadow.camera.far = 220;
    this.flareDoor.shadow.bias = -0.0009;
    this.flareDoor.shadow.normalBias = 0.05;
    g.add(this.flareDoor, this.flareDoor.target);
    this.flareD = new THREE.PointLight(0xffcf9f, 0, 90, 1.3);
    this.flareD.position.set(-42, 26, -37);
    g.add(this.flareD);
    this.flareE = new THREE.PointLight(0xffcf9f, 0, 90, 1.3);
    this.flareE.position.set(42, 26, -37);
    g.add(this.flareE);
    this.flareSideL = new THREE.SpotLight(0xffd7ae, 0, 140, 0.6, 0.95, 1.2);
    this.flareSideL.position.set(-52, 38, -8);
    this.flareSideL.target.position.set(-46, 16, -57);
    g.add(this.flareSideL, this.flareSideL.target);
    this.flareSideR = new THREE.SpotLight(0xffd7ae, 0, 140, 0.6, 0.95, 1.2);
    this.flareSideR.position.set(52, 38, -8);
    this.flareSideR.target.position.set(46, 16, -57);
    g.add(this.flareSideR, this.flareSideR.target);
    // side rim for the hanging bodies in the 3A beat
    this.chainRim = new THREE.SpotLight(0x9fb4c0, 650, 80, 0.55, 0.9, 1.4);
    this.chainRim.position.set(4, 30, 24);
    this.chainRim.target.position.set(0, 13, 2);
    g.add(this.chainRim, this.chainRim.target);
    this.flareLevel = 0;
    this._flareOn = false;
    this._savedHemi = 1;
    this._savedAmb = 1;
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
        color: 0x93805f, metalness: 0.38, roughness: 0.66,
        envMap: this.envCube, envMapIntensity: 0.1,
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
      body.castShadow = true;
      body.receiveShadow = true;
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
        fp.setZ(vi, (hv - 0.34) * 0.92);
      }
      fgeo.computeVertexNormals();
      const face = new THREE.Mesh(fgeo, side < 0 ? this.doorFaceL : this.doorFaceR);
      face.position.set(centerX, 15, 1.18);
      face.castShadow = true;
      face.receiveShadow = true;
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
        mp.setZ(vi, (hv - 0.36) * 0.58);
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
      medallion.position.set(mx, 19.0, 1.78);
      medallion.castShadow = true;
      pivot.add(medallion);
      const mframeMat = new THREE.MeshStandardMaterial({ color: 0x4a3f28, metalness: 0.6, roughness: 0.55, envMap: this.envCube, envMapIntensity: 0.18 });
      const mf = (w, hh, x, y) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, 0.26), mframeMat);
        m.position.set(mx + x, 19.0 + y, 1.94); pivot.add(m);
      };
      mf(10.3, 0.36, 0, 4.85);
      mf(10.3, 0.36, 0, -4.85);
      mf(0.36, 10.0, -4.97, 0);
      mf(0.36, 10.0, 4.97, 0);
      // cast frame ribs, made as a single heavy border
      const ribMat = new THREE.MeshStandardMaterial({ color: 0x2c2a1e, metalness: 0.55, roughness: 0.62, envMap: this.envCube, envMapIntensity: 0.12 });
      const addRib = (w, h, d, x, y, z) => {
        const r = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), ribMat);
        r.position.set(centerX + x, y, z);
        pivot.add(r);
      };
      addRib(29.9, 0.7, 0.34, 0, 0.65, 0.9);
      addRib(29.9, 0.7, 0.34, 0, 29.35, 0.9);
      addRib(0.7, 30, 0.34, -14.6, 15, 0.9);
      addRib(0.7, 30, 0.34, 14.6, 15, 0.9);
      // v3: heavy cast perimeter and registers give the leaf a real silhouette
      addRib(30, 1.5, 1.4, 0, 1.15, 1.65);
      addRib(30, 1.5, 1.4, 0, 28.85, 1.65);
      addRib(1.5, 30, 1.4, -14.25, 15, 1.65);
      addRib(1.5, 30, 1.4, 14.25, 15, 1.65);
      addRib(29.9, 0.95, 0.8, 0, 10.4, 1.38);
      addRib(29.9, 0.95, 0.8, 0, 21.2, 1.38);
      addRib(28.6, 1.3, 1.5, 0, 6.2, 1.7);
      addRib(28.6, 1.3, 1.5, 0, 26.0, 1.7);
      // horizontal casting ribs aligned to the registers of the texture
      addRib(29.9, 0.24, 0.22, 0, 16.7, 0.86);
      addRib(29.9, 0.18, 0.2, 0, 8.1, 0.85);
      addRib(29.9, 0.16, 0.2, 0, 4.7, 0.85);
      // door studs
      const studGeo = new THREE.SphereGeometry(0.32, 6, 5);
      const studMat = new THREE.MeshStandardMaterial({ color: 0x675c3f, metalness: 0.75, roughness: 0.45, envMap: this.envCube, envMapIntensity: 0.2 });
      const studs = new THREE.InstancedMesh(studGeo, studMat, 56);
      const d = new THREE.Object3D();
      let k = 0;
      for (let row = 0; row < 4; row++) {
        for (let i = 0; i < 14; i++) {
          const x = -14 + i * 2.16;
          const y = [1.1, 3.1, 27.2, 28.9][row];
          d.position.set(centerX + x, y, 1.62);
          d.updateMatrix(); studs.setMatrixAt(k++, d.matrix);
        }
      }
      studs.instanceMatrix.needsUpdate = true;
      pivot.add(studs);
      // monumental cast ring handles: unmistakable 3D relief and a strong
      // shadow caster on the otherwise planar bronze face
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x6e5b38, metalness: 0.8, roughness: 0.4,
        envMap: this.envCube, envMapIntensity: 0.25,
      });
      const hx = centerX + (side < 0 ? 7 : -7);
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.6, 28), ringMat);
      plate.rotation.x = Math.PI / 2;
      plate.position.set(hx, 14.6, 2.45);
      plate.castShadow = true;
      pivot.add(plate);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.34, 8, 30), ringMat);
      ring.position.set(hx, 14.2, 3.05);
      ring.castShadow = true;
      pivot.add(ring);
      const ringBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 12), ringMat);
      ringBolt.rotation.x = Math.PI / 2;
      ringBolt.position.set(hx, 16.2, 2.9);
      pivot.add(ringBolt);
      // a few heavy bosses around the leaves
      for (const [bx, by] of [[-9, 5.2], [9, 5.2], [-9, 24.8], [9, 24.8]]) {
        const boss = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 7), ringMat);
        boss.scale.set(1, 1, 0.65);
        boss.position.set(centerX + bx, by, 1.9);
        boss.castShadow = true;
        pivot.add(boss);
      }
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

    // No dressed-stone façade: the bronze leaves sit directly in a torn
    // volcanic wall (buildDoorCliff), so the door reads as embedded in rock.
    this.frame = null;

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

  /* ---------------- gate portal: depth + carved frame ---------------- */
  buildPortalFrame() {
    const g = new THREE.Group();
    g.name = 'portal-frame';
    this.portalGroup = g;
    this.group.add(g);
    const rnd = mulberry32(4517);

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x535d56, map: cloneTex(this.tex.rock.map, [2.4, 2.4]),
      normalMap: cloneTex(this.tex.rock.normal, [2.4, 2.4]),
      normalScale: new THREE.Vector2(1.7, 1.7),
      bumpMap: cloneTex(this.tex.rock.bump, [2.4, 2.4]), bumpScale: 2.8,
      roughness: 0.95, metalness: 0.03, flatShading: true,
    });
    this.portalStone = stoneMat;
    const carvedMat = new THREE.MeshStandardMaterial({
      color: 0x66563b, map: cloneTex(this.tex.door.map, [5, 1.6]),
      bumpMap: cloneTex(this.tex.door.bump, [5, 1.6]), bumpScale: 0.8,
      roughnessMap: cloneTex(this.tex.door.roughness, [5, 1.6]),
      metalness: 0.55, roughness: 0.62,
      envMap: this.envCube, envMapIntensity: 0.14,
    });
    this.portalBronze = carvedMat;

    const mkBlock = (w, h, d, seed) => {
      const geo = new THREE.BoxGeometry(w, h, d, 4, 5, 4);
      const p = geo.attributes.position;
      const n = geo.attributes.normal;
      const amp = Math.min(w, h, d) * 0.045;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const dd = fbm3(x * 0.12 + seed, y * 0.12, z * 0.12, 3) * amp
          + fbm3(x * 0.45 + seed, y * 0.45, z * 0.45, 2) * amp * 0.3;
        p.setXYZ(i, x + n.getX(i) * dd, y + n.getY(i) * dd, z + n.getZ(i) * dd);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, stoneMat);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };

    // stepped jambs: three layers recede toward the bronze leaves, so the
    // portal has 6-8 m of visible thickness from the valley floor
    for (const side of [-1, 1]) {
      const outer = mkBlock(18, 38, 15, side * 4.1);
      outer.position.set(side * 45.5, 16.5, -55.0);
      outer.rotation.set(0.02, side * 0.03, side * 0.015);
      const mid = mkBlock(10, 33.5, 8.5, side * 8.3);
      mid.position.set(side * 36.6, 15.6, -51.2);
      mid.rotation.set(-0.02, side * 0.06, side * -0.01);
      const inner = mkBlock(5.8, 31.6, 5.2, side * 2.7);
      inner.position.set(side * 32.2, 15.0, -48.4);
      inner.rotation.set(0.01, side * 0.02, side * 0.008);
      // corbels stepping down toward the opening
      for (const y of [4.0, 9.6, 15.2, 20.8, 26.4]) {
        const c = mkBlock(2.6, 1.5, 4.0, side * 3 + y);
        c.position.set(side * 30.6, y, -47.9);
        c.rotation.y = (rnd() - 0.5) * 0.1;
      }
    }

    // stepped lintel and corbels: the gate sits under a deep overhang
    const lintelLow = mkBlock(68, 4.3, 6.0, 12.1);
    lintelLow.position.set(0, 32.2, -48.9);
    lintelLow.rotation.z = 0.006;
    const lintelMid = mkBlock(78, 5.4, 8.0, 15.7);
    lintelMid.position.set(0, 35.9, -51.6);
    const lintelTop = mkBlock(92, 7.2, 12.0, 19.3);
    lintelTop.position.set(0, 40.5, -55.2);
    for (let i = 0; i < 9; i++) {
      const x = -26 + i * 6.5;
      const c = mkBlock(3.0, 1.7, 4.2, 30 + i);
      c.position.set(x, 29.7, -47.7);
    }

    // two threshold steps
    const step1 = mkBlock(64, 1.0, 6.0, 41.2);
    step1.position.set(0, 0.35, -47.3);
    const step2 = mkBlock(67, 1.3, 5.6, 44.8);
    step2.position.set(0, -0.35, -50.4);

    // bronze inner frame bands (the carved frame the leaves close against)
    const band = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), carvedMat);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
      return m;
    };
    for (const side of [-1, 1]) {
      band(1.45, 30.7, 1.2, side * 30.35, 15.25, -49.0);
      // rivets along the jambs
      for (let i = 0; i < 8; i++) {
        const rv = new THREE.Mesh(new THREE.SphereGeometry(0.32, 7, 6), carvedMat);
        rv.position.set(side * 30.35, 2.5 + i * 3.8, -48.25);
        g.add(rv);
      }
    }
    band(61, 1.5, 1.2, 0, 30.85, -49.0);
    band(61, 0.9, 1.2, 0, 0.85, -49.0);
    // side reveal walls: visible thickness between the bronze face and frame
    for (const side of [-1, 1]) {
      const rv = new THREE.Mesh(new THREE.BoxGeometry(0.5, 30.2, 5.6), stoneMat);
      rv.position.set(side * 30.55, 15.1, -50.3);
      rv.receiveShadow = true;
      g.add(rv);
    }
    const topReveal = new THREE.Mesh(new THREE.BoxGeometry(61.2, 0.55, 5.4), stoneMat);
    topReveal.position.set(0, 30.35, -50.2);
    g.add(topReveal);
    // cold light leaking through the recess traces the opening: this is the
    // clearest cue that the bronze face sits metres behind the stone frame
    const leakMat = new THREE.MeshBasicMaterial({
      color: 0x9fc7c3, transparent: true, opacity: 0.34,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    for (const side of [-1, 1]) {
      const leak = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 28.6), leakMat);
      leak.position.set(side * 30.15, 15.2, -49.6);
      g.add(leak);
    }
    const leakTop = new THREE.Mesh(new THREE.PlaneGeometry(59.8, 0.15), leakMat);
    leakTop.position.set(0, 30.1, -49.6);
    g.add(leakTop);
    const leakWarm = new THREE.Mesh(new THREE.PlaneGeometry(59, 0.18), new THREE.MeshBasicMaterial({
      color: 0xd29a64, transparent: true, opacity: 0.32,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    leakWarm.position.set(0, 0.95, -48.2);
    g.add(leakWarm);
    // low lamps inside the reveal; they graze the 5.6 m deep return walls and
    // the edges of the bronze leaves, making the portal thickness readable
    this.portalReveals = [];
    for (const side of [-1, 1]) {
      const l = new THREE.PointLight(0xa9c4b9, 0, 20, 2);
      l.position.set(side * 28.4, 7.5, -48.6);
      g.add(l);
      this.portalReveals.push(l);
      const l2 = new THREE.PointLight(0x7e9ea4, 0, 22, 2);
      l2.position.set(side * 29.4, 18, -48.9);
      g.add(l2);
      this.portalReveals.push(l2);
    }

    // relief medallions on the jamb faces (real bump + stepped surround)
    const med = this.tex.medallion;
    const medMat = new THREE.MeshStandardMaterial({
      map: med.map, bumpMap: med.bump, bumpScale: 0.6,
      roughnessMap: med.roughness, color: 0x8c7c5d,
      metalness: 0.4, roughness: 0.62, envMap: this.envCube, envMapIntensity: 0.15,
    });
    for (const side of [-1, 1]) {
      for (const y of [7.5, 15.5, 23.5]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), medMat);
        m.position.set(side * 33.7, y, -45.62);
        g.add(m);
        for (const [ox, oy, w, h] of [[0, 2.55, 5.2, 0.3], [0, -2.55, 5.2, 0.3], [-2.55, 0, 0.3, 5.2], [2.55, 0, 0.3, 5.2]]) {
          const rib = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.34), carvedMat);
          rib.position.set(side * 33.7 + ox, y + oy, -45.55);
          rib.castShadow = true;
          g.add(rib);
        }
      }
    }
    // a broad carved cloud band over the lintel
    for (let i = 0; i < 13; i++) {
      const c = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.16, 4, 8, Math.PI * 1.15), carvedMat);
      c.position.set(-27 + i * 4.5, 32.35, -46.6);
      c.rotation.z = (i % 2 ? 1 : -1) * 0.45;
      g.add(c);
    }
    // five large cast masks across the lintel face: the overhang must read as
    // carved relief from 70 m away, not a smooth beam
    for (let i = 0; i < 5; i++) {
      const x = -24 + i * 12;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 3.8), medMat);
      m.position.set(x, 32.2, -45.72);
      g.add(m);
      for (const [ox, oy, w, h] of [[0, 2.0, 8.6, 0.28], [0, -2.0, 8.6, 0.28], [-4.3, 0, 0.28, 4.2], [4.3, 0, 0.28, 4.2]]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), carvedMat);
        r.position.set(x + ox, 32.2 + oy, -45.62);
        g.add(r);
      }
    }
    // warm spill on the threshold steps, hinting at heat behind the gate
    const sillGlow = new THREE.Mesh(new THREE.PlaneGeometry(44, 2.4), new THREE.MeshBasicMaterial({
      color: 0x9c5b31, transparent: true, opacity: 0.18,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    sillGlow.rotation.x = -Math.PI / 2;
    sillGlow.position.set(0, 0.88, -44.5);
    g.add(sillGlow);

    // cool halo behind the lintel, separating the portal silhouette from black
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(2.4), color: 0x6a97a0, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    halo.position.set(0, 28, -62);
    halo.scale.set(86, 62, 1);
    g.add(halo);
    this.portalHalo = halo;
  }

  buildDoorCliff() {
    const g = new THREE.Group();
    g.name = 'door-cliff';
    this.doorCliff = g;
    this.group.add(g);
    const rnd = mulberry32(5566);
    const wallMat = rockMaterial(this.tex.rock, [4, 3], 0x4b534b, 1.9);
    wallMat.flatShading = true;
    this.doorWallMat = wallMat;

    // two enormous rough wall panels, their inner edges torn open around the door
    for (const side of [-1, 1]) {
      const w = 88, h = 70;
      const geo = makeWallGeometry(w, h, this.low ? 26 : 44, this.low ? 18 : 30, (u, v) => {
        return fbm3(u * 0.028 + side * 3.1, v * 0.045, 5.1, 5) * 6.2
          + fbm3(u * 0.09, v * 0.12, side * 2.2, 3) * 2.4 + 1.6;
      }, side * 2 + 5);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const inner = side < 0 ? x > w * 0.5 - 6.0 : x < -w * 0.5 + 6.0;
        if (inner) {
          const k = side < 0 ? (x - (w * 0.5 - 6.0)) / 6.0 : ((-w * 0.5 + 6.0) - x) / 6.0;
          p.setX(i, x + side * (-1) * (1.2 + k * 2.2) + (rnd() - 0.5) * 1.6);
          p.setZ(i, p.getZ(i) + (rnd() - 0.5) * 2.3);
        }
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, wallMat);
      m.position.set(side * (30 + w / 2 - 1.4), 34, -59.5);
      g.add(m);
    }
    // header / overhanging cliff above the lintel
    const hw = 152, hh = 42;
    const hgeo = makeWallGeometry(hw, hh, this.low ? 28 : 46, this.low ? 14 : 24, (u, v) => {
      return fbm3(u * 0.026, v * 0.05 + 6, 8.3, 5) * 5.6 + fbm3(u * 0.08, v * 0.14, 3, 3) * 2.2 + 1.8;
    }, 7.7);
    const hp = hgeo.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      const y = hp.getY(i);
      if (y < -hh * 0.5 + 5.5) {
        hp.setY(i, y - (rnd() * 2.4));
        hp.setZ(i, hp.getZ(i) + (rnd() - 0.5) * 2.0);
      }
    }
    hgeo.computeVertexNormals();
    const header = new THREE.Mesh(hgeo, wallMat);
    header.position.set(0, 31.4 + hh * 0.5, -59.5);
    g.add(header);

    // angular volcanic jambs that lean over the bronze edges
    const blockMat = new THREE.MeshStandardMaterial({
      color: 0x2a312c, map: cloneTex(this.tex.rock.map, [1.2, 1.2]),
      bumpMap: cloneTex(this.tex.rock.bump, [1.2, 1.2]), bumpScale: 1.4,
      roughness: 0.96, metalness: 0.03, flatShading: true,
    });
    const shard = new THREE.DodecahedronGeometry(1, 0);
    const jambs = [
      [-38, 6, -53.4, 6.2, 6.5, 7.0, 0.2], [-40, 16.5, -53.7, 6.8, 9.5, 7.4, 0.4],
      [-39, 27.2, -53.3, 6.0, 7.0, 6.6, 0.1], [-45, 10.5, -51.8, 8.0, 11.0, 7.4, 0.6],
      [38, 6.6, -53.4, 6.4, 6.8, 7.2, 0.9], [40, 17.0, -53.8, 7.0, 9.6, 7.4, 0.2],
      [39, 27.6, -53.2, 6.2, 7.2, 6.8, 0.5], [46, 11.0, -51.8, 8.2, 11.5, 7.6, 0.3],
      [-21, 32.2, -53.6, 11.0, 4.2, 7.0, 0.4], [0, 32.8, -53.9, 13.0, 4.6, 7.4, 0.1],
      [21, 32.3, -53.5, 11.5, 4.4, 7.2, 0.7], [-8, 35.2, -54.5, 18.0, 5.8, 9.0, 0.2],
    ];
    for (const [x, y, z, sx, sy, sz, ry] of jambs) {
      const m = new THREE.Mesh(shard, blockMat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.rotation.set((rnd() - 0.5) * 0.2, ry * 3, (rnd() - 0.5) * 0.18);
      g.add(m);
    }
    // rubble skirt at the threshold
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (31 + rnd() * 16) * (i % 5 === 0 ? 0.2 : 1);
      const z = -52.4 + rnd() * 5.0;
      const s = 0.7 + Math.pow(rnd(), 1.8) * 3.8;
      const m = new THREE.Mesh(shard, blockMat);
      m.position.set(x, riftFloorHeight(x, z) + s * 0.28, z);
      m.scale.set(s * (0.8 + rnd() * 0.7), s * (0.4 + rnd() * 0.9), s * (0.8 + rnd() * 0.6));
      m.rotation.set(rnd() * 2, rnd() * 6, rnd() * 2);
      g.add(m);
    }
    // basalt columns flanking the gate, and dark fins high on the wall
    const columnMat = new THREE.MeshStandardMaterial({ color: 0x101413, roughness: 0.97, flatShading: true, map: cloneTex(this.tex.rock.map, [1, 3]) });
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const x = side * (48 + i * 7 + rnd() * 4);
        const z = -43 + rnd() * 26;
        const h = 14 + rnd() * 24;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(2.0 + rnd() * 2.4, 3.0 + rnd() * 2.6, h, 6, 3), columnMat);
        col.position.set(x, riftFloorHeight(x, z) + h * 0.46, z);
        col.rotation.set((rnd() - 0.5) * 0.1, rnd() * 3, (rnd() - 0.5) * 0.1);
        g.add(col);
      }
    }
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : -1;
      const m = new THREE.Mesh(shard, blockMat);
      const x = side * (42 + rnd() * 34);
      const y = 30 + rnd() * 26;
      m.position.set(x, y, -55 - rnd() * 5);
      m.scale.set(6 + rnd() * 9, 5 + rnd() * 10, 6 + rnd() * 8);
      m.rotation.set(rnd() * 2, rnd() * 6, rnd() * 2);
      g.add(m);
    }
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

  buildChains() {
    const g = new THREE.Group();
    g.name = 'hanging-chains';
    this.chainGroup = g;
    this.group.add(g);
    const rnd = mulberry32(7731);
    const linkGeo = new THREE.TorusGeometry(0.26, 0.052, 4, 8);
    linkGeo.scale(1, 1.36, 1);
    const linkMat = new THREE.MeshStandardMaterial({ color: 0x0b0c09, metalness: 0.05, roughness: 0.92, envMap: this.envCube, envMapIntensity: 0.02 });
    const chainDefs = [
      [-17.5, 4, 66], [-6.5, 17, 64], [12.5, 8, 65], [28.0, 24, 63], [-30.0, 30, 62],
    ];
    const bodies = [];
    for (let c = 0; c < chainDefs.length; c++) {
      const [x, z, top] = chainDefs[c];
      const floor = riftFloorHeight(x, z);
      const count = Math.floor((top - floor) / 0.62);
      const mesh = new THREE.InstancedMesh(linkGeo, linkMat, count);
      mesh.frustumCulled = false;
      const dummy = new THREE.Object3D();
      for (let i = 0; i < count; i++) {
        const y = top - i * 0.62;
        const sway = Math.sin(i * 0.18 + c) * 0.05;
        dummy.position.set(x + sway, y, z + Math.cos(i * 0.14 + c) * 0.04);
        dummy.rotation.set(0, (i % 2 ? Math.PI / 2 : 0) + c * 0.3, Math.sin(i * 0.1 + c) * 0.05);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      g.add(mesh);
      // bodies: some near the top, some just above the valley floor
      const heights = c === 0 ? [6.5, 15.0, 25.0] : c === 1 ? [7.0, 18.0, 27.0] : c === 2 ? [5.8, 16.0, 28.0] : c === 3 ? [8.0, 20.0] : [6.5, 17.0];
      for (const by of heights) {
        bodies.push({ x, z, y: by, s: 0.92 + rnd() * 0.18, ry: rnd() * Math.PI * 2 });
      }
    }
    const cloth = new THREE.MeshStandardMaterial({ color: 0x2b281d, roughness: 0.95, metalness: 0.02 });
    const cloth2 = new THREE.MeshStandardMaterial({ color: 0x3b3423, roughness: 0.93, metalness: 0.03 });
    const bone = new THREE.MeshStandardMaterial({ color: 0xb1aa91, roughness: 0.88, metalness: 0.02 });
    const pale = new THREE.MeshBasicMaterial({ color: 0x8e8a76 });
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x322a1e, roughness: 1 });
    for (const b of bodies) {
      const body = new THREE.Group();
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 3, 6), cloth);
      torso.position.y = 1.12; body.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 8, 6), pale);
      head.position.set(0, 1.55, 0.02); head.rotation.x = 0.35; body.add(head);
      const limb = new THREE.CapsuleGeometry(0.05, 0.46, 2, 5);
      const armL = new THREE.Mesh(limb, cloth2); armL.position.set(-0.25, 1.14, 0.05); armL.rotation.z = 0.32; armL.rotation.x = 0.18; body.add(armL);
      const armR = new THREE.Mesh(limb, cloth2); armR.position.set(0.25, 1.12, 0.02); armR.rotation.z = -0.38; body.add(armR);
      const legL = new THREE.Mesh(limb, cloth); legL.position.set(-0.09, 0.42, 0.03); legL.rotation.x = -0.18; body.add(legL);
      const legR = new THREE.Mesh(limb, cloth); legR.position.set(0.10, 0.40, -0.06); legR.rotation.x = 0.15; body.add(legR);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), ropeMat);
      rope.position.y = 2.05; body.add(rope);
      body.position.set(b.x + (rnd() - 0.5) * 0.5, b.y - 1.55, b.z + (rnd() - 0.5) * 0.5);
      body.rotation.set((rnd() - 0.5) * 0.16, b.ry, (rnd() - 0.5) * 0.2);
      body.scale.setScalar(b.s * 1.32);
      g.add(body);
    }
    this.chainBodies = bodies;
  }

  buildBones() {
    const boneMat = new THREE.MeshStandardMaterial({
      color: 0xa29b86, map: this.tex.bone.map, roughness: 0.93, metalness: 0.02,
    });
    const boneGeo = makeBoneGeometry();
    const skullGeo = makeSkullGeometry();
    const ribGeo = new THREE.TorusGeometry(0.42, 0.042, 4, 8, Math.PI * 1.3);
    const rnd = mulberry32(8821);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    // v3: a bone carpet over the whole visible floor, not a few near heaps.
    // 60 % follows the drifts, 40 % is scattered across the entire valley so
    // the bone layer runs all the way to the gate and the side walls.
    const scatter = () => {
      let x, z;
      if (rnd() < 0.60) {
        const heap = BONE_HEAPS[Math.floor(rnd() * BONE_HEAPS.length)];
        const [cx, cz, r] = heap;
        const a = rnd() * Math.PI * 2;
        const rad = Math.pow(rnd(), 0.55) * r * 1.12;
        x = cx + Math.cos(a) * rad;
        z = cz + Math.sin(a) * rad * 0.9;
      } else {
        x = (rnd() - 0.5) * 182;
        z = -56 + rnd() * 160;
      }
      return { x, z, pile: bonePile(x, z) };
    };

    // keep the immediate 3B / node-4 camera foreground legible: shrink very
    // close bones instead of letting one femur fill half the screen
    const nearCam = (x, z) => Math.hypot(x - 10.5, z - 28) < 8 || Math.hypot(x - 11, z - 16) < 7 || Math.hypot(x, z - 8) < 8;
    const N = this.low ? 2800 : 7000;
    const bones = new THREE.InstancedMesh(boneGeo, boneMat, N);
    bones.frustumCulled = false;
    bones.castShadow = false;
    bones.receiveShadow = true;
    for (let i = 0; i < N; i++) {
      const { x, z, pile } = scatter();
      // several layers through a drift, plus a single strewn layer elsewhere
      const lift = pile > 0.15 ? 0.18 + Math.pow(rnd(), 0.8) * 0.72 : rnd() * 0.10;
      const y = riftFloorHeight(x, z) + 0.03 + pile * lift;
      dummy.position.set(x, y, z);
      dummy.rotation.set((rnd() - 0.5) * 0.5, rnd() * 6.28, (rnd() - 0.5) * 0.4);
      let sc = 0.95 + rnd() * 0.9;
      if (nearCam(x, z)) sc *= 0.52;
      dummy.scale.set(sc, sc, sc * (0.85 + rnd() * 0.3));
      dummy.updateMatrix();
      bones.setMatrixAt(i, dummy.matrix);
      const c = 0.54 + rnd() * 0.30;
      color.setRGB(c * 1.04, c * 0.96, c * 0.78);
      bones.setColorAt(i, color);
    }
    bones.instanceMatrix.needsUpdate = true;
    if (bones.instanceColor) bones.instanceColor.needsUpdate = true;
    this.group.add(bones);
    this.bones = bones;

    const skullN = this.low ? 320 : 850;
    const skulls = new THREE.InstancedMesh(skullGeo, boneMat, skullN);
    skulls.frustumCulled = false;
    skulls.castShadow = true;
    skulls.receiveShadow = true;
    for (let i = 0; i < skullN; i++) {
      const { x, z, pile } = scatter();
      const y = riftFloorHeight(x, z) + 0.09 + pile * (0.55 + rnd() * 0.45);
      dummy.position.set(x, y, z);
      dummy.rotation.set((rnd() - 0.5) * 1.5, rnd() * 6.28, (rnd() - 0.5) * 1.2);
      let sc = 0.85 + rnd() * 1.0;
      if (nearCam(x, z)) sc *= 0.55;
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      skulls.setMatrixAt(i, dummy.matrix);
      const c = 0.56 + rnd() * 0.28;
      color.setRGB(c * 1.05, c * 0.97, c * 0.80);
      skulls.setColorAt(i, color);
    }
    skulls.instanceMatrix.needsUpdate = true;
    if (skulls.instanceColor) skulls.instanceColor.needsUpdate = true;
    this.group.add(skulls);

    const ribN = this.low ? 300 : 800;
    const ribs = new THREE.InstancedMesh(ribGeo, boneMat, ribN);
    ribs.frustumCulled = false;
    ribs.castShadow = false;
    ribs.receiveShadow = true;
    for (let i = 0; i < ribN; i++) {
      const { x, z, pile } = scatter();
      dummy.position.set(x, riftFloorHeight(x, z) + 0.13 + pile * (0.35 + rnd() * 0.55), z);
      dummy.rotation.set(Math.PI / 2 + (rnd() - 0.5) * 1.1, rnd() * 6.28, (rnd() - 0.5) * 0.8);
      let sc = 0.7 + rnd() * 0.95;
      if (nearCam(x, z)) sc *= 0.55;
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      ribs.setMatrixAt(i, dummy.matrix);
      const c = 0.54 + rnd() * 0.28;
      color.setRGB(c * 1.03, c * 0.95, c * 0.78);
      ribs.setColorAt(i, color);
    }
    ribs.instanceMatrix.needsUpdate = true;
    if (ribs.instanceColor) ribs.instanceColor.needsUpdate = true;
    this.group.add(ribs);

    // splinters and fragments fill the gaps between the larger bones
    const fragN = this.low ? 800 : 2200;
    const fragGeo = new THREE.TetrahedronGeometry(1, 0);
    const frags = new THREE.InstancedMesh(fragGeo, boneMat, fragN);
    frags.frustumCulled = false;
    for (let i = 0; i < fragN; i++) {
      const { x, z, pile } = scatter();
      dummy.position.set(x, riftFloorHeight(x, z) + 0.025 + pile * (0.1 + rnd() * 0.4), z);
      dummy.rotation.set((rnd() - 0.5) * 0.8, rnd() * 6.28, (rnd() - 0.5) * 0.8);
      let sc = 0.14 + rnd() * 0.34;
      if (nearCam(x, z)) sc *= 0.6;
      dummy.scale.set(sc * 1.6, sc * 0.55, sc * 1.1);
      dummy.updateMatrix();
      frags.setMatrixAt(i, dummy.matrix);
      const c = 0.48 + rnd() * 0.30;
      color.setRGB(c * 1.03, c * 0.95, c * 0.78);
      frags.setColorAt(i, color);
    }
    frags.instanceMatrix.needsUpdate = true;
    if (frags.instanceColor) frags.instanceColor.needsUpdate = true;
    this.group.add(frags);
    this.boneFragments = frags;

    // dark organic patches, sparse and small — no gore
    const stainMat = new THREE.MeshBasicMaterial({
      map: makeMistTexture(9, false), color: 0x070503, transparent: true,
      opacity: 0.5, depthWrite: false, blending: THREE.NormalBlending,
    });
    for (let i = 0; i < (this.low ? 6 : 12); i++) {
      const heap = BONE_HEAPS[Math.floor(rnd() * BONE_HEAPS.length)];
      const x = heap[0] + (rnd() - 0.5) * heap[2] * 1.1;
      const z = heap[1] + (rnd() - 0.5) * heap[2] * 0.9;
      const size = 1.0 + rnd() * 2.6;
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.7), stainMat);
      patch.rotation.x = -Math.PI / 2;
      patch.rotation.z = rnd() * 6;
      patch.position.set(x, riftFloorHeight(x, z) + 0.09, z);
      patch.renderOrder = 3;
      this.group.add(patch);
    }
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
    // v3: the portal frame now stands in front of the old line positions, so
    // the scale lines move onto the face of the jamb / threshold where the
    // node-4 camera can actually read them.
    mkLine([new THREE.Vector3(-36.5, 0.6, -45.45), new THREE.Vector3(-36.5, 30.5, -45.45)]);
    mkLine([new THREE.Vector3(-37.3, 30.5, -45.45), new THREE.Vector3(-35.7, 30.5, -45.45)]);
    mkLine([new THREE.Vector3(-37.3, 0.6, -45.45), new THREE.Vector3(-35.7, 0.6, -45.45)]);
    mkLine([new THREE.Vector3(-30.2, 0.75, -45.4), new THREE.Vector3(30.2, 0.75, -45.4)]);
    mkLine([new THREE.Vector3(-30.2, 0.3, -45.4), new THREE.Vector3(-30.2, 1.2, -45.4)]);
    mkLine([new THREE.Vector3(30.2, 0.3, -45.4), new THREE.Vector3(30.2, 1.2, -45.4)]);
    mkLine([new THREE.Vector3(-21.4, 0.4, -44.6), new THREE.Vector3(-21.4, 2.2, -44.6)]);
    mkLine([new THREE.Vector3(-21.9, 0.4, -44.6), new THREE.Vector3(-20.9, 0.4, -44.6)]);
    mkLine([new THREE.Vector3(-21.9, 2.2, -44.6), new THREE.Vector3(-20.9, 2.2, -44.6)]);
    const label = (text, x, y, z, scale = 4.6) => {
      const tex = makeTextTexture(text, { w: 512, h: 128, font: '500 64px serif', color: '#bcd6c9' });
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.8, depthTest: false, fog: false }));
      s.position.set(x, y, z); s.scale.set(scale, scale / 4, 1); s.renderOrder = 21;
      g.add(s);
    };
    label('30 m', -32.5, 24, -45.4, 4.2);
    label('60 m', 3, 2.2, -45.4, 5.0);
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
    const mat = new THREE.MeshStandardMaterial({ color: 0x2b393b, roughness: 0.82, metalness: 0.04 });
    // two expedition silhouettes on a foreground slab, looking at the gate;
    // without this stage the figures disappear behind the new bone/rubble field
    const ledgeMat = new THREE.MeshStandardMaterial({
      color: 0x3a4442, roughness: 0.95, metalness: 0.03, flatShading: true,
      map: cloneTex(this.tex.rock.map, [2, 1]),
      normalMap: cloneTex(this.tex.rock.normal, [2, 1]),
    });
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(8.5, 1.6, 5.4, 5, 2, 3), ledgeMat);
    ledge.position.set(-3.4, 4.55, -8.6);
    ledge.rotation.y = 0.18;
    ledge.castShadow = true;
    ledge.receiveShadow = true;
    g.add(ledge);
    const ledgeBoneMat = new THREE.MeshStandardMaterial({ color: 0x9a9380, map: this.tex.bone.map, roughness: 0.92, metalness: 0.02 });
    const ledgeBoneGeo = makeBoneGeometry();
    for (const [bx, bz, by] of [[-2.4, 1.7, 0.2], [0.9, 1.2, -0.5], [2.6, 2.0, 1.1], [-0.4, 2.3, 2.2], [2.0, -0.1, 0.8]]) {
      const b = new THREE.Mesh(ledgeBoneGeo, ledgeBoneMat);
      b.position.set(-3.4 + bx, 5.4, -8.6 + bz);
      b.rotation.set(0.1, by, 0.08);
      b.scale.setScalar(1.15);
      g.add(b);
    }
    const a = makeFigure(mat);
    a.position.set(-5.15, 5.46, -8.9);
    a.rotation.y = 3.05;
    a.scale.setScalar(1.5);
    const packMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.52, 0.22), new THREE.MeshStandardMaterial({ color: 0x0d1110, roughness: 0.98 }));
    packMesh.position.set(0, 1.28, 0.2);
    a.add(packMesh);
    g.add(a);
    const b = makeFigure(mat);
    b.position.set(-2.55, 5.46, -8.25);
    b.rotation.y = 2.95;
    b.scale.setScalar(1.4);
    g.add(b);
    const c = makeFigure(mat);
    c.position.set(1.5, riftFloorHeight(1.5, -36.5) + 0.02, -36.5);
    c.rotation.y = 0.15;
    c.scale.setScalar(1.12);
    g.add(c);
    const rim = new THREE.SpotLight(0x9fb6b2, 320, 30, 0.4, 0.9, 1.35);
    rim.position.set(-10, 12, 4);
    rim.target.position.set(-3.8, 5.3, -8.5);
    g.add(rim, rim.target);
    this.epilogueRim = rim;
    const back = new THREE.PointLight(0xffa363, 240, 16, 2);
    back.position.set(0, 4, -56);
    g.add(back);
    const figFill = new THREE.PointLight(0x9fc3c8, 80, 18, 2);
    figFill.position.set(-3.8, 6.2, -14);
    g.add(figFill);
    const figRim = new THREE.PointLight(0xffb071, 38, 12, 2);
    figRim.position.set(-2.5, 4.2, -12.5);
    g.add(figRim);
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
  setFlare(k) {
    k = Math.max(0, Math.min(1, k));
    this.flareLevel = k;
    const flick = 0.90 + 0.10 * Math.sin(this.time * 31.0);
    if (this.flareA) {
      this.flareA.intensity = k * 3200 * flick;
      this.flareB.intensity = k * 1600 * flick;
      this.flareC.intensity = k * 1800 * (1.9 - flick);
      this.flareDoor.intensity = k * 5.0;
      this.flareDoor.visible = k > 0.002;
      this.flareD.intensity = k * 2500;
      this.flareE.intensity = k * 2500;
      this.flareSideL.intensity = k * 4200;
      this.flareSideR.intensity = k * 4200;
    }
    if (k > 0 && !this._flareOn) {
      this._savedHemi = this.hemi.intensity;
      this._savedAmb = this.ambient.intensity;
      this._flareOn = true;
    }
    if (this._flareOn) {
      this.hemi.intensity = this._savedHemi + k * 0.55;
      this.ambient.intensity = this._savedAmb + k * 0.38;
      if (k <= 0.001) {
        this.hemi.intensity = this._savedHemi;
        this.ambient.intensity = this._savedAmb;
        this._flareOn = false;
      }
    }
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
        if (c.isGroup) {
          if (c.userData.baseY === undefined) c.userData.baseY = c.position.y;
          c.position.y = c.userData.baseY + Math.sin(t * 0.6 + i * 2) * 0.012;
        }
      });
      this.epiSnow.update(t);
    }
  }
}
