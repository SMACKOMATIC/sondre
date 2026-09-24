import * as THREE from 'three';

// 23,000 points, one per ESA applicant, shaped like a spiral galaxy.
// As uProgress goes 0 -> 1, the points drop out one by one until only two remain.
export function createSwarm({ count = 23000, pixelRatio = 1 } = {}) {
  const pos = new Float32Array(count * 3);
  const scatter = new Float32Array(count * 3);
  const special = new Float32Array(count);
  const rand = new Float32Array(count);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

  for (let i = 0; i < count; i++) {
    let x, y;
    if (Math.random() < 0.22) {
      const r = Math.abs(gauss()) * 0.022;
      const a = Math.random() * Math.PI * 2;
      x = Math.cos(a) * r;
      y = Math.sin(a) * r * 0.8;
    } else {
      const arm = i % 3;
      const r = 0.012 + Math.pow(Math.random(), 0.8) * 0.09;
      const a = (arm * Math.PI * 2) / 3 + r * 26 + gauss() * 0.35;
      x = Math.cos(a) * r + gauss() * 0.006;
      y = Math.sin(a) * r + gauss() * 0.006;
    }
    pos.set([x, y, gauss() * 0.004], i * 3);
    const d = new THREE.Vector3(x, y, (Math.random() - 0.5) * 0.05).normalize().multiplyScalar(0.4 + Math.random());
    scatter.set([d.x, d.y, d.z], i * 3);
    rand[i] = Math.random();
  }
  special[0] = special[1] = 1;
  rand[0] = 0.25;
  rand[1] = 0.75;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3));
  geo.setAttribute('aSpecial', new THREE.BufferAttribute(special, 1));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uProgress: { value: 0 },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aScatter;
      attribute float aSpecial;
      attribute float aRand;
      uniform float uProgress, uOpacity, uTime, uPixelRatio;
      varying float vAlpha;
      varying float vSpecial;
      void main() {
        vec3 p = position;
        float ang = uTime * (0.03 + 0.05 * (1.0 - length(p.xy) * 8.0));
        float cs = cos(ang), sn = sin(ang);
        p.xy = mat2(cs, -sn, sn, cs) * p.xy;

        float cut = 0.18 + aRand * 0.6;
        float gone = smoothstep(cut, cut + 0.08, uProgress) * (1.0 - aSpecial);
        p += aScatter * gone * gone * 0.12;

        vec3 target = vec3((aRand > 0.5 ? 1.0 : -1.0) * 0.011, 0.0, 0.015);
        p = mix(p, target, aSpecial * smoothstep(0.3, 0.85, uProgress));

        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        float size = mix(1.4 + aRand * 1.4, 7.0 + 15.0 * smoothstep(0.55, 0.95, uProgress), aSpecial);
        gl_PointSize = size * uPixelRatio;
        vAlpha = (1.0 - gone) * uOpacity;
        vSpecial = aSpecial;
      }`,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      varying float vSpecial;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = pow(smoothstep(0.5, 0.0, d), 1.8);
        vec3 col = mix(vec3(0.3, 0.45, 0.75), vec3(2.6, 1.8, 0.8), vSpecial);
        gl_FragColor = vec4(col * a * vAlpha, 1.0);
      }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 4;

  return {
    points,
    set(progress, opacity, time) {
      material.uniforms.uProgress.value = progress;
      material.uniforms.uOpacity.value = opacity;
      material.uniforms.uTime.value = time;
      points.visible = opacity > 0.001;
    },
    setPixelRatio(pr) {
      material.uniforms.uPixelRatio.value = pr;
    },
  };
}
