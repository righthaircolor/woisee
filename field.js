/* woisee · field (v2)
   Форма без контура: мягкое облако частиц, внутри которого голос выстраивает узор стоячей волны.
   Частица стоит в облаке (гауссово распределение) и сдвигается к ближайшей узловой линии
   настолько, насколько «упорядочен» звук. Края нет никогда.
   Зависимостей нет. Голос (микрофон, высота тона) — VoiceForm.Voice из ../voiceform.js. */
(function (global) {
  'use strict';

  // 9 узоров: от крупных ячеек к мелкому кружеву. Индекс 2 — комфортная нота человека.
  const MODES = [[2, 3, -1], [1, 4, -1], [3, 4, -1], [2, 5, 1], [2, 5, -1], [3, 5, 1], [4, 5, 1], [2, 7, -1], [4, 7, 1]];
  MODES.forEach((m, i) => { m.nx = MODES[(i + 3) % MODES.length]; }); // подмешиваемый соседний узор
  const COMFORT = 2, SEMITONES_PER_STEP = 3, MIX = 0.42;
  const AX = Math.PI * 1.25, AY = Math.PI * 1.45;   // прямоугольная пластина: нет вечного креста
  const OX = 0.23, OY = -0.17;                       // облако сдвинуто от центра пластины: нет кольца в середине

  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function gs(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
  const snap = f => f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  function zm(md, x, y) { x += OX; y += OY; const m = md[0], n = md[1], s = md[2]; return Math.cos(m * AX * x) * Math.cos(n * AY * y) + s * Math.cos(n * AX * x) * Math.cos(m * AY * y); }
  function zf(md, x, y) { return zm(md, x, y) + MIX * zm(md.nx, x * 1.07, y * 0.94); }

  function make(N, seed, sx, sy) {
    const r = rng(seed || 7); sx = sx || 0.42; sy = sy || 0.36;
    const F = { N, X0: new Float32Array(N), Y0: new Float32Array(N), X: new Float32Array(N), Y: new Float32Array(N),
      CAP: new Float32Array(N), JX: new Float32Array(N), JY: new Float32Array(N), SZ: new Float32Array(N), G: [[], [], [], []] };
    for (let i = 0; i < N; i++) {
      F.X0[i] = gs(r) * sx; F.Y0[i] = gs(r) * sy; F.X[i] = F.X0[i]; F.Y[i] = F.Y0[i];
      F.CAP[i] = Math.pow(r(), 0.35);               // насколько частица слушается голоса
      F.JX[i] = gs(r); F.JY[i] = gs(r); F.SZ[i] = 0.8 + r() * r() * 1.2;
      F.G[(r() * 4) | 0].push(i);
    }
    return F;
  }

  // S: n (0..8), amp (0..1), stab (0..1), e (энергия: 1 звук, ~0.08 пауза), hold (0..1), noise (0..1), kick, front
  function state(o) { return Object.assign({ n: COMFORT, amp: 0.4, stab: 1, e: 1, hold: 1, noise: 0, kick: 0, front: 9 }, o || {}); }

  function target(F, S, i, t, out) {
    const nn = clamp(S.n, 0, MODES.length - 1);
    const i0 = Math.floor(nn), i1 = Math.min(MODES.length - 1, i0 + 1), g = snap(nn - i0), blur = 4 * g * (1 - g);
    const M0 = MODES[i0], M1 = MODES[i1];
    const order = S.e * (0.35 + 0.65 * S.stab) * (0.55 + 0.45 * S.hold) * (1 - blur * 0.55) * (1 - S.noise);
    const env = 0.85 + 0.3 * S.amp;
    const jit = 0.006 + (1 - S.stab) * 0.03 + (1 - S.hold) * 0.01 + S.noise * 0.05 + blur * 0.03;
    const x = F.X0[i] * env, y = F.Y0[i] * env, e = 0.004;
    const z = (1 - g) * zf(M0, x, y) + g * zf(M1, x, y);
    const zx = ((1 - g) * zf(M0, x + e, y) + g * zf(M1, x + e, y) - z) / e;
    const zy = ((1 - g) * zf(M0, x, y + e) + g * zf(M1, x, y + e) - z) / e;
    const g2 = zx * zx + zy * zy + 1e-4;
    let dx = -z * zx / g2, dy = -z * zy / g2; const dl = Math.hypot(dx, dy); if (dl > 0.22) { dx *= 0.22 / dl; dy *= 0.22 / dl; }
    const o = order * F.CAP[i];
    const w = t == null ? 0.7 : Math.sin(t * 7 + i) * 0.5 + 0.5;
    let tx = x + dx * o + F.JX[i] * jit * (0.4 + w), ty = y + dy * o + F.JY[i] * jit * (0.4 + w);
    if (S.front < 3 && S.kick > 0.02) {
      const r = Math.hypot(tx, ty) || 1e-6, d = Math.abs(r - S.front);
      if (d < 0.18) { const f = (0.18 - d) * 0.6 * S.kick; tx += tx / r * f; ty += ty / r * f; }
    }
    out[0] = tx; out[1] = ty;
  }

  const tmp = [0, 0];
  function step(F, S, dt, t) {
    const mv = 1 - Math.pow(1 - (S.e > 0.5 ? 0.12 : 0.03), dt * 60);
    for (let i = 0; i < F.N; i++) { target(F, S, i, t, tmp); F.X[i] += (tmp[0] - F.X[i]) * mv; F.Y[i] += (tmp[1] - F.Y[i]) * mv; }
    S.front += dt * 1.8; S.kick *= Math.pow(0.97, dt * 60);
  }
  function settle(F, S) { for (let i = 0; i < F.N; i++) { target(F, S, i, null, tmp); F.X[i] = tmp[0]; F.Y[i] = tmp[1]; } }

  const AL = [0.35, 0.55, 0.78, 1];
  function draw(ctx, F, cx, cy, R, color, dot, alpha) {
    ctx.fillStyle = color; const a = alpha == null ? 1 : alpha;
    for (let q = 0; q < 4; q++) {
      ctx.globalAlpha = AL[q] * a; const L = F.G[q];
      for (let j = 0; j < L.length; j++) { const i = L[j], s = F.SZ[i] * dot; ctx.fillRect(cx + F.X[i] * R - s / 2, cy + F.Y[i] * R - s / 2, s, s); }
    }
    ctx.globalAlpha = 1;
  }

  // Плавное состояние: быстрая сборка, медленное рассыпание
  function ease(S, T, dt) {
    const k = a => 1 - Math.pow(1 - a, dt * 60);
    S.n += (T.n - S.n) * k(0.06);
    S.amp += (T.amp - S.amp) * k(T.amp > S.amp ? 0.15 : 0.04);
    S.stab += (T.stab - S.stab) * k(0.08);
    S.e += (T.e - S.e) * k(T.e > S.e ? 0.06 : 0.012);
    S.hold += (T.hold - S.hold) * k(0.06);
    S.noise += (T.noise - S.noise) * k(0.1);
    if (T.kick > 0) { S.kick = T.kick; S.front = 0; T.kick = 0; }
  }

  // Голос (VoiceForm.Voice после update) → цель для поля
  function fromVoice(v, T) {
    const f = v.f;
    if (f.voiced && f.ref) T.n = clamp(COMFORT + (f.midi - f.ref) / SEMITONES_PER_STEP, 0, MODES.length - 1);
    T.amp = f.noise ? 0.1 : 0.15 + 0.85 * Math.pow(Math.min(1, f.level || 0), 0.6);
    T.stab = f.voiced ? f.stab : f.noise ? 0.15 : T.stab;
    T.e = f.silent ? 0.08 : f.noise ? 0.6 : 1;
    T.noise = f.noise ? 1 : 0;
    T.hold = v.hold;
    if (v.T.kick) { T.kick = v.T.kick; v.T.kick = 0; }
    return T;
  }

  global.Field = { MODES, COMFORT, SEMITONES_PER_STEP, rng, gs, make, state, step, settle, draw, ease, fromVoice, zf };
})(window);
