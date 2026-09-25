import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { latLon, toLatLon, smooth, bump, easeInOut, clamp01, lerp, esaProgress } from './geo.js';
import { createSky } from './sky.js';
import { createEarth, createMarker } from './earth.js';
import { createISS } from './iss.js';
import { createRocket } from './rocket.js';
import { createSwarm } from './swarm.js';
import { createRoute } from './route.js';

const SUN_DIR = latLon(10, -30).normalize();
const UP = new THREE.Vector3(0, 1, 0);
const O = new THREE.Vector3();

// Chapter order must match the data-chapter sections in index.html.
export const CHAPTERS = ['hero', 'origin', 'training', 'esa', 'launch', 'iss', 'work', 'film', 'media', 'contact'];

export function createScene(canvas, { quality, reducedMotion = false, snap = false, onProgress, onLoaded } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  // Capped by a total pixel budget: large external monitors otherwise exhaust GPU memory and Chrome shows black tiles.
  const pixelRatio = () =>
    Math.min(window.devicePixelRatio || 1, quality.maxDpr, Math.sqrt(quality.maxPixels / (window.innerWidth * window.innerHeight)));
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.001, 2000);

  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => onProgress?.(loaded / total);
  manager.onLoad = () => onLoaded?.();
  const loader = new THREE.TextureLoader(manager);

  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: quality.msaa })
  );
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.62, 0.55, 1.1);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---- Lights ----
  const sunLight = new THREE.DirectionalLight(0xfff2e2, 3.4);
  sunLight.position.copy(SUN_DIR).multiplyScalar(50);
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0x1c2a40, 0.35));
  const earthShine = new THREE.HemisphereLight(0x000000, 0x2a5aa0, 0.9);
  scene.add(earthShine);

  // ---- World ----
  const sky = createSky({ loader, sunDir: SUN_DIR, starCount: quality.stars, pixelRatio: renderer.getPixelRatio() });
  scene.add(sky.group);

  const earth = createEarth({ loader, sunDir: SUN_DIR, quality, maxAniso: renderer.capabilities.getMaxAnisotropy() });
  scene.add(earth.group);

  const SAND = latLon(66.02, 12.63);
  const MOJAVE = latLon(35.06, -118.15);
  const markers = {
    sand: createMarker(66.02, 12.63),
    mojave: createMarker(35.06, -118.15),
  };
  for (const m of Object.values(markers)) scene.add(m.group);

  // Training: one suborbital hop from Mojave (height exaggerated) and a row of Zero-G parabolas.
  const suborbital = createRoute(
    new THREE.CatmullRomCurve3(
      Array.from({ length: 48 }, (_, i) => {
        const s = i / 47;
        return latLon(lerp(35.06, 36.4, s), lerp(-118.15, -111.5, s), 1.002 + 0.05 * 4 * s * (1 - s));
      })
    ),
    { radius: 0.0011, color: 0xffb86b }
  );
  const parabolas = createRoute(
    new THREE.CatmullRomCurve3(
      Array.from({ length: 160 }, (_, i) => {
        const s = i / 159;
        const hump = Math.pow(Math.abs(Math.sin(s * Math.PI * 7)), 0.75);
        return latLon(lerp(31.5, 32.5, s), lerp(-117.5, -106.5, s), 1.006 + 0.008 * hump);
      })
    ),
    { radius: 0.0008, color: 0x9fd0ff, segments: 600, dashes: 0 }
  );
  scene.add(suborbital.mesh, parabolas.mesh);

  // ESA selection swarm, floating above Europe.
  const ESA_C = latLon(50.5, 8, 1.13);
  const esaCam = latLon(44, -7, 1.7);
  const swarm = createSwarm({ pixelRatio: renderer.getPixelRatio() });
  swarm.points.position.copy(ESA_C);
  swarm.points.scale.setScalar(0.9);
  swarm.points.lookAt(esaCam);
  scene.add(swarm.points);

  // Launch: a path from above Northern Norway up to orbit, ending just behind the ISS.
  const rocketPath = new THREE.CatmullRomCurve3([
    latLon(67.4, 13, 1.035),
    latLon(66.6, 19, 1.06),
    latLon(64.8, 27.5, 1.1),
    latLon(62, 37, 1.145),
    latLon(58.5, 47, 1.18),
    latLon(55, 57, 1.2),
  ]);
  const rocket = createRocket();
  rocket.group.scale.setScalar(0.011);
  scene.add(rocket.group);
  const contrail = createRoute(rocketPath, { radius: 0.00014, color: 0xffd6a0, dashes: 0 });
  scene.add(contrail.mesh);

  const issPos = rocketPath.getPointAt(1).addScaledVector(rocketPath.getTangentAt(1), 0.07);
  issPos.setLength(1.2);
  const issBasis = (() => {
    const y = issPos.clone().normalize();
    const z = rocketPath.getTangentAt(1).clone();
    z.addScaledVector(y, -z.dot(y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    return { x, y, z };
  })();
  const iss = createISS();
  iss.group.scale.setScalar(0.042);
  iss.group.position.copy(issPos);
  iss.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(issBasis.x, issBasis.y, issBasis.z));
  iss.group.updateMatrixWorld();
  iss.trackSun(SUN_DIR);
  scene.add(iss.group);
  earthShine.position.copy(issBasis.y);

  // Moon, placed so it sits beside the Earth in the "work" shot.
  const workPos = latLon(14, 100, 4.6);
  const moonTex = loader.load('assets/textures/moon-1k.jpg');
  moonTex.colorSpace = THREE.SRGBColorSpace;
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 64, 32),
    new THREE.MeshStandardMaterial({ map: moonTex, roughness: 1, metalness: 0 })
  );
  {
    const fwd = O.clone().sub(workPos).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    moon.position.copy(workPos).addScaledVector(fwd, 14).addScaledVector(right, -2.2).addScaledVector(up, 3.4);
  }
  scene.add(moon);

  // ---- Shots: where the camera is for each chapter ----
  const wide = () => camera.aspect > 1.05;

  // Look past `subject` so it appears offset on screen: dx > 0 moves it right, dy > 0 moves it up.
  function framed(pos, subject, dx, dy = 0, portraitDy = 0.13) {
    const f = subject.clone().sub(pos);
    const dist = f.length();
    f.normalize();
    const r = new THREE.Vector3().crossVectors(f, UP).normalize();
    const u = new THREE.Vector3().crossVectors(r, f).normalize();
    const w = wide();
    return subject
      .clone()
      .addScaledVector(r, -(w ? dx : 0) * dist)
      .addScaledVector(u, -(w ? dy : portraitDy) * dist);
  }

  const rocketProgress = (loc) => smooth(0.06, 0.97, loc);

  function chase(rp) {
    const P = rocketPath.getPointAt(rp);
    const T = rocketPath.getTangentAt(rp);
    const U = P.clone().normalize();
    const S = new THREE.Vector3().crossVectors(T, U).normalize();
    const pos = P.clone().addScaledVector(T, -0.05).addScaledVector(S, 0.034).addScaledVector(U, 0.014);
    return { pos, P };
  }

  const shots = [
    (c) => {
      const r = (wide() ? 3.3 : 4.8) + 2.6 * (1 - c.intro);
      const pos = latLon(22, 46 + c.drift * 3, r);
      return { pos, target: framed(pos, O, 0.25, 0, 0.3), fov: 36, alt: 21000 };
    },
    () => {
      const pos = latLon(54, -2, 2.0);
      return { pos, target: framed(pos, SAND, 0.2), fov: 36, alt: 400 };
    },
    () => {
      const pos = latLon(20, -131, 1.4);
      return { pos, target: framed(pos, latLon(34.5, -114, 1.02), -0.2), fov: 36, alt: 100 };
    },
    () => ({ pos: esaCam.clone(), target: framed(esaCam, ESA_C, 0.19), fov: 38, alt: 800 }),
    (c) => {
      const ch = chase(c.rp);
      return { pos: ch.pos, target: framed(ch.pos, ch.P, -0.16, 0.1), fov: 42, alt: lerp(60, 400, c.rp) };
    },
    (c) => {
      const a = lerp(-1.0, 0.35, clamp01(c.loc[5]));
      const pos = issPos
        .clone()
        .addScaledVector(issBasis.x, Math.cos(a) * 0.085)
        .addScaledVector(issBasis.z, Math.sin(a) * 0.085)
        .addScaledVector(issBasis.y, 0.024);
      return { pos, target: framed(pos, issPos, 0.17), fov: 40, alt: 408 };
    },
    () => ({ pos: workPos.clone(), target: framed(workPos, O, -0.24), fov: 38, alt: 36000 }),
    () => {
      const pos = latLon(8, 140, 7);
      return { pos, target: framed(pos, pos.clone().addScaledVector(sky.galaxyDirs.andromeda, 50), 0.2), fov: 40, alt: 384400 };
    },
    () => {
      const pos = latLon(-6, 175, 9);
      return { pos, target: framed(pos, pos.clone().addScaledVector(sky.galaxyDirs.whirlpool, 50), -0.2), fov: 40, alt: 1500000 };
    },
    () => {
      const pos = latLon(18, 24, 7.2);
      return { pos, target: framed(pos, O, 0.22), fov: 36, alt: 39500 };
    },
  ];

  function slerpPos(a, b, e) {
    const ra = a.length();
    const rb = b.length();
    const da = a.clone().divideScalar(ra);
    const db = b.clone().divideScalar(rb);
    const ang = Math.acos(THREE.MathUtils.clamp(da.dot(db), -1, 1));
    let d;
    if (ang < 1e-3) d = da.lerp(db, e).normalize();
    else {
      const s = Math.sin(ang);
      d = da.multiplyScalar(Math.sin((1 - e) * ang) / s).addScaledVector(db, Math.sin(e * ang) / s);
    }
    const r = lerp(ra, rb, e) + Math.sin(Math.PI * e) * ang * 0.35 * Math.min(ra, rb);
    return d.multiplyScalar(r);
  }

  function desiredShot(ctx) {
    const n = shots.length;
    const t = THREE.MathUtils.clamp(ctx.t, 0, n - 1);
    const i = Math.floor(t);
    const f = t - i;
    const A = shots[i](ctx);
    if (f < 1e-4 || i >= n - 1) return A;
    const B = shots[i + 1](ctx);
    const e = easeInOut(f);
    return {
      pos: slerpPos(A.pos, B.pos, e),
      target: A.target.clone().lerp(B.target, e),
      fov: lerp(A.fov, B.fov, e),
      alt: Math.exp(lerp(Math.log(A.alt), Math.log(B.alt), e)),
    };
  }

  // ---- Camera state (damped, so scrolling feels smooth) ----
  const cam = { dir: new THREE.Vector3(), r: 0, target: new THREE.Vector3(), fov: 38, init: false };
  const mouse = new THREE.Vector2();
  const pointerV = new THREE.Vector2();
  let introStart = null;

  const labelDefs = [
    { id: 'sandnessjoen', pos: SAND, w: (t) => bump(t, 1, 0.45) },
    { id: 'mojave', pos: MOJAVE, w: (t) => bump(t, 2, 0.45) },
    { id: 'iss', pos: issPos, w: (t) => bump(t, 5, 0.4) },
    { id: 'moon', pos: moon.position, w: (t) => bump(t, 6, 0.45) },
  ];
  const v = new THREE.Vector3();
  const toCam = new THREE.Vector3();

  function update({ t, loc, dt, time, pointer, loaded }) {
    if (loaded && introStart === null) introStart = time;
    const intro = reducedMotion || snap ? 1 : introStart === null ? 0 : easeInOut(clamp01((time - introStart) / 3.2));
    const rp = rocketProgress(loc[4] ?? 0);
    const ctx = { t, loc, rp, intro, drift: reducedMotion ? 0 : Math.sin(time * 0.05) };
    const shot = desiredShot(ctx);

    // `snap` (?snap in the URL) turns off smoothing, for screenshots.
    const k = cam.init && !snap ? 1 - Math.exp(-dt * (reducedMotion ? 10 : 4.2)) : 1;
    const sr = shot.pos.length();
    const sd = shot.pos.clone().divideScalar(sr);
    if (!cam.init) {
      cam.dir.copy(sd);
      cam.r = sr;
      cam.target.copy(shot.target);
      cam.fov = shot.fov;
      cam.init = true;
    } else {
      cam.dir.lerp(sd, k).normalize();
      cam.r += (sr - cam.r) * k;
      cam.target.lerp(shot.target, k);
      cam.fov += (shot.fov - cam.fov) * k;
    }

    camera.position.copy(cam.dir).multiplyScalar(Math.max(cam.r, 1.012));
    const dist = camera.position.distanceTo(cam.target);
    if (!reducedMotion) {
      mouse.lerp(pointerV.set(pointer.x, pointer.y), 1 - Math.exp(-dt * 3));
      const f = cam.target.clone().sub(camera.position).normalize();
      const right = new THREE.Vector3().crossVectors(f, UP).normalize();
      const up = new THREE.Vector3().crossVectors(right, f);
      const amp = dist * 0.012;
      camera.position
        .addScaledVector(right, (mouse.x + Math.sin(time * 0.13) * 0.35) * amp)
        .addScaledVector(up, (-mouse.y + Math.cos(time * 0.11) * 0.35) * amp);
    }
    camera.lookAt(cam.target);
    const rNow = camera.position.length();
    camera.near = THREE.MathUtils.clamp((rNow - 1.3) * 0.2, 0.0008, 0.8);
    // On portrait screens, widen the vertical lens so the horizontal view stays usable.
    const portraitFov = (2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov * 0.8) / 2) / camera.aspect) * 180) / Math.PI;
    camera.fov = Math.min(75, Math.max(cam.fov, portraitFov));
    camera.updateProjectionMatrix();

    // ---- Per-chapter objects ----
    earth.update(dt);
    sky.update(time, camera, { andromeda: bump(t, 7, 1.4), whirlpool: bump(t, 8, 1.4) });
    markers.sand.update(time, bump(t, 1, 0.8));
    markers.mojave.update(time, bump(t, 2, 0.8));

    const trainW = bump(t, 2, 0.85);
    suborbital.set(smooth(0.02, 0.5, loc[2] ?? 0), trainW, time);
    parabolas.set(smooth(0.3, 0.85, loc[2] ?? 0), trainW, time);

    swarm.set(esaProgress(loc[3] ?? 0), bump(t, 3, 0.8), time);

    const rocketOn = t > 3.15 && t < 5.6 && rp > 0 && rp < 0.999;
    rocket.group.visible = rocketOn;
    if (rocketOn) {
      rocket.group.position.copy(rocketPath.getPointAt(rp));
      rocket.group.quaternion.setFromUnitVectors(UP, rocketPath.getTangentAt(rp));
      rocket.update(time, smooth(0, 0.04, rp) * (1 - smooth(0.93, 0.995, rp)));
    }
    contrail.set(rp, bump(t, 4.3, 1.3) * 0.7, time);
    iss.group.visible = t > 3.4 && t < 5.8;

    composer.render();

    // ---- Telemetry and screen labels for the HTML overlay ----
    const ll = toLatLon(camera.position);
    const w = window.innerWidth;
    const h = window.innerHeight;
    const labels = labelDefs.map((d) => {
      const weight = d.w(t);
      if (weight < 0.02) return { id: d.id, visible: false };
      v.copy(d.pos).project(camera);
      toCam.copy(camera.position).sub(d.pos).normalize();
      const facing = d.id === 'moon' || d.id === 'iss' ? 1 : toCam.dot(d.pos.clone().normalize());
      const visible = v.z < 1 && facing > 0.05 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      return { id: d.id, visible, x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, opacity: weight };
    });
    return { lat: ll.lat, lon: ll.lon, alt: shot.alt, labels };
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = pixelRatio();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    sky.setPixelRatio(pr);
    swarm.setPixelRatio(pr);
  }
  resize();

  return { update, resize };
}
