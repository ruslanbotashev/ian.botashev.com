const STAGES = {
  sense: {
    label: 'SENSE THE WORLD.',
    caption: 'Sense: information enters the control loop. A conceptual study, not recorded flight data.',
    color: '#9ad7cc'
  },
  compute: {
    label: 'TURN INPUT INTO A PLAN.',
    caption: 'Compute: a model connects the current state to a possible path. A conceptual study, not recorded flight data.',
    color: '#f6a85a'
  },
  act: {
    label: 'CHANGE THE TRAJECTORY.',
    caption: 'Act: a control decision changes the thrust direction. A conceptual study, not recorded flight data.',
    color: '#f6a85a'
  }
};

/** An illustrative control-loop drawing, deliberately separate from Ian's actual simulator. */
export function initFlightStudy(canvas, { paused = false } = {}) {
  const inert = { setPaused() {}, setStage() {}, destroy() {} };
  if (!canvas || typeof canvas.getContext !== 'function') return inert;
  let context;
  try { context = canvas.getContext('2d'); } catch { return inert; }
  if (!context) return inert;
  const panel = canvas.closest('.flight-study') || canvas.parentElement;
  const buttons = [...(panel?.querySelectorAll('[data-stage]') || [])];
  const label = panel?.querySelector('#study-stage-label');
  const caption = panel?.querySelector('#study-caption');
  if (caption) caption.setAttribute('aria-live', 'polite');
  let mode = 'sense';
  let width = 0;
  let height = 0;
  let frame = 0;
  let activeTime = 0;
  let previousTime = null;
  let destroyed = false;
  let pageVisible = !document.hidden;
  let onScreen = false;
  let visibilityObserver;
  let sizeObserver;
  const pointer = { x: 0, y: 0 };
  const listeners = [];
  const stars = Array.from({ length: 47 }, (_, i) => ({
    x: ((i * 73 + 19) % 251) / 251,
    y: ((i * 113 + 47) % 257) / 257,
    alpha: 0.12 + (i % 4) * 0.09,
    size: i % 6 === 0 ? 1.25 : 0.65
  }));

  function listen(target, type, callback, options) {
    target?.addEventListener(type, callback, options);
    listeners.push(() => target?.removeEventListener(type, callback, options));
  }

  function line(x1, y1, x2, y2, color, lineWidth = 1) {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.stroke();
  }

  function text(value, x, y, color = '#a7b3b6', size = 8, alignment = 'left') {
    context.font = `${size}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    context.textAlign = alignment;
    context.fillStyle = color;
    context.fillText(value, x, y);
  }

  function pointOnOrbit(cx, cy, rx, ry, angle, rotation) {
    const x = Math.cos(angle) * rx;
    const y = Math.sin(angle) * ry;
    return {
      x: cx + x * Math.cos(rotation) - y * Math.sin(rotation),
      y: cy + x * Math.sin(rotation) + y * Math.cos(rotation)
    };
  }

  function rocket(x, y, rotation, time) {
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    context.lineWidth = 1.2;
    const throttle = mode === 'act' ? 24 + Math.sin(time * 0.008) * 3 : 8;
    context.beginPath();
    context.moveTo(-4, 9);
    context.lineTo(0, 9 + throttle);
    context.lineTo(4, 9);
    context.strokeStyle = '#f6a85a';
    context.stroke();
    if (mode === 'act') {
      context.beginPath();
      context.moveTo(-2, 10);
      context.lineTo(0, 20 + throttle * 0.5);
      context.lineTo(2, 10);
      context.fillStyle = '#f6a85a66';
      context.fill();
    }
    context.beginPath();
    context.moveTo(0, -19);
    context.quadraticCurveTo(9, -9, 7, 7);
    context.lineTo(4, 11);
    context.lineTo(-4, 11);
    context.lineTo(-7, 7);
    context.quadraticCurveTo(-9, -9, 0, -19);
    context.fillStyle = '#e9eee9';
    context.fill();
    context.strokeStyle = '#f4c18c';
    context.stroke();
    context.beginPath();
    context.moveTo(-6, 0);
    context.lineTo(-13, 10);
    context.lineTo(-5, 7);
    context.moveTo(6, 0);
    context.lineTo(13, 10);
    context.lineTo(5, 7);
    context.strokeStyle = '#e9eee9';
    context.stroke();
    context.beginPath();
    context.arc(0, -5, 2.5, 0, Math.PI * 2);
    context.fillStyle = '#7ec1ba';
    context.fill();
    context.restore();
  }

  function draw(time = activeTime) {
    if (destroyed || !width || !height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#19252b');
    background.addColorStop(0.55, '#121e25');
    background.addColorStop(1, '#101a20');
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    const top = 65;
    const bottom = Math.max(top + 100, height - 153);
    const space = bottom - top;
    context.save();
    context.beginPath();
    context.rect(12, top - 8, width - 24, space + 8);
    context.clip();
    stars.forEach(star => {
      context.beginPath();
      context.arc(18 + star.x * (width - 36), top + star.y * space, star.size, 0, Math.PI * 2);
      context.fillStyle = `rgba(225,236,230,${star.alpha})`;
      context.fill();
    });
    for (let x = 22; x < width; x += 40) line(x, top, x, bottom, '#a0b8bb0b');
    for (let y = top + 15; y < bottom; y += 40) line(14, y, width - 14, y, '#a0b8bb0b');

    const cx = width * 0.36 + pointer.x * 5;
    const cy = top + space * 0.79 + pointer.y * 3;
    const radius = Math.min(width * 0.29, space * 0.48);
    const orbitX = cx + radius * 0.33;
    const orbitY = cy - radius * 0.20;
    const orbitRX = radius * 1.73;
    const orbitRY = radius * 1.16;
    const rotation = -0.30;

    context.save();
    context.translate(orbitX, orbitY);
    context.rotate(rotation);
    context.setLineDash([3, 7]);
    context.beginPath();
    context.ellipse(0, 0, orbitRX, orbitRY, 0, 0, Math.PI * 2);
    context.strokeStyle = mode === 'compute' ? '#f6a85a70' : '#91b9ba42';
    context.lineWidth = 1;
    context.stroke();
    context.setLineDash([]);
    context.beginPath();
    context.ellipse(0, 0, orbitRX * 1.10, orbitRY * 1.10, 0, -2.1, -0.05);
    context.strokeStyle = '#91b9ba14';
    context.stroke();
    context.restore();

    const planet = context.createRadialGradient(cx - radius * 0.25, cy - radius * 0.55, radius * 0.05, cx, cy, radius);
    planet.addColorStop(0, '#34565a');
    planet.addColorStop(0.75, '#1e373f');
    planet.addColorStop(1, '#15272f');
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.fillStyle = planet;
    context.fill();
    context.strokeStyle = '#8dc9c766';
    context.lineWidth = 1;
    context.stroke();
    context.save();
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.clip();
    for (const angle of [-0.72, 0, 0.72]) {
      context.beginPath();
      context.ellipse(cx, cy, Math.max(5, radius * Math.abs(Math.cos(angle + 0.2)) * 0.65), radius, angle * 0.30, 0, Math.PI * 2);
      context.strokeStyle = '#a4cfcc22';
      context.lineWidth = 0.7;
      context.stroke();
    }
    for (const offset of [-0.55, 0, 0.55]) {
      context.beginPath();
      context.ellipse(cx, cy + radius * offset, radius * Math.sqrt(1 - offset * offset), radius * 0.20, -0.12, 0, Math.PI * 2);
      context.strokeStyle = '#a4cfcc22';
      context.stroke();
    }
    context.restore();
    context.beginPath();
    context.arc(cx, cy, radius + 6, -Math.PI * 0.96, -0.02);
    context.strokeStyle = '#8bd1cb1c';
    context.lineWidth = 5;
    context.stroke();

    const angle = -1.18 + Math.sin(time * 0.00020) * 0.26;
    const ship = pointOnOrbit(orbitX, orbitY, orbitRX, orbitRY, angle, rotation);
    const next = pointOnOrbit(orbitX, orbitY, orbitRX, orbitRY, angle + 0.02, rotation);
    const shipAngle = Math.atan2(next.y - ship.y, next.x - ship.x) + Math.PI / 2;
    const color = STAGES[mode].color;

    if (mode === 'sense') {
      for (let i = 0; i < 3; i += 1) {
        const pulse = (time * 0.00020 + i / 3) % 1;
        context.beginPath();
        context.arc(ship.x, ship.y, 20 + pulse * 42, 0, Math.PI * 2);
        context.strokeStyle = `rgba(154,215,204,${(1 - pulse) * 0.25})`;
        context.lineWidth = 0.8;
        context.stroke();
      }
      context.setLineDash([2, 5]);
      line(ship.x, ship.y, cx, cy, '#9ad7cc6b');
      context.setLineDash([]);
      text('INPUT / WORLD', width - 23, top + 18, '#9ad7cc', 8, 'right');
    } else if (mode === 'compute') {
      context.beginPath();
      for (let i = 0; i <= 24; i += 1) {
        const point = pointOnOrbit(orbitX, orbitY, orbitRX, orbitRY, angle + i * 0.025, rotation);
        if (!i) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y);
      }
      context.strokeStyle = '#f6a85a99';
      context.lineWidth = 1.6;
      context.stroke();
      for (let i = 1; i < 6; i += 1) {
        const point = pointOnOrbit(orbitX, orbitY, orbitRX, orbitRY, angle + i * 0.10, rotation);
        context.beginPath();
        context.arc(point.x, point.y, 2.2, 0, Math.PI * 2);
        context.fillStyle = '#f6a85a';
        context.fill();
      }
      text('STATE → GUIDANCE', width - 23, top + 18, '#f6a85a', 8, 'right');
    } else {
      const endX = Math.min(width - 35, ship.x + 60);
      const endY = ship.y - 36;
      line(ship.x + 13, ship.y, endX, endY, '#f6a85aa6', 1.2);
      line(endX, endY, endX - 9, endY + 1, '#f6a85aa6', 1.2);
      line(endX, endY, endX - 3, endY + 9, '#f6a85aa6', 1.2);
      text('CONTROL / THRUST', width - 23, top + 18, '#f6a85a', 8, 'right');
    }

    rocket(ship.x, ship.y, shipAngle + (mode === 'act' ? Math.sin(time * 0.0015) * 0.10 : 0), time);
    context.beginPath();
    context.arc(cx - radius * 0.30, cy - radius * 0.45, 2.5, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    text('SIMPLIFIED WORLD', Math.max(24, cx - radius * 0.6), Math.min(bottom - 10, cy + radius * 0.20), '#b1ccca', 7);
    context.restore();
  }

  function canAnimate() {
    return !destroyed && !paused && pageVisible && onScreen && width > 0 && height > 0;
  }

  function tick(timestamp) {
    frame = 0;
    if (!canAnimate()) return;
    if (previousTime !== null) activeTime += Math.min(40, Math.max(0, timestamp - previousTime));
    previousTime = timestamp;
    draw(activeTime);
    frame = window.requestAnimationFrame(tick);
  }

  function reconcile() {
    if (canAnimate()) {
      if (!frame) {
        previousTime = null;
        frame = window.requestAnimationFrame(tick);
      }
    } else {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      previousTime = null;
    }
  }

  function resize() {
    if (destroyed) return;
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(0, bounds.width);
    height = Math.max(0, bounds.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    draw();
    reconcile();
  }

  function measureVisibility() {
    const bounds = canvas.getBoundingClientRect();
    onScreen = bounds.bottom > 0 && bounds.top < window.innerHeight && bounds.right > 0 && bounds.left < window.innerWidth;
    reconcile();
  }

  function setStage(nextMode) {
    if (!STAGES[nextMode] || destroyed) return;
    mode = nextMode;
    buttons.forEach(button => {
      const selected = button.dataset.stage === mode;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    if (label) label.textContent = STAGES[mode].label;
    if (caption) caption.textContent = STAGES[mode].caption;
    if (panel) panel.dataset.stage = mode;
    draw();
  }

  buttons.forEach(button => listen(button, 'click', () => setStage(button.dataset.stage)));
  listen(document, 'visibilitychange', () => {
    pageVisible = !document.hidden;
    reconcile();
  });
  listen(window, 'pagehide', () => { pageVisible = false; reconcile(); });
  listen(window, 'pageshow', () => { pageVisible = !document.hidden; measureVisibility(); });
  listen(window, 'resize', () => { resize(); measureVisibility(); }, { passive: true });
  listen(panel, 'pointermove', event => {
    if (paused || !canAnimate()) return;
    const bounds = panel.getBoundingClientRect();
    pointer.x = (event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5;
    pointer.y = (event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5;
  }, { passive: true });
  listen(panel, 'pointerleave', () => { pointer.x = 0; pointer.y = 0; }, { passive: true });

  if (typeof ResizeObserver === 'function') {
    try {
      sizeObserver = new ResizeObserver(resize);
      sizeObserver.observe(canvas);
    } catch { sizeObserver?.disconnect(); }
  }
  if (typeof IntersectionObserver === 'function') {
    try {
      visibilityObserver = new IntersectionObserver(entries => {
        onScreen = entries.some(entry => entry.isIntersecting);
        reconcile();
      }, { rootMargin: '30px', threshold: 0 });
      visibilityObserver.observe(canvas);
    } catch {
      visibilityObserver?.disconnect();
      listen(window, 'scroll', measureVisibility, { passive: true });
    }
  } else listen(window, 'scroll', measureVisibility, { passive: true });
  resize();
  measureVisibility();
  setStage(mode);
  return {
    setPaused(value) {
      paused = Boolean(value);
      draw();
      reconcile();
    },
    setStage,
    destroy() {
      destroyed = true;
      reconcile();
      sizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      listeners.forEach(remove => remove());
    }
  };
}
