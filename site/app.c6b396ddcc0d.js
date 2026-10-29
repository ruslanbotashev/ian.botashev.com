import { initFlightStudy } from './flight-study.4331b37e5834.js';

const root = document.documentElement;
const motionButtons = [...document.querySelectorAll('[data-motion-toggle]')];
const motionMedia = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const motionStorageKey = 'ian-botashev-motion-paused';
let motionPreference = null;
let flightStudy = null;

try {
  const saved = window.localStorage.getItem(motionStorageKey);
  if (saved === 'true' || saved === 'false') motionPreference = saved === 'true';
} catch { /* Motion controls also work when browser storage is unavailable. */ }

function motionIsPaused() {
  return motionPreference ?? Boolean(motionMedia?.matches);
}

function syncMotion() {
  const paused = motionIsPaused();
  root.classList.toggle('motion-paused', paused);
  root.classList.toggle('motion-enabled', !paused);
  motionButtons.forEach(button => {
    button.setAttribute('aria-pressed', String(paused));
    const label = [...button.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
    if (label) label.textContent = paused ? 'Resume motion ' : 'Pause motion ';
    const icon = button.querySelector('[aria-hidden]');
    if (icon) icon.textContent = paused ? '▶' : 'Ⅱ';
  });
  flightStudy?.setPaused(paused);
  if (paused) document.querySelectorAll('.reveal').forEach(node => node.classList.add('is-visible'));
}

motionButtons.forEach(button => button.addEventListener('click', () => {
  motionPreference = !motionIsPaused();
  try { window.localStorage.setItem(motionStorageKey, String(motionPreference)); } catch { /* Optional storage. */ }
  syncMotion();
}));
if (motionMedia?.addEventListener) motionMedia.addEventListener('change', syncMotion);
else if (motionMedia?.addListener) motionMedia.addListener(syncMotion);
syncMotion();

function initNavigation() {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#mobile-nav');
  if (!toggle || !nav) return;
  let open = false;
  function setOpen(value, restoreFocus = false) {
    open = value;
    nav.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    if (restoreFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => setOpen(!open));
  nav.addEventListener('click', event => {
    if (event.target.closest('a[href]')) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) setOpen(false, true);
  });
  document.addEventListener('click', event => {
    if (open && !nav.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
  });
  window.addEventListener('resize', () => {
    if (open && getComputedStyle(toggle).display === 'none') setOpen(false);
  }, { passive: true });
  setOpen(false);
  root.classList.add('nav-ready');
}

function initProgress() {
  const bar = document.querySelector('.scroll-progress');
  if (!bar) return;
  let scheduled = false;
  function update() {
    scheduled = false;
    const range = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.max(0, Math.min(1, window.scrollY / range));
    bar.style.transform = `scaleX(${progress})`;
    root.style.setProperty('--read-progress', String(progress));
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(update);
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('load', update, { once: true });
  update();
}

function initReveals() {
  const nodes = [...document.querySelectorAll('.reveal')];
  const showAll = () => {
    root.classList.remove('reveal-ready');
    nodes.forEach(node => node.classList.add('is-visible'));
  };
  if (!nodes.length || typeof IntersectionObserver !== 'function' || motionIsPaused()) {
    showAll();
    return;
  }
  let observer;
  try {
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting || entry.intersectionRatio > 0) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -24px 0px', threshold: 0.04 });
    nodes.forEach(node => {
      const bounds = node.getBoundingClientRect();
      if (bounds.top < window.innerHeight && bounds.bottom >= 0 || bounds.bottom < 0) {
        node.classList.add('is-visible');
      } else observer.observe(node);
    });
    root.classList.add('reveal-ready');
  } catch {
    observer?.disconnect();
    showAll();
  }
}

function initCpuStudy() {
  const button = document.querySelector('#cpu-cycle');
  const status = document.querySelector('#cpu-phase');
  const study = button?.closest('.cpu-study');
  const units = [...document.querySelectorAll('[data-cpu-unit]')];
  if (!button || !status || !study || !units.length) return;
  const stages = ['fetch', 'decode', 'execute'];
  let phase = -1;
  button.addEventListener('click', () => {
    phase = (phase + 1) % stages.length;
    const selected = stages[phase];
    units.forEach(unit => unit.classList.toggle('active', unit.dataset.cpuUnit === selected));
    study.dataset.phase = selected;
    const pixels = study.querySelector('.pixel-grid');
    if (pixels) pixels.dataset.phase = selected;
    status.textContent = `${String(phase + 1).padStart(2, '0')} / ${selected.toUpperCase()}`;
  });
}

initNavigation();
initProgress();
initReveals();
initCpuStudy();
flightStudy = initFlightStudy(document.querySelector('#flight-canvas'), { paused: motionIsPaused() });
