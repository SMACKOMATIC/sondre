import * as THREE from 'three';
import { latLon } from './geo.js';

const SURFACE_VS = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vP;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vP = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const EARTH_FS = /* glsl */ `
  uniform sampler2D uDay, uNight, uWater, uClouds;
  uniform vec3 uSunDir;
  uniform float uCloudOffset;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vP;
  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vP);
    vec3 L = normalize(uSunDir);
    float ndl = dot(N, L);
    float dayMix = smoothstep(-0.08, 0.2, ndl);

    vec3 day = texture2D(uDay, vUv).rgb;
    vec3 night = texture2D(uNight, vUv).rgb;
    float water = texture2D(uWater, vUv).r;
    float cloud = texture2D(uClouds, vUv + vec2(uCloudOffset, 0.0)).r;

    float diffuse = max(ndl, 0.0);
    vec3 lit = day * (0.012 + 1.5 * diffuse);
    lit *= 1.0 - 0.4 * cloud * smoothstep(0.0, 0.3, ndl);
    lit *= mix(vec3(1.0, 0.6, 0.36), vec3(1.0), smoothstep(0.0, 0.28, ndl));

    vec3 lights = pow(night, vec3(2.4)) * vec3(5.5, 3.9, 2.2);
    lights *= 1.0 - 0.75 * cloud;
    vec3 col = mix(lights, lit, dayMix);

    vec3 H = normalize(L + V);
    float nh = max(dot(N, H), 0.0);
    float glint = pow(nh, 90.0) * water * smoothstep(-0.02, 0.25, ndl) * (1.0 - cloud);
    col += vec3(1.0, 0.86, 0.66) * glint * 2.0;
    col += vec3(0.35, 0.55, 0.85) * pow(nh, 6.0) * water * 0.06 * diffuse;

    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
    vec3 rim = mix(vec3(1.0, 0.42, 0.18), vec3(0.3, 0.58, 1.0), smoothstep(0.0, 0.35, ndl));
    col += rim * fres * smoothstep(-0.22, 0.25, ndl) * 1.1;

    gl_FragColor = vec4(col, 1.0);
  }`;

const CLOUD_FS = /* glsl */ `
  uniform sampler2D uClouds;
  uniform vec3 uSunDir;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vP;
  void main() {
    vec3 N = normalize(vN);
    vec3 L = normalize(uSunDir);
    float c = texture2D(uClouds, vUv).r;
    float ndl = dot(N, L);
    float light = smoothstep(-0.12, 0.35, ndl);
    vec3 col = mix(vec3(0.01, 0.014, 0.025), vec3(1.05), light);
    col *= mix(vec3(1.0, 0.55, 0.3), vec3(1.0), smoothstep(0.0, 0.3, ndl));
    gl_FragColor = vec4(col, c * 0.92);
  }`;

// Glow of the atmosphere around the limb. For each pixel, find how close the view ray
// passes to the Earth centre, and use that height to look up an exponential density.
const ATMO_FS = /* glsl */ `
  uniform vec3 uSunDir;
  uniform float uIntensity;
  varying vec3 vP;
  void main() {
    vec3 D = normalize(vP - cameraPosition);
    float t = -dot(cameraPosition, D);
    vec3 closest = cameraPosition + D * max(t, 0.0);
    float d = length(closest);
    float h = max(d - 1.0, 0.0);
    float dens = exp(-h / 0.02);
    dens *= mix(0.2, 1.0, smoothstep(-0.2, 0.2, t));
    vec3 L = normalize(uSunDir);
    float sunSide = dot(closest / d, L);
    float lit = smoothstep(-0.3, 0.2, sunSide);
    vec3 col = mix(vec3(1.0, 0.4, 0.14), vec3(0.3, 0.58, 1.0), smoothstep(-0.02, 0.35, sunSide)) * lit;
    float fwd = pow(max(dot(D, L), 0.0), 10.0);
    col += vec3(1.0, 0.7, 0.42) * fwd * smoothstep(-0.5, 0.05, sunSide) * 2.4;
    gl_FragColor = vec4(col * dens * uIntensity, 1.0);
  }`;

export function createEarth({ loader, sunDir, quality, maxAniso }) {
  const group = new THREE.Group();
  const load = (name, srgb = true) => {
    const t = loader.load(`assets/textures/${name}`);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, maxAniso);
    return t;
  };
  const day = load(`earth-day-${quality.tex}.jpg`);
  const night = load(`earth-night-${quality.tex}.jpg`);
  const water = load('earth-water-2k.jpg', false);
  const cloudsTex = load('earth-clouds-2k.jpg', false);
  const seg = quality.segments;

  const earthMat = new THREE.ShaderMaterial({
    uniforms: {
      uDay: { value: day },
      uNight: { value: night },
      uWater: { value: water },
      uClouds: { value: cloudsTex },
      uSunDir: { value: sunDir },
      uCloudOffset: { value: 0 },
    },
    vertexShader: SURFACE_VS,
    fragmentShader: EARTH_FS,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, seg, seg / 2), earthMat);
  group.add(earth);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.006, seg, seg / 2),
    new THREE.ShaderMaterial({
      uniforms: { uClouds: { value: cloudsTex }, uSunDir: { value: sunDir } },
      vertexShader: SURFACE_VS,
      fragmentShader: CLOUD_FS,
      transparent: true,
      depthWrite: false,
    })
  );
  clouds.renderOrder = 1;
  group.add(clouds);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.14, 96, 48),
    new THREE.ShaderMaterial({
      uniforms: { uSunDir: { value: sunDir }, uIntensity: { value: 1.35 } },
      vertexShader: SURFACE_VS,
      fragmentShader: ATMO_FS,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
  );
  atmosphere.renderOrder = 2;
  group.add(atmosphere);

  return {
    group,
    update(dt) {
      clouds.rotation.y += dt * 0.004;
      earthMat.uniforms.uCloudOffset.value = -clouds.rotation.y / (Math.PI * 2);
    },
  };
}

// A glowing dot with a pulsing ring, lying flat on the Earth's surface.
export function createMarker(lat, lon, color = new THREE.Color(2.4, 1.6, 0.7)) {
  const group = new THREE.Group();
  const p = latLon(lat, lon, 1.0025);
  group.position.copy(p);
  group.lookAt(p.clone().multiplyScalar(2));

  const mat = () =>
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0035, 24), mat());
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), mat());
  group.add(dot, ring);
  group.renderOrder = 3;

  return {
    group,
    position: p,
    update(time, weight) {
      group.visible = weight > 0.001;
      const k = (time * 0.55) % 1;
      ring.scale.setScalar(0.004 + 0.028 * k);
      ring.material.opacity = (1 - k) * weight;
      dot.material.opacity = weight;
    },
  };
}
