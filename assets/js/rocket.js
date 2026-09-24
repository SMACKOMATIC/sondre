import * as THREE from 'three';

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }`;

// A two-stage launcher. Local +y is the nose. One unit = the full height.
export function createRocket() {
  const group = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf1f0ec, metalness: 0.25, roughness: 0.42 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x17191d, metalness: 0.55, roughness: 0.45 });
  const engineMat = new THREE.MeshStandardMaterial({ color: 0x3a3c40, metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide });

  const add = (geo, mat, y) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    group.add(m);
    return m;
  };
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.52, 32), white, 0.33); // first stage
  add(new THREE.CylinderGeometry(0.0505, 0.0505, 0.035, 32), dark, 0.61); // interstage
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 32), white, 0.73); // second stage
  add(new THREE.CylinderGeometry(0.0505, 0.0505, 0.012, 32), dark, 0.2);

  const ogive = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    ogive.push(new THREE.Vector2(0.05 * Math.pow(1 - Math.pow(t, 1.9), 0.62) + 0.0001, t * 0.17));
  }
  add(new THREE.LatheGeometry(ogive, 32), white, 0.83); // fairing

  const finGeo = new THREE.BoxGeometry(0.004, 0.1, 0.055);
  for (let k = 0; k < 4; k++) {
    const fin = new THREE.Mesh(finGeo, dark);
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    fin.position.set(Math.cos(a) * 0.072, 0.12, Math.sin(a) * 0.072);
    fin.rotation.y = -a;
    group.add(fin);
  }
  add(new THREE.CylinderGeometry(0.03, 0.046, 0.07, 24, 1, true), engineMat, 0.035); // engine bell

  const plumeMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uThrottle: { value: 0 },
      uHot: { value: new THREE.Color(4.2, 3.6, 2.8) },
      uWarm: { value: new THREE.Color(3.2, 1.25, 0.38) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vP;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vP = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uThrottle;
      uniform vec3 uHot, uWarm;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vP;
      ${NOISE}
      void main() {
        float s = 1.0 - vUv.y;
        vec3 V = normalize(cameraPosition - vP);
        float soft = pow(abs(dot(normalize(vN), V)), 1.3);
        float n = noise(vec2(vUv.x * 12.0, s * 8.0 - uTime * 11.0));
        float fall = pow(1.0 - s, 2.0);
        vec3 col = mix(uWarm, uHot, pow(1.0 - s, 5.0));
        float I = fall * soft * (0.5 + 0.7 * n) * uThrottle;
        gl_FragColor = vec4(col * I, 1.0);
      }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const plume = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.15, 1.0, 32, 1, true), plumeMat);
  plume.position.y = -0.5;
  plume.renderOrder = 5;
  group.add(plume);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.06, 0.34, 24, 1, true), plumeMat.clone());
  core.material.uniforms.uWarm.value = new THREE.Color(3.5, 2.6, 1.8);
  core.position.y = -0.17;
  core.renderOrder = 6;
  group.add(core);

  return {
    group,
    update(time, throttle) {
      for (const m of [plumeMat, core.material]) {
        m.uniforms.uTime.value = time;
        m.uniforms.uThrottle.value = throttle;
      }
      const flicker = 1 + Math.sin(time * 60) * 0.03;
      plume.scale.set(flicker, 0.85 + throttle * 0.3, flicker);
    },
  };
}
