// 岩缝温泉（节点2）：窄岩缝、温泉池、暖色蒸汽、顶部裂缝冷光
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { mulberry32 } from './util.js';
import { makeSteam } from './particles.js';
import { softDotMap, rockDetailMaps } from './textures.js';

const cnoise = createNoise2D(mulberry32(88));
function cfbm(x, y, oct = 4) {
  let v = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { v += a * cnoise(x * f, y * f); n += a; a *= 0.5; f *= 2.1; }
  return v / n;
}

export function buildCrevice(scene, batch) {
  const group = new THREE.Group();
  scene.add(group);
  const dotTex = softDotMap();
  const detail = rockDetailMaps();
  detail.bumpMap.repeat.set(8, 3);

  const CX = -16;         // 通道中线 x
  const Z0 = -52, Z1 = -92; // 通道范围

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x2b2622, roughness: 0.92, metalness: 0.04,
    bumpMap: detail.bumpMap, bumpScale: 2.5,
  });

  // ---------- 两侧岩壁 ----------
  function wall(sign) {
    const g = new THREE.PlaneGeometry(Z0 - Z1 + 14, 16, 90, 18);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      let d = cfbm(x * 0.08, y * 0.08, 4) * 1.8 + cfbm(x * 0.28, y * 0.28, 2) * 0.5;
      // 中部鼓出，形成窄缝感
      d += Math.max(0, 1 - Math.abs(y - 2) / 5) * 0.8;
      p.setZ(i, sign * d);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, rockMat);
    m.rotation.y = sign > 0 ? -Math.PI / 2 : Math.PI / 2;
    m.position.set(CX + sign * 3.1, 6, (Z0 + Z1) / 2 - 4);
    m.receiveShadow = true;
    group.add(m);
    return m;
  }
  wall(1); wall(-1);

  // ---------- 顶盖岩板（错落留缝） ----------
  const rng = mulberry32(17);
  for (let i = 0; i < 9; i++) {
    const w = 5 + rng() * 6, d = 5 + rng() * 7;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(8.5, 1.4 + rng(), d), rockMat);
    slab.position.set(CX + (rng() - 0.5) * 2, 10.5 + rng() * 2.5 + i * 0.35, Z0 - 6 - i * 4.6);
    slab.rotation.set((rng() - 0.5) * 0.2, (rng() - 0.5) * 0.5, (rng() - 0.5) * 0.16);
    group.add(slab);
  }

  // ---------- 地面 ----------
  const floorGeo = new THREE.PlaneGeometry(12, Z0 - Z1 + 14, 14, 60);
  floorGeo.rotateX(-Math.PI / 2);
  {
    const p = floorGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, cfbm(x * 0.3, z * 0.12, 3) * 0.5 - 0.2);
    }
    floorGeo.computeVertexNormals();
  }
  const floor = new THREE.Mesh(floorGeo, rockMat);
  floor.position.set(CX, 0, (Z0 + Z1) / 2 - 4);
  floor.receiveShadow = true;
  group.add(floor);

  // ---------- 温泉池 ----------
  const poolPos = new THREE.Vector3(CX - 0.4, 0.32, -76);
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.9, 0.9, 24, 1, true),
    rockMat,
  );
  basin.position.set(poolPos.x, 0.28, poolPos.z);
  group.add(basin);

  const waterUniforms = { uTime: { value: 0 } };
  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: waterUniforms,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 4378.545); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 c = vUv - 0.5;
        float r = length(c) * 2.0;
        float rip = noise(vUv * 14.0 + uTime * 0.35) * 0.5 + noise(vUv * 26.0 - uTime * 0.5) * 0.5;
        vec3 deep = vec3(0.04, 0.10, 0.12);
        vec3 warm = vec3(0.55, 0.34, 0.16);
        vec3 col = mix(deep, warm, smoothstep(0.55, 1.0, rip) * 0.5 + smoothstep(0.7, 1.0, r) * 0.35);
        col += vec3(0.2, 0.42, 0.45) * smoothstep(0.75, 1.0, rip) * 0.4;
        float a = 0.96 * smoothstep(1.0, 0.92, r);
        gl_FragColor = vec4(col, a);
      }`,
  });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(3.2, 28), waterMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.copy(poolPos);
  group.add(pool);

  // 池缘暖光 + 蒸汽
  const warm1 = new THREE.PointLight(0xff9440, 20, 22, 2);
  warm1.position.set(poolPos.x, 1.6, poolPos.z);
  const warm2 = new THREE.PointLight(0xffb060, 14, 14, 2);
  warm2.position.set(CX + 1, 2.5, -70);
  group.add(warm1, warm2);
  makeSteam(batch, dotTex, new THREE.Vector3(poolPos.x, 0.7, poolPos.z));

  // 顶部裂缝冷光（一线天光）
  const shaft = new THREE.SpotLight(0x9fc4e8, 150, 30, 0.5, 0.7, 1.6);
  shaft.position.set(CX - 0.5, 14, -64);
  const shaftTarget = new THREE.Object3D();
  shaftTarget.position.set(CX, 0, -64);
  group.add(shaft, shaftTarget);
  shaft.target = shaftTarget;

  // 深处通道尽头暖光（引向青铜门方向的暗示）
  const deep = new THREE.PointLight(0xff8a3a, 5, 18, 2);
  deep.position.set(CX, 2, Z1 + 4);
  group.add(deep);

  function update(t) {
    waterUniforms.uTime.value = t;
    warm1.intensity = 20 + Math.sin(t * 2.2) * 2.5;
    deep.intensity = 5 + Math.sin(t * 1.3 + 2) * 1.2;
  }

  return { group, update };
}
