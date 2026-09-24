import * as THREE from 'three';

// Earth radius is 1 scene unit. Texture u=0 is longitude -180, matching THREE.SphereGeometry.
export function latLon(lat, lon, r = 1, out = new THREE.Vector3()) {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const theta = ((90 - lat) / 180) * Math.PI;
  return out
    .set(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta))
    .multiplyScalar(r);
}

export function toLatLon(v) {
  const r = v.length();
  const lat = 90 - (Math.acos(THREE.MathUtils.clamp(v.y / r, -1, 1)) * 180) / Math.PI;
  let lon = (Math.atan2(v.z, -v.x) * 180) / Math.PI - 180;
  if (lon < -180) lon += 360;
  return { lat, lon, r };
}

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;

export function smooth(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

// 1 at `center`, falling to 0 at distance `width`.
export const bump = (x, center, width) => 1 - smooth(0, width, Math.abs(x - center));

export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Shared by the particle swarm and the HTML counter, so both stay in step.
export const esaProgress = (loc) => clamp01((loc - 0.12) / 0.66);
export const esaCountdown = (p) => smooth(0.22, 0.86, p);
