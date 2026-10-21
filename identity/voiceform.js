/* woisee · voiceform
   Движок знака: материя (частицы) + голос (микрофон) → фигура.
   Принцип: тишина — материя рассыпана; голос собирает её в стоячую волну;
   высота = число лепестков, устойчивость = чёткость, громкость = глубина,
   атака = толчок, длительность = плотность, пауза = рассыпание с отпечатком.
   Файл без зависимостей, можно переносить в приложение как есть. */
(function (global) {
  'use strict';
  const TAU = Math.PI * 2;

  /* ---------- утилиты ---------- */
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function gauss(r) { return (r() + r() + r() - 1.5) / 1.5; }          // ~[-1..1], колокол
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function snap(f) { return f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2; } // притяжение к целым модам
  function median(a) { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; }

  /* ---------- параметры знака ---------- */
  const MARK = { n: 3, amp: 0.22, stab: 1, kick: 0, m: 1, hold: 1, noise: 0, rot: 0 };
  const SILENCE = { n: 3, amp: 0.1, stab: 1, kick: 0, m: 0.12, hold: 0, noise: 0, rot: 0 };
  function state(o) { return Object.assign({}, MARK, o || {}); }

  /* ---------- материя ---------- */
  function makeMatter(N, seed) {
    const r = rng(seed || 7);
    const M = {
      N, th: new Float32Array(N), u: new Float32Array(N), h: new Float32Array(N),
      sx: new Float32Array(N), sy: new Float32Array(N), sz: new Float32Array(N),
      x: new Float32Array(N), y: new Float32Array(N), tx: new Float32Array(N), ty: new Float32Array(N),
      grp: [[], [], [], []]
    };
    for (let i = 0; i < N; i++) {
      M.th[i] = r() * TAU;
      M.u[i] = gauss(r);
      M.h[i] = gauss(r);
      // тишина: неровная «лужица» из двух сгустков, никакого круга
      const k = r();
      const ox = k < 0.62 ? -0.2 : 0.3, oy = k < 0.62 ? 0.08 : -0.16;
      M.sx[i] = ox + gauss(r) * 0.66;
      M.sy[i] = oy + gauss(r) * 0.44;
      M.sz[i] = 0.7 + r() * r() * 1.5;
      M.x[i] = M.sx[i]; M.y[i] = M.sy[i];
      M.grp[Math.min(3, (r() * 4) | 0)].push(i);
    }
    return M;
  }

  // Радиус контура в направлении th (в единицах R). Лепесток всегда смотрит вверх.
  // На низких нотах лепестки глубже: двухлепестковая фигура всегда с перетяжкой, никогда не овал («0»)
  function effAmp(S) { return S.amp * (1 + Math.max(0, 3 - S.n) * 0.75); }
  function shapeAt(th, S) {
    const n0 = Math.floor(S.n), g = snap(S.n - n0);
    const a = th + Math.PI / 2 + (S.rot || 0);
    return (1 - g) * Math.cos(n0 * a) + g * Math.cos((n0 + 1) * a);
  }
  function contour(th, S) {
    return (1 + (S.kick || 0) * 0.18) * (1 + effAmp(S) * shapeAt(th, S) * (1 + (S.kick || 0) * 0.5));
  }

  function targets(M, S) {
    const n0 = Math.floor(S.n), g = snap(S.n - n0), blur = 4 * g * (1 - g);
    const band = 0.06 + blur * 0.16 + (1 - S.stab) * 0.08 + (S.kick || 0) * 0.1 + (1 - S.hold) * 0.035;
    const haze = (S.noise || 0) * 0.32;
    for (let i = 0; i < M.N; i++) {
      const th = M.th[i], sh = shapeAt(th, S);
      // на кончиках лепестков материя колеблется сильнее — полоса шире; во впадинах уже
      const b = band * (0.7 + 0.32 * (sh + 1));
      const r = (1 + (S.kick || 0) * 0.18) * (1 + effAmp(S) * sh * (1 + (S.kick || 0) * 0.5)) * (1 - (S.noise || 0) * 0.08) + M.u[i] * b + M.h[i] * haze;
      const fx = r * Math.cos(th), fy = r * Math.sin(th);
      M.tx[i] = M.sx[i] + (fx - M.sx[i]) * S.m;
      M.ty[i] = M.sy[i] + (fy - M.sy[i]) * S.m;
    }
  }

  // Шаг живой материи: быстрая сборка, медленное рассыпание, дрожь от неустойчивости и шума
  function stepMatter(M, S, dt, silent) {
    targets(M, S);
    const k = 1 - Math.pow(1 - (silent ? 0.03 : 0.14), dt * 60);
    const j = 0.003 + (1 - S.stab) * 0.012 + (S.noise || 0) * 0.02 + (silent ? 0.0015 : 0);
    for (let i = 0; i < M.N; i++) {
      M.x[i] += (M.tx[i] - M.x[i]) * k + (Math.random() - 0.5) * j;
      M.y[i] += (M.ty[i] - M.y[i]) * k + (Math.random() - 0.5) * j;
    }
  }

  // Мгновенно поставить частицы в состояние (для статичных кадров)
  function settle(M, S, seed) {
    targets(M, S);
    const r = rng((seed || 1) + 99);
    const j = 0.004 + (1 - S.stab) * 0.01 + (S.noise || 0) * 0.02;
    for (let i = 0; i < M.N; i++) { M.x[i] = M.tx[i] + gauss(r) * j; M.y[i] = M.ty[i] + gauss(r) * j; }
  }

  const ALPHA = [0.38, 0.6, 0.8, 1];
  function draw(ctx, M, cx, cy, R, color, dot, alphaMul) {
    ctx.fillStyle = color;
    const am = alphaMul == null ? 1 : alphaMul;
    for (let g = 0; g < 4; g++) {
      ctx.globalAlpha = ALPHA[g] * am;
      const L = M.grp[g];
      for (let q = 0; q < L.length; q++) {
        const i = L[q], s = M.sz[i] * dot;
        ctx.fillRect(cx + M.x[i] * R - s / 2, cy + M.y[i] * R - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Векторный контур знака (для иконок и маленьких размеров)
  function pathPoints(S, cx, cy, R, steps) {
    const pts = [];
    steps = steps || 360;
    for (let k = 0; k < steps; k++) {
      const th = (k / steps) * TAU, r = contour(th, S) * R;
      pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
    }
    return pts;
  }
  function svgPath(S, cx, cy, R) {
    return pathPoints(S, cx, cy, R, 240).map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('') + 'Z';
  }
  function strokeMark(ctx, S, cx, cy, R, color, width) {
    const pts = pathPoints(S, cx, cy, R, 360);
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath();
    ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.strokeStyle = color; ctx.stroke();
  }

  /* ---------- плавное состояние ---------- */
  function ease(S, T, dt) {
    const k = a => 1 - Math.pow(1 - a, dt * 60);
    S.n += (T.n - S.n) * k(0.07);
    S.amp += (T.amp - S.amp) * k(T.amp > S.amp ? 0.18 : 0.04);   // быстрая атака, мягкое затухание
    S.stab += (T.stab - S.stab) * k(0.08);
    S.m += (T.m - S.m) * k(T.m > S.m ? 0.07 : 0.012);
    S.hold += (T.hold - S.hold) * k(0.06);
    S.noise += (T.noise - S.noise) * k(0.1);
    if (T.kick > S.kick) S.kick = T.kick; else S.kick *= Math.pow(0.92, dt * 60);
    T.kick = 0;
  }

  /* ---------- высота тона: упрощённый YIN ---------- */
  function yin(buf, sr, minF, maxF) {
    const N = buf.length, maxLag = Math.min(Math.floor(sr / minF), (N / 2) | 0), minLag = Math.max(2, Math.floor(sr / maxF));
    const W = N - maxLag, d = yin.d && yin.d.length > maxLag ? yin.d : (yin.d = new Float32Array(maxLag + 1));
    d[0] = 1; let run = 0;
    for (let tau = 1; tau <= maxLag; tau++) {
      let s = 0;
      for (let j = 0; j < W; j++) { const v = buf[j] - buf[j + tau]; s += v * v; }
      run += s; d[tau] = run ? s * tau / run : 1;
    }
    let tau = -1;
    for (let t = minLag; t <= maxLag; t++) {
      if (d[t] < 0.15) { while (t + 1 <= maxLag && d[t + 1] < d[t]) t++; tau = t; break; }
    }
    if (tau < 0) return { f: 0, clarity: 0 };
    const a = d[tau - 1] || d[tau], b = d[tau], c = d[tau + 1] || d[tau];
    const den = a + c - 2 * b, shift = den ? (a - c) / (2 * den) : 0;
    return { f: sr / (tau + shift), clarity: clamp(1 - b, 0, 1) };
  }

  const NOTES = ['до', 'до♯', 'ре', 'ре♯', 'ми', 'фа', 'фа♯', 'соль', 'соль♯', 'ля', 'ля♯', 'си'];
  function noteName(midi) {
    const m = Math.round(midi), oct = Math.floor(m / 12) - 1;
    const names = { 2: 'большой', 3: 'малой', 4: 'первой', 5: 'второй', 6: 'третьей' };
    return NOTES[((m % 12) + 12) % 12] + (names[oct] ? ' ' + names[oct] + ' октавы' : '');
  }

  /* ---------- голос ---------- */
  const STEP_PER_LOBE = 3.5; // полутонов на один лепесток; комфортная нота = 3 лепестка = знак

  function Voice() {
    this.on = false; this.reset();
    this.T = { n: 3, amp: 0.1, stab: 1, kick: 0, m: 0.12, hold: 0, noise: 0 };
    this.f = { db: -90, hz: 0, midi: 0, level: 0, stab: 1, voiced: false, silent: true, noise: false };
  }
  Voice.prototype.reset = function () {
    this.floor = -70; this.ref = null; this.refDb = null; this.cal = []; this.calDb = [];
    this.hist = []; this.fast = -90; this.slow = -90; this.cool = 0; this.silentT = 1; this.noiseT = 0; this.hold = 0; this.lastN = 3;
  };
  Voice.prototype.start = async function () {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const AC = global.AudioContext || global.webkitAudioContext;
    this.ctx = new AC(); if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.stream = stream; this.src = this.ctx.createMediaStreamSource(stream);
    this.an = this.ctx.createAnalyser(); this.an.fftSize = 2048; this.src.connect(this.an);
    this.buf = new Float32Array(this.an.fftSize); this.dec = new Float32Array(this.an.fftSize / 2);
    this.on = true;
  };
  Voice.prototype.stop = function () {
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.ctx) this.ctx.close();
    this.on = false; this.stream = this.ctx = null;
  };
  Voice.prototype.recalibrate = function () { this.ref = null; this.refDb = null; this.cal = []; this.calDb = []; };
  Voice.prototype.update = function (dt) {
    if (!this.on) return this.T;
    const b = this.buf; this.an.getFloatTimeDomainData(b);
    let s = 0; for (let i = 0; i < b.length; i++) s += b[i] * b[i];
    const db = 20 * Math.log10(Math.sqrt(s / b.length) + 1e-7);
    if (db < this.floor) this.floor += (db - this.floor) * 0.3; else this.floor += dt * 0.25;
    this.floor = clamp(this.floor, -95, -30);
    const act = db > this.floor + 10;
    for (let i = 0; i < this.dec.length; i++) this.dec[i] = (b[2 * i] + b[2 * i + 1]) * 0.5;
    const p = act ? yin(this.dec, this.ctx.sampleRate / 2, 70, 1100) : { f: 0, clarity: 0 };
    const voiced = act && p.clarity > 0.8 && p.f > 70 && p.f < 1100;
    const midi = voiced ? 69 + 12 * Math.log2(p.f / 440) : 0;

    // калибровка: первые ~0,8 с ровного звука задают комфортную ноту и громкость
    if (voiced && this.ref == null) {
      this.cal.push(midi); this.calDb.push(db);
      if (this.cal.length >= 48) { this.ref = median(this.cal); this.refDb = median(this.calDb); }
    }
    const ref = this.ref != null ? this.ref : (this.cal.length ? median(this.cal) : 55);
    const refDb = this.refDb != null ? this.refDb : this.floor + 30;

    // устойчивость: разброс высоты за ~0,4 с
    const now = (this.time = (this.time || 0) + dt);
    if (voiced) this.hist.push([now, midi]);
    while (this.hist.length && now - this.hist[0][0] > 0.4) this.hist.shift();
    let stab = this.f.stab;
    if (voiced && this.hist.length > 4) {
      const v = this.hist.map(h => h[1]), mean = v.reduce((a, c) => a + c, 0) / v.length;
      const sd = Math.sqrt(v.reduce((a, c) => a + (c - mean) * (c - mean), 0) / v.length);
      stab = clamp(1 - (sd - 0.12) / 0.9, 0, 1);
    }

    // атака: резкий подъём огибающей
    this.fast += (db - this.fast) * 0.5; this.slow += (db - this.slow) * 0.06; this.cool -= dt;
    let kick = 0;
    if (act && this.fast - this.slow > 8 && this.cool <= 0) { kick = clamp((this.fast - this.slow - 8) / 10 + 0.5, 0.5, 1); this.cool = 0.18; }

    this.silentT = act ? 0 : this.silentT + dt;
    this.noiseT = act && !voiced ? this.noiseT + dt : 0;
    const silent = this.silentT > 0.3, noise = this.noiseT > 0.12;
    if (voiced && stab > 0.6) this.hold = Math.min(1, this.hold + dt / 2.5); else this.hold = Math.max(0, this.hold - dt * 0.8);

    const level = clamp((db - this.floor - 10) / Math.max(8, (refDb - this.floor - 10) * 1.35), 0, 1.25);
    if (voiced) this.lastN = clamp(3 + (midi - ref) / STEP_PER_LOBE, 2, 8);

    const T = this.T;
    T.n = this.lastN;
    T.amp = noise ? 0.05 : 0.07 + 0.27 * Math.pow(Math.min(level, 1.2), 0.6);
    T.stab = voiced ? stab : noise ? 0.25 : T.stab;
    T.m = silent ? 0.12 : noise ? 0.6 : 1;
    T.noise = noise ? 1 : 0;
    T.hold = this.hold;
    if (kick) T.kick = kick;

    Object.assign(this.f, { db, hz: voiced ? p.f : 0, midi, ref, level, stab, voiced, silent, noise, calibrated: this.ref != null, floor: this.floor });
    return T;
  };

  global.VoiceForm = { TAU, rng, gauss, clamp, snap, MARK, SILENCE, state, makeMatter, contour, targets, stepMatter, settle, draw, pathPoints, svgPath, strokeMark, ease, yin, noteName, Voice, STEP_PER_LOBE };
})(window);
