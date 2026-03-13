/* ═══════════════════════════════════════════════════════════
   viewer360.js — 360° Truck Showcase (NMC Website)
   Horizontal drag / touch / wheel / keyboard / scrubber / auto-rotate
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const TOTAL            = 28;
  const DRAG_PX_PER_FRAME = 18;   // pixels of drag to advance one frame

  // Build image sources
  const paths = Array.from({ length: TOTAL }, (_, i) => `Pictures/3d (${i + 1}).png`);

  // DOM refs
  const stage    = document.getElementById('v360-stage');
  const imgWrap  = document.getElementById('v360-imgs');
  const loading  = document.getElementById('v360-loading');
  const pfill    = document.getElementById('v360-pfill');
  const ltxt     = document.getElementById('v360-ltxt');
  const hint     = document.getElementById('v360-hint');
  const fnum     = document.getElementById('v360-fnum');
  const scrubber = document.getElementById('v360-scrubber');
  const rotBtn   = document.getElementById('v360-rotbtn');

  if (!stage) return; // guard: section not present

  let current       = 0;
  let loaded        = 0;
  let dragging      = false;
  let dragStartX    = 0;
  let dragStartFrame= 0;
  let hintGone      = false;
  let autoOn        = false;
  let autoTimer     = null;
  let sensitivity   = 1;

  /* ── Create & preload <img> elements ─────────────────── */
  const imgs = paths.map((src, i) => {
    const img = new Image();
    img.src   = src;
    img.alt   = `Truck 360° frame ${i + 1}`;
    if (i === 0) img.classList.add('v360-visible');
    img.addEventListener('load',  onLoad);
    img.addEventListener('error', onLoad);
    imgWrap.appendChild(img);
    return img;
  });

  function onLoad() {
    loaded++;
    const pct = Math.round((loaded / TOTAL) * 100);
    pfill.style.width  = pct + '%';
    ltxt.textContent   = `Loading… ${loaded} / ${TOTAL}`;
    if (loaded >= TOTAL) {
      setTimeout(() => loading.classList.add('v360-hidden'), 400);
    }
  }

  /* ── Frame switching ──────────────────────────────────── */
  function goTo(idx) {
    idx = ((idx % TOTAL) + TOTAL) % TOTAL;
    if (idx === current) return;
    imgs[current].classList.remove('v360-visible');
    current = idx;
    imgs[current].classList.add('v360-visible');
    fnum.textContent   = current + 1;
    scrubber.value     = current;
  }

  /* ── Dismiss hint ─────────────────────────────────────── */
  function dismissHint() {
    if (hintGone) return;
    hintGone = true;
    hint.classList.add('v360-hidden');
  }

  /* ── Auto-rotate ──────────────────────────────────────── */
  function startAuto() {
    stopAuto();
    autoOn = true;
    rotBtn.classList.add('v360-active');
    autoTimer = setInterval(() => goTo(current + 1), Math.round(80 / sensitivity));
  }
  function stopAuto() {
    if (!autoOn) return;
    autoOn = false;
    rotBtn.classList.remove('v360-active');
    clearInterval(autoTimer);
    autoTimer = null;
  }
  rotBtn.addEventListener('click', () => autoOn ? stopAuto() : startAuto());

  /* ── Mouse drag ───────────────────────────────────────── */
  stage.addEventListener('mousedown', e => {
    dragging      = true;
    dragStartX    = e.clientX;
    dragStartFrame= current;
    dismissHint();
    stopAuto();
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const delta = dragStartX - e.clientX;
    goTo(dragStartFrame + Math.round(delta / (DRAG_PX_PER_FRAME / sensitivity)));
  });
  window.addEventListener('mouseup', () => { dragging = false; });

  /* ── Touch drag ───────────────────────────────────────── */
  stage.addEventListener('touchstart', e => {
    dragging      = true;
    dragStartX    = e.touches[0].clientX;
    dragStartFrame= current;
    dismissHint();
    stopAuto();
    e.preventDefault();
  }, { passive: false });
  window.addEventListener('touchmove', e => {
    if (!dragging) return;
    const delta = dragStartX - e.touches[0].clientX;
    goTo(dragStartFrame + Math.round(delta / (DRAG_PX_PER_FRAME / sensitivity)));
  }, { passive: true });
  window.addEventListener('touchend', () => { dragging = false; });

  /* ── Scroll wheel (horizontal or vertical) ────────────── */
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    stopAuto();
    dismissHint();
    goTo(current + Math.sign(e.deltaX !== 0 ? e.deltaX : e.deltaY));
  }, { passive: false });

  /* ── Scrubber ─────────────────────────────────────────── */
  scrubber.addEventListener('input', () => {
    stopAuto();
    dismissHint();
    goTo(+scrubber.value);
  });

  /* ── Keyboard (only when viewer is in view) ───────────── */
  window.addEventListener('keydown', e => {
    const rect = stage.getBoundingClientRect();
    const inViewport = rect.top < window.innerHeight && rect.bottom > 0;
    if (!inViewport) return;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); stopAuto(); dismissHint(); goTo(current - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); stopAuto(); dismissHint(); goTo(current + 1); }
    if (e.key === ' ')          { e.preventDefault(); autoOn ? stopAuto() : startAuto(); }
  });

  /* ── Speed buttons ────────────────────────────────────── */
  document.querySelectorAll('.v360-speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.v360-speed-btn').forEach(b => b.classList.remove('v360-active'));
      btn.classList.add('v360-active');
      sensitivity = parseFloat(btn.dataset.spd);
      // Restart auto-rotate at new speed if running
      if (autoOn) { stopAuto(); startAuto(); }
    });
  });

})();
