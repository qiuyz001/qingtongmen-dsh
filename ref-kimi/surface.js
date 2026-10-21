// 地表世界：长白山雪谷、30米崖壁、暴风雪、被雪埋住的缝隙（节点1 & 节点7 尾声共用）
import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { createNoise2D } from 'simplex-noise';
import { mulberry32, smooth } from './util.js';
import { makeBlizzard, makeSteam } from './particles.js';
import { softDotMap, rockDetailMaps } from './textures.js';

const snoise = createNoise2D(mulberry32(2026));
function sfbm(x, y, oct = 4) {
  let v = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { v += a * snoise(x * f, y * f); n += a; a *= 0.5; f *= 2.05; }
  return v / n;
}

export function snowHeight(x, z) {
  let h = sfbm(x * 0.012, z * 0.012, 4) * 3.2 + sfbm(x * 0.06, z * 0.06, 3) * 0.8 + 1.2;
  // 谷道隆起两侧：|x| 越大越高
  h += smooth(24, 90, Math.abs(x)) * 14;
  // 缝隙前小空地 & 门前空地压平（近处压平）
  h *= 1 - (1 - smooth(10, 26, Math.hypot(x + 16, z + 48))) * 0.75;
  h *= 1 - (1 - smooth(18, 42, Math.hypot(x * 0.9, z + 34))) * 0.8;
  return h;
}

const sparkleChunk = `
  varying vec3 vWp;
  varying vec3 vWn;
  uniform float uTime;
`;
const sparkleVert = `
  ${''}
  varying vec3 vWp;
  varying vec3 vWn;
  uniform float uTime;
`;

export function buildSurface(scene, batch) {
  const group = new THREE.Group();
  scene.add(group);
  const dotTex = softDotMap();
  const detail = rockDetailMaps();
  detail.bumpMap.repeat.set(24, 24);

  // ---------- 雪地（CSM：闪点 + 凹陷蓝影） ----------
  const snowUniforms = { uTime: { value: 0 } };
  const snowMat = new CustomShaderMaterial({
    baseMaterial: THREE.MeshStandardMaterial,
    color: 0xb8c4d2, roughness: 0.82, metalness: 0.0,
    bumpMap: detail.bumpMap, bumpScale: 1.2,
    uniforms: snowUniforms,
    vertexShader: `
      varying vec3 vWp; varying vec3 vWn;
      void main() {
        vWp = (modelMatrix * vec4(position, 1.0)).xyz;
        vWn = normalize(mat3(modelMatrix) * normal);
      }`,
    fragmentShader: `
      varying vec3 vWp; varying vec3 vWn;
      uniform float uTime;
      float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        // 背光凹陷处泛蓝
        float dip = 1.0 - clamp(vWn.y, 0.0, 1.0);
        csm_DiffuseColor.rgb = mix(csm_DiffuseColor.rgb, vec3(0.62, 0.72, 0.88), dip * 0.45);
        // 雪粒闪光
        vec2 cell = floor(vWp.xz * 14.0);
        float g = hash21(cell);
        float tw = step(0.992, g) * (0.5 + 0.5 * sin(uTime * 2.2 + g * 40.0));
        csm_Emissive.rgb += vec3(0.75, 0.85, 1.0) * tw * 0.35;
      }`,
  });

  const terrainGeo = new THREE.PlaneGeometry(300, 300, 150, 150);
  terrainGeo.rotateX(-Math.PI / 2);
  {
    const p = terrainGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      p.setY(i, snowHeight(p.getX(i), p.getZ(i)));
    }
    terrainGeo.computeVertexNormals();
  }
  const terrain = new THREE.Mesh(terrainGeo, snowMat);
  terrain.receiveShadow = true;
  group.add(terrain);

  // ---------- 崖壁（30 米，缝隙入口在 x=-16） ----------
  const cliffMat = new CustomShaderMaterial({
    baseMaterial: THREE.MeshStandardMaterial,
    color: 0x23262c, roughness: 0.95, metalness: 0.03,
    bumpMap: detail.bumpMap, bumpScale: 4,
    vertexShader: `
      varying vec3 vWp; varying vec3 vWn;
      void main() {
        vWp = (modelMatrix * vec4(position, 1.0)).xyz;
        vWn = normalize(mat3(modelMatrix) * normal);
      }`,
    fragmentShader: `
      varying vec3 vWp; varying vec3 vWn;
      float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        // 朝上的岩面积雪
        float up = smoothstep(0.35, 0.75, vWn.y + (hash21(floor(vWp.xz * 3.0)) - 0.5) * 0.25);
        csm_DiffuseColor.rgb = mix(csm_DiffuseColor.rgb, vec3(0.82, 0.87, 0.94), up);
      }`,
  });

  function cliffSeg(w, cx) {
    const g = new THREE.PlaneGeometry(w, 52, Math.max(24, w / 3 | 0), 26);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + cx, y = p.getY(i);
      let d = sfbm(x * 0.03, y * 0.03, 4) * 5 + sfbm(x * 0.1, y * 0.1, 3) * 1.5;
      d -= smooth(14, 0, y + 20) * 2; // 底部内凹埋雪
      p.setZ(i, d);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, cliffMat);
    m.position.set(cx, 22, -54);
    m.receiveShadow = true;
    group.add(m);
    return m;
  }
  cliffSeg(130, -85);  // 左段 [-150,-20]
  cliffSeg(140, 57);   // 右段 [-13,127]，中间留 6 米缝隙

  // ---------- 被雪埋住的缝隙 ----------
  const crevice = new THREE.Group();
  crevice.position.set(-16, 0, -50);
  const slabMat = new THREE.MeshStandardMaterial({ color: 0x1d2026, roughness: 0.97 });
  const slabL = new THREE.Mesh(new THREE.BoxGeometry(3.2, 11.5, 9), slabMat);
  slabL.position.set(-2.6, 4.6, 0);
  slabL.rotation.z = 0.36; slabL.rotation.y = 0.2;
  const slabR = new THREE.Mesh(new THREE.BoxGeometry(3.0, 10.5, 9), slabMat);
  slabR.position.set(2.4, 4.3, 0.3);
  slabR.rotation.z = -0.34; slabR.rotation.y = -0.15;
  const slabTop = new THREE.Mesh(new THREE.BoxGeometry(7.5, 2.2, 8), slabMat);
  slabTop.position.set(0, 9.4, 0);
  slabTop.rotation.z = 0.06;
  // 缝隙内的黑暗 + 深处温泉暖光
  const innerDark = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 9),
    new THREE.MeshStandardMaterial({ color: 0x03040a, roughness: 1 }),
  );
  innerDark.position.set(0, 4.2, -2.2);
  const warmGlow = new THREE.PointLight(0xff9a4e, 14, 16, 2);
  warmGlow.position.set(0, 2.2, -3.5);
  const glowSp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: dotTex, color: 0xff9a4e, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glowSp.position.set(0, 2.0, -2.6);
  glowSp.scale.setScalar(2.6);
  crevice.add(slabL, slabR, slabTop, innerDark, warmGlow, glowSp);
  group.add(crevice);
  // 缝隙口蒸汽
  makeSteam(batch, dotTex, new THREE.Vector3(-16, 1.2, -51.5));

  // ---------- 雪中岩石露头 ----------
  const rockGeo = new THREE.IcosahedronGeometry(1, 1);
  {
    const p = rockGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const n = 1 + sfbm(p.getX(i) * 1.2 + 3, p.getY(i) * 1.2, 2) * 0.4;
      p.setXYZ(i, p.getX(i) * n, p.getY(i) * n * 0.7, p.getZ(i) * n);
    }
    rockGeo.computeVertexNormals();
  }
  const outcrops = new THREE.InstancedMesh(rockGeo, cliffMat, 40);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const rng = mulberry32(313);
    const e = new THREE.Euler();
    for (let i = 0; i < 40; i++) {
      const x = (rng() - 0.5) * 260, z = -60 + rng() * 130;
      const r = 0.6 + rng() * rng() * 3.4;
      v.set(x, snowHeight(x, z) + r * 0.1, z);
      e.set(rng() * 3, rng() * 3, rng() * 3); q.setFromEuler(e);
      s.setScalar(r);
      m.compose(v, q, s);
      outcrops.setMatrixAt(i, m);
    }
  }
  group.add(outcrops);

  // ---------- 暴风雪 ----------
  const snowSystems = makeBlizzard(batch, dotTex, { count: 1100, area: 170, height: 44 });

  // ---------- 尾声（节点7）：门前身影 + 暖白光 ----------
  const epilogue = new THREE.Group();
  const figMat = new THREE.MeshStandardMaterial({ color: 0x10141a, roughness: 1 });
  function figure(px, pz, h = 1.78) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, h * 0.55, 4, 10), figMat);
    body.position.y = h * 0.5;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), figMat);
    head.position.y = h * 0.95;
    g.add(body, head);
    g.position.set(px, snowHeight(px, pz), pz);
    return g;
  }
  // 吴邪、胖子望着门口；门口站着小哥
  const f1 = figure(6.5, -20, 1.78);
  const f2 = figure(8.4, -19.2, 1.7); f2.scale.x = 1.35; // 胖子
  const f3 = figure(0.3, -35.2, 1.82);
  epilogue.add(f1, f2, f3);
  const doorGlow = new THREE.PointLight(0xffc890, 0, 40, 1.8);
  doorGlow.position.set(0, 6.5, -35);
  epilogue.add(doorGlow);
  epilogue.visible = false;
  group.add(epilogue);

  function update(t) {
    snowUniforms.uTime.value = t;
  }

  return { group, update, snowSystems, epilogue, doorGlow };
}
