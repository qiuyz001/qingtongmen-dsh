import * as THREE from 'three';
import { mulberry32, makeMistTexture, makeGlowTexture, makeFlareTexture } from './textures.js';

const softSprite = `
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.06, length(c));
`;

/* ---------------- GPU snowfall ---------------- */
export class Snowfall {
  constructor({ count = 4200, box = [120, 55, 120], size = 1.5, color = 0xcfe0e6, opacity = 0.7, speed = 3.2, wind = 5.0, maxSize = 9.0 } = {}) {
    const rnd = mulberry32(8181 + count);
    const pos = new Float32Array(count * 3);
    const speedA = new Float32Array(count);
    const sizeA = new Float32Array(count);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * box[0];
      pos[i * 3 + 1] = (rnd() - 0.5) * box[1];
      pos[i * 3 + 2] = (rnd() - 0.5) * box[2];
      speedA[i] = speed * (0.55 + rnd() * 0.9);
      sizeA[i] = size * (0.4 + rnd() * 1.1);
      phase[i] = rnd() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speedA, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizeA, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: {
        uTime: { value: 0 }, uBox: { value: new THREE.Vector3(...box) },
        uPixelRatio: { value: 1 }, uColor: { value: new THREE.Color(color) },
        uOpacity: { value: opacity }, uWind: { value: wind }, uSizeScale: { value: 1 },
        uMaxSize: { value: maxSize },
      },
      vertexShader: `
        uniform float uTime, uPixelRatio, uWind, uSizeScale, uOpacity, uMaxSize;
        uniform vec3 uBox;
        attribute float aSpeed, aSize, aPhase;
        varying float vA;
        void main(){
          vec3 p = position;
          p.y = mod(p.y - uTime*aSpeed + uBox.y*0.5, uBox.y) - uBox.y*0.5;
          p.x = mod(p.x + uTime*uWind + sin(uTime*0.7+aPhase)*2.4 + uBox.x*0.5, uBox.x) - uBox.x*0.5;
          p.z = mod(p.z + cos(uTime*0.35+aPhase)*1.8 + uBox.z*0.5, uBox.z) - uBox.z*0.5;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float d = max(1.0, -mv.z);
          gl_PointSize = clamp(aSize * uPixelRatio * uSizeScale * 190.0 / d, 1.0, uMaxSize);
          vA = uOpacity * (0.35 + 0.65*smoothstep(uBox.x*0.5, 4.0, d)) * smoothstep(2.0, 9.0, d);
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uOpacity;
        varying float vA;
        void main(){
          ${softSprite}
          if(a < 0.01) discard;
          gl_FragColor = vec4(uColor, a * vA);
        }`,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }
  setPixelRatio(r) { this.material.uniforms.uPixelRatio.value = r; }
  update(t) { this.material.uniforms.uTime.value = t; }
  setOpacity(o) { this.material.uniforms.uOpacity.value = o; }
  setSize(s) { this.material.uniforms.uSizeScale.value = s; }
  dispose() { this.points.geometry.dispose(); this.material.dispose(); }
}

/* ---------------- wind streaks (blizzard) ---------------- */
export class SnowStreaks {
  constructor({
    count = 260, box = [110, 40, 110], color = 0xa9c4cc, opacity = 0.35,
    length = [0.7, 1.9], speed = 15, fall = 7, turbulence = 2.0,
  } = {}) {
    const rnd = mulberry32(555 + count);
    const pos = new Float32Array(count * 6);
    const seed = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const x = (rnd() - 0.5) * box[0], y = (rnd() - 0.5) * box[1], z = (rnd() - 0.5) * box[2];
      const len = length[0] + rnd() * (length[1] - length[0]);
      pos.set([x, y, z, x + len, y - len * 0.13, z + (rnd() - 0.5) * len * 0.18], i * 6);
      seed.set([rnd() * 100, rnd()], i * 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uBox: { value: new THREE.Vector3(...box) }, uColor: { value: new THREE.Color(color) },
        uOpacity: { value: opacity }, uSpeed: { value: speed }, uFall: { value: fall }, uTurb: { value: turbulence },
      },
      vertexShader: `
        uniform float uTime, uSpeed, uFall, uTurb; uniform vec3 uBox;
        attribute vec2 aSeed;
        varying float vA;
        void main(){
          vec3 p = position;
          p.y = mod(p.y - uTime*(uFall+aSeed.y*uFall*0.55) + uBox.y*0.5, uBox.y) - uBox.y*0.5;
          p.x = mod(p.x + uTime*(uSpeed+aSeed.y*uSpeed*0.5) + uBox.x*0.5, uBox.x) - uBox.x*0.5;
          p.z = mod(p.z + cos(uTime*0.8+aSeed.x)*uTurb + uBox.z*0.5, uBox.z) - uBox.z*0.5;
          vec4 mv = modelViewMatrix*vec4(p,1.0);
          gl_Position = projectionMatrix*mv;
          vA = smoothstep(max(uBox.z*0.62, 80.0), 6.0, -mv.z) * smoothstep(2.5, 11.0, -mv.z);
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uOpacity; varying float vA;
        void main(){ gl_FragColor = vec4(uColor, vA*uOpacity); }`,
    });
    this.lines = new THREE.LineSegments(geo, this.material);
    this.lines.frustumCulled = false;
  }
  update(t) { this.material.uniforms.uTime.value = t; }
}

/* ---------------- wind-driven snow veils (screen-crossing bands) ---------------- */
export class SnowVeil {
  constructor({ count = 14, box = [130, 40, 110], color = 0xdfeef2, opacity = 0.09 } = {}) {
    this.group = new THREE.Group();
    this.items = [];
    const tex = makeMistTexture(15, false);
    const rnd = mulberry32(4411);
    this.box = box;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex, color, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.NormalBlending, fog: false,
      });
      const s = new THREE.Sprite(mat);
      const item = {
        sprite: s,
        x: (rnd() - 0.5) * box[0],
        y: (rnd() - 0.15) * box[1],
        z: (rnd() - 0.5) * box[2],
        sx: 26 + rnd() * 34,
        sy: 6 + rnd() * 9,
        phase: rnd() * 20,
        speed: 16 + rnd() * 18,
        base: opacity * (0.5 + rnd()),
      };
      s.scale.set(item.sx, item.sy, 1);
      s.position.set(item.x, item.y, item.z);
      s.renderOrder = 6;
      this.group.add(s);
      this.items.push(item);
    }
  }
  update(t) {
    const { box } = this;
    for (const it of this.items) {
      const x = ((it.x + t * it.speed + box[0] * 0.5) % box[0]) - box[0] * 0.5;
      const y = it.y + Math.sin(t * 0.5 + it.phase) * 2.4;
      it.sprite.position.set(x, y, it.z);
      it.sprite.material.opacity = it.base * (0.55 + 0.45 * Math.sin(t * 0.7 + it.phase));
    }
  }
}

/* ---------------- volumetric-ish mist quads ---------------- */
export class MistField {
  constructor({
    count = 16, center = [0, 8, -20], extent = [40, 26, 50], size = [12, 9], color = 0x7fb8c8,
    opacity = 0.1, rise = 0.7, mode = 'billboard', texture = null, blending = THREE.AdditiveBlending,
  } = {}) {
    this.group = new THREE.Group();
    this.group.position.set(...center);
    this.items = [];
    this.extent = extent;
    this.rise = rise;
    this.intensity = 1;
    const tex = texture || makeMistTexture(9, mode === 'billboard');
    const rnd = mulberry32(2701 + count);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
        blending, color, fog: false,
      });
      const geo = new THREE.PlaneGeometry(1, 1);
      const mesh = new THREE.Mesh(geo, mat);
      const item = {
        mesh,
        x: (rnd() - 0.5) * extent[0],
        y: rnd() * extent[1],
        z: (rnd() - 0.5) * extent[2],
        sx: size[0] * (0.55 + rnd() * 1.0),
        sy: size[1] * (0.55 + rnd() * 1.0),
        phase: rnd() * 10,
        speed: 0.45 + rnd() * 0.9,
        baseOpacity: opacity * (0.6 + rnd() * 0.8),
        rot: (rnd() - 0.5) * 0.8,
      };
      if (mode === 'ground') { mesh.rotation.x = -Math.PI / 2; mesh.scale.set(item.sx * 1.8, item.sy * 1.8, 1); }
      else mesh.scale.set(item.sx, item.sy, 1);
      mesh.position.set(item.x, item.y, item.z);
      mesh.renderOrder = 4;
      this.group.add(mesh);
      this.items.push(item);
    }
    this.mode = mode;
  }
  setIntensity(k) { this.intensity = k; }
  update(t, camera) {
    for (const it of this.items) {
      const h = ((it.y + t * this.rise * it.speed) % this.extent[1]);
      it.mesh.position.set(it.x + Math.sin(t * 0.17 + it.phase) * 2.5, h, it.z + Math.cos(t * 0.12 + it.phase) * 2.0);
      const fade = Math.min(1, h / 5) * Math.min(1, (this.extent[1] - h) / 7);
      it.mesh.material.opacity = this.intensity * it.baseOpacity * (0.55 + 0.45 * Math.sin(t * 0.3 + it.phase)) * Math.max(0.05, fade);
      if (this.mode === 'billboard' && camera) {
        it.mesh.rotation.y = Math.atan2(camera.position.x - (this.group.position.x + it.mesh.position.x), camera.position.z - (this.group.position.z + it.mesh.position.z)) + it.rot;
      } else if (this.mode === 'ground') {
        it.mesh.rotation.z = t * 0.01 + it.phase;
      }
    }
  }
}

/* ---------------- steam / dust point cloud ---------------- */
export class SoftPuffs {
  constructor({ count = 160, box = [10, 8, 12], center = [0, 0, 0], size = 34, color = 0xa8c0bd, opacity = 0.16, rise = 0.6, blending = THREE.NormalBlending, tex = null } = {}) {
    const rnd = mulberry32(6060 + count);
    const pos = new Float32Array(count * 3), seed = new Float32Array(count * 2), sz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * box[0];
      pos[i * 3 + 1] = rnd() * box[1];
      pos[i * 3 + 2] = (rnd() - 0.5) * box[2];
      seed[i * 2] = rnd(); seed[i * 2 + 1] = rnd() * 100;
      sz[i] = 0.5 + rnd() * 1.1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending,
      uniforms: {
        uTime: { value: 0 }, uBox: { value: new THREE.Vector3(...box) }, uSize: { value: size },
        uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uRise: { value: rise },
        uMap: { value: tex }, uPixelRatio: { value: 1 },
      },
      vertexShader: `
        uniform float uTime, uSize, uRise; uniform vec3 uBox;
        attribute vec2 aSeed; attribute float aSize;
        varying float vA; varying vec2 vUv;
        void main(){
          vec3 p = position;
          float life = fract(uTime*uRise*0.08 + aSeed.x);
          p.y = life*uBox.y + position.y*0.15;
          p.x += sin(uTime*0.3 + aSeed.y)*1.2 + life*1.6;
          p.z += cos(uTime*0.23 + aSeed.y)*0.9;
          vec4 mv = modelViewMatrix*vec4(p,1.0);
          gl_Position = projectionMatrix*mv;
          gl_PointSize = clamp(uSize*aSize*300.0/max(1.0,-mv.z), 2.0, 240.0);
          vA = sin(life*3.14159) * smoothstep(140.0, 4.0, -mv.z);
          vUv = uv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uOpacity; uniform sampler2D uMap;
        varying float vA;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.1, length(c));
          vec4 t = texture2D(uMap, gl_PointCoord);
          a *= t.a;
          gl_FragColor = vec4(uColor, a*vA*uOpacity);
        }`,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.position.set(...center);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }
  update(t) { this.material.uniforms.uTime.value = t; }
  setPixelRatio(r) { this.material.uniforms.uPixelRatio.value = r; }
}

/* ---------------- dust motes (flashlight) ---------------- */
export class DustMotes {
  constructor({ count = 340, box = [30, 16, 30], size = 1.2, color = 0xbfd8d2, opacity = 0.5 } = {}) {
    const rnd = mulberry32(1234);
    const pos = new Float32Array(count * 3), phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * box[0];
      pos[i * 3 + 1] = (rnd() - 0.5) * box[1];
      pos[i * 3 + 2] = (rnd() - 0.5) * box[2];
      phase[i] = rnd() * 30;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uPixelRatio: { value: 1 } },
      vertexShader: `
        uniform float uTime, uPixelRatio; attribute float aPhase; varying float vA;
        void main(){
          vec3 p = position;
          p += vec3(sin(uTime*0.12+aPhase), cos(uTime*0.09+aPhase*1.7), sin(uTime*0.07+aPhase*0.4))*0.8;
          vec4 mv = modelViewMatrix*vec4(p,1.0);
          gl_Position = projectionMatrix*mv;
          gl_PointSize = clamp(1.6*uPixelRatio*140.0/max(1.0,-mv.z), 1.0, 5.0);
          vA = smoothstep(40.0, 2.0, -mv.z);
        }`,
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vA;
        void main(){ vec2 c=gl_PointCoord-.5; float a=smoothstep(.5,.05,length(c)); gl_FragColor=vec4(uColor,a*vA*uOpacity); }`,
      fog: false,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
  }
  update(t) { this.material.uniforms.uTime.value = t; }
}

/* ---------------- flare ---------------- */
export class Flare {
  constructor(scene, { start = [16, 12, 44], peak = [4, 32, 8], intensity = 1800 } = {}) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.spriteMat = new THREE.SpriteMaterial({ map: makeFlareTexture(), color: 0xfff1d6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
    this.sprite = new THREE.Sprite(this.spriteMat);
    this.sprite.scale.set(3, 3, 1);
    this.group.add(this.sprite);
    this.glowMat = new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xffb066, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
    this.glow = new THREE.Sprite(this.glowMat);
    this.glow.scale.set(26, 26, 1);
    this.group.add(this.glow);
    this.light = new THREE.PointLight(0xfff0d8, 0, 430, 0.58);
    this.light.position.set(0, 0, 0);
    this.group.add(this.light);
    this.time = -1;
    this.level = 0;
    this.active = false;
    this.power = intensity;
    this.start = new THREE.Vector3(...start);
    this.peak = new THREE.Vector3(...peak);
    // sparks
    const N = 200;
    const rnd = mulberry32(991);
    const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos.set([0, 0, 0], i * 3);
      const theta = rnd() * Math.PI * 2, phi = Math.acos(rnd() * 2 - 1), sp = 3 + rnd() * 14;
      vel.set([Math.sin(phi) * Math.cos(theta) * sp, Math.cos(phi) * sp * 0.7, Math.sin(phi) * Math.sin(theta) * sp], i * 3);
      life[i] = rnd();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
    this.sparkMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uOrigin: { value: new THREE.Vector3() }, uActive: { value: 0 } },
      vertexShader: `
        uniform float uTime, uActive; uniform vec3 uOrigin;
        attribute vec3 aVel; attribute float aLife; varying float vA;
        void main(){
          float t = mod(uTime + aLife*2.2, 2.2);
          vec3 p = uOrigin + aVel*t + vec3(0.0,-4.9,0.0)*t*t;
          p.x += sin(t*9.0+aLife*20.0)*0.2;
          vec4 mv = modelViewMatrix*vec4(p,1.0);
          gl_Position = projectionMatrix*mv;
          gl_PointSize = clamp(5.0*(1.0-t/2.2)*180.0/max(1.0,-mv.z), 1.0, 14.0);
          vA = uActive*(1.0-t/2.2);
        }`,
      fragmentShader: `varying float vA; void main(){ vec2 c=gl_PointCoord-.5; float a=smoothstep(.5,0.0,length(c)); gl_FragColor=vec4(1.0,0.72,0.4,a*vA); }`,
    });
    this.sparks = new THREE.Points(geo, this.sparkMat);
    this.sparks.frustumCulled = false;
    this.group.add(this.sparks);
  }
  trigger() {
    this.time = 0;
    this.active = true;
    this.level = 0;
    this.group.visible = true;
    this.sparkMat.uniforms.uOrigin.value.copy(this.start);
    this.sparkMat.uniforms.uActive.value = 1;
  }
  reset() { this.time = -1; this.level = 0; this.active = false; this.group.visible = false; this.light.intensity = 0; }
  update(dt) {
    if (this.time < 0) { this.level = 0; return; }
    this.time += dt;
    const t = this.time;
    const k = Math.min(1, t / 1.35);
    const ease = 1 - Math.pow(1 - k, 3);
    const p = new THREE.Vector3().lerpVectors(this.start, this.peak, ease);
    p.y += Math.sin(t * 1.1) * 0.4;
    this.group.position.copy(p);
    let intensity = 0;
    if (t < 0.9) intensity = this.power * (t / 0.9);
    else if (t < 5.5) intensity = this.power * (1 + Math.sin(t * 23) * 0.07 + Math.sin(t * 7.1) * 0.04);
    else intensity = Math.max(0, this.power * (1 - (t - 5.5) / 3.2));
    this.light.intensity = intensity;
    this.level = t < 0.9 ? t / 0.9 : t < 5.5 ? 1 : Math.max(0, 1 - (t - 5.5) / 3.2);
    const life = Math.max(0, 1 - t / 8.6);
    this.spriteMat.opacity = Math.min(1, t * 3) * life;
    this.glowMat.opacity = 0.5 * Math.min(1, t * 2) * life;
    const sc = 2.2 + 2.8 * Math.min(1, t / 1.1) + (1 - life) * 2;
    this.sprite.scale.set(sc, sc, 1);
    this.glow.scale.set(16 + (1 - life) * 12, 16 + (1 - life) * 12, 1);
    this.sparkMat.uniforms.uTime.value = t;
    this.sparkMat.uniforms.uActive.value = t < 2.4 ? 1 : 0;
    if (t > 9) { this.time = -1; this.level = 0; this.active = false; this.group.visible = false; this.light.intensity = 0; }
  }
}

/* ---------------- skin burst flecks ---------------- */
export class SkinBurst {
  constructor(scene, origin = new THREE.Vector3(0, 16, -51.4)) {
    this.scene = scene;
    const N = 380;
    this.N = N;
    const rnd = mulberry32(4711);
    this.pos = new Float32Array(N * 3);
    this.vel = new Float32Array(N * 3);
    this.rot = new Float32Array(N * 3);
    this.seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const y = rnd() * 28;
      this.pos.set([(rnd() - 0.5) * 3.2, y, (rnd() - 0.5) * 0.6], i * 3);
      this.vel.set([(rnd() - 0.5) * 7, (rnd() - 0.2) * 4 + 1, 2.5 + rnd() * 8], i * 3);
      this.rot.set([rnd() * 6, rnd() * 6, rnd() * 6], i * 3);
      this.seed[i] = rnd();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(N).map((_, i) => 0.25 + rnd() * 0.8), 1));
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(0x9aa59b) }, uOpacity: { value: 1 } },
      vertexShader: `
        attribute float aSize; varying float vA;
        void main(){
          vec4 mv = modelViewMatrix*vec4(position,1.0);
          gl_Position = projectionMatrix*mv;
          gl_PointSize = clamp(aSize*300.0/max(1.0,-mv.z), 1.5, 40.0);
          vA = smoothstep(0.0, 2.0, position.y);
        }`,
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vA;
        void main(){ vec2 c=gl_PointCoord-.5; float a=smoothstep(.5,.15,length(c)); gl_FragColor=vec4(uColor,a*0.85*uOpacity); }`,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.position.copy(origin);
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
    this.time = -1;
    this.origin = origin.clone();
  }
  burst() {
    this.time = 0; this.points.visible = true;
    this.points.position.copy(this.origin);
    this.points.geometry.attributes.position.array.set(this.pos);
    this.points.geometry.attributes.position.needsUpdate = true;
  }
  hide() { this.time = -1; this.points.visible = false; }
  update(dt) {
    if (this.time < 0) return;
    this.time += dt;
    if (this.time > 3.6) { this.hide(); return; }
    const arr = this.points.geometry.attributes.position.array;
    for (let i = 0; i < this.N; i++) {
      arr[i * 3] += this.vel[i * 3] * dt;
      arr[i * 3 + 1] += (this.vel[i * 3 + 1] - this.time * 4.5) * dt;
      arr[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3 + 1] -= 2.2 * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.material.uniforms.uOpacity.value = Math.min(1, (3.6 - this.time) / 1.2);
  }
}

/* ---------------- ember / torch wisps for the open door ---------------- */
export class TorchEmbers {
  constructor({ count = 90, center = [0, 0, 0], spread = 10, color = 0xff9a4a } = {}) {
    const rnd = mulberry32(3141);
    const pos = new Float32Array(count * 3), phase = new Float32Array(count), size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * spread;
      pos[i * 3 + 1] = rnd() * 12;
      pos[i * 3 + 2] = (rnd() - 0.5) * spread;
      phase[i] = rnd() * 100; size[i] = 0.4 + rnd();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.6 } },
      vertexShader: `
        uniform float uTime; attribute float aPhase, aSize; varying float vA;
        void main(){
          vec3 p = position;
          p.y = mod(p.y + uTime*(0.6+aSize*0.7) + aPhase, 14.0);
          p.x += sin(uTime*0.35+aPhase)*1.4;
          p.z += cos(uTime*0.22+aPhase)*1.0;
          vec4 mv = modelViewMatrix*vec4(p,1.0);
          gl_Position = projectionMatrix*mv;
          gl_PointSize = clamp(aSize*6.0*140.0/max(1.0,-mv.z), 1.0, 9.0);
          vA = smoothstep(14.0, 0.0, p.y) * smoothstep(90.0, 3.0, -mv.z);
        }`,
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vA;
        void main(){ vec2 c=gl_PointCoord-.5; float a=smoothstep(.5,.0,length(c)); gl_FragColor=vec4(uColor,a*vA*uOpacity); }`,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.position.set(...center);
    this.points.frustumCulled = false;
  }
  update(t) { this.material.uniforms.uTime.value = t; }
}
