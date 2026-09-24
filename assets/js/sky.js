import * as THREE from 'three';

// Everything "infinitely far away". The group follows the camera, so it never shows parallax.
export function createSky({ loader, sunDir, starCount, pixelRatio }) {
  const group = new THREE.Group();

  const mwTex = loader.load('assets/textures/milkyway.jpg');
  mwTex.colorSpace = THREE.SRGBColorSpace;
  const milkyWay = new THREE.Mesh(
    new THREE.SphereGeometry(900, 64, 32),
    new THREE.MeshBasicMaterial({
      map: mwTex,
      side: THREE.BackSide,
      depthWrite: false,
      color: new THREE.Color(0.5, 0.52, 0.6),
    })
  );
  milkyWay.rotation.set(1.1, 0.5, 0.35);
  milkyWay.renderOrder = -10;
  group.add(milkyWay);

  const stars = createStars(starCount, pixelRatio);
  group.add(stars.points);

  const andromeda = createGalaxy(loader, 'assets/textures/andromeda.jpg', 1280 / 409, 150, 1.6);
  andromeda.mesh.position.set(0, 0, 0).add(new THREE.Vector3(0.62, 0.34, 0.71).normalize().multiplyScalar(600));
  andromeda.mesh.lookAt(0, 0, 0);
  andromeda.mesh.rotateZ(-0.45);
  group.add(andromeda.mesh);

  const whirlpool = createGalaxy(loader, 'assets/textures/whirlpool.jpg', 1280 / 888, 150, 1.5);
  whirlpool.mesh.position.copy(new THREE.Vector3(-0.35, -0.25, 0.9).normalize().multiplyScalar(600));
  whirlpool.mesh.lookAt(0, 0, 0);
  whirlpool.mesh.rotateZ(0.3);
  group.add(whirlpool.mesh);

  const sun = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sunTexture(),
      color: new THREE.Color(4.0, 3.5, 2.9),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    })
  );
  sun.position.copy(sunDir).multiplyScalar(500);
  sun.scale.setScalar(55);
  group.add(sun);

  return {
    group,
    galaxyDirs: {
      andromeda: andromeda.mesh.position.clone().normalize(),
      whirlpool: whirlpool.mesh.position.clone().normalize(),
    },
    update(time, camera, weights) {
      group.position.copy(camera.position);
      stars.material.uniforms.uTime.value = time;
      andromeda.material.uniforms.uOpacity.value = weights.andromeda;
      whirlpool.material.uniforms.uOpacity.value = weights.whirlpool;
    },
    setPixelRatio(pr) {
      stars.material.uniforms.uPixelRatio.value = pr;
    },
  };
}

function createStars(n, pixelRatio) {
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const phase = new Float32Array(n);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = s * Math.cos(a) * 800;
    pos[i * 3 + 1] = u * 800;
    pos[i * 3 + 2] = s * Math.sin(a) * 800;
    const kind = Math.random();
    if (kind < 0.62) c.setRGB(0.8, 0.88, 1.0);
    else if (kind < 0.9) c.setRGB(1.0, 0.96, 0.9);
    else c.setRGB(1.0, 0.78, 0.55);
    const b = Math.pow(Math.random(), 7);
    c.multiplyScalar(0.55 + b * 2.2);
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = 1.1 + b * 3.4;
    phase[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: pixelRatio } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColor;
      void main() {
        float tw = 0.72 + 0.28 * sin(uTime * (0.7 + aPhase * 1.8) + aPhase * 40.0);
        vColor = aColor * tw;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = pow(smoothstep(0.5, 0.0, d), 2.2);
        gl_FragColor = vec4(vColor * a, 1.0);
      }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, material);
  points.renderOrder = -9;
  points.frustumCulled = false;
  return { points, material };
}

function createGalaxy(loader, url, aspect, height, intensity) {
  const tex = loader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: tex }, uIntensity: { value: intensity }, uOpacity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uIntensity, uOpacity;
      varying vec2 vUv;
      void main() {
        vec3 c = max(texture2D(uMap, vUv).rgb - 0.012, 0.0);
        float m = smoothstep(1.0, 0.45, length((vUv - 0.5) * 2.0));
        gl_FragColor = vec4(c * m * uIntensity * uOpacity, 1.0);
      }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(height * aspect, height), material);
  mesh.renderOrder = -8;
  return { mesh, material };
}

function sunTexture() {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.08, 'rgba(255,250,235,1)');
  grd.addColorStop(0.2, 'rgba(255,215,160,0.35)');
  grd.addColorStop(0.5, 'rgba(255,170,90,0.07)');
  grd.addColorStop(1, 'rgba(255,150,80,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
