/**
 * KeyVeil receipt visualization.
 * - ready / processing: faceted reference crystal
 * - approved: ordered green node network and deterministic hash fragments
 * - blocked: RGB separation, scan lines, and red edge signals
 * - pending_human: dual core, review particles, and receipt hash ring
 */
(function () {
  const canvas = document.getElementById("core-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const N = 28;
  const targetRadii = new Float32Array(N);
  const currentRadii = new Float32Array(N);

  /** @type {Record<string, object>} */
  const themes = {
    idle: {
      glow: [255, 107, 157],
      rim: [248, 244, 240],
      breathHz: 0.28,
      scaleAmp: 0.055,
      vertexBreath: 0.04,
      glowAlpha: [0.12, 0.48],
      haloBoost: 0.2,
      twistAmp: 0.06,
      morphLerp: 0.07,
    },
    processing: {
      glow: [110, 210, 255],
      rim: [230, 246, 255],
      breathHz: 0.62,
      scaleAmp: 0.09,
      vertexBreath: 0.08,
      glowAlpha: [0.2, 0.72],
      haloBoost: 0.38,
      twistAmp: 0.14,
      morphLerp: 0.11,
    },
    approved: {
      glow: [61, 220, 132],
      rim: [230, 255, 238],
      breathHz: 0.22,
      scaleAmp: 0.045,
      vertexBreath: 0.03,
      glowAlpha: [0.14, 0.52],
      haloBoost: 0.22,
      twistAmp: 0.04,
      morphLerp: 0.08,
    },
    blocked: {
      glow: [255, 72, 72],
      rim: [255, 228, 228],
      breathHz: 0.55,
      scaleAmp: 0.1,
      vertexBreath: 0.1,
      glowAlpha: [0.28, 0.88],
      haloBoost: 0.52,
      twistAmp: 0.14,
      morphLerp: 0.1,
    },
    pending_human: {
      glow: [245, 177, 74],
      rim: [255, 242, 214],
      breathHz: 0.32,
      scaleAmp: 0.06,
      vertexBreath: 0.05,
      glowAlpha: [0.18, 0.58],
      haloBoost: 0.34,
      twistAmp: 0.08,
      morphLerp: 0.08,
    },
  };

  let currentKey = "idle";
  let morphGen = 0;
  let receiptSalt = "idle";
  let lastAppliedKey = "";
  let t0 = performance.now();
  let visualMode = "crystal";
  let prevVisualMode = "crystal";
  let prevThemeKeyForBlend = "idle";
  let transitionActive = false;
  let transitionStart = 0;
  let contentEnterTime = performance.now();

  const motionOk = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const motion = motionOk ? 1 : 0.22;
  const TRANSITION_MS = motionOk ? 1180 : 420;

  let mx = 0;
  let my = 0;
  let pointerActive = false;

  function mix(a, b, k) {
    return a + (b - a) * k;
  }

  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function keyToMode(key) {
    if (key === "approved") return "network";
    if (key === "blocked") return "glitch";
    if (key === "pending_human") return "audit";
    return "crystal";
  }

  function refreshTargets() {
    const salt = hashStr(`${currentKey}|g${morphGen}|${receiptSalt}`);
    for (let i = 0; i < N; i++) {
      const h = hashStr(`${salt}|v${i}`);
      const u = (h % 10007) / 10007;
      targetRadii[i] = 0.42 + 0.62 * u;
    }
  }

  /**
   * @param {string} key
   * @param {{ receiptId?: string | null; interact?: boolean }=} opts
   */
  window.setCoreTheme = function (key, opts) {
    if (!themes[key]) return;
    const o = opts || {};
    const oldKey = currentKey;
    const oldVisual = visualMode;
    const keyChanged = key !== lastAppliedKey;
    lastAppliedKey = key;
    currentKey = key;

    if (o.receiptId !== undefined && o.receiptId !== null) {
      receiptSalt = String(o.receiptId);
    }
    if (o.receiptId === null) {
      receiptSalt = "idle";
    }
    if (o.interact) morphGen++;
    if (keyChanged || o.receiptId !== undefined || o.interact) {
      refreshTargets();
    }

    const nextMode = keyToMode(key);
    if (nextMode !== oldVisual) {
      prevVisualMode = oldVisual;
      visualMode = nextMode;
      prevThemeKeyForBlend = oldKey;
      transitionStart = performance.now();
      transitionActive = true;
      contentEnterTime = transitionStart;
    } else if (o.receiptId !== undefined && o.receiptId !== null) {
      contentEnterTime = performance.now();
    }
  };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function breathValue(tSec, hz) {
    const w = hz * Math.PI * 2;
    const a = 0.62 * Math.sin(tSec * w + 0.2);
    const b = 0.38 * Math.sin(tSec * w * 2 + 1.1);
    return Math.max(-1, Math.min(1, a + b));
  }

  function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
  }

  function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function easeOutQuart(x) {
    return 1 - Math.pow(1 - x, 4);
  }

  canvas.addEventListener("click", () => {
    window.setCoreTheme(currentKey, { interact: true });
  });
  canvas.style.cursor = "pointer";
  canvas.setAttribute("title", "Receipt visual; click to change the local seed");

  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    mx = e.clientX - r.left;
    my = e.clientY - r.top;
    pointerActive = true;
  });
  canvas.addEventListener("mouseleave", () => {
    pointerActive = false;
  });

  function hexFromSalt(salt, len) {
    let out = "";
    let h = hashStr(String(salt));
    for (let k = 0; k < len; k++) {
      out += ((h >> (k % 28)) & 15).toString(16);
      h = Math.imul(h, 1103515245) + 12345;
    }
    return out.toUpperCase();
  }

  /** Build the crystal vertices. */
  function buildCrystalVerts(cx, cy, baseR, th, t, wave, breathScale, twist) {
    const px = pointerActive ? (mx - cx) / Math.max(canvas.getBoundingClientRect().width, 1) : 0;
    const py = pointerActive ? (my - cy) / Math.max(canvas.getBoundingClientRect().height, 1) : 0;
    const pointerWarp = motion * 0.12;
    const xs = new Float32Array(N);
    const ys = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const baseA = (i / N) * Math.PI * 2 - Math.PI / 2 + twist;
      const vb = Math.sin(t * (2.1 + i * 0.03) * th.breathHz * 2 + i * 0.7) * th.vertexBreath * motion;
      const ri = baseR * currentRadii[i] * breathScale * (1 + vb);
      const pull = Math.sin(t * 1.3 + i * 0.4) * pointerWarp * (px + py);
      const a = baseA + pull;
      xs[i] = cx + Math.cos(a) * ri;
      ys[i] = cy + Math.sin(a) * ri;
    }
    return { xs, ys };
  }

  function drawCrystalFillStroke(cx, cy, xs, ys, th, r0, g0, b0, alphaMul) {
    const [R, G, B] = th.rim;
    const br = Math.hypot(xs[0] - cx, ys[0] - cy) * 2.2;
    const fillG = ctx.createRadialGradient(cx, cy, 0, cx, cy, br);
    fillG.addColorStop(0, `rgba(${mix(R, 255, 0.2)},${mix(G, 255, 0.2)},${mix(B, 255, 0.2)},${0.88 * alphaMul})`);
    fillG.addColorStop(0.55, `rgba(${R * 0.35},${G * 0.35},${B * 0.35},${0.5 * alphaMul})`);
    fillG.addColorStop(1, `rgba(${R * 0.12},${G * 0.12},${B * 0.12},${0.2 * alphaMul})`);
    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    for (let i = 1; i < N; i++) ctx.lineTo(xs[i], ys[i]);
    ctx.closePath();
    ctx.fillStyle = fillG;
    ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.12 * alphaMul})`;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.strokeStyle = `rgba(${r0},${g0},${b0},${0.32 * alphaMul})`;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let i = 0; i < N; i += 3) {
      ctx.lineTo(xs[i], ys[i]);
      ctx.moveTo(cx, cy);
    }
    ctx.stroke();
  }

  /** tBlend: 0 = fromKey, 1 = toKey */
  function drawBackgroundBlended(fromKey, toKey, tBlend, w, h, cx, cy, wavePulse) {
    const ta = themes[fromKey];
    const tb = themes[toKey];
    const u = easeInOutCubic(Math.max(0, Math.min(1, tBlend)));
    const r0 = mix(ta.glow[0], tb.glow[0], u);
    const g0 = mix(ta.glow[1], tb.glow[1], u);
    const b0 = mix(ta.glow[2], tb.glow[2], u);
    const aLo = mix(ta.glowAlpha[0], tb.glowAlpha[0], u);
    const aHi = mix(ta.glowAlpha[1], tb.glowAlpha[1], u);
    const haloBoost = mix(ta.haloBoost, tb.haloBoost, u);
    const glowA = mix(aLo, aHi, wavePulse);
    const waveDet = wavePulse * 2 - 1;
    const haloR = Math.max(w, h) * (0.36 + 0.07 * waveDet + haloBoost * 0.07);
    const outer = ctx.createRadialGradient(cx, cy - 6, 0, cx, cy, haloR * 1.12);
    outer.addColorStop(0, `rgba(${r0},${g0},${b0},${glowA * 0.32})`);
    outer.addColorStop(0.42, `rgba(${r0},${g0},${b0},${glowA * 0.1})`);
    outer.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = outer;
    ctx.fillRect(0, 0, w, h);
    const core = ctx.createRadialGradient(cx, cy - 10, 0, cx, cy, haloR * 0.62);
    core.addColorStop(0, `rgba(${r0},${g0},${b0},${glowA * 0.85})`);
    core.addColorStop(0.55, `rgba(${r0},${g0},${b0},${glowA * 0.2})`);
    core.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, w, h);
  }

  function dispatchDraw(mode, themeKey, innerEase, w, h, cx, cy, t, wave) {
    const th = themes[themeKey];
    const wv = wave !== undefined ? wave : breathValue(t, th.breathHz) * motion;
    const baseR = Math.min(w, h) * 0.31;
    const breathScale = 1 + th.scaleAmp * wv;
    const twist = Math.sin(t * 0.7) * th.twistAmp * motion;
    const { xs, ys } = buildCrystalVerts(cx, cy, baseR, th, t, wv, breathScale, twist);
    const [r0, g0, b0] = th.glow;
    if (mode === "network") drawNetwork(cx, cy, t, wv, th, innerEase, w, h);
    else if (mode === "glitch") drawGlitch(cx, cy, xs, ys, t, wv, th, innerEase, w, h);
    else if (mode === "audit") drawAuditCloud(cx, cy, t, wv, th, innerEase, w, h);
    else drawCrystalFillStroke(cx, cy, xs, ys, th, r0, g0, b0, innerEase);
  }

  /** Approved: ordered node network, flowing edges, and hash fragments. */
  function drawNetwork(cx, cy, t, wave, th, ease, w, h) {
    const spread = Math.min(w, h) * 0.38 * ease;
    const nodeCount = 42;
    const nodes = [];
    const salt = receiptSalt + morphGen;
    for (let i = 0; i < nodeCount; i++) {
      const hx = hashStr(`nx${i}|${salt}`);
      const hy = hashStr(`ny${i}|${salt}`);
      let x = ((hx % 2000) / 2000 - 0.5) * spread * 2;
      let y = ((hy % 2000) / 2000 - 0.5) * spread * 2;
      x += Math.sin(t * 1.1 + i * 0.4) * 12 * motion;
      y += Math.cos(t * 0.9 + i * 0.35) * 10 * motion;
      nodes.push({ x: cx + x, y: cy + y, i });
    }

    const maxD = spread * 0.52;
    ctx.lineWidth = 1;
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        if ((hashStr(`${i}|${j}|${salt}`) & 15) > 10) continue;
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d = Math.hypot(dx, dy);
        if (d < maxD) {
          const a = (1 - d / maxD) * 0.55 * ease;
          const flow = (t * 1.8 + i * 0.2 + j * 0.15) % 1;
          ctx.strokeStyle = `rgba(61,220,132,${a * (0.35 + 0.65 * flow)})`;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    const [r0, g0, b0] = th.glow;
    for (let i = 0; i < nodeCount; i++) {
      const pulse = 0.6 + 0.4 * Math.sin(t * 3 + i * 0.5);
      const rad = 2.2 + pulse * 1.8;
      ctx.beginPath();
      ctx.arc(nodes[i].x, nodes[i].y, rad * ease, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r0},${g0},${b0},${0.55 * ease * pulse})`;
      ctx.fill();
    }

    ctx.font = `${Math.max(7, 9 * ease)}px JetBrains Mono, monospace`;
    ctx.textAlign = "center";
    for (let k = 0; k < 14; k++) {
      const hx = hexFromSalt(salt + "f" + k, 6);
      const ang = t * 0.35 + (k / 14) * Math.PI * 2;
      const rr = spread * (0.85 + 0.12 * Math.sin(t * 2 + k));
      const tx = cx + Math.cos(ang) * rr;
      const ty = cy + Math.sin(ang) * rr;
      ctx.fillStyle = `rgba(180,255,210,${0.22 * ease})`;
      ctx.fillText("0x" + hx, tx, ty);
    }
  }

  /** Blocked: RGB separation, scan lines, flicker, and edge hashes. */
  function drawGlitch(cx, cy, xs, ys, t, wave, th, ease, w, h) {
    const [r0, g0, b0] = th.glow;
    const flick = 0.72 + 0.28 * Math.sin(t * 31 * motion);
    const rgbShift = 5 * ease * motion * (0.5 + 0.5 * Math.sin(t * 18));

    function polyPath() {
      ctx.beginPath();
      ctx.moveTo(xs[0], ys[0]);
      for (let i = 1; i < N; i++) ctx.lineTo(xs[i], ys[i]);
      ctx.closePath();
    }

    ctx.save();
    ctx.globalAlpha = 0.42 * flick * ease;
    ctx.translate(rgbShift, 0);
    polyPath();
    ctx.fillStyle = "rgba(255,40,40,0.45)";
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.38 * flick * ease;
    ctx.translate(-rgbShift * 0.9, 1);
    polyPath();
    ctx.fillStyle = "rgba(40,200,255,0.35)";
    ctx.fill();
    ctx.restore();

    drawCrystalFillStroke(cx, cy, xs, ys, th, r0, g0, b0, 0.55 * flick * ease);

    /* Keep scan effects near the crystal instead of framing the full canvas. */
    const clipRx = Math.min(w, h) * 0.48;
    const clipRy = Math.min(w, h) * 0.44;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, clipRx, clipRy, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalCompositeOperation = "overlay";
    for (let y = 0; y < h; y += 3) {
      const on = (Math.floor(y / 3 + t * 40) % 2) === 0;
      ctx.fillStyle = on ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.12)";
      ctx.fillRect(0, y, w, 2);
    }

    const burst = Math.sin(t * 22) * 8 * ease * motion;
    ctx.strokeStyle = `rgba(255,100,100,${0.15 * flick})`;
    for (let s = 0; s < 6; s++) {
      const yy = ((t * 120 + s * 47) % (h + 40)) - 20;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(w, yy + burst);
      ctx.stroke();
    }
    ctx.restore();

    ctx.font = "8px JetBrains Mono, monospace";
    ctx.textAlign = "center";
    const tape = hexFromSalt(receiptSalt + "glitch", 64);
    for (let i = 0; i < N; i += 1) {
      const j = (i + 1) % N;
      const mx2 = (xs[i] + xs[j]) * 0.5;
      const my2 = (ys[i] + ys[j]) * 0.5;
      const seg = tape.slice((i * 2) % 40, ((i * 2) % 40) + 4);
      ctx.fillStyle = `rgba(255,200,200,${0.35 * flick * ease})`;
      ctx.fillText(seg, mx2, my2);
    }
  }

  /** Pending: dual core, particle cloud, and outer hash ring. */
  function drawAuditCloud(cx, cy, t, wave, th, ease, w, h) {
    const [r0, g0, b0] = th.glow;
    const sep = Math.min(w, h) * 0.14 * ease;
    const scale = 0.38 * ease;

    const cloudN = 95;
    for (let i = 0; i < cloudN; i++) {
      const h1 = hashStr(`c${i}|${receiptSalt}`);
      const ang = (h1 % 628) / 100 + t * 0.25;
      const rad = sep * (1.1 + ((h1 >> 8) % 100) / 100) + Math.sin(t * 2 + i) * 6 * motion;
      const px2 = cx + Math.cos(ang) * rad * 1.8;
      const py2 = cy + Math.sin(ang) * rad * 1.35;
      const a = 0.04 + ((h1 >> 4) % 20) / 200;
      ctx.beginPath();
      ctx.arc(px2, py2, 1.2 + (i % 3), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r0},${g0},${b0},${a * ease})`;
      ctx.fill();
    }

    function smallCrystal(ox, oy) {
      const br = Math.min(w, h) * scale;
      const twist = Math.sin(t * 0.5) * 0.08;
      const local = buildCrystalVerts(ox, oy, br, th, t, wave, 1 + th.scaleAmp * wave * 0.5, twist);
      drawCrystalFillStroke(ox, oy, local.xs, local.ys, th, r0, g0, b0, 0.75);
    }

    smallCrystal(cx - sep * 2.2, cy + Math.sin(t * 0.7) * 5 * motion);
    smallCrystal(cx + sep * 2.2, cy - Math.sin(t * 0.7) * 5 * motion);

    const ringR = Math.min(w, h) * 0.42 * ease;
    const text = hexFromSalt(receiptSalt + "audit", 40);
    const chunks = text.match(/.{1,5}/g) || [text];
    ctx.font = `${Math.max(7, 8 * ease)}px JetBrains Mono, monospace`;
    ctx.textAlign = "center";
    chunks.forEach((chunk, idx) => {
      const ang = -Math.PI / 2 + (idx / chunks.length) * Math.PI * 2 + t * 0.15;
      const tx = cx + Math.cos(ang) * ringR;
      const ty = cy + Math.sin(ang) * ringR;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(ang + Math.PI / 2);
      ctx.fillStyle = `rgba(255,230,190,${0.45 * ease})`;
      ctx.fillText(chunk, 0, 0);
      ctx.restore();
    });
  }

  let initialized = false;

  function draw(now) {
    const th = themes[currentKey];
    const ts = typeof now === "number" ? now : performance.now();
    const w = Math.max(1, canvas.getBoundingClientRect().width);
    const h = Math.max(1, canvas.getBoundingClientRect().height);
    const cx = w * 0.5;
    const cy = h * 0.5;
    const t = (ts - t0) / 1000;
    const wave = breathValue(t, th.breathHz) * motion;
    const wave01 = (wave + 1) * 0.5;
    const wavePrev = breathValue(t, themes[prevThemeKeyForBlend].breathHz) * motion;

    if (!initialized) {
      refreshTargets();
      currentRadii.set(targetRadii);
      initialized = true;
    }

    const lerp = 1 - Math.pow(1 - th.morphLerp, motion);
    for (let i = 0; i < N; i++) {
      currentRadii[i] += (targetRadii[i] - currentRadii[i]) * lerp;
    }

    let cross = 1;
    let blending = false;
    if (transitionActive) {
      cross = Math.min(1, (ts - transitionStart) / TRANSITION_MS);
      blending = cross < 1;
      if (cross >= 1) {
        transitionActive = false;
        prevThemeKeyForBlend = currentKey;
        prevVisualMode = visualMode;
        blending = false;
        cross = 1;
      }
    }

    ctx.clearRect(0, 0, w, h);
    drawBackgroundBlended(
      prevThemeKeyForBlend,
      currentKey,
      blending ? cross : 1,
      w,
      h,
      cx,
      cy,
      wave01
    );

    const contentEase = easeOutQuart(Math.min(1, (ts - contentEnterTime) / 840));

    if (blending) {
      const u = easeInOutCubic(cross);
      const outAlpha = (1 - u) * (0.92 + 0.08 * (1 - u));
      const outScale = mix(1, 0.86, easeInOutCubic(cross));
      const inAlpha = 0.04 + 0.96 * easeOutQuart(cross);
      const inScale = mix(0.9, 1, easeOutQuart(cross));
      const inDetail = contentEase * (0.35 + 0.65 * easeOutCubic(cross));

      ctx.save();
      ctx.globalAlpha = outAlpha;
      ctx.translate(cx, cy);
      ctx.scale(outScale, outScale);
      ctx.translate(-cx, -cy);
      dispatchDraw(
        prevVisualMode,
        prevThemeKeyForBlend,
        mix(1, 0.82, easeInOutCubic(cross)),
        w,
        h,
        cx,
        cy,
        t,
        wavePrev
      );
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = inAlpha;
      ctx.translate(cx, cy);
      ctx.scale(inScale, inScale);
      ctx.translate(-cx, -cy);
      dispatchDraw(visualMode, currentKey, inDetail, w, h, cx, cy, t, wave);
      ctx.restore();
    } else {
      ctx.save();
      const s = mix(0.93, 1, contentEase);
      ctx.translate(cx, cy);
      ctx.scale(s, s);
      ctx.translate(-cx, -cy);
      dispatchDraw(visualMode, currentKey, contentEase, w, h, cx, cy, t, wave);
      ctx.restore();
    }

    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(draw);
})();
