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
  ? { maxDpr: 1.5, maxPixels: Infinity, msaa: 0, tex: '2k', stars: 3500, segments: 96 }
  : { maxDpr: 2, maxPixels: 1920 * 1080, msaa: 2, tex: '4k', stars: 7000, segments: 160 };

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
requestAnimationFrame(frame);

startScene().catch((err) => {
  console.warn('3D scene disabled:', err);
  root.classList.add('no-webgl');
  finishLoading();
});
