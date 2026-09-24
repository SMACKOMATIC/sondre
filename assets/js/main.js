import { esaProgress, esaCountdown } from './geo.js';

const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const small = coarse || window.innerWidth < 820;

// ---------- Language ----------
function setLang(lang) {
  root.lang = lang;
  document.querySelectorAll('[data-set-lang]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.setLang === lang));
  });
  try {
    localStorage.setItem('lang', lang);
  } catch {}
  hudCache.name = null;
}
document.querySelectorAll('[data-set-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.setLang)));

// ---------- Chapters and scroll mapping ----------
const sections = [...document.querySelectorAll('[data-chapter]')];
let marks = [];
let vh = window.innerHeight;

// Each chapter "holds" the camera while you read, and the camera flies between chapters.
function measure() {
  vh = window.innerHeight;
  marks = sections.map((s) => {
    const r = s.getBoundingClientRect();
    const top = r.top + window.scrollY;
    const h = r.height;
    let hs = top + vh * 0.42;
    let he = top + h - vh * 0.42;
    if (he < hs) hs = he = top + h / 2;
    return { top, h, hs, he };
  });
}

function chapterT(y) {
  if (y <= marks[0].he) return 0;
  for (let i = 0; i < marks.length; i++) {
    const m = marks[i];
    const n = marks[i + 1];
    if (y >= m.hs && y <= m.he) return i;
    if (n && y > m.he && y < n.hs) return i + (y - m.he) / (n.hs - m.he);
  }
  return marks.length - 1;
}

// ---------- Chapter rail ----------
const rail = document.getElementById('rail');
const railLinks = sections.map((s, i) => {
  const a = document.createElement('a');
  a.href = `#${s.id}`;
  a.className = 'rail-dot';
  a.innerHTML = `<span class="rail-num">${String(i).padStart(2, '0')}</span><span class="rail-name" data-lang-no>${s.dataset.nameNo}</span><span class="rail-name" data-lang-en>${s.dataset.nameEn}</span>`;
  rail.appendChild(a);
  return a;
});

// ---------- HUD ----------
const hud = {
  lat: document.getElementById('hud-lat'),
  lon: document.getElementById('hud-lon'),
  alt: document.getElementById('hud-alt'),
  ch: document.getElementById('hud-ch'),
  name: document.getElementById('hud-name'),
  bar: document.getElementById('hud-bar'),
};
const hudCache = {};
function setText(key, el, text) {
  if (hudCache[key] !== text) {
    hudCache[key] = text;
    el.textContent = text;
  }
}
const fmt = (lang, digits = 0) => new Intl.NumberFormat(lang === 'no' ? 'nb-NO' : 'en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits });

function updateHUD(t, tel) {
  const lang = root.lang;
  const idx = Math.round(t);
  setText('ch', hud.ch, `${String(idx).padStart(2, '0')} / ${String(sections.length - 1).padStart(2, '0')}`);
  const s = sections[idx];
  setText('name', hud.name, lang === 'no' ? s.dataset.nameNo : s.dataset.nameEn);
  hud.bar.style.transform = `scaleX(${t / (sections.length - 1)})`;
  railLinks.forEach((a, i) => a.classList.toggle('active', i === idx));
  if (!tel) return;
  const f1 = fmt(lang, 2);
  const ns = tel.lat >= 0 ? 'N' : 'S';
  const ew = tel.lon >= 0 ? (lang === 'no' ? 'Ø' : 'E') : lang === 'no' ? 'V' : 'W';
  setText('lat', hud.lat, `${f1.format(Math.abs(tel.lat))}° ${ns}`);
  setText('lon', hud.lon, `${f1.format(Math.abs(tel.lon))}° ${ew}`);
  const altRounded = tel.alt > 10000 ? Math.round(tel.alt / 100) * 100 : Math.round(tel.alt);
  setText('alt', hud.alt, `${fmt(lang).format(altRounded)} km`);
}

// ---------- Geographic labels that follow 3D points ----------
const labelEls = Object.fromEntries([...document.querySelectorAll('[data-label]')].map((el) => [el.dataset.label, el]));
function updateLabels(labels) {
  for (const l of labels) {
    const el = labelEls[l.id];
    if (!el) continue;
    if (!l.visible) {
      el.style.opacity = '0';
      continue;
    }
    el.style.opacity = String(l.opacity);
    el.style.transform = `translate3d(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px, 0)`;
  }
}

// ---------- ESA counter: 23 000 -> 2 ----------
const counterEl = document.getElementById('esa-count');
const counterWrap = document.getElementById('esa-counter');
let lastCount = null;
function updateCounter(loc) {
  const q = esaCountdown(esaProgress(loc));
  const value = Math.round(Math.exp(Math.log(23000) * (1 - q) + Math.log(2) * q));
  const key = `${value}-${root.lang}`;
  if (key !== lastCount) {
    lastCount = key;
    counterEl.textContent = fmt(root.lang).format(value);
    counterWrap.classList.toggle('done', value <= 2);
  }
}

// ---------- Lightbox ----------
const lightbox = document.getElementById('lightbox');
const lightboxImg = lightbox.querySelector('img');
const lightboxCap = lightbox.querySelector('figcaption');
document.querySelectorAll('[data-zoom]').forEach((img) => {
  img.tabIndex = 0;
  const open = () => {
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt;
    lightboxCap.textContent = img.alt;
    lightbox.showModal();
  };
  img.addEventListener('click', open);
  img.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  });
});
lightbox.addEventListener('click', () => lightbox.close());

// ---------- Loader ----------
const loaderEl = document.getElementById('loader');
const loaderPct = document.getElementById('loader-pct');
let loaded = false;
function finishLoading() {
  if (loaded) return;
  loaded = true;
  root.classList.add('ready');
  setTimeout(() => loaderEl.remove(), 1200);
}
setTimeout(finishLoading, 12000);

// ---------- 3D scene ----------
function hasWebGL2() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

const quality = small
  ? { maxDpr: 1.5, msaa: 0, tex: '2k', stars: 3500, segments: 96 }
  : { maxDpr: 2, msaa: 4, tex: '4k', stars: 7000, segments: 160 };

let scene = null;
const pointer = { x: 0, y: 0 };
window.addEventListener(
  'pointermove',
  (e) => {
    pointer.x = e.clientX / window.innerWidth - 0.5;
    pointer.y = e.clientY / window.innerHeight - 0.5;
  },
  { passive: true }
);

async function startScene() {
  if (!hasWebGL2()) throw new Error('WebGL2 not available');
  const { createScene } = await import('./scene.js');
  scene = createScene(document.getElementById('scene'), {
    quality,
    reducedMotion,
    snap: new URLSearchParams(location.search).has('snap'),
    onProgress: (f) => (loaderPct.textContent = `${Math.round(f * 100)}`),
    onLoaded: finishLoading,
  });
}

// ---------- Main loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const y = window.scrollY + vh * 0.5;
  const t = chapterT(y);
  const loc = marks.map((m) => (y - m.top) / m.h);
  let tel = null;
  if (scene) {
    tel = scene.update({ t, loc, dt, time: now / 1000, pointer, loaded });
    updateLabels(tel.labels);
  }
  updateHUD(t, tel);
  updateCounter(loc[3] ?? 0);
  requestAnimationFrame(frame);
}

function onResize() {
  measure();
  scene?.resize();
}

// ---------- Spaceship cursor (desktop only) ----------
function initCursor() {
  const el = document.getElementById('rocket-cursor');
  const trail = document.getElementById('cursor-trail');
  if (!matchMedia('(pointer: fine)').matches || reducedMotion) {
    el.remove();
    trail.remove();
    return;
  }
  root.classList.add('has-fine-pointer');
  const ctx = trail.getContext('2d');
  let tw, th;
  const resizeTrail = () => {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    tw = window.innerWidth;
    th = window.innerHeight;
    trail.width = tw * d;
    trail.height = th * d;
    ctx.setTransform(d, 0, 0, d, 0, 0);
  };
  window.addEventListener('resize', resizeTrail);
  resizeTrail();

  let mx = tw / 2, my = th / 2, x = mx, y = my, angle = 0, moved = false;
  const history = [];
  const sparks = [];
  const rand = (a, b) => Math.random() * (b - a) + a;
  window.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    if (!moved) {
      x = mx;
      y = my;
      moved = true;
      el.classList.add('visible');
    }
  });
  document.addEventListener('mouseleave', () => el.classList.remove('visible'));
  document.addEventListener('mouseenter', () => moved && el.classList.add('visible'));
  document.addEventListener('mouseover', (e) => e.target.closest?.('a, button, [data-zoom]') && el.classList.add('hover'));
  document.addEventListener('mouseout', (e) => e.target.closest?.('a, button, [data-zoom]') && el.classList.remove('hover'));

  (function loop(t) {
    if (!moved) return requestAnimationFrame(loop);
    const dx = mx - x;
    const dy = my - y;
    x += dx * 0.18;
    y += dy * 0.18;
    const dist = Math.hypot(dx, dy);
    if (dist > 1.2) {
      const target = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      const diff = ((((target - angle + 180) % 360) + 360) % 360) - 180;
      angle += diff * 0.15;
    }
    const sx = x + Math.sin(t * 0.0025) * 1.4;
    const sy = y + Math.cos(t * 0.002) * 1.4;
    el.style.transform = `translate(${sx}px, ${sy}px) rotate(${angle}deg)`;

    const rad = ((angle - 90) * Math.PI) / 180;
    const tx = sx - Math.cos(rad) * 15;
    const ty = sy - Math.sin(rad) * 15;
    history.push({ x: tx, y: ty });
    if (history.length > 16) history.shift();
    if (dist > 0.6 && Math.random() < 0.9) {
      const a = rad + Math.PI + (Math.random() - 0.5) * 0.9;
      const sp = rand(0.3, 1.1);
      sparks.push({ x: tx, y: ty, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, size: rand(1, 2.6) });
    }
    if (sparks.length > 80) sparks.splice(0, sparks.length - 80);

    ctx.clearRect(0, 0, tw, th);
    for (let i = 1; i < history.length; i++) {
      const f = i / history.length;
      ctx.beginPath();
      ctx.moveTo(history[i - 1].x, history[i - 1].y);
      ctx.lineTo(history[i].x, history[i].y);
      ctx.lineCap = 'round';
      ctx.lineWidth = 1 + f * 6;
      ctx.strokeStyle = `rgba(255,${Math.round(150 + f * 90)},${Math.round(70 + f * 60)},${f * 0.5})`;
      ctx.stroke();
    }
    for (let j = sparks.length - 1; j >= 0; j--) {
      const s = sparks[j];
      s.x += s.vx;
      s.y += s.vy;
      s.life -= 0.035;
      if (s.life <= 0) {
        sparks.splice(j, 1);
        continue;
      }
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,${Math.round(140 + s.life * 90)},${Math.round(60 + s.life * 60)},${s.life * 0.85})`;
      ctx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(loop);
  })(0);
}

// ---------- Start ----------
let saved = null;
try {
  saved = localStorage.getItem('lang');
} catch {}
setLang(saved === 'en' || saved === 'no' ? saved : 'no');
measure();
window.addEventListener('resize', onResize);
window.addEventListener('load', measure);
new ResizeObserver(() => measure()).observe(document.querySelector('main'));
initCursor();
requestAnimationFrame(frame);

startScene().catch((err) => {
  console.warn('3D scene disabled:', err);
  root.classList.add('no-webgl');
  finishLoading();
});
