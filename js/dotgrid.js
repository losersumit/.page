/* ═══════════════════════════════════════════════════════════
   DotGrid — Vanilla JS Interactive Background
   ═══════════════════════════════════════════════════════════
   Self-contained IIFE. No external dependencies.

   CONFIG:
     DOT_SIZE      – diameter of each dot in px
     GAP           – spacing between dots
     BASE_COLOR    – resting dot colour (matches --navy)
     ACTIVE_COLOR  – cursor-proximity glow colour (matches --gold)
     PROXIMITY     – radius (px) for colour influence
     SPEED_TRIGGER – minimum cursor speed (px/s) to trigger ripple
     SHOCK_RADIUS  – click shockwave reach (px)
     SHOCK_STR     – shockwave impulse multiplier
     SPRING_K      – spring stiffness for return-to-origin
     SPRING_DAMP   – spring damping (0 = no damping, 1 = no bounce)
   ═══════════════════════════════════════════════════════════ */
(function () {
    const DOT_SIZE     = 5;
    const GAP          = 16;
    const BASE_COLOR   = { r: 30,  g: 48,  b: 80  };  // visible blue-grey on navy
    const ACTIVE_COLOR = { r: 232, g: 160, b: 32  };  // --gold
    const PROXIMITY    = 130;   // px colour-influence radius
    const SPEED_TRIGGER = 80;   // px/s minimum to ripple
    const SHOCK_RADIUS  = 280;  // px click shockwave reach
    const SHOCK_STR     = 6;    // shockwave impulse multiplier
    const SPRING_K      = 0.18; // spring stiffness
    const SPRING_DAMP   = 0.72; // spring damping

    const wrap   = document.getElementById('dot-grid-wrap');
    const canvas = document.getElementById('dot-grid-canvas');
    let ctx, dots = [], dpr = 1;

    /* Build / rebuild the dot grid to fill the wrapper */
    function buildGrid() {
        if (!wrap || !canvas) return;
        const { width, height } = wrap.getBoundingClientRect();
        dpr = window.devicePixelRatio || 1;
        canvas.width  = width  * dpr;
        canvas.height = height * dpr;
        canvas.style.width  = width  + 'px';
        canvas.style.height = height + 'px';
        ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const cell   = DOT_SIZE + GAP;
        const cols   = Math.floor((width  + GAP) / cell);
        const rows   = Math.floor((height + GAP) / cell);
        const gridW  = cell * cols - GAP;
        const gridH  = cell * rows - GAP;
        const startX = (width  - gridW) / 2 + DOT_SIZE / 2;
        const startY = (height - gridH) / 2 + DOT_SIZE / 2;

        dots = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                dots.push({
                    cx: startX + c * cell, // home X
                    cy: startY + r * cell, // home Y
                    ox: 0, oy: 0,          // current offset from home
                    vx: 0, vy: 0           // velocity
                });
            }
        }
    }

    /* Pointer state */
    const ptr = { x: -9999, y: -9999, vx: 0, vy: 0, speed: 0, lx: 0, ly: 0, lt: 0 };

    function lerp(a, b, t) { return a + (b - a) * t; }

    let animId;
    const proxSq = PROXIMITY * PROXIMITY;

    /* Main render loop */
    function tick() {
        animId = requestAnimationFrame(tick);
        if (!ctx) return;
        const W = canvas.width  / dpr;
        const H = canvas.height / dpr;
        ctx.clearRect(0, 0, W, H);

        const px = ptr.x, py = ptr.y;

        for (const d of dots) {
            // Spring physics — pull dots back toward their home position
            const fx = -SPRING_K * d.ox;
            const fy = -SPRING_K * d.oy;
            d.vx = (d.vx + fx) * SPRING_DAMP;
            d.vy = (d.vy + fy) * SPRING_DAMP;
            d.ox += d.vx;
            d.oy += d.vy;

            // Kill micro-jitter so idle dots are truly still
            if (Math.abs(d.ox) < 0.01 && Math.abs(d.vx) < 0.01) { d.ox = 0; d.vx = 0; }
            if (Math.abs(d.oy) < 0.01 && Math.abs(d.vy) < 0.01) { d.oy = 0; d.vy = 0; }

            const dx  = d.cx - px;
            const dy  = d.cy - py;
            const dsq = dx * dx + dy * dy;

            // Colour: blend from base → active as cursor gets closer
            let fr, fg, fb;
            if (dsq <= proxSq) {
                const t = 1 - Math.sqrt(dsq) / PROXIMITY;
                fr = Math.round(lerp(BASE_COLOR.r, ACTIVE_COLOR.r, t));
                fg = Math.round(lerp(BASE_COLOR.g, ACTIVE_COLOR.g, t));
                fb = Math.round(lerp(BASE_COLOR.b, ACTIVE_COLOR.b, t));
            } else {
                fr = BASE_COLOR.r; fg = BASE_COLOR.g; fb = BASE_COLOR.b;
            }

            // Dots are clearly visible at rest; near cursor they shift to gold
            const br   = Math.min(255, fr);
            const bg_c = Math.min(255, fg);
            const bb   = Math.min(255, fb);

            ctx.save();
            ctx.translate(d.cx + d.ox, d.cy + d.oy);
            ctx.beginPath();
            ctx.arc(0, 0, DOT_SIZE / 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgb(${br},${bg_c},${bb})`;
            ctx.fill();
            ctx.restore();
        }
    }

    /* Mouse move — track pointer and apply ripple impulse when moving fast */
    function onMouseMove(e) {
        const rect = canvas.getBoundingClientRect();
        const now  = performance.now();
        const dt   = ptr.lt ? now - ptr.lt : 16;
        const nx   = e.clientX - rect.left;
        const ny   = e.clientY - rect.top;

        ptr.vx    = ((nx - ptr.lx) / dt) * 1000;
        ptr.vy    = ((ny - ptr.ly) / dt) * 1000;
        ptr.speed = Math.hypot(ptr.vx, ptr.vy);
        ptr.lx = nx; ptr.ly = ny; ptr.lt = now;
        ptr.x  = nx; ptr.y  = ny;

        if (ptr.speed > SPEED_TRIGGER) {
            for (const d of dots) {
                const dist = Math.hypot(d.cx - nx, d.cy - ny);
                if (dist < PROXIMITY) {
                    const angle = Math.atan2(d.cy - ny, d.cx - nx);
                    const force = (1 - dist / PROXIMITY) * ptr.speed * 0.003;
                    d.vx += Math.cos(angle) * force + ptr.vx * 0.001;
                    d.vy += Math.sin(angle) * force + ptr.vy * 0.001;
                }
            }
        }
    }

    /* Click — radial shockwave from click point */
    function onClick(e) {
        const rect = canvas.getBoundingClientRect();
        const cx   = e.clientX - rect.left;
        const cy   = e.clientY - rect.top;
        for (const d of dots) {
            const dist = Math.hypot(d.cx - cx, d.cy - cy);
            if (dist < SHOCK_RADIUS) {
                const falloff = Math.max(0, 1 - dist / SHOCK_RADIUS);
                const angle   = Math.atan2(d.cy - cy, d.cx - cx);
                const force   = falloff * SHOCK_STR;
                d.vx += Math.cos(angle) * force;
                d.vy += Math.sin(angle) * force;
            }
        }
    }

    /* Init — build grid, start loop, attach listeners */
    let ro;
    function init() {
        buildGrid();
        tick();

        window.addEventListener('mousemove', onMouseMove, { passive: true });
        window.addEventListener('click', onClick);

        if ('ResizeObserver' in window) {
            ro = new ResizeObserver(() => {
                cancelAnimationFrame(animId);
                buildGrid();
                tick();
            });
            ro.observe(wrap);
        } else {
            window.addEventListener('resize', () => {
                cancelAnimationFrame(animId);
                buildGrid();
                tick();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
