import * as THREE from 'three';

// A simplified ISS built from primitives. Local axes: x = truss, y = up (away from Earth),
// z = flight direction. One unit = the length of the main truss.
export function createISS() {
  const iss = new THREE.Group();

  const metal = new THREE.MeshStandardMaterial({ color: 0xaeb3bb, metalness: 0.75, roughness: 0.38, map: trussTexture() });
  const hull = new THREE.MeshStandardMaterial({ color: 0xe9e7e1, metalness: 0.12, roughness: 0.6, map: blanketTexture() });
  const foil = new THREE.MeshStandardMaterial({ color: 0xd8b064, metalness: 0.85, roughness: 0.28 });
  const radiator = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, metalness: 0.05, roughness: 0.45 });
  const panel = new THREE.MeshStandardMaterial({
    map: panelTexture(),
    metalness: 0.55,
    roughness: 0.32,
    emissive: new THREE.Color(0x120c04),
    side: THREE.DoubleSide,
  });

  const truss = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.028, 0.03), metal);
  iss.add(truss);

  // Four solar array pairs. Each pair sits in a gimbal that turns about the truss axis.
  const gimbals = [];
  const wingGeo = new THREE.BoxGeometry(0.11, 0.33, 0.003);
  const mastGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.7, 6);
  for (const x of [-0.455, -0.335, 0.335, 0.455]) {
    const gimbal = new THREE.Group();
    gimbal.position.set(x, 0, 0);
    gimbal.add(new THREE.Mesh(mastGeo, metal));
    for (const s of [1, -1]) {
      const wing = new THREE.Mesh(wingGeo, panel);
      wing.position.set(0, s * 0.185, 0);
      gimbal.add(wing);
    }
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.035), foil);
    gimbal.add(box);
    iss.add(gimbal);
    gimbals.push(gimbal);
  }

  // Heat radiators.
  for (const x of [-0.15, 0.15]) {
    for (let k = 0; k < 3; k++) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.002, 0.13), radiator);
      r.position.set(x + (k - 1) * 0.038, -0.02, -0.08);
      iss.add(r);
    }
  }

  // Pressurised modules along the flight direction.
  const tube = (r, len, x, y, z, axis = 'z', mat = hull) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24), mat);
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    m.position.set(x, y, z);
    iss.add(m);
    return m;
  };
  const y0 = -0.035;
  tube(0.022, 0.07, 0, y0, 0.11); // Harmony
  tube(0.021, 0.07, 0.065, y0, 0.11, 'x'); // Columbus
  tube(0.023, 0.11, -0.085, y0, 0.11, 'x'); // Kibo
  tube(0.022, 0.09, 0, y0, 0.03); // Destiny
  tube(0.021, 0.05, 0, y0, -0.04); // Unity
  tube(0.02, 0.12, 0, y0, -0.125); // Zarya
  tube(0.021, 0.12, 0, y0, -0.245); // Zvezda
  tube(0.012, 0.05, 0, y0, -0.33, 'z', foil); // Progress
  tube(0.013, 0.05, 0, y0 - 0.035, -0.04, 'y', foil); // Soyuz
  const kiboEF = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.04), metal);
  kiboEF.position.set(-0.165, y0, 0.11);
  iss.add(kiboEF);

  // Small Russian solar wings on Zvezda and Zarya.
  const smallWing = new THREE.BoxGeometry(0.1, 0.002, 0.028);
  for (const z of [-0.125, -0.245]) {
    for (const s of [1, -1]) {
      const w = new THREE.Mesh(smallWing, panel);
      w.position.set(s * 0.075, y0, z);
      iss.add(w);
    }
  }

  const sunLocal = new THREE.Vector3();
  const inv = new THREE.Quaternion();
  return {
    group: iss,
    // Turn each array so its face points at the Sun.
    trackSun(sunDirWorld) {
      inv.copy(iss.quaternion).invert();
      sunLocal.copy(sunDirWorld).applyQuaternion(inv);
      const angle = Math.atan2(-sunLocal.y, sunLocal.z);
      for (const g of gimbals) g.rotation.x = angle;
    },
  };
}

function canvasTexture(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  return tex;
}

function panelTexture() {
  return canvasTexture(128, 512, (g, w, h) => {
    g.fillStyle = '#1c130a';
    g.fillRect(0, 0, w, h);
    const cols = 4;
    const rows = 40;
    const cw = w / cols;
    const ch = h / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const l = 30 + Math.random() * 9;
        g.fillStyle = `hsl(${30 + Math.random() * 6}, 62%, ${l}%)`;
        g.fillRect(x * cw + 1.5, y * ch + 1, cw - 3, ch - 2);
      }
    }
    g.fillStyle = 'rgba(20,14,8,0.9)';
    g.fillRect(w / 2 - 2, 0, 4, h);
  });
}

function trussTexture() {
  return canvasTexture(
    256,
    32,
    (g, w, h) => {
      g.fillStyle = '#9aa0a8';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#4b5058';
      g.lineWidth = 2;
      for (let x = 0; x < w; x += 16) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + 16, h);
        g.moveTo(x + 16, 0);
        g.lineTo(x, h);
        g.stroke();
      }
    },
    [4, 1]
  );
}

function blanketTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#e6e3dc';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      g.fillStyle = `rgba(${150 + Math.random() * 60},${150 + Math.random() * 60},${140 + Math.random() * 50},0.25)`;
      g.fillRect(x, y, 20 + Math.random() * 60, 10 + Math.random() * 40);
    }
    g.strokeStyle = 'rgba(90,90,90,0.35)';
    for (let x = 0; x < w; x += 32) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
  });
}
