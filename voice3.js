/* woisee · voice3
   v3 of the form ("woisee v3: нота, шум, вместе"):
   - note → symmetry (rays, sharps spiral), octave → rings; v2 lace kept as an option;
   - noise (s, sh, breath) draws a running field, the exhale inflates the cloud;
   - the gathered form flows around; a held note that changes leaves a fading trace;
   - colour: rainbow of notes or monochrome;
   - together: up to three voices from one microphone (multi-pitch, tracks, beats, superposition).
   Needs window.Field (field.js) and window.VoiceForm (voiceform.js). No other dependencies. */
(function (g) {
  'use strict';
  const FL = g.Field, VF = g.VoiceForm;
  const HUE = ['#F4E04D','#B8D84A','#4DB86B','#2FA6A0','#3478D8','#4B4FB8','#7B41B3','#B33A92','#E8333E','#F05A2A','#F58C2B','#F7B733'];
  const NAMES = ['до','до♯','ре','ре♯','ми','фа','фа♯','соль','соль♯','ля','ля♯','си'];
  const SYM = [2,2,3,3,4,5,5,6,6,7,7,8], SHARP = [0,1,0,1,0,0,1,0,1,0,1,0];
  const OCT = ['ниже','комфортная','выше','ещё выше'];
  const IV = ['унисон','малая секунда','большая секунда','малая терция','большая терция','кварта','тритон','квинта','малая секста','большая секста','малая септима','большая септима','октава'];
  const TENSE = { 1:1, 2:.6, 6:.8, 10:.6, 11:1 };
  const VCOL = ['#FFFEFC', '#ECF176', '#E780C0'];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const snap = f => f < .5 ? 4*f*f*f : 1 - Math.pow(-2*f + 2, 3)/2;
  const hex = c => [1,3,5].map(i => parseInt(c.slice(i, i+2), 16));
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v)*t)).join(',') + ')'; };
  const toHex = c => c[0] === '#' ? c : '#' + c.match(/\d+/g).map(v => (+v).toString(16).padStart(2, '0')).join('');
  const reduced = () => g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- note field ---------- */
  function params(ui){ ui = clamp(ui, 0, 47); const pc = ui % 12, o = Math.floor(ui/12) - 1; return { m: SYM[pc], tw: SHARP[pc], k: o + 2, pc, o }; }
  function zc(P, x, y){ const r = Math.hypot(x, y), th = Math.atan2(y, x) + Math.PI/2, rr = P.k*Math.PI*r*1.15; return Math.cos(P.m*(th + P.tw*r*1.7))*Math.cos(rr) + 0.18*Math.cos(rr); }
  /* noise: many frequencies, no standing wave — running plane waves */
  const NZ_DIR = [0.3, 1.5, 2.6, 3.9, 5.1], NZ_K = [1, 1.13, 0.87, 1.27, 0.93], NZ_PH = [0, 1.7, 3.1, 4.4, 5.6], NZ_SP = [1, -0.8, 1.2, -1.1, 0.9];
  function zNoise(cent, amp, x, y, t){
    const k = Math.PI*(1.6 + 5.5*cent), w = (0.35 + 1.8*cent)*(0.6 + 0.5*amp), tt = t || 0; let z = 0;
    for (let q = 0; q < 5; q++){ const a = NZ_DIR[q]; z += Math.cos(k*NZ_K[q]*(x*Math.cos(a) + y*Math.sin(a)) - w*NZ_SP[q]*tt + NZ_PH[q]); }
    return z/2.2;
  }
  function zAt(S, x, y){
    const u0 = Math.floor(S.u), gg = snap(S.u - u0);
    if (!S.crisp){ const n = clamp(2 + (S.u - 12)/3, 0, 8), i0 = Math.floor(n), i1 = Math.min(8, i0 + 1), h = snap(n - i0); return (1-h)*FL.zf(FL.MODES[i0], x, y) + h*FL.zf(FL.MODES[i1], x, y); }
    return (1-gg)*zc(params(u0), x, y) + gg*zc(params(u0 + 1), x, y);
  }
  function makeP(N, seed){
    const r = FL.rng(seed), P = { N, X0:new Float32Array(N), Y0:new Float32Array(N), X:new Float32Array(N), Y:new Float32Array(N), C:new Float32Array(N), J:new Float32Array(N*2), Z:new Float32Array(N) };
    for (let i = 0; i < N; i++){ P.X0[i] = FL.gs(r)*0.42; P.Y0[i] = FL.gs(r)*0.4; P.X[i] = P.X0[i]; P.Y[i] = P.Y0[i]; P.C[i] = Math.pow(r(), 0.18); P.J[2*i] = FL.gs(r); P.J[2*i+1] = FL.gs(r); P.Z[i] = 0.7 + r()*r()*1.3; }
    return P;
  }
  function targetOf(P, S, i, rot, t, out){
    const c = Math.cos(rot), s = Math.sin(rot), env = (0.85 + 0.3*S.amp)*S.bx;
    const x = (P.X0[i]*c - P.Y0[i]*s)*env, y = (P.X0[i]*s + P.Y0[i]*c)*env, e = 0.004;
    const gg = S.u - Math.floor(S.u), blur = 4*snap(gg)*(1 - snap(gg)), crisp = S.crisp ? 1 : 0;
    const nm = S.noise*(1 - 0.55*S.vo);
    const noteOrder = (0.4 + 0.6*S.stab)*(0.55 + 0.45*S.hold)*(1 - blur*0.6);
    const order = S.e*((1 - nm)*noteOrder + nm*0.78);
    const Fz = (px, py) => nm < 0.01 ? zAt(S, px, py) : (1 - nm)*zAt(S, px, py) + nm*zNoise(S.cent, S.amp, px, py, t);
    const z = Fz(x, y), zx = (Fz(x + e, y) - z)/e, zy = (Fz(x, y + e) - z)/e, g2 = zx*zx + zy*zy + 1e-4;
    let dx = -z*zx/g2, dy = -z*zy/g2; const dl = Math.hypot(dx, dy), mx = crisp ? 0.16 : 0.22; if (dl > mx){ dx *= mx/dl; dy *= mx/dl; }
    const o = order*(crisp ? P.C[i] : Math.pow(P.C[i], 2));
    const jit = (crisp ? 0.0035 : 0.006) + (1 - S.stab)*0.03*(1 - nm) + (1 - S.hold)*0.008*(1 - nm) + blur*0.03*(1 - nm) + nm*0.003;
    const w = t == null ? 0.7 : Math.sin(t*6 + i)*0.5 + 0.5;
    out[0] = x + dx*o + P.J[2*i]*jit*(0.4 + w); out[1] = y + dy*o + P.J[2*i+1]*jit*(0.4 + w);
  }
  function noteColor(u){ const a = Math.floor(clamp(u, 0, 47)), gg = snap(u - a); return mix(HUE[a % 12], HUE[(a + 1) % 12], gg); }

  /* ---------- one voice ---------- */
  function Solo(N, seed){
    this.P = makeP(N, seed || 5);
    this.S = { u:12, amp:.4, stab:.9, e:.08, hold:0, crisp:true, noise:0, cent:.5, vo:1, bx:1 };
    this.T = { u:12, amp:.4, stab:.9, e:1, hold:0, noise:0, cent:.5, vo:1 };
    this.ghosts = []; this.lastStable = null; this.stableT = 0; this.rot = 0; this.kick = 0; this.front = 9;
    this.exh = 0; this.exhLast = 0; this.silT = 0; this.spec = null; this.t = 0;
    this.opt = { rain:true, crisp:true, orbit:true, weave:true, mono:'#FFFEFC' };
    this.info = { voiced:false, midi:0, silent:true, noise:0, cent:.5, stab:1, level:0 };
    this._tmp = [0, 0];
  }
  Solo.prototype.spectral = function (voice){
    const an = voice.an, sr = voice.ctx.sampleRate; if (!this.spec || this.spec.length !== an.frequencyBinCount) this.spec = new Float32Array(an.frequencyBinCount);
    const spec = this.spec; an.getFloatFrequencyData(spec);
    const bin = sr/an.fftSize; let num = 0, den = 0, lg = 0, cnt = 0;
    for (let i = Math.floor(150/bin); i < Math.min(spec.length, Math.floor(11000/bin)); i++){ const pw = Math.pow(10, spec[i]/10) + 1e-20; num += pw*i*bin; den += pw; lg += Math.log(pw); cnt++; }
    return { cent: num/den, flat: Math.exp(lg/cnt)/(den/cnt) };
  };
  /* voice (VoiceForm.Voice after update) → target */
  Solo.prototype.fromVoice = function (voice, dt){
    const f = voice.f, T = this.T, sp = this.spectral(voice);
    const act = f.db > f.floor + 6;
    let voiced = f.voiced, midi = f.midi;
    if (!voiced && act){ const p = VF.yin(voice.dec, voice.ctx.sampleRate/2, 70, 1100); if (p.clarity > 0.72 && p.f > 70){ voiced = true; midi = 69 + 12*Math.log2(p.f/440); } }   // quiet «m-m-m»
    this.silT = act ? 0 : this.silT + dt;
    const silent = this.silT > 0.3;
    const cN = clamp((Math.log2(Math.max(200, sp.cent)) - Math.log2(800))/(Math.log2(9000) - Math.log2(800)), 0, 1);
    let nz = act ? clamp((sp.flat - 0.05)/0.25, 0, 1) : 0; if (act && !voiced) nz = Math.max(nz, 0.85);
    const ref = f.ref != null ? f.ref : 55;
    if (voiced){ const refOct = Math.floor(ref/12) - 1, raw = clamp(midi - 12*refOct, 0, 47); T.u = Math.abs(raw - Math.round(raw)) < 0.42 ? Math.round(raw) : raw; }
    T.noise = silent ? 0 : nz; T.cent = act ? cN : T.cent; T.vo = silent ? T.vo : voiced ? 1 : 0;
    const lev = clamp((f.db - f.floor - 6)/30, 0, 1);
    T.amp = 0.15 + 0.85*Math.pow(voiced ? Math.min(1, f.level || 0) : lev, 0.6);
    T.stab = voiced ? f.stab : T.stab; T.e = silent ? 0.08 : 1; T.hold = voiced ? voice.hold : 0;
    if (!voiced && nz > .5 && !silent){ this.exh += dt; this.exhLast = this.exh; } else if (silent || voiced) this.exh = 0;
    if (voice.T.kick){ this.kick = voice.T.kick; this.front = 0; voice.T.kick = 0; }
    Object.assign(this.info, { voiced, midi, silent, noise: T.noise, cent: T.cent, stab: f.stab, level: f.level || 0, act });
    return this.info;
  };
  Solo.prototype.target = function (o){ Object.assign(this.T, o); if (o.kick){ this.kick = o.kick; this.front = 0; } };
  Solo.prototype.ease = function (dt){
    const S = this.S, T = this.T, k = a => 1 - Math.pow(1 - a, dt*60);
    S.u += (T.u - S.u)*k(0.07); S.amp += (T.amp - S.amp)*k(T.amp > S.amp ? .15 : .04);
    S.stab += (T.stab - S.stab)*k(.08); S.e += (T.e - S.e)*k(T.e > S.e ? .07 : .012); S.hold += (T.hold - S.hold)*k(.06);
    S.noise += (T.noise - S.noise)*k(T.noise > S.noise ? .12 : .04); S.cent += (T.cent - S.cent)*k(.08); S.vo += (T.vo - S.vo)*k(T.vo > S.vo ? .1 : .05);
    const bxT = 1 + 0.22*Math.min(1, this.exh/6)*S.noise; S.bx += (bxT - S.bx)*k(bxT > S.bx ? .03 : .008);   // exhale inflates, the pause (inhale) gathers
    S.crisp = this.opt.crisp;
  };
  Solo.prototype.step = function (dt){
    const S = this.S, P = this.P, still = reduced(); this.t += dt;
    this.rot += still ? 0 : (this.opt.orbit ? dt*0.32*S.hold*S.e*S.vo : 0) + dt*S.noise*0.12;
    const mv = 1 - Math.pow(1 - (S.e > .5 ? (S.noise > .5 ? .055 : .12) : .03), dt*60), tmp = this._tmp, t = still ? null : this.t;
    for (let i = 0; i < P.N; i++){
      targetOf(P, S, i, this.rot, t, tmp);
      let tx = tmp[0], ty = tmp[1];
      if (this.front < 3 && this.kick > .02){ const r = Math.hypot(tx, ty) || 1e-6, d = Math.abs(r - this.front); if (d < .18){ const f = (.18 - d)*.6*this.kick; tx += tx/r*f; ty += ty/r*f; } }
      P.X[i] += (tx - P.X[i])*mv; P.Y[i] += (ty - P.Y[i])*mv;
    }
    this.front += dt*1.8; this.kick *= Math.pow(.97, dt*60);
    /* weave: a held note that changes stays as a fading trace (7 s, at most 3) */
    const un = Math.round(S.u);
    if (S.hold > .8 && Math.abs(S.u - un) < .15 && S.e > .5){ this.stableT += dt; if (this.lastStable === null || un !== this.lastStable) this.lastStable = un; }
    if (this.opt.weave && this.lastStable !== null && Math.abs(S.u - this.lastStable) > 0.6 && this.stableT > 0.8){
      const n = Math.round(P.N*0.45), X = new Float32Array(n), Y = new Float32Array(n);
      for (let j = 0; j < n; j++){ const i = (j*2) % P.N; X[j] = P.X[i]; Y[j] = P.Y[i]; }
      this.ghosts.unshift({ X, Y, u: this.lastStable, a: .75, rot: 0 }); if (this.ghosts.length > 3) this.ghosts.pop();
      this.lastStable = null; this.stableT = 0;
    }
    this.ghosts.forEach(gh => { gh.a -= dt/7; gh.rot += (this.opt.orbit && !still) ? dt*0.12 : 0; });
    while (this.ghosts.length && this.ghosts[this.ghosts.length - 1].a <= 0) this.ghosts.pop();
  };
  Solo.prototype.color = function (){
    const S = this.S; if (!this.opt.rain) return this.opt.mono;
    const nm = Math.min(1, S.noise*(1 - 0.6*S.vo)), nc = noteColor(S.u);
    return nm > 0.02 ? mix(toHex(nc), this.opt.mono, nm) : nc;
  };
  Solo.prototype.draw = function (ctx, w, h, scale, alpha){
    const R = Math.min(w, h)*(scale || 0.5), cx = w/2, cy = h/2, P = this.P, A = alpha == null ? 1 : alpha;
    this.ghosts.forEach(gh => { ctx.fillStyle = this.opt.rain ? noteColor(gh.u) : this.opt.mono; ctx.globalAlpha = Math.max(0, gh.a)*0.7*A; const c = Math.cos(gh.rot), s = Math.sin(gh.rot);
      for (let j = 0; j < gh.X.length; j++){ const x = gh.X[j]*c - gh.Y[j]*s, y = gh.X[j]*s + gh.Y[j]*c; ctx.fillRect(cx + x*R - .6, cy + y*R - .6, 1.2, 1.2); } });
    ctx.fillStyle = this.color();
    for (let i = 0; i < P.N; i++){ ctx.globalAlpha = (0.35 + 0.65*((i*7919 % 100)/100))*A; const z = P.Z[i]*1.05; ctx.fillRect(cx + P.X[i]*R - z/2, cy + P.Y[i]*R - z/2, z, z); }
    ctx.globalAlpha = 1;
  };
  Solo.prototype.label = function (){
    const S = this.S, pr = params(Math.round(S.u));
    if (S.e < .3) return { name: '', sub: '' };
    if (S.noise > .5 && S.vo < .5) return { name: S.cent > .68 ? 'с-с-с' : S.cent > .38 ? 'ш-ш-ш' : 'выдох', sub: '' };
    return { name: NAMES[pr.pc], sub: OCT[pr.o + 1] };
  };

  /* static form for pictures: day plate, voice map */
  function renderForm(ctx, cx, cy, R, u, N, seed, color, alpha, dot, rotA, crisp){
    const Q = makeP(N, seed), st = { u, amp:.4, stab:.95, e:1, hold:1, crisp: crisp !== false, noise:0, cent:.5, vo:1, bx:1 }, o = [0, 0];
    ctx.fillStyle = color;
    for (let i = 0; i < N; i++){ targetOf(Q, st, i, rotA || 0, null, o); ctx.globalAlpha = (0.35 + 0.65*((i*7919 % 100)/100))*alpha; const z = Q.Z[i]*dot; ctx.fillRect(cx + o[0]*R - z/2, cy + o[1]*R - z/2, z, z); }
    ctx.globalAlpha = 1;
  }
  function renderNoise(ctx, cx, cy, R, cent, N, seed, color, alpha, dot){
    const Q = makeP(N, seed), st = { u:12, amp:.5, stab:.2, e:1, hold:0, crisp:true, noise:1, cent, vo:0, bx:1 }, o = [0, 0];
    ctx.fillStyle = color;
    for (let i = 0; i < N; i++){ targetOf(Q, st, i, 0, 1.3, o); ctx.globalAlpha = (0.35 + 0.65*((i*7919 % 100)/100))*alpha; const z = Q.Z[i]*dot; ctx.fillRect(cx + o[0]*R - z/2, cy + o[1]*R - z/2, z, z); }
    ctx.globalAlpha = 1;
  }

  function renderState(ctx, cx, cy, R, st, N, seed, color, alpha, dot, t){
    const Q = makeP(N, seed), S = Object.assign({ u:19, amp:.4, stab:.9, e:1, hold:1, crisp:true, noise:0, cent:.5, vo:1, bx:1 }, st), o = [0, 0];
    ctx.fillStyle = color;
    for (let i = 0; i < N; i++){ targetOf(Q, S, i, 0, t == null ? 1.3 : t, o); ctx.globalAlpha = (0.35 + 0.65*((i*7919 % 100)/100))*alpha; const z = Q.Z[i]*dot; ctx.fillRect(cx + o[0]*R - z/2, cy + o[1]*R - z/2, z, z); }
    ctx.globalAlpha = 1;
  }

  /* ---------- together: up to three voices from one microphone ---------- */
  const hzOf = u => 440*Math.pow(2, (u + 36 - 69)/12);   // u: semitones from C2 (midi 36)
  function noteLabel(u){ const n = Math.round(u), c = Math.round((u - n)*100), o = Math.floor(n/12), OCTN = ['большой','малой','первой','второй']; return NAMES[((n % 12) + 12) % 12] + ' ' + (OCTN[o] || '') + (Math.abs(c) >= 3 ? (c > 0 ? ' +' : ' −') + Math.abs(c) + ' ц' : ''); }
  function zNote(n, r, th){ n = clamp(n, 0, 47); const pc = n % 12, k = Math.floor(n/12) + 1, m = SYM[pc], tw = SHARP[pc], rr = k*Math.PI*r*1.15; return Math.cos(m*(th + Math.PI/2 + tw*r*1.7))*Math.cos(rr) + 0.18*Math.cos(rr); }
  function zVoice(u, r, th){ const a = Math.floor(u), gg = snap(u - a); return gg < 0.01 ? zNote(a, r, th) : gg > 0.99 ? zNote(a + 1, r, th) : (1 - gg)*zNote(a, r, th) + gg*zNote(a + 1, r, th); }
  const CANDS = []; for (let m = 0; m <= 12*Math.log2(1000/70)*10; m++) CANDS.push(70*Math.pow(2, m/120));
  function peakAt(arr, b){ const wdt = Math.max(1, b*0.018), lo = Math.max(1, Math.floor(b - wdt)), hi = Math.min(arr.length - 2, Math.ceil(b + wdt)); let mx = 0, at = lo; for (let i = lo; i <= hi; i++) if (arr[i] > mx){ mx = arr[i]; at = i; } return [mx, at]; }

  function Multi(N){
    this.N = N; const r0 = FL.rng(17);
    this.X0 = new Float32Array(N); this.Y0 = new Float32Array(N); this.X = new Float32Array(N); this.Y = new Float32Array(N);
    this.CAP = new Float32Array(N); this.JX = new Float32Array(N); this.JY = new Float32Array(N); this.ZS = new Float32Array(N);
    for (let i = 0; i < N; i++){ this.X0[i] = FL.gs(r0)*0.42; this.Y0[i] = FL.gs(r0)*0.4; this.X[i] = this.X0[i]; this.Y[i] = this.Y0[i]; this.CAP[i] = Math.pow(r0(), 0.18); this.JX[i] = FL.gs(r0); this.JY[i] = FL.gs(r0); this.ZS[i] = 0.7 + r0()*r0()*1.3; }
    this.V = [0,1,2].map(j => ({ u:12, lev:0, e:0, stab:.9, hold:0, rot:j*2.1, on:false }));
    this.VT = [0,1,2].map(() => ({ u:12, lev:.5, e:0, stab:.9, hold:0, on:false }));
    this.tracks = [null, null, null]; this.noise = 0; this.noiseT = 0; this.cent = .5; this.centT = .5;
    this.beat = { fb:0, on:false, t:0 }; this.envBuf = []; this.micAcc = 0; this.floorDb = -70; this.t = 0;
    this.colorMode = 'note'; this.on = false; this.rain = true; this.mono = '#FFFEFC';
    this.stats = { voicesMax:0, lockedSec:0, intervals:{}, notes:[[],[],[]] };
  }
  Multi.prototype.start = async function (){
    this.stream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:false, noiseSuppression:false, autoGainControl:false } });
    const AC = g.AudioContext || g.webkitAudioContext; this.AC = new AC(); if (this.AC.state === 'suspended') await this.AC.resume();
    this.an = this.AC.createAnalyser(); this.an.fftSize = 8192; this.an.smoothingTimeConstant = 0.2;
    this.AC.createMediaStreamSource(this.stream).connect(this.an);
    const n = this.an.frequencyBinCount; this.spec = new Float32Array(n); this.mag = new Float32Array(n); this.res = new Float32Array(n); this.td = new Float32Array(2048);
    this.on = true;
  };
  Multi.prototype.stop = function (){ if (this.stream) this.stream.getTracks().forEach(tr => tr.stop()); if (this.AC) this.AC.close(); this.AC = this.an = this.stream = null; this.tracks.fill(null); this.on = false; this.VT.forEach(v => v.on = false); };
  Multi.prototype.pairInfo = function (a, b){
    const lo = Math.min(a.u, b.u), hi = Math.max(a.u, b.u), d = hi - lo, n = Math.round(d), dev = d - n;
    let fb = hzOf(lo + n)*(Math.pow(2, Math.abs(dev)/12) - 1), locked = Math.abs(dev) < 0.12;
    if (this.beat.on && d < 0.5){ fb = this.beat.fb; locked = this.beat.fb < 0.8; }
    const cls = n % 12 === 0 && n > 0 ? 12 : n % 12;
    return { n, dev: locked ? 0 : (Math.abs(dev) < 0.12 ? 0.2*Math.sign(dev || 1) : dev), fb, locked, cls, tense: TENSE[n % 12] || 0, name: n > 12 ? IV[cls] + (cls !== 12 ? ' через октаву' : '') : IV[n] };
  };
  Multi.prototype.multiPitch = function (){
    const an = this.an, spec = this.spec, mag = this.mag, res = this.res; an.getFloatFrequencyData(spec);
    const sr = this.AC.sampleRate, bin = sr/an.fftSize, n = spec.length;
    for (let i = 0; i < n; i++){ mag[i] = Math.sqrt(Math.pow(10, spec[i]/20)); res[i] = mag[i]; }
    const sorted = Array.from(mag.subarray(Math.floor(100/bin), Math.floor(4000/bin))).sort((a, b) => a - b), floorM = sorted[sorted.length >> 1] + 1e-9;
    let lg = 0, am = 0, cnt = 0; for (let i = Math.floor(150/bin); i < Math.floor(8000/bin); i++){ const p = mag[i]*mag[i] + 1e-20; lg += Math.log(p); am += p; cnt++; }
    const flat = Math.exp(lg/cnt)/(am/cnt);
    let cn = 0, cd = 0; for (let i = Math.floor(150/bin); i < Math.min(n, Math.floor(11000/bin)); i++){ const p = mag[i]*mag[i]; cn += p*i*bin; cd += p; }
    this.centT = clamp((Math.log2(Math.max(200, cn/(cd + 1e-20))) - Math.log2(800))/(Math.log2(9000) - Math.log2(800)), 0, 1);
    const out = []; let first = 0;
    for (let it = 0; it < 3; it++){
      let best = 0, bf = 0;
      for (const f0 of CANDS){ let s = 0, strong = 0; for (let h = 1; h <= 10; h++){ const f = h*f0; if (f > 5000) break; const [m] = peakAt(res, f/bin); s += m*(f0 + 20)/(h*f0 + 320); if (h <= 4 && m > 5*floorM) strong++; } if (strong >= 2 && s > best){ best = s; bf = f0; } }
      if (!bf) break; if (it === 0) first = best; else if (best < 0.5*first) break;
      const mult = out.some(o => { const q = bf/o.f, rq = Math.round(q); return rq >= 2 && Math.abs(q - rq) < 0.02*rq; });
      if (mult && best < 0.8*first) break;
      if (out.some(o => Math.abs(12*Math.log2(bf/o.f)) < 1)) break;
      let num = 0, den = 0;
      for (let h = 1; h <= 10; h++){ const f = h*bf; if (f > 5000) break; const [m, at] = peakAt(res, f/bin); const a0 = res[at - 1], a1 = res[at], a2 = res[at + 1], dd = a0 - 2*a1 + a2, sh = dd ? 0.5*(a0 - a2)/dd : 0; num += m*((at + sh)*bin/h); den += m;
        const wdt = Math.max(2, (f/bin)*0.03); for (let i = Math.max(0, Math.floor(f/bin - wdt)); i <= Math.min(n - 1, Math.ceil(f/bin + wdt)); i++) res[i] *= 0.02; }
      out.push({ f: num/den, sal: best });
    }
    return { out, first, flat };
  };
  Multi.prototype.detectBeats = function (){
    const L = this.envBuf.length; if (L < 80) return null;
    const xs = this.envBuf.slice(-110), ts = xs.map(e => e[0]), v = xs.map(e => e[1]);
    const m = v.reduce((a, b) => a + b, 0)/v.length; if (m <= 0) return null;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m)*(b - m), 0)/v.length), depth = sd/m;
    if (depth < 0.18) return null;
    const fr = (ts.length - 1)/(ts[ts.length - 1] - ts[0]), cs = []; let best = 0;
    const l0 = Math.max(2, Math.round(fr/8)), l1 = Math.round(fr/0.8);
    for (let lag = l0; lag <= l1; lag++){ let c = 0, n = 0; for (let i = lag; i < v.length; i++){ c += (v[i] - m)*(v[i - lag] - m); n++; } c = c/(n*sd*sd); cs.push(c); if (c > best) best = c; }
    if (best < 0.45) return null;
    for (let q = 1; q < cs.length - 1; q++) if (cs[q] >= cs[q - 1] && cs[q] >= cs[q + 1] && cs[q] > 0.8*best){
      const a0 = cs[q - 1], a1 = cs[q], a2 = cs[q + 1], dd = a0 - 2*a1 + a2, sh = dd ? 0.5*(a0 - a2)/dd : 0;
      return { fb: fr/(l0 + q + sh), depth };
    }
    return null;
  };
  Multi.prototype.update = function (dt){
    this.t += dt; if (!this.an) return;
    const td = this.td; this.an.getFloatTimeDomainData(td); let s2 = 0; for (let i = 0; i < td.length; i++) s2 += td[i]*td[i];
    const db = 20*Math.log10(Math.sqrt(s2/td.length) + 1e-7);
    this.envBuf.push([this.t, Math.sqrt(s2/td.length)]); if (this.envBuf.length > 140) this.envBuf.shift();
    if (db < this.floorDb) this.floorDb += (db - this.floorDb)*0.3; else this.floorDb += dt*0.25; this.floorDb = clamp(this.floorDb, -95, -30);
    const act = db > this.floorDb + 8;
    this.micAcc += dt; if (this.micAcc < 1/30) return; const step = this.micAcc; this.micAcc = 0;
    const { out, first, flat } = act ? this.multiPitch() : { out: [], first: 0, flat: 0 };
    this.noiseT = act && !out.length ? 1 : act && flat > .35 ? .5 : 0;
    const used = [false, false, false], tracks = this.tracks, floorDb = this.floorDb;
    out.forEach(d => {
      const u = clamp(69 + 12*Math.log2(d.f/440) - 36, 0, 47), lev = clamp(d.sal/first, .2, 1)*clamp((db - floorDb - 8)/25, .25, 1);
      let bj = -1, bd = 1.6; tracks.forEach((tr, j) => { if (tr && !used[j] && Math.abs(tr.u - u) < bd){ bd = Math.abs(tr.u - u); bj = j; } });
      if (bj < 0) bj = tracks.findIndex((tr, j) => !tr && !used[j]);
      if (bj < 0) return;
      const tr = tracks[bj] || (tracks[bj] = { u, lev, miss: 0, hist: [], age: 0 });
      tr.u += (u - tr.u)*0.6; tr.lev = lev; tr.miss = 0; tr.age++; tr.hist.push(u); if (tr.hist.length > 12) tr.hist.shift(); used[bj] = true;
    });
    tracks.forEach((tr, j) => { if (tr && !used[j]){ tr.miss += step; if (tr.miss > (tr.age >= 4 ? 0.35 : 0.1)) tracks[j] = null; } });
    const liveTr = tracks.filter(tr => tr && tr.age >= 4 && tr.miss < 0.15), beat = this.beat;
    beat.t -= step; if (beat.t <= 0){ beat.t = 0.25; const bt = liveTr.length === 1 ? this.detectBeats() : null; beat.on = !!bt; if (bt) beat.fb += (bt.fb - beat.fb)*0.5; }
    tracks.forEach((tr, j) => {
      this.VT[j].on = !!tr && tr.miss < 0.15 && tr.age >= 4;
      if (tr){ this.VT[j].u = tr.u; this.VT[j].lev = tr.lev; const m = tr.hist.reduce((a, b) => a + b, 0)/tr.hist.length, sd = Math.sqrt(tr.hist.reduce((a, b) => a + (b - m)*(b - m), 0)/tr.hist.length); this.VT[j].stab = clamp(1 - (sd - .1)/.9, 0, 1); }
    });
    if (beat.on && liveTr.length === 1){
      const j0 = tracks.indexOf(liveTr[0]), j1 = [0,1,2].find(j => !tracks[j]);
      if (j1 !== undefined){ const f = hzOf(liveTr[0].u), dev = 12*Math.log2(1 + beat.fb/f); this.VT[j1].on = true; this.VT[j0].u = clamp(liveTr[0].u - dev/2, 0, 47); this.VT[j1].u = clamp(liveTr[0].u + dev/2, 0, 47); this.VT[j1].lev = liveTr[0].lev; this.VT[j1].stab = this.VT[j0].stab; }
    }
  };
  Multi.prototype.ease = function (dt){
    const k = a => 1 - Math.pow(1 - a, dt*60);
    for (let j = 0; j < 3; j++){
      const v = this.V[j], T = this.VT[j];
      if (T.on) v.u += (T.u - v.u)*k(.25);
      v.lev += (T.lev - v.lev)*k(T.lev > v.lev ? .15 : .04); v.stab += (T.stab - v.stab)*k(.08);
      const eT = T.on ? 1 : 0; v.e += (eT - v.e)*k(eT > v.e ? .07 : .015);
      v.hold += ((T.on && T.stab > .6 ? 1 : 0) - v.hold)*k(T.on ? .02 : .06); v.on = T.on;
    }
    this.noise += (this.noiseT - this.noise)*k(this.noiseT > this.noise ? .12 : .04); this.cent += (this.centT - this.cent)*k(.08);
  };
  Multi.prototype.owners = function (){ const act = []; for (let j = 0; j < 3; j++) if (this.V[j].on || this.V[j].e > 0.15) act.push(j); return act.length ? act : [0]; };
  Multi.prototype.step = function (dt){
    const V = this.V, act = this.owners(), Ka = act.length, still = reduced(), t = this.t;
    const pulse = [0,0,0], tension = [0,0,0], lockedAll = [true,true,true], ws = V.map(v => v.e*(0.4 + 0.6*v.lev));
    for (let a = 0; a < Ka; a++) for (let b = a + 1; b < Ka; b++){
      const A = V[act[a]], B = V[act[b]]; if (A.e < .3 || B.e < .3) continue;
      const p = this.pairInfo(A, B);
      if (!p.locked && Math.abs(p.dev) < 0.5 && !still){ const ph = 0.5 - 0.5*Math.cos(2*Math.PI*clamp(p.fb, 0.3, 7)*t); pulse[act[a]] = Math.max(pulse[act[a]], ph*(1 - Math.abs(p.dev)*1.2)); pulse[act[b]] = Math.max(pulse[act[b]], ph*(1 - Math.abs(p.dev)*1.2)); }
      if (!p.locked){ lockedAll[act[a]] = false; lockedAll[act[b]] = false; }
      tension[act[a]] = Math.max(tension[act[a]], p.tense); tension[act[b]] = Math.max(tension[act[b]], p.tense);
    }
    const allLocked = act.every(j => lockedAll[j]);
    if (!still) act.forEach((j, q) => { const sp = allLocked ? 0.3 : 0.18 + 0.16*q; V[j].rot += dt*sp*V[j].hold*V[j].e; });
    if (allLocked && Ka > 1){ const m = act.reduce((s, j) => s + V[j].rot, 0)/Ka; act.forEach(j => V[j].rot += (m - V[j].rot)*(1 - Math.pow(0.97, dt*60))); }
    const mv0 = 1 - Math.pow(1 - .12, dt*60), mv1 = 1 - Math.pow(1 - .03, dt*60), mvN = 1 - Math.pow(1 - .055, dt*60), e = 0.004, noise = this.noise, cent = this.cent;
    for (let i = 0; i < this.N; i++){
      const k = act[i % Ka], v = V[k];
      const nm = noise*(v.e > .5 ? 0.45 : 1), c = Math.cos(v.rot), s = Math.sin(v.rot), env = 0.85 + 0.3*v.lev;
      const x = (this.X0[i]*c - this.Y0[i]*s)*env, y = (this.X0[i]*s + this.Y0[i]*c)*env;
      const F = (px, py) => { const r = Math.hypot(px, py), th = Math.atan2(py, px); let z = zVoice(v.u, r, th); for (let q = 0; q < Ka; q++){ const j = act[q]; if (j === k) continue; z += 0.55*ws[j]*(1 - 0.6*pulse[k])*zVoice(V[j].u, r, th); } return nm > 0.01 ? (1 - nm)*z + nm*zNoise(cent, .5, px, py, t) : z; };
      const z = F(x, y), zx = (F(x + e, y) - z)/e, zy = (F(x, y + e) - z)/e, g2 = zx*zx + zy*zy + 1e-4;
      let dx = -z*zx/g2, dy = -z*zy/g2; const dl = Math.hypot(dx, dy); if (dl > .16){ dx *= .16/dl; dy *= .16/dl; }
      const gg = v.u - Math.floor(v.u), blur = 4*snap(gg)*(1 - snap(gg));
      const order = ((1 - nm)*v.e*(0.4 + 0.6*v.stab)*(0.55 + 0.45*v.hold)*(1 - blur*0.5)*(1 - 0.5*pulse[k]) + nm*0.78)*this.CAP[i];
      const jit = 0.0035 + (1 - v.stab)*0.03 + blur*0.025 + tension[k]*0.006*(0.6 + 0.4*Math.sin(t*23 + i)) + pulse[k]*0.012;
      const w = Math.sin(t*6 + i)*0.5 + 0.5;
      const tx = x + dx*order + this.JX[i]*jit*(0.4 + w), ty = y + dy*order + this.JY[i]*jit*(0.4 + w);
      const mv = nm > .5 ? mvN : v.e > .5 ? mv0 : mv1;
      this.X[i] += (tx - this.X[i])*mv; this.Y[i] += (ty - this.Y[i])*mv;
    }
    this.info = { act, pulse, allLocked };
    /* stats for the picture of the day */
    const live = act.filter(j => V[j].on && V[j].e > .5);
    this.stats.voicesMax = Math.max(this.stats.voicesMax, live.length);
    if (live.length >= 2){ const p = this.pairInfo(V[live[0]], V[live[1]]); if (p.locked){ this.stats.lockedSec += dt; this.stats.intervals[p.n] = (this.stats.intervals[p.n] || 0) + dt; } }
    live.forEach(j => { const nl = this.stats.notes[j], u = Math.round(V[j].u*10)/10; const L = nl[nl.length - 1]; if (L && Math.abs(L.u - u) < .5) L.sec += dt; else nl.push({ u, sec: dt }); if (nl.length > 40) nl.shift(); });
  };
  Multi.prototype.colorOf = function (j){
    if (this.colorMode === 'voice') return VCOL[j];
    if (!this.rain) return this.mono;
    const v = this.V[j], a = Math.floor(clamp(v.u, 0, 47)), gg = snap(v.u - a); return mix(HUE[a % 12], HUE[(a + 1) % 12], gg);
  };
  Multi.prototype.draw = function (ctx, w, h, scale, alpha){
    const A = alpha == null ? 1 : alpha, R = Math.min(w, h)*(scale || 0.5), cx = w/2, cy = h/2, act = (this.info || { act:[0] }).act, Ka = act.length;
    act.forEach((j, q) => {
      const base = this.colorOf(j);
      ctx.fillStyle = this.noise > .3 ? mix(toHex(base), this.mono, this.noise) : base;
      const a = (0.25 + 0.75*clamp(Math.max(this.V[j].e, this.noise), 0, 1))*A;
      for (let i = q; i < this.N; i += Ka){ ctx.globalAlpha = (0.35 + 0.65*((i*7919 % 100)/100))*a; const z = this.ZS[i]*1.05; ctx.fillRect(cx + this.X[i]*R - z/2, cy + this.Y[i]*R - z/2, z, z); }
    });
    ctx.globalAlpha = 1;
  };
  Multi.prototype.labels = function (){
    const V = this.V, act = this.owners(), live = act.filter(j => V[j].on && V[j].e > .5);
    const voices = live.map(j => ({ j, color: this.colorOf(j), note: noteLabel(V[j].u), lev: V[j].lev }));
    let title = '', sub = '';
    if (this.noise > .5 && !live.length){ title = this.cent > .68 ? 'с-с-с' : this.cent > .38 ? 'ш-ш-ш' : 'выдох'; }
    else if (live.length === 1){ title = 'один голос'; sub = 'ждём второй'; }
    else if (live.length === 2){
      const p = this.pairInfo(V[live[0]], V[live[1]]);
      title = !p.locked && Math.abs(p.dev) < .5 && p.n === 0 ? 'почти унисон' : !p.locked && Math.abs(p.dev) < .5 ? 'почти ' + p.name : p.name;
      sub = p.locked ? 'строй найден' : Math.abs(p.dev) < .5 ? 'биения ' + p.fb.toFixed(1).replace('.', ',') + ' в секунду · подстройтесь, пока пульс не замрёт' : 'между интервалами';
    } else if (live.length === 3){
      const us = live.map(j => V[j].u).sort((a, b) => a - b), i1 = Math.round(us[1] - us[0]) % 12, i2 = Math.round(us[2] - us[0]) % 12;
      const ps = [[0,1],[0,2],[1,2]].map(([a, b]) => this.pairInfo(V[live[a]], V[live[b]])), okAll = ps.every(p => p.locked);
      title = i1 === 4 && i2 === 7 ? 'мажорное трезвучие' : i1 === 3 && i2 === 7 ? 'минорное трезвучие' : i1 === 0 && i2 === 0 ? 'унисон втроём' : 'три голоса';
      const worst = ps.filter(p => !p.locked && Math.abs(p.dev) < .5).sort((a, b) => b.fb - a.fb)[0];
      sub = okAll ? 'строй найден' : worst ? 'биения ' + worst.fb.toFixed(1).replace('.', ',') + ' в секунду · кто-то чуть мимо' : 'голоса между интервалами';
    }
    return { title, sub, voices };
  };

  /* ---------- live: one voice or several, decided by the sound itself ---------- */
  function Live(n){
    this.solo = new Solo(n, 5); this.multi = new Multi(Math.round(n*1.04)); this.voice = new VF.Voice();
    this.on = false; this.mixT = 0; this.many = 0; this.count = 1;
  }
  Live.prototype.start = async function (){
    if (this.on) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:false, noiseSuppression:false, autoGainControl:false } });
    const AC = new (g.AudioContext || g.webkitAudioContext)(); if (AC.state === 'suspended') await AC.resume();
    const src = AC.createMediaStreamSource(stream);
    const v = this.voice; v.ctx = AC; v.src = src; v.an = AC.createAnalyser(); v.an.fftSize = 2048; src.connect(v.an);
    v.buf = new Float32Array(v.an.fftSize); v.dec = new Float32Array(v.an.fftSize/2); v.on = true; v.stream = null;
    const m = this.multi; m.AC = AC; m.an = AC.createAnalyser(); m.an.fftSize = 8192; m.an.smoothingTimeConstant = 0.2; src.connect(m.an);
    const nb = m.an.frequencyBinCount; m.spec = new Float32Array(nb); m.mag = new Float32Array(nb); m.res = new Float32Array(nb); m.td = new Float32Array(2048); m.on = true;
    this.stream = stream; this.AC = AC; this.on = true;
  };
  Live.prototype.stop = function (){
    if (this.stream) this.stream.getTracks().forEach(tr => tr.stop());
    if (this.AC) try { this.AC.close(); } catch (e) {}
    this.stream = this.AC = null; this.on = false; this.voice.on = false; this.voice.ctx = null;
    const m = this.multi; m.on = false; m.an = m.AC = null; m.tracks.fill(null); m.VT.forEach(x => x.on = false);
  };
  /* returns {kick, info}; call every frame while on */
  Live.prototype.update = function (dt){
    const v = this.voice; v.update(dt); const kick = !!v.T.kick;
    const info = this.solo.fromVoice(v, dt);
    const m = this.multi; m.update(dt); m.ease(dt);
    const n = m.V.filter(x => x.on && x.e > .5).length;
    this.many = n >= 2 ? Math.min(1.2, this.many + dt) : Math.max(0, this.many - dt*1.5);
    this.count = this.mixT > .5 ? Math.max(2, n) : 1;
    return { kick, info, voices: n };
  };
  Live.prototype.idle = function (dt){ const m = this.multi; m.ease(dt); this.many = Math.max(0, this.many - dt*1.5); };
  Live.prototype.step = function (dt){
    const target = this.many > .5 ? 1 : this.many <= 0 ? 0 : this.mixT > .5 ? 1 : 0;
    this.mixT += clamp(target - this.mixT, -dt/0.6, dt/0.6);
    this.solo.ease(dt);
    if (this.mixT < 1) this.solo.step(dt);
    if (this.mixT > 0) this.multi.step(dt);
  };
  Live.prototype.draw = function (ctx, w, h, scale){
    if (this.mixT < 1) this.solo.draw(ctx, w, h, scale, 1 - this.mixT);
    if (this.mixT > 0) this.multi.draw(ctx, w, h, scale, this.mixT);
  };
  Live.prototype.setOpts = function (o){ Object.assign(this.solo.opt, o); this.multi.rain = o.rain; this.multi.mono = o.mono; };

  g.Voice3 = { Live, renderState, HUE, NAMES, SYM, SHARP, OCT, IV, VCOL, params, noteColor, makeP, targetOf, renderForm, renderNoise, Solo, Multi, noteLabel, mix, toHex, clamp };
})(window);
