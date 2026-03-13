/* ═══════════════════════════════════════════════════════
   convoy.js — Looping police-escorted truck convoy
   Draws on #convoy-canvas in the hero section
═══════════════════════════════════════════════════════ */
(function () {
    'use strict';

    const canvas = document.getElementById('convoy-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W, H, roadY, roadH;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    /* ── Resize ──────────────────────────────────────────── */
    function resize() {
        W = canvas.offsetWidth;
        H = canvas.offsetHeight;
        canvas.width  = W * DPR;
        canvas.height = H * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        roadH = Math.min(90, Math.max(60, H * 0.5));
        roadY = H - roadH;
    }
    resize();
    window.addEventListener('resize', resize);

    /* ── Helpers ─────────────────────────────────────────── */
    function wheel(x, y, r) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#111';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = '#555';
        ctx.fill();
    }

    function radialGlow(cx, cy, r0, r1, color) {
        const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        return g;
    }

    /* ── Road ────────────────────────────────────────────── */
    function drawRoad(dashOffset) {
        /* asphalt */
        const g = ctx.createLinearGradient(0, roadY, 0, H);
        g.addColorStop(0, '#212535');
        g.addColorStop(1, '#0e1220');
        ctx.fillStyle = g;
        ctx.fillRect(0, roadY, W, roadH);

        /* kerb line top */
        ctx.fillStyle = 'rgba(232,160,32,0.55)';
        ctx.fillRect(0, roadY, W, 2);

        /* dashed centre line — scrolls with convoy */
        const dW = 34, dG = 22, dH = 3;
        const dY = roadY + roadH * 0.5 - dH / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        for (let x = -dashOffset % (dW + dG); x < W; x += dW + dG) {
            ctx.fillRect(x, dY, dW, dH);
        }

        /* faint kerb line bottom */
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(0, H - 3, W, 3);
    }

    /* ── Police car ──────────────────────────────────────── */
    function drawPoliceCar(cx, flash) {
        const BW = 56, BH = 20, TH = 13;
        const baseY = roadY - BH - 2;
        const topY  = baseY - TH;
        const bx    = cx - BW / 2;

        /* drop shadow */
        ctx.fillStyle = radialGlow(cx, roadY + 2, 4, 44, 'rgba(0,0,0,0.4)');
        ctx.beginPath(); ctx.ellipse(cx, roadY + 4, 32, 7, 0, 0, Math.PI * 2); ctx.fill();

        /* body */
        ctx.fillStyle = '#1e2d6b';
        ctx.beginPath(); ctx.roundRect(bx, baseY, BW, BH, [0, 0, 5, 5]); ctx.fill();

        /* white side band */
        const band = ctx.createLinearGradient(bx, 0, bx + BW, 0);
        band.addColorStop(0,   'rgba(255,255,255,0)');
        band.addColorStop(0.1, 'rgba(255,255,255,0.18)');
        band.addColorStop(0.9, 'rgba(255,255,255,0.18)');
        band.addColorStop(1,   'rgba(255,255,255,0)');
        ctx.fillStyle = band;
        ctx.fillRect(bx, baseY + 4, BW, BH - 8);

        /* cabin */
        ctx.fillStyle = '#162057';
        ctx.beginPath(); ctx.roundRect(bx + 8, topY, BW - 18, TH + 2, [4, 4, 0, 0]); ctx.fill();

        /* front windshield */
        ctx.fillStyle = 'rgba(160,220,255,0.6)';
        ctx.beginPath(); ctx.roundRect(bx + BW - 22, topY + 2, 14, TH - 3, 2); ctx.fill();

        /* rear window */
        ctx.fillStyle = 'rgba(160,220,255,0.45)';
        ctx.beginPath(); ctx.roundRect(bx + 9, topY + 2, 10, TH - 3, 2); ctx.fill();

        /* light bar base */
        const lbX = bx + 10, lbY = topY - 6, lbW = BW - 20, lbH = 5;
        ctx.fillStyle = '#333';
        ctx.fillRect(lbX, lbY, lbW, lbH);

        /* red / blue flash */
        ctx.fillStyle = flash ? 'rgba(255,30,30,0.95)' : 'rgba(255,30,30,0.18)';
        ctx.fillRect(lbX, lbY, lbW / 2 - 1, lbH);
        ctx.fillStyle = flash ? 'rgba(30,80,255,0.18)' : 'rgba(30,80,255,0.95)';
        ctx.fillRect(lbX + lbW / 2 + 1, lbY, lbW / 2 - 1, lbH);

        /* glow from bar */
        const gc = flash ? 'rgba(255,40,40,' : 'rgba(30,80,255,';
        ctx.fillStyle = radialGlow(cx, lbY + 3, 3, 40, gc + '0.2)');
        ctx.fillRect(cx - 45, lbY - 18, 90, 45);

        /* front headlight */
        ctx.fillStyle = 'rgba(255,255,200,0.9)';
        ctx.fillRect(bx + BW - 3, baseY + 5, 4, 6);
        ctx.fillStyle = radialGlow(bx + BW + 8, baseY + 8, 1, 22, 'rgba(255,255,180,0.3)');
        ctx.fillRect(bx + BW - 3, baseY - 4, 35, 22);

        /* tail light */
        ctx.fillStyle = 'rgba(255,50,50,0.9)';
        ctx.fillRect(bx - 3, baseY + 5, 3, 6);

        /* POLICE label */
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = 'bold 5px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('POLICE', cx, baseY + BH - 4);

        /* wheels */
        wheel(bx + 10,      roadY, 8);
        wheel(bx + BW - 10, roadY, 8);
    }

    /* ── Truck + Trailer ─────────────────────────────────── */
    function drawTruck(cx) {
        /* cx = center of trailer; cab attaches to right end */
        const TW = 140, TH = 34;
        const CW = 60,  CH = 44;
        const tx   = cx - TW / 2;
        const ty   = roadY - TH - 6;
        const cabX = tx + TW - 8;   /* slight hitch overlap */
        const cabY = roadY - CH - 6;

        /* shadow */
        ctx.fillStyle = radialGlow(cx + CW / 2, roadY + 3, 5, 80, 'rgba(0,0,0,0.45)');
        ctx.beginPath(); ctx.ellipse(cx + CW / 2, roadY + 5, 75, 9, 0, 0, Math.PI * 2); ctx.fill();

        /* ── Trailer ── */
        /* body */
        ctx.fillStyle = '#d4d4d4';
        ctx.beginPath(); ctx.roundRect(tx, ty, TW, TH, [3, 3, 2, 2]); ctx.fill();

        /* top strip */
        ctx.fillStyle = '#bbb';
        ctx.fillRect(tx, ty, TW, 5);

        /* NMC livery */
        ctx.fillStyle = '#e8a020';
        ctx.fillRect(tx, ty + 5, TW, 5);
        ctx.fillStyle = '#0a1628';
        ctx.fillRect(tx, ty + 10, TW, 4);
        ctx.fillStyle = '#e8a020';
        ctx.fillRect(tx, ty + 14, TW, 3);

        /* NMC text */
        ctx.fillStyle = '#0a1628';
        ctx.font = 'bold 8px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('NMC LOGISTICS', tx + TW * 0.46, ty + TH - 7);

        /* tail lights */
        ctx.fillStyle = 'rgba(255,50,50,0.95)';
        ctx.fillRect(tx - 3, ty + TH - 15, 3, 9);
        ctx.fillStyle = 'rgba(255,200,20,0.85)';
        ctx.fillRect(tx - 3, ty + TH - 6,  3, 4);

        /* trailer wheels */
        const twa = [tx + 16, tx + 33, tx + TW - 36, tx + TW - 18];
        twa.forEach(wx => wheel(wx, roadY, 9));

        /* ── Cab ── */
        ctx.fillStyle = '#19215c';
        ctx.beginPath(); ctx.roundRect(cabX, cabY, CW, CH, [6, 8, 4, 4]); ctx.fill();

        /* gold accent stripe */
        ctx.fillStyle = '#e8a020';
        ctx.fillRect(cabX, cabY + 5, 5, CH - 10);

        /* windshield */
        ctx.fillStyle = 'rgba(165,220,255,0.65)';
        ctx.beginPath(); ctx.roundRect(cabX + CW - 22, cabY + 6, 18, CH * 0.43, 2); ctx.fill();

        /* side window */
        ctx.fillStyle = 'rgba(155,215,255,0.45)';
        ctx.beginPath(); ctx.roundRect(cabX + 8, cabY + 6, 14, 13, 2); ctx.fill();

        /* headlights */
        ctx.fillStyle = 'rgba(255,255,200,0.95)';
        ctx.fillRect(cabX + CW - 3, cabY + 9,      4, 7);
        ctx.fillRect(cabX + CW - 3, cabY + CH - 15, 4, 5);

        /* headlight glow cone */
        const hg = ctx.createLinearGradient(cabX + CW, cabY + CH / 2, cabX + CW + 55, cabY + CH / 2);
        hg.addColorStop(0, 'rgba(255,255,180,0.28)');
        hg.addColorStop(1, 'rgba(255,255,180,0)');
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.moveTo(cabX + CW, cabY + 5);
        ctx.lineTo(cabX + CW + 60, cabY - 8);
        ctx.lineTo(cabX + CW + 60, cabY + CH + 8);
        ctx.lineTo(cabX + CW, cabY + CH - 5);
        ctx.fill();

        /* exhaust stacks */
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(cabX + 10, cabY - 16, 5, 18);
        ctx.fillRect(cabX + 20, cabY - 12, 5, 14);
        /* puffs */
        ctx.fillStyle = 'rgba(200,200,200,0.12)';
        ctx.beginPath(); ctx.arc(cabX + 12, cabY - 19, 7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cabX + 22, cabY - 15, 5, 0, Math.PI * 2); ctx.fill();

        /* cab wheels */
        wheel(cabX + 13,      roadY, 10);
        wheel(cabX + CW - 9,  roadY, 10);
    }

    /* ── Animation loop ──────────────────────────────────── */
    const SPEED = 2.4;
    const GAP_REAR_TRUCK  = 185;  /* rear police → truck centre */
    const GAP_TRUCK_LEAD  = 215;  /* truck centre → front police */
    const CONVOY_LEN      = GAP_REAR_TRUCK + GAP_TRUCK_LEAD;

    let frame = 0, lastFlash = 0, flashState = 0;

    function animate() {
        ctx.clearRect(0, 0, W, H);
        frame++;

        /* flash: every 7 frames */
        if (frame - lastFlash > 7) { lastFlash = frame; flashState ^= 1; }

        /* dash offset for scrolling road lines */
        const dashOffset = (frame * SPEED) % 56;

        drawRoad(dashOffset);

        /* convoy position — seamless loop */
        const loopLen = W + CONVOY_LEN + 160;
        const base = (frame * SPEED) % loopLen - CONVOY_LEN - 80;

        const rearPoliceX  = base;
        const truckCX      = base + GAP_REAR_TRUCK;
        const frontPoliceX = base + CONVOY_LEN;

        /* draw back-to-front so rear elements appear on top */
        drawPoliceCar(rearPoliceX,  flashState === 0);
        drawTruck(truckCX);
        drawPoliceCar(frontPoliceX, flashState === 1); /* opposite phase */

        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
}());
