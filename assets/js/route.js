import * as THREE from 'three';

// A glowing tube that "draws itself" along a curve as uProgress goes from 0 to 1.
export function createRoute(curve, { radius = 0.0012, color = 0xffb86b, segments = 240, dashes = 60 } = {}) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uProgress: { value: 0 },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uDashes: { value: dashes },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uProgress, uOpacity, uTime, uDashes;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float s = vUv.x;
        if (s > uProgress || uOpacity <= 0.0) discard;
        float head = smoothstep(uProgress - 0.06, uProgress, s);
        float dash = 0.55 + 0.45 * step(0.45, fract(s * uDashes - uTime * 0.6));
        vec3 c = uColor * (0.9 * dash + 3.0 * head);
        gl_FragColor = vec4(c * uOpacity, 1.0);
      }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 8, false), material);
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;

  return {
    mesh,
    set(progress, opacity, time) {
      material.uniforms.uProgress.value = progress;
      material.uniforms.uOpacity.value = opacity;
      material.uniforms.uTime.value = time;
      mesh.visible = opacity > 0.001 && progress > 0.001;
    },
  };
}
