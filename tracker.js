/* woisee · звучание: отпечаток голоса, вкладка «Звучание», картинка дня, профиль.
   Отпечаток — полминуты: догадка «где звучит голос», «а-а-а», сирена, выдох. Можно делать без практики.
   Файл пользуется данными и функциями приложения (data, getDay, saveDay, dkey, ensureLive, openDay…);
   они вызываются только из функций, поэтому файл подключается до основного скрипта. */
(function (g) {
'use strict';
const V3 = g.Voice3, FL = g.Field;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const sm = t => { t = clamp(t, 0, 1); return t*t*(3 - 2*t); };
const DPR = () => Math.min(g.devicePixelRatio || 1, 2);
const reduced = () => g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
const C = { ink:'#F4F2EC', muted:'#9AA7A3', rule:'rgba(255,254,252,.12)', lime:'#ECF176', kale:'#5EA879', ground:'#121A19' };
function fit(cv, w, h){ const d = DPR(); const W = Math.max(1, Math.round(w*d)), H = Math.max(1, Math.round(h*d)); if (cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; } cv.style.height = h + 'px'; const ctx = cv.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0); return ctx; }
const escH = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const pl = (n, a, b, c) => { const k = Math.abs(n) % 100, l = k % 10; return k > 10 && k < 20 ? c : l === 1 ? a : l > 1 && l < 5 ? b : c; };
const ICO = {
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  play:'<svg viewBox="0 0 24 24" fill="currentColor" style="width:28px;height:28px"><path d="M9 6.5v11l9-5.5z"/></svg>',
  arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  chev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  chevL:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  inf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12c-2.2-2.6-3.9-4-5.6-4a4 4 0 0 0 0 8c1.7 0 3.4-1.4 5.6-4zm0 0c2.2 2.6 3.9 4 5.6 4a4 4 0 0 0 0-8c-1.7 0-3.4 1.4-5.6 4z"/></svg>'
};

/* ---------- notes ---------- */
const OCTN = { 1:'субконтроктавы', 2:'контроктавы', 3:'большой октавы', 4:'малой октавы', 5:'первой октавы', 6:'второй октавы', 7:'третьей октавы' };
const OCTS = { 1:'субконтр.', 2:'контр.', 3:'большой', 4:'малой', 5:'первой', 6:'второй', 7:'третьей' };
const pcOf = m => ((Math.round(m) % 12) + 12) % 12;
const nShort = m => V3.NAMES[pcOf(m)];
const nName = m => nShort(m) + ' ' + (OCTS[Math.floor(Math.round(m)/12)] || '');
const hz = m => 440*Math.pow(2, (m - 69)/12);
const nCol = m => (typeof data === 'undefined' || data.profile.rain !== false) ? V3.HUE[pcOf(m)] : C.ink;
const octs = n => (n/12).toFixed(1).replace('.', ',');
const fmtS = s => { s = Math.max(0, s); return Math.floor(s/60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
const fmt1 = v => v.toFixed(1).replace('.', ',');
const uOfM = m => typeof uOfMidi === 'function' ? uOfMidi(m) : clamp(Math.round(m) - 36, 0, 47);

/* ---------- zones: where in the body a note is felt ----------
   by pitch (+ a little by brightness); boundaries in MIDI E2 · E3 · D4 · G4 · D5 · D6 — rough register transitions */
const ZB = [40, 52, 62, 67, 74, 86];
const LABELS = {
  body:   [['Низ груди','рёбра, солнечное сплетение'], ['Грудь','грудина, ключицы'], ['Шея','гортань, переход'], ['Маска','скулы, нос, губы'], ['Голова','лоб, темя']],
  chakra: [['Манипура','солнечное сплетение'], ['Анахата','сердце'], ['Вишудха','горло'], ['Аджна','третий глаз'], ['Сахасрара','макушка']]
};
const ZIN = { body:['в низу груди','в груди','в шее','в маске','в голове'], chakra:['в манипуре','в анахате','в вишудхе','в аджне','в сахасраре'] };
/* body parts by default; chakras only when chosen in the settings. The profile can switch its own view without changing that. */
let labView = null;
const labSet = () => labView || ((typeof data !== 'undefined' && data.profile && data.profile.zoneLabels === 'chakra') ? 'chakra' : 'body');
const zName = i => LABELS[labSet()][i][0], zSub = i => LABELS[labSet()][i][1], zIn = i => ZIN[labSet()][i];
const BAND = [[.64, .90], [.415, .64], [.28, .415], [.165, .28], [.05, .165]];
/* the silhouette is drawn 14 % larger than its own coordinates; the hips run out under the frame */
/* body scale: the silhouette fills the height (crown at the top edge, hips running out under the frame),
   up to 1.3× its own coordinates, and never wider than the space beside the zone labels allows */
let BK = 1.14;
const setBody = (W, H, k) => { BK = Math.min(1.3, k*W/H); return BK; };
const BY = y => .006 + (y - .064)*BK, BYinv = v => .064 + (v - .006)/BK;
const bandMid = z => BY((BAND[z][0] + BAND[z][1])/2);
const PINK = '#E780C0';
function pOf(midi, cent){
  let p;
  if (midi <= ZB[0]) p = 0; else if (midi >= ZB[5]) p = 1;
  else { let i = 0; while (midi > ZB[i + 1]) i++; p = (i + (midi - ZB[i])/(ZB[i + 1] - ZB[i]))/5; }
  if (cent != null) p += 0.04*clamp(cent, 0, 1);
  return clamp(p, 0, 0.999);
}
const zoneOf = p => Math.min(4, Math.max(0, Math.floor(p*5)));
function yOfP(p){ const i = zoneOf(p), f = p*5 - i, b = BAND[i]; return b[1] - f*(b[1] - b[0]); }
function zoneOfY(y){ for (let i = 0; i < 5; i++) if (y >= BAND[i][0] && y <= BAND[i][1]) return i; return y > BAND[0][1] ? 0 : 4; }

/* ---------- silhouette of grain ---------- */
function shape(x, y){
  const hx = x/.088, hy = (y - .168)/.104; if (hx*hx + hy*hy < 1) return 1;
  if (y > .25 && y < .37 && Math.abs(x) < .046) return 1;
  if (y >= .335 && y < .98){ const hw = .046 + (.215 - .046)*sm((y - .335)/.1); if (Math.abs(x) < hw) return y > .88 ? 1 - (y - .88)/.1 : 1; }
  return 0;
}
const bodies = new Map();
function body(n, seed){
  const key = n + ':' + seed; if (bodies.has(key)) return bodies.get(key);
  const r = FL.rng(seed), X = [], Y = [], S = [], A = [], byZ = [[], [], [], [], []];
  while (X.length < n){ const x = (r() - .5)*.46, y = .05 + r()*.93; if (r() < shape(x, y)){ byZ[zoneOfY(y)].push(X.length); X.push(x); Y.push(y); S.push(.6 + r()*r()*1.3); A.push(r()); } }
  const B = { X, Y, S, A, byZ }; bodies.set(key, B); return B;
}
/* wash: 0..1 — how much the whole silhouette takes the tint (the note's colour while the voice sounds) */
/* a soft mask of the silhouette: the voice's form is drawn only inside the body, so face and shoulders show through it */
const masks = new Map(), fades = new Map();
/* the stage has no visible edge: anything drawn near it fades out */
function edgeFade(W, H){
  const key = W + 'x' + H; if (fades.has(key)) return fades.get(key);
  const m = document.createElement('canvas'), d = DPR(); m.width = Math.round(W*d); m.height = Math.round(H*d);
  const c = m.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'destination-in';
  const band = (x0, y0, x1, y1) => { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.16, '#fff'); g.addColorStop(.84, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); };
  band(0, 0, 0, H); band(0, 0, W, 0);
  fades.set(key, m); return m;
}
function bodyMask(W, H, cxF){
  const key = W + 'x' + H + ':' + cxF + ':' + BK.toFixed(3); if (masks.has(key)) return masks.get(key);
  const m = document.createElement('canvas'), d = DPR(); m.width = Math.round(W*d); m.height = Math.round(H*d);
  const c = m.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.filter = 'blur(' + Math.round(H*.016) + 'px)'; c.fillStyle = '#fff';
  const cx = W*cxF, X = x => cx + x*H*BK, Y = y => BY(y)*H;
  c.beginPath(); c.ellipse(X(0), Y(.168), .088*H*BK, .104*H*BK, 0, 0, Math.PI*2); c.fill();
  c.fillRect(X(-.046), Y(.25), .092*H*BK, (BY(.37) - BY(.25))*H);
  c.beginPath(); c.moveTo(X(-.046), Y(.335));
  for (let y = .335; y <= 1.0; y += .005){ const hw = .046 + (.215 - .046)*sm((y - .335)/.1); c.lineTo(X(-hw), Y(y)); }
  for (let y = 1.0; y >= .335; y -= .005){ const hw = .046 + (.215 - .046)*sm((y - .335)/.1); c.lineTo(X(hw), Y(y)); }
  c.closePath(); c.fill();
  masks.set(key, m); return m;
}
function drawBody(ctx, B, W, H, cxF, hl, tint, t, wash){
  const cx = W*cxF, sh = reduced() ? 0 : 1, w = wash || 0;
  for (let z = 0; z < 5; z++){
    const h = hl[z] || 0; ctx.fillStyle = (h > .04 || w > .3) && tint ? tint : C.ink;
    for (const i of B.byZ[z]){
      const a = B.A[i];
      ctx.globalAlpha = Math.min(1, (.26 + .24*a)*(1 + .4*w) + h*(.3 + .45*a));
      const x = cx + (B.X[i] + sh*.0025*Math.sin(t*.9 + a*40))*H*BK, y = BY(B.Y[i] + sh*.0018*Math.cos(t*.7 + a*31))*H, s = B.S[i]*(1 + .35*h);
      ctx.fillRect(x - s/2, y - s/2, s, s);
    }
  }
  ctx.globalAlpha = 1;
}

/* =========================== data =========================== */
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length/2)] : null; };
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[clamp(Math.round(q*(s.length - 1)), 0, s.length - 1)] : null; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0)/a.length : null;
const valid = c => !!(c && c.comfort != null);
function prints(k){
  const d = data.days[k]; if (!d) return [];
  if (d.checks && !d.prints){ d.prints = ['before', 'after'].map(x => d.checks[x]).filter(valid); delete d.checks; }
  return (d.prints || []).filter(valid);
}
const practised = k => typeof ok === 'function' ? ok(k) : false;
/* a day «with voice»: a voice print or at least a minute of practice — one streak for both */
const voiced = k => practised(k) || prints(k).length > 0;
function streak(){ let d = new Date(); if (!voiced(dkey(d))) d = addDays(d, -1); let n = 0; while (voiced(dkey(d))){ n++; d = addDays(d, -1); } return n; }
/* the notes a day sounded on in its exercises, the longest held first */
function exNotes(k){
  const d = data.days[k], out = [];
  ((d && d.log) || []).forEach(L => (L.notes || []).forEach(n => { if (n.midi != null) out.push({ midi:n.midi, sec:n.sec || 1, stab:n.stab }); }));
  return out.sort((a, b) => b.sec - a.sec);
}
/* the note(s) that gather out of the day's haze: first and last print; or the most held note of the exercises */
function dayNotes(k){
  const P = prints(k);
  if (P.length >= 2) return [P[0].comfort, P[P.length - 1].comfort];
  if (P.length) return [P[0].comfort];
  const E = exNotes(k); return E.length ? [E[0].midi] : [];
}

/* =========================== the voice print (flow) =========================== */
const STEPS = {
  pick: { t:'Где, по-твоему, звучит твой голос?', h:'Прислушайся к себе и нажми на зону. Потом отпечаток проверит.' },
  a:    { t:'Скажи «а-а-а», как обычно говоришь', h:'Ровно, на удобной ноте. Таймер идёт, только пока звучит голос.', dur:5, next:'сирена' },
  siren:{ t:'Сирена снизу вверх и обратно', h:'От самой низкой удобной ноты до самой высокой и вниз. Без крика.', dur:11, next:'выдох' },
  sss:  { t:'Вдохни и тяни «с-с-с»', h:'Ровно, пока хватает воздуха. Воздух закончился — нажми «Стоп».' }
};
const ORDER = ['pick', 'a', 'siren', 'sss', 'res'];
const fl = { step:0, guess:null, demo:false, run:false, done:{}, curZ:-1, p:.3, pShown:.3, hl:[0,0,0,0,0], formA:0, result:null, info:null, auto:0, raf:0, last:0, T:0, ctx:null, onSave:null, key:'', saved:-1 };
const acc = { a:null, s:null, x:null };
/* while a step sounds, its living form is grabbed 12 times a second (the same capture the exercises use);
   the last 3 seconds of «а», the siren and the «с-с-с» go into the picture of the day */
const rec = { buf:[], last:0, clips:{} };
const canClip = () => typeof grab === 'function' && typeof gifPut === 'function' && typeof GIF_FPS !== 'undefined';
let SW = 0, SH = 0, off = null, off2 = null, off3 = null, prevZ = -2, L = null;
function resetStep(id){
  if (id === 'a') acc.a = { t:0, voicedT:0, midis:[], stabs:[], cents:[], zoneT:[0,0,0,0,0], zm:[] };
  if (id === 'siren') acc.s = { t:0, midis:[], zoneT:[0,0,0,0,0], zm:[] };
  if (id === 'sss') acc.x = { t:0, exh:0 };
  fl.done[id] = false; delete rec.clips[id]; rec.buf = [];
}
function build(){
  if ($('pt')) return;
  const el = document.createElement('section');
  el.className = 'pt'; el.id = 'pt'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'ptTitle');
  el.innerHTML = `<canvas class="pt-flow" id="ptFlow" aria-hidden="true"></canvas><div class="pt-in">
    <div class="ex-top"><button class="icon-btn" id="ptClose" aria-label="Закрыть">${ICO.x}</button><div class="segs" id="ptSegs"></div><span></span></div>
    <span class="pill" id="ptPill" style="align-self:flex-start"></span>
    <h2 class="ex-title" id="ptTitle"></h2><p class="pt-hint" id="ptHint"></p>
    <div class="pt-stage" id="ptStage"><canvas id="ptCv" aria-label="Силуэт из точек: зоны, где ощущается голос"></canvas><div class="pt-zones" id="ptZones"></div></div>
    <div class="pt-res" id="ptRes"></div></div>`;
  const bar = document.createElement('div'); bar.className = 'tbar pt-bar'; bar.id = 'ptBar'; bar.hidden = true;
  document.body.appendChild(el); document.body.appendChild(bar);
  $('ptClose').addEventListener('click', close);
  bar.addEventListener('click', onBar);
  addEventListener('keydown', e => { if (e.key === 'Escape' && !el.hidden) close(); });
  addEventListener('resize', () => { if (!el.hidden) layout(); });
  off = document.createElement('canvas');
}
function buildZones(){
  const zs = $('ptZones'); if (!zs) return;
  zs.innerHTML = [4,3,2,1,0].map(z => `<button class="pt-zb" data-z="${z}" tabindex="-1"><b>${zName(z)}</b><span>${zSub(z)}</span></button>`).join('');
  const pick = z => {
    if (ORDER[fl.step] !== 'pick') return;
    fl.guess = z; markZones(); renderBar();
    clearTimeout(fl.auto); fl.auto = setTimeout(() => { if (ORDER[fl.step] === 'pick') go(1); }, 550);
  };
  zs.querySelectorAll('.pt-zb').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); pick(+b.dataset.z); }));
  $('ptStage').onclick = e => { if (ORDER[fl.step] !== 'pick') return; const b = $('ptStage').getBoundingClientRect(); pick(zoneOfY(BYinv((e.clientY - b.top)/b.height))); };
  layout(); markZones();
}
function layout(){
  const st = $('ptStage'); if (!st) return;
  const id = ORDER[fl.step], W = st.clientWidth || Math.min(innerWidth, 520) - 36;
  /* the stage runs down to the top of the bottom capsule, so the body stands on it */
  const top = st.getBoundingClientRect().top + $('pt').scrollTop, cap = $('ptBar') && $('ptBar').firstElementChild;
  const floor = cap ? cap.getBoundingClientRect().top - 6 : innerHeight - 104;
  const H = id === 'res' ? Math.round(Math.min(W*1.05, 470)) : Math.round(clamp(floor - top, 260, W*1.7));
  st.style.height = H + 'px';
  if (W !== SW || H !== SH){ SW = W; SH = H; fit($('ptCv'), SW, SH); }
  setBody(SW, SH, 1.55);
  st.classList.toggle('compact', SH < 300);
  $('ptZones').querySelectorAll('.pt-zb').forEach(b => { const z = +b.dataset.z; b.style.top = (SH*bandMid(z)) + 'px'; });
}
function markZones(){
  const id = ORDER[fl.step];
  $('ptStage').classList.toggle('pick', id === 'pick');
  $('ptZones').querySelectorAll('.pt-zb').forEach(b => {
    const z = +b.dataset.z;
    b.classList.toggle('guess', fl.guess === z && (id === 'pick' || id === 'res'));
    b.classList.toggle('on', z === fl.curZ && id !== 'pick');
    b.tabIndex = id === 'pick' ? 0 : -1;
  });
}
/* ctx: 'after' when it closes a practice; onSave(record) runs when she leaves the result */
function open(ctx, onSave){
  if (typeof HAS_FORM !== 'undefined' && !HAS_FORM) return;
  build();
  L = ensureLive(); L.setOpts({ rain: data.profile.rain !== false, crisp: data.profile.lace !== true, mono: '#F4F2EC' });
  L.solo.ghosts.length = 0; L.solo.exh = 0; L.mixT = 0; L.many = 0;
  rec.buf = []; rec.clips = {};
  Object.assign(fl, { ctx: ctx || null, onSave: onSave || null, step:0, guess:null, demo:false, run:false, done:{}, result:null, curZ:-1, formA:0, info:null, key:dkey(), saved:-1 });
  ['a','siren','sss'].forEach(resetStep);
  L.solo.target({ e:.08, hold:0, noise:0 });
  const el = $('pt'); el.hidden = false; $('ptBar').hidden = false; el.scrollTop = 0; document.body.style.overflow = 'hidden';
  buildZones(); renderStep();
  cancelAnimationFrame(fl.raf); fl.last = performance.now(); fl.raf = requestAnimationFrame(frame);
}
function close(){
  if (L && L.on) L.stop();
  fl.run = false; clearTimeout(fl.auto); cancelAnimationFrame(fl.raf); fl.raf = 0;
  if ($('pt')) $('pt').hidden = true; if ($('ptBar')) $('ptBar').hidden = true;
  document.body.style.overflow = (typeof ex !== 'undefined' && ex.open) ? 'hidden' : '';
  const cb = fl.onSave, r = fl.saved >= 0 ? fl.result : null; fl.onSave = null;
  if (cb && r) cb(r); else if (typeof render === 'function' && !(typeof ex !== 'undefined' && ex.open)) render();
}
function go(i){
  clearTimeout(fl.auto); fl.run = false;
  const id = ORDER[i];
  if (id === 'res'){ compute(); if (L.on) L.stop(); save(); }
  fl.step = i; fl.curZ = id === 'res' && valid(fl.result) ? fl.result.actual : -1;
  if (id !== 'res') L.solo.target({ e:.08, hold:0, noise:0 });
  $('pt').scrollTop = 0; renderStep();
}
function renderStep(){
  const id = ORDER[fl.step];
  $('ptSegs').innerHTML = ORDER.slice(0, -1).map((s, k) => `<i class="${k < fl.step || (k === fl.step && fl.done[s]) ? 'dn' : k === fl.step ? 'cur' : ''}"></i>`).join('');
  if (id !== 'res'){
    $('ptPill').textContent = 'Отпечаток · ' + (fl.step + 1) + ' из 4' + (fl.demo && id !== 'pick' ? ' · демо' : '');
    $('ptTitle').textContent = STEPS[id].t; $('ptHint').textContent = STEPS[id].h;
    $('ptRes').innerHTML = '';
  } else renderResult();
  renderBar(); layout(); markZones();
}
/* the bottom capsule is the one from the exercises: big timer on the left, round button on the right */
function renderBar(){
  const id = ORDER[fl.step], bar = $('ptBar'); if (!bar) return;
  let time = '', label = '', acts = '', fin = false, big = true, fill = 0;
  if (id === 'pick'){
    big = false; time = 'Догадка'; label = fl.guess == null ? 'нажми на зону на силуэте' : zName(fl.guess);
    acts = `<button class="go" data-pt="next" ${fl.guess == null ? 'disabled style="opacity:.35"' : ''}>Дальше</button>`;
  } else if (id === 'res'){
    fin = true; big = false; time = 'Готово'; label = valid(fl.result) ? 'отпечаток сохранён' : 'голос не услышан';
    const toPractice = valid(fl.result) && fl.ctx !== 'after' && !practised(fl.key);
    acts = !valid(fl.result) ? `<button class="go" data-pt="retry">Ещё раз</button>`
      : toPractice ? `<button class="chip" data-pt="close">Закрыть</button><button class="go" data-pt="practice">К<br>практике</button>`
      : `<button class="go" data-pt="close">${fl.ctx === 'after' ? 'Дальше' : 'Закрыть'}</button>`;
  } else if (fl.done[id]){
    fin = true; big = false;
    time = id === 'sss' ? Math.round(acc.x.exh) + ' с' : 'Готово'; label = id === 'sss' ? 'выдох' : 'дальше: ' + STEPS[id].next;
    acts = `<button class="chip" data-pt="redo">Ещё раз</button><button class="go" data-pt="next">${id === 'sss' ? 'Итог' : 'Дальше'}</button>`;
  } else {
    if (id === 'sss'){ time = fmt1(acc.x.exh); fill = Math.min(100, acc.x.exh/40*100); }
    else { const left = id === 'a' ? STEPS.a.dur - acc.a.voicedT : STEPS.siren.dur - acc.s.t; time = fmtS(Math.ceil(left - 1e-6)); fill = (1 - left/STEPS[id].dur)*100; }
    const started = (id === 'a' && acc.a.t > 0) || (id === 'siren' && acc.s.t > 0);
    if (!fl.run) acts = `<button class="go" data-pt="play" aria-label="${started ? 'Продолжить' : 'Старт'}">${started ? ICO.play : 'Старт'}</button>`;
    else acts = id === 'sss' ? `<button class="go" data-pt="stop">Стоп</button>` : `<button class="go alt" data-pt="pause">Пауза</button>`;
  }
  bar.innerHTML = `<div class="cap ${fin ? 'fin' : ''}"><i class="fill" id="ptFill" style="width:${fin ? 100 : fill}%"></i><div class="time"><b id="ptTime" class="${big ? 'big' : ''}">${time}</b>${label ? `<span>${escH(label)}</span>` : ''}</div><div class="acts">${acts}</div></div>`;
}
function tickBar(){
  const id = ORDER[fl.step], t = $('ptTime'), f = $('ptFill'); if (!t || fl.done[id] || id === 'pick' || id === 'res') return;
  if (id === 'sss'){ t.textContent = fmt1(acc.x.exh); if (f) f.style.width = Math.min(100, acc.x.exh/40*100) + '%'; return; }
  const left = id === 'a' ? STEPS.a.dur - acc.a.voicedT : STEPS.siren.dur - acc.s.t;
  t.textContent = fmtS(Math.ceil(left - 1e-6)); if (f) f.style.width = clamp((1 - left/STEPS[id].dur)*100, 0, 100) + '%';
}
async function onBar(e){
  const b = e.target.closest('[data-pt]'); if (!b) return;
  const a = b.dataset.pt, id = ORDER[fl.step];
  if (a === 'next'){ if (id === 'pick' && fl.guess == null) return; go(fl.step + 1); return; }
  if (a === 'demo'){ fl.demo = true; if (fl.guess == null) fl.guess = 2; go(1); return; }
  if (a === 'close'){ close(); return; }
  if (a === 'practice'){ fl.onSave = null; close(); if (typeof state !== 'undefined'){ state.tab = 'path'; state.choosing = true; render(); scrollTo(0, 0); } return; }
  if (a === 'retry'){ resetStep('a'); go(1); return; }
  if (a === 'redo'){ resetStep(id); fl.run = true; renderStep(); return; }
  if (a === 'pause'){ fl.run = false; L.solo.target({ e:.12, hold:0, noise:0 }); renderBar(); return; }
  if (a === 'stop'){ finishStep(); return; }
  if (a === 'play'){
    if (!fl.demo && !L.on){
      if (data.profile.micOff === true) fl.demo = true;
      else { try { await L.start(); if (!data.profile.mic){ data.profile.mic = 'asked'; saveProfile(); } } catch (err){ fl.demo = true; } }
      if (fl.demo) renderStep();
    }
    fl.run = true; renderBar();
  }
}
function keepClip(id){
  if (!canClip() || rec.buf.length < GIF_FPS) return;
  const n = CLIP_SEC*GIF_FPS, fr = rec.buf.length > n + 3 ? rec.buf.slice(-n - 3, -3) : rec.buf.slice(-n);
  rec.clips[id] = fr.map(f => ({ xy:f.xy, sa:f.sa, ci:f.ci, cols:f.cols })); rec.buf = [];
}
function finishStep(){ const id = ORDER[fl.step]; keepClip(id); fl.run = false; fl.done[id] = true; L.solo.target({ hold:.2 }); const s = $('ptSegs').children[fl.step]; if (s) s.className = 'dn'; renderBar(); }

function demoInfo(id, t){
  const up = prints(dkey()).length ? 1.6 : 0;
  if (id === 'a'){ if (t < .6) return { voiced:false, silent:true, act:false, noise:0 }; return { voiced:true, midi:55.2 + up + .18*Math.sin(t*5.5) + .06*Math.sin(t*17), stab:up ? .9 : .78, act:true, silent:false, noise:0, cent:.2 }; }
  if (id === 'siren'){ if (t > 10.4) return { voiced:false, silent:true, act:false, noise:0 }; return { voiced:true, midi:52 - up*.6 + (25 + up*2)*Math.sin(Math.PI*Math.min(t, 10)/10), stab:.7, act:true, silent:false, noise:0, cent:.3 }; }
  if (t < .5 || t > 17.5) return { voiced:false, silent:true, act:false, noise:0 };
  return { voiced:false, act:true, silent:false, noise:.95, cent:.85 };
}
function analyse(info, dt){
  const id = ORDER[fl.step];
  let z = -1;
  if (info.voiced && info.midi > 30){ fl.p = pOf(info.midi, info.cent); z = zoneOf(fl.p); }
  if (id === 'a'){ const a = acc.a; a.t += dt;
    if (z >= 0){ a.voicedT += dt; a.midis.push(info.midi); a.stabs.push(info.stab); a.cents.push(info.cent); a.zoneT[z] += dt; (a.zm[z] = a.zm[z] || []).push(info.midi); }
    if (a.voicedT >= STEPS.a.dur) finishStep();
  } else if (id === 'siren'){ const s = acc.s; s.t += dt;
    if (z >= 0){ s.midis.push(info.midi); s.zoneT[z] += dt; (s.zm[z] = s.zm[z] || []).push(info.midi); }
    if (s.t >= STEPS.siren.dur) finishStep();
  } else if (id === 'sss'){ acc.x.t += dt; acc.x.exh = acc.x.t; }
  fl.curZ = id === 'sss' ? -1 : z >= 0 ? z : info.silent ? -1 : fl.curZ;
  fl.info = info;
}
function contour(m, n){
  if (m.length < 8) return [];
  const out = [], step = m.length/n;
  for (let i = 0; i < n; i++){ const seg = m.slice(Math.floor(i*step), Math.max(Math.floor(i*step) + 1, Math.floor((i + 1)*step))); out.push(+median(seg).toFixed(1)); }
  return out;
}
function compute(){
  const a = acc.a, s = acc.s, x = acc.x, now = new Date();
  const comfort = median(a.midis), all = a.midis.concat(s.midis), cent = mean(a.cents);
  const zt = a.zoneT.map((v, k) => v + s.zoneT[k]), tz = zt.reduce((p, q) => p + q, 0) || 1;
  const r = { at:String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), guess:fl.guess,
    comfort: comfort == null ? null : +comfort.toFixed(2), stab: a.stabs.length ? +clamp(mean(a.stabs), 0, 1).toFixed(3) : null,
    low: s.midis.length > 12 ? +pct(all, .04).toFixed(2) : null, high: s.midis.length > 12 ? +pct(all, .96).toFixed(2) : null,
    contour: contour(s.midis, 32), exhale: x.exh > 1 ? +x.exh.toFixed(1) : null, cent: cent == null ? 0 : +cent.toFixed(3), zones: zt.map(v => +(v/tz).toFixed(3)), zoneNotes: [0,1,2,3,4].map(z => { const m = (a.zm[z] || []).concat(s.zm[z] || []); return m.length ? +median(m).toFixed(1) : null; }) };
  if (fl.ctx) r.ctx = fl.ctx;
  if (fl.demo) r.demo = true;
  r.actual = r.comfort == null ? null : zoneOf(pOf(r.comfort, r.cent));
  fl.result = r;
  if (valid(r)){ fl.p = pOf(r.comfort, r.cent); fl.pShown = fl.p; const m = Math.round(r.comfort); L.solo.target({ u: m - 12*(Math.floor(m/12) - 1), vo:1, noise:0, amp:.55, stab:Math.max(.7, r.stab || .7), e:1, hold:1, cent:.5 }); }
}
/* the result is kept as soon as it is shown; going back and measuring again replaces it */
function save(){
  const r = fl.result; if (!valid(r)) return;
  const k = fl.key, d = getDay(k); prints(k);
  d.prints = d.prints || [];
  if (fl.saved >= 0 && fl.saved < d.prints.length) d.prints[fl.saved] = r; else { d.prints.push(r); fl.saved = d.prints.length - 1; }
  saveDay(k);
  if (!data.profile.ref){ data.profile.ref = Math.round(r.comfort); saveProfile(); }
  if (canClip()) ['a', 'siren', 'sss'].forEach(id => { const fr = rec.clips[id]; if (fr && fr.length >= GIF_FPS) gifPut('c:' + k + ':p' + fl.saved + '-' + id, { id:'print-' + id, b: id === 'sss' ? 'breath' : 'phon', frames: fr }); });
  if (typeof mom !== 'undefined' && mom.cache) mom.cache.delete('d:' + k);
}
const semis = c => c && c.low != null ? Math.round(c.high - c.low) : null;
function guessLine(r){
  if (r.guess == null) return '';
  if (r.guess === r.actual) return 'Догадка совпала. Это редкость: изнутри голос обычно звучит иначе, чем снаружи.';
  return r.guess > r.actual ? 'Ты думала: «' + zName(r.guess) + '». Голос ниже, чем кажется: он опирается на грудь, а внимание сосредоточено выше.'
    : 'Ты думала: «' + zName(r.guess) + '». Изнутри голос кажется ниже: кости черепа добавляют низких частот, поэтому своя запись звучит выше.';
}
function renderResult(){
  const r = fl.result;
  $('ptPill').textContent = 'Отпечаток · итог' + (fl.demo ? ' · демо' : '');
  if (!valid(r)){ $('ptTitle').textContent = 'Голос не услышан'; $('ptHint').textContent = 'Шаг «а-а-а» пропущен или микрофон не поймал звук. Без него не найти комфортную ноту.'; $('ptRes').innerHTML = ''; return; }
  const P = (data.days[fl.key] || {}).prints || [], prev = fl.saved > 0 ? P[fl.saved - 1] : null;
  if (valid(prev)){
    const mv = r.actual - prev.actual;
    $('ptTitle').innerHTML = mv === 0 ? `Голос остался <span style="color:${nCol(r.comfort)}">${zIn(r.actual)}</span>` : `Голос ${mv > 0 ? 'поднялся' : 'опустился'} <span style="color:${nCol(r.comfort)}">${zIn(r.actual)}</span>`;
  } else $('ptTitle').innerHTML = `Ты звучишь <span style="color:${nCol(r.comfort)}">${zIn(r.actual)}</span>`;
  $('ptHint').textContent = guessLine(r);
  const pv = valid(prev) ? prev : null, s = semis(r), ps = pv ? semis(pv) : null;
  $('ptRes').innerHTML = `<div class="pt-tiles">
    <div class="pr-tile dark wide"><span>Комфортная нота</span><b class="pt-note"><span class="pt-dot" style="background:${nCol(r.comfort)}"></span>${escH(nName(r.comfort))}</b><span>${Math.round(hz(r.comfort))} Гц · ${zIn(r.actual)}${pv ? ' · было ' + escH(nName(pv.comfort)) : ''}</span></div>
    <div class="pr-tile b-body"><span>Диапазон сирены</span>${s != null ? `<b class="num">${octs(s)}<small>окт.</small></b><span>${escH(nShort(r.low))} — ${escH(nName(r.high))}${ps != null ? ' · было ' + octs(ps) : ''}</span>` : '<b>—</b><span>сирену не услышала</span>'}</div>
    <div class="pr-tile b-phon"><span>Устойчивость «а»</span>${r.stab != null ? `<b class="num">${Math.round(r.stab*100)}<small>%</small></b><span>${pv && pv.stab != null ? 'было ' + Math.round(pv.stab*100) + ' %' : 'насколько ровно'}</span>` : '<b>—</b>'}</div>
    <div class="pr-tile b-breath"><span>Долгий выдох</span>${r.exhale ? `<b class="num">${Math.round(r.exhale)}<small>с</small></b>` : '<b>—</b>'}<span>цель 30–40 с</span></div>
    <div class="pr-tile dark"><span>Где звучал голос</span><canvas class="pt-zline" id="ptZline" aria-label="Доля времени по зонам, цветом нот"></canvas><span class="pt-zl"><span>${zName(0)}</span><span>${zName(4)}</span></span></div>
  </div>`;
  zoneLine($('ptZline'), r);
}
/* the share of time per zone as a band of dust, like the day's line in the exercises; each zone in the colour of the note heard there */
function zoneLine(cv, r){
  if (!cv) return;
  const w = cv.clientWidth, h = 26, ctx = fit(cv, w, h); ctx.clearRect(0, 0, w, h);
  const z = r.zones || [], zn = r.zoneNotes || [], tot = z.reduce((a, b) => a + b, 0) || 1, gap = 3, rr = FL.rng(17);
  let x = 0; const used = z.filter(v => v > .005).length, room = w - gap*Math.max(0, used - 1);
  z.forEach((v, i) => {
    if (v <= .005) return;
    const ww = room*v/tot, m = zn[i] != null ? zn[i] : (ZB[i] + ZB[i + 1])/2, n = Math.round(ww*h*.42);
    ctx.fillStyle = nCol(m);
    for (let q = 0; q < n; q++){ const s = .8 + rr()*1.3; ctx.globalAlpha = .45 + .55*rr(); ctx.fillRect(x + rr()*ww - s/2, h/2 + FL.gs(rr)*h*.2 - s/2, s, s); }
    x += ww + gap;
  });
  ctx.globalAlpha = 1;
}
function frame(now){
  const el = $('pt'); if (!el || el.hidden){ fl.raf = 0; return; }
  const dt = Math.min(.05, (now - fl.last)/1000); fl.last = now; fl.T += dt;
  const id = ORDER[fl.step];
  if (['a','siren','sss'].includes(id) && fl.run){
    const t = id === 'a' ? acc.a.t : id === 'siren' ? acc.s.t : acc.x.t;
    let info = null;
    if (fl.demo){
      info = demoInfo(id, t);
      if (info.voiced) L.solo.target({ u: info.midi - 36, vo:1, noise:0, amp:.62, stab:info.stab, e:1, hold:.9, cent:.5 });
      else if (info.noise > .5){ L.solo.target({ vo:0, noise:1, cent:.85, amp:.5, e:1, hold:0, stab:.25 }); L.solo.exh += dt; }
      else { L.solo.target({ e:.08, hold:0, noise:0 }); L.solo.exh = 0; }
    } else if (L.on) info = L.update(dt).info;
    if (info) analyse(info, dt);
    if (canClip() && fl.run && now - rec.last >= 1000/GIF_FPS - 4){ rec.last = now; rec.buf.push(grab(L, 400, 400, .54, now, CLIP_DOTS)); if (rec.buf.length > (CLIP_SEC + 2)*GIF_FPS) rec.buf.shift(); }
    tickBar();
  }
  if (id !== 'pick') L.step(dt);
  if (fl.curZ !== prevZ){ prevZ = fl.curZ; markZones(); }
  drawStage(dt);
  fl.raf = requestAnimationFrame(frame);
}
function drawStage(dt){
  const id = ORDER[fl.step], k = a => 1 - Math.pow(1 - a, dt*60), r = fl.result, okR = id === 'res' && valid(r);
  for (let z = 0; z < 5; z++){
    const tg = id === 'pick' ? (z === fl.guess ? .7 : 0) : z === fl.curZ ? 1 : 0;
    fl.hl[z] += (tg - fl.hl[z])*k(tg > fl.hl[z] ? .12 : .03);
  }
  fl.pShown += (fl.p - fl.pShown)*k(.08);
  const show = (['a','siren','sss'].includes(id) && (fl.run || fl.done[id])) || okR;
  fl.formA += ((show ? 1 : 0) - fl.formA)*k(.06);
  const ctx = $('ptCv').getContext('2d'), d = DPR(); ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, SW, SH);
  setBody(SW, SH, 1.55);
  const cxF = .63, voiceCol = okR ? nCol(r.comfort) : fl.curZ >= 0 || id === 'sss' ? V3.toHex(L.solo.color()) : null;
  const tint = id === 'pick' ? PINK : voiceCol;
  drawBody(ctx, body(SW < 420 ? 2300 : 3200, 7), SW, SH, cxF, fl.hl, tint, fl.T, id === 'pick' ? 0 : fl.formA*.8);
  if (okR && r.guess != null && r.guess !== r.actual){
    const yg = SH*bandMid(r.guess), ya = SH*BY(yOfP(fl.pShown)), x = Math.min(SW - 10, SW*cxF + .23*BK*SH);
    ctx.strokeStyle = PINK; ctx.globalAlpha = .85; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(x, yg); ctx.lineTo(x, ya); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(x, yg, 3.5, 0, Math.PI*2); ctx.stroke(); ctx.fillStyle = PINK; ctx.beginPath(); ctx.arc(x, ya, 3.5, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
  }
  /* a voice in the head does not stop at the crown: a stream of dots leaves the top of the head and rises
     up the whole screen, behind the title, on its own layer under the text */
  const head = id === 'sss' ? 0 : sm((fl.pShown - .74)/.2)*fl.formA;
  const fc = $('ptFlow'), sr = $('ptStage').getBoundingClientRect(), fx = fit(fc, innerWidth, innerHeight); fc.style.height = '';
  fx.clearRect(0, 0, innerWidth, innerHeight);
  streamStep(fx, dt, head, sr.left + SW*cxF, sr.top + BY(.075)*SH, SH, voiceCol || C.ink);
  if (fl.formA > .01){
    /* the sound spreads past the body, but the body is where it is strongest: the form is drawn whole,
       full strength inside the silhouette and about a third outside it, so the voice leaves the body
       and the head and shoulders still read through it */
    if (!off2){ off2 = document.createElement('canvas'); off3 = document.createElement('canvas'); }
    const F = Math.round(Math.min(SW*.7, SH*.78)), oc = fit(off, F, F); oc.clearRect(0, 0, F, F);
    L.draw(oc, F, F, .5);
    const y = SH*(id === 'sss' ? BY(.55) : BY(yOfP(fl.pShown))), M = bodyMask(SW, SH, cxF);
    [[off2, 'destination-in'], [off3, 'destination-out']].forEach(([cv, op]) => {
      const lc = fit(cv, SW, SH); lc.clearRect(0, 0, SW, SH); lc.drawImage(off, SW*cxF - F/2, y - F/2, F, F);
      lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalCompositeOperation = op; lc.drawImage(M, 0, 0);
      if (op === 'destination-out'){ lc.globalCompositeOperation = 'destination-in'; lc.drawImage(edgeFade(SW, SH), 0, 0); }
      lc.globalCompositeOperation = 'source-over';
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = fl.formA*.36; ctx.drawImage(off3, 0, 0);
    ctx.globalAlpha = fl.formA; ctx.drawImage(off2, 0, 0);
    ctx.globalAlpha = 1; ctx.setTransform(d, 0, 0, d, 0, 0);
  }
}
const stream = [];
function streamStep(ctx, dt, k, cx, top, H, col){
  if (reduced()){ stream.length = 0; return; }
  const born = k*dt*320;
  for (let n = Math.floor(born) + (Math.random() < born % 1 ? 1 : 0); n >= 1; n--)
    stream.push({ x: cx + FL.gs(Math.random)*H*.028, y: top + Math.random()*H*.03, vx: FL.gs(Math.random)*H*.01, vy: -(.2 + Math.random()*.32)*H, z: .7 + Math.random()*1.4, a: .4 + Math.random()*.6, ph: Math.random()*6.28 });
  ctx.fillStyle = col;
  for (let i = stream.length - 1; i >= 0; i--){
    const p = stream[i];
    p.ph += dt*2.4; p.x += (p.vx + Math.sin(p.ph)*H*.02)*dt; p.y += p.vy*dt; p.vx *= 1 + dt*.5;
    if (p.y < -4){ stream.splice(i, 1); continue; }
    ctx.globalAlpha = p.a*clamp(p.y/(top*.5), 0, 1)*clamp((top + H*.02 - p.y)/(H*.05), 0, 1)*.85;
    ctx.fillRect(p.x - p.z/2, p.y - p.z/2, p.z, p.z);
  }
  ctx.globalAlpha = 1;
}
function setLabels(v){
  data.profile.zoneLabels = v; saveProfile();
  if ($('pt') && !$('pt').hidden){ buildZones(); renderStep(); }
}

/* =========================== picture of the day =========================== */
/* The haze of the day stays as it is — every exercise's clip laid over the others, moving, chaotic.
   Inside it the dots of the note never stop changing: the form flows from the morning note along the recorded siren
   to the note after practice and back, through every pattern in between, while the dots keep drifting
   between haze and pattern. Nothing switches on or off — it is one continuous flow.
   One loop is 144 frames (12 s at 12 fps) and closes on itself, so the GIF has no seam; live views pass a
   fractional frame and move at full frame rate. */
const LOOP = 144, T2 = Math.PI*2;
const cloudCache = new Map();
function cloud(N){
  if (cloudCache.has(N)) return cloudCache.get(N);
  const Q = V3.makeP(N, 31), r = FL.rng(97), D = new Float32Array(N), A = new Float32Array(N), PH = new Float32Array(N);
  for (let i = 0; i < N; i++){ D[i] = r(); A[i] = .35 + .65*((i*7919 % 100)/100); PH[i] = r()*T2; }
  const c = { Q, D, A, PH, N }; cloudCache.set(N, c); return c;
}
/* the notes the form travels through, as points on a loop: morning note → up the siren → note after → down the siren */
function noteKeys(k){
  const P = prints(k), lerp = (a, b, t) => a + (b - a)*t;
  if (P.length){
    const A = P[0].comfort, B = P[P.length - 1].comfort, ct = (P[P.length - 1].contour && P[P.length - 1].contour.length > 6 ? P[P.length - 1].contour : P[0].contour) || [];
    const at = q => ct.length > 6 ? ct[Math.round(q*(ct.length - 1))] : null, hi = at(.5), lo = at(.9);
    return [A, hi != null ? lerp(A, hi, .4) : A + 3, B, lo != null ? lerp(B, lo, .45) : B - 2].map(uOfM);
  }
  const E = exNotes(k); if (!E.length) return [];
  const ns = E.slice(0, 4).map(n => n.midi); while (ns.length < 3) ns.push(ns[0] + (ns.length === 1 ? 3 : -2));
  return ns.map(uOfM);
}
/* a smooth closed path through the keys (Catmull–Rom, cyclic) */
function pathU(K, ph){
  const n = K.length, q = ph*n, i = Math.floor(q) % n, t = q - Math.floor(q);
  const p0 = K[(i - 1 + n) % n], p1 = K[i], p2 = K[(i + 1) % n], p3 = K[(i + 2) % n], t2 = t*t, t3 = t2*t;
  return .5*((2*p1) + (-p0 + p2)*t + (2*p0 - 5*p1 + 4*p2 - p3)*t2 + (-p0 + 3*p1 - 3*p2 + p3)*t3);
}
/* the haze: every clip of the day — exercises and the prints' own «а», siren and «с-с-с».
   A print made before its clips were kept still brings its «с-с-с» as a running noise field. */
function hazeOf(k, clips, i, ctx, cx, cy, R, mul, mono){
  const fi = Math.floor(i), ph = (((i % LOOP) + LOOP) % LOOP)/LOOP;
  const hasSss = (clips || []).some(c => c.id === 'print-sss');
  if (!hasSss && prints(k).some(c => c.exhale)){
    const N = Math.round(clamp(R*R*.05, 400, 1800));
    V3.renderState(ctx, cx, cy, R*1.15, { noise:1, cent:.85, vo:0, stab:.2, hold:0, e:1, amp:.5 }, N, 53, mono || C.ink, .55*mul, Math.max(.8, R/170), 1.3 + 1.2*Math.sin(T2*ph));
  }
  if (clips && clips.length) paintAt(ctx, dayLayers(clips, fi), layerMul(clips.length)*mul, cx, cy, R*1.18, .8, mono);
  else { ctx.save(); paintSynth(ctx, k, cx, cy, R*1.05, .07*Math.sin(T2*ph), mono); ctx.restore(); }
}
/* returns false when the day has no note: then the caller paints it as before */
function paintDay(ctx, k, clips, i, cx, cy, R, mono){
  const K = noteKeys(k); if (!K.length) return false;
  const ph = (((i % LOOP) + LOOP) % LOOP)/LOOP, still = reduced();
  const u = clamp(still ? K[K.length >= 4 ? 3 : 0] : pathU(K, ph), 0, 47);
  const order = still ? .85 : .76 + .12*Math.sin(T2*ph);   // breathes between haze and pattern, never all the way
  hazeOf(k, clips, i, ctx, cx, cy, R, 1 - .45*order, mono);
  const N = Math.round(clamp(R*R*.08, 600, 3000)), dot = Math.max(1, R/115), Cl = cloud(N), Q = Cl.Q, o = [0, 0];
  const st = { u, amp:.4, stab:.95, e:1, hold:1, crisp: data.profile.lace !== true, noise:0, cent:.5, vo:1, bx:1 };
  const rot = still ? 0 : .35*Math.sin(T2*ph), Rf = R*.78;
  ctx.fillStyle = mono || (data.profile.rain !== false ? V3.noteColor(u) : C.ink);
  for (let j = 0; j < N; j++){
    V3.targetOf(Q, st, j, rot, null, o);
    const e = sm((order - Cl.D[j]*.45)/.55);
    const w = still ? 0 : .07, hx = Q.X0[j]*1.35 + w*Math.sin(T2*ph + Cl.PH[j]), hy = Q.Y0[j]*1.35 + w*Math.cos(T2*ph*2 + Cl.PH[j]);
    const x = cx + (hx + (o[0] - hx)*e)*Rf, y = cy + (hy + (o[1] - hy)*e)*Rf, z = Q.Z[j]*dot;
    ctx.globalAlpha = Cl.A[j]*(.25 + .75*e); ctx.fillRect(x - z/2, y - z/2, z, z);
  }
  ctx.globalAlpha = 1;
  return true;
}
/* GIF 9:16 with the Reels / TikTok safety zones: «woisee» and the date pinned to the top of the safe area,
   the picture right under them, everything inside the zone */
const SAFE = { top:.114, left:.08, right:.058, rightLow:.18, bottom:.71 };
function gifLayout(W, H){ const side = W*(1 - SAFE.left - SAFE.right), textY = H*SAFE.top + 22, top = textY + 14; return { cx: W*SAFE.left + side/2, cy: top + side/2, R: side*.42, textY }; }
function gifText(ctx, k, W, H){
  const G = gifLayout(W, H);
  ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.font = '800 22px "Inter Tight", sans-serif'; ctx.fillText('woisee', W*SAFE.left, G.textY);
  ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.font = '400 15px "Inter Tight", sans-serif'; ctx.fillText(dateLong(parseKey(k)), W*(1 - SAFE.right), G.textY - 2);
  ctx.textAlign = 'left';
}

/* =========================== «Звучание» tab =========================== */
const WD = ['пн','вт','ср','чт','пт','сб','вс'];
const monday = dt => { const x = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; };
const hasAny = k => voiced(k) || exNotes(k).length > 0;
/* the little picture of a day: its note, or the rebuilt day when there was only practice */
function paintDayCell(cv, k){
  const s = cv.clientWidth; if (!s) return;
  const ctx = fit(cv, s, s); ctx.clearRect(0, 0, s, s);
  const n = dayNotes(k), P = prints(k);
  if (n.length){ const m = n[n.length - 1], st = P.length ? P[P.length - 1].stab : .8; V3.renderForm(ctx, s/2, s/2, s*.5, Math.round(uOfM(m)), Math.round(120 + s*5), 700 + parseInt(k.slice(8), 10), nCol(m), .55 + .45*(st || .6), Math.max(.7, s/60), 0, data.profile.lace !== true); }
  else paintSynth(ctx, k, s/2, s/2, s*.42, 0);
}
function weekHTML(start){
  const tk = dkey(); let h = '';
  for (let i = 0; i < 7; i++){
    const k = dkey(addDays(start, i)), fut = k > tk, isT = k === tk;
    h += `<div class="tr-day ${isT ? 't' : ''}">${hasAny(k) ? `<button class="tr-dc" data-act="day" data-v="${k}" aria-label="${escH(dateLong(parseKey(k)))}"><canvas data-trday="${k}"></canvas></button>`
      : isT ? `<button class="tr-dc empty" data-act="print" aria-label="Оставить отпечаток"><i></i></button>` : `<span class="tr-dc ${fut ? 'fut' : 'off'}"><i></i></span>`}<span>${WD[i]}</span></div>`;
  }
  return h;
}
function viewTrack(){
  const k = dkey(), P = prints(k), t = new Date(), h = t.getHours();
  const when = h < 5 ? 'этой ночью' : h < 12 ? 'этим утром' : h < 18 ? 'этим днём' : 'этим вечером';
  const last = P[P.length - 1];
  return topbar() + `
  <section class="tr-week" aria-label="Неделя">${weekHTML(monday(t))}</section>
  <h1 class="big-title tr-q">${last ? 'Сегодня ты звучишь <span style="color:' + nCol(last.comfort) + '">' + zIn(last.actual) + '</span>' : 'Как ты звучишь ' + when + '?'}</h1>
  <div class="tr-ring"><canvas id="trRing" aria-hidden="true"></canvas>
    ${last ? '' : `<button class="tr-go" data-act="print" aria-label="Оставить отпечаток"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M12 6.5v11M6.5 12h11"/></svg></button>`}</div>
  ${P.length ? `<button class="tr-more" data-act="print">Ещё один отпечаток</button>` : `<p class="note tr-note">Полминуты: догадка, «а-а-а», сирена и выдох. Покажет, где в теле живёт голос и на какой ноте.</p>`}`;
}
/* the ring is the flowing dust of the current exercise's outline; the part of the week with voice is bright.
   Inside lives one cloud of dots: a loose haze before the first print, the note's pattern after it.
   A finger (or the mouse on a desktop) stirs it the way it stirs the dots around «Привет» in the profile:
   dots near it are pushed aside and swirl, then flow back. A tap sends a wave out from the centre,
   the same push an attack of the voice gives in the exercises. */
const ring = { P:null, flow:0, t:0, raf:0, last:0, solo:null, VX:null, VY:null, ptr:null, s:0, key:'' };
const SOLO_N = 3000, SOLO_SC = .45;
function mountTrack(){
  document.querySelectorAll('canvas[data-trday]').forEach(cv => paintDayCell(cv, cv.dataset.trday));
  const cv = $('trRing'); if (!cv) return;
  if (!ring.P){ ring.P = []; for (let i = 0; i < 1300; i++){ let u = 0; while (!u) u = Math.random(); ring.P.push({ s:Math.random(), sp:.6 + Math.random()*.8, n:Math.sqrt(-2*Math.log(u))*Math.cos(6.283*Math.random()), x:NaN, y:NaN, z:.9 + Math.random()*1.3, a:.45 + Math.random()*.55 }); } }
  if (!ring.solo){ ring.solo = new V3.Solo(SOLO_N, 9); ring.VX = new Float32Array(SOLO_N); ring.VY = new Float32Array(SOLO_N); }
  const P = prints(dkey()), last = P[P.length - 1], so = ring.solo;
  so.opt.crisp = data.profile.lace !== true; so.opt.orbit = true;
  if (last){
    const m = Math.round(last.comfort); so.opt.rain = data.profile.rain !== false; so.opt.mono = C.ink;
    so.target({ u: m - 12*(Math.floor(m/12) - 1), e:1, vo:1, noise:0, stab:Math.max(.85, last.stab || .85), hold:1, amp:.5, cent:.5 });
    if (ring.key !== last.at + m){ ring.key = last.at + m; so.S.u = so.T.u; }
  } else { so.opt.rain = false; so.opt.mono = C.ink; so.target({ u:19, e:.35, vo:1, noise:0, stab:.45, hold:.3, amp:.32 }); }
  const box = cv.parentElement;
  const at = e => { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  box.onpointermove = e => { ring.ptr = at(e); };
  box.onpointerdown = e => { ring.ptr = at(e); if (!reduced()){ so.kick = 1; so.front = 0; const q = ring.ptr, R = ring.s*SOLO_SC, c = ring.s/2; for (let i = 0; i < SOLO_N; i++){ const dx = so.P.X[i]*R + c - q.x, dy = so.P.Y[i]*R + c - q.y, d = Math.hypot(dx, dy) || 1; if (d < 140){ const f = (1 - d/140)*2.2; ring.VX[i] += dx/d*f; ring.VY[i] += dy/d*f; } } } };
  box.onpointerleave = box.onpointerup = box.onpointercancel = e => { if (e.pointerType !== 'mouse' || e.type === 'pointerleave') ring.ptr = null; };
  cancelAnimationFrame(ring.raf); ring.last = performance.now(); ring.raf = requestAnimationFrame(ringFrame);
}
function stir(dt){
  const so = ring.solo, R = ring.s*SOLO_SC, c = ring.s/2, q = ring.ptr, damp = Math.exp(-4.5*dt), X = so.P.X, Y = so.P.Y;
  for (let i = 0; i < SOLO_N; i++){
    if (q){ const dx = X[i]*R + c - q.x, dy = Y[i]*R + c - q.y, d = Math.hypot(dx, dy) || 1;
      if (d < 90){ const f = (1 - d/90)*dt; ring.VX[i] += (dx/d*16 - dy/d*10.5)*f; ring.VY[i] += (dy/d*16 + dx/d*10.5)*f; } }
    ring.VX[i] *= damp; ring.VY[i] *= damp;
    X[i] += ring.VX[i]*dt; Y[i] += ring.VY[i]*dt;
  }
}
function ringFrame(now){
  const cv = $('trRing'); if (!cv || !cv.isConnected){ ring.raf = 0; return; }
  const dt = Math.min(.05, (now - ring.last)/1000); ring.last = now; ring.t += dt;
  const s = cv.clientWidth; if (!s){ ring.raf = requestAnimationFrame(ringFrame); return; }
  ring.s = s;
  const ctx = fit(cv, s, s), c = s/2, R = s*.44, still = reduced(); ctx.clearRect(0, 0, s, s);
  const mon = monday(new Date()); let n = 0; for (let i = 0; i < 7; i++) if (voiced(dkey(addDays(mon, i)))) n++;
  const wp = n/7;
  ring.flow += still ? 0 : dt*.018;
  const kk = still ? 1 : 1 - Math.pow(1 - .16, dt*60);
  ctx.fillStyle = C.ink;
  for (const p of ring.P){
    const u = ((p.s + ring.flow*p.sp) % 1 + 1) % 1, an = -Math.PI/2 + u*Math.PI*2, nx = Math.cos(an), ny = Math.sin(an);
    const o = p.n*2.4 + (still ? 0 : Math.sin(ring.t*2.2 + p.s*40)*1.2), tx = c + nx*(R + o), ty = c + ny*(R + o);
    if (isNaN(p.x)){ p.x = tx; p.y = ty; }
    p.x += (tx - p.x)*kk; p.y += (ty - p.y)*kk;
    ctx.globalAlpha = p.a*(u < wp ? 1 : .18); ctx.fillRect(p.x - p.z/2, p.y - p.z/2, p.z, p.z);
  }
  ctx.globalAlpha = 1;
  const so = ring.solo, has = prints(dkey()).length > 0;
  so.ease(dt); so.step(dt); if (!still) stir(dt);
  ctx.save(); ctx.beginPath(); ctx.arc(c, c, R - 6, 0, Math.PI*2); ctx.clip(); so.draw(ctx, s, s, SOLO_SC, has ? 1 : .55); ctx.restore();
  ring.raf = still ? 0 : requestAnimationFrame(ringFrame);
}

/* =========================== after a practice =========================== */
function winBlock(k){
  const P = prints(k), after = P.filter(c => c.ctx === 'after').pop(), before = P.filter(c => c !== after)[0];
  if (after) return `<div class="pt-win"><b>После практики ты звучишь ${zIn(after.actual)}</b><span>${escH(nName(after.comfort))}${before ? ' · до практики ' + escH(nName(before.comfort)) + ', ' + zIn(before.actual) : ''}</span></div>`;
  return `<div class="pt-win"><b>Как ты звучишь после практики?</b><span>Полминуты. Отпечаток ляжет в картинку дня${P.length ? ' рядом с утренним' : ''}.</span><button class="blackbtn" data-act="printafter">Оставить отпечаток ${ICO.arrow}</button></div>`;
}
function doneNudge(k){ return prints(k).some(c => c.ctx === 'after') ? '' : `<button class="ghost" data-act="printafter">Оставить отпечаток после практики</button>`; }
function dayRows(k){
  return prints(k).map(c => `<li><span>Отпечаток ${c.at}</span><span class="m"><span class="pt-dot" style="background:${nCol(c.comfort)}"></span>${escH(nName(c.comfort))} · ${zName(c.actual)}</span></li>`).join('');
}

/* =========================== profile =========================== */
const H = { per:'w', off:0, sample:false, lab:null };
let SAMPLE = null;
/* a stand-in history to see the profile filled: never stored, never mixed with hers */
function sampleData(){
  if (SAMPLE) return SAMPLE;
  const r = FL.rng(2026), out = {}, today = new Date(), days = 120, K = 45, norm = 1 - Math.exp(-(days - 1)/K);
  for (let d = 0; d < days; d++){
    if (r() < .14) continue;
    const t = (1 - Math.exp(-d/K))/norm, tired = r() < .07 ? 1 : 0, k = dkey(addDays(today, -(days - d)));
    const mk = lift => {
      const comfort = 54.2 + 1.3*t + lift + (r() - .5)*.9 - tired*1.1, low = 50.8 - 5*t - lift*.4 + (r() - .5)*1.3, high = 67.8 + 11.5*Math.pow(t, .8) + lift*1.5 + (r() - .5)*2.2 - tired*4.5;
      const stab = clamp(.55 + .27*t + lift*.05 + (r() - .5)*.08 - tired*.16, .3, .97), cent = .2 + .3*t, actual = zoneOf(pOf(comfort, cent));
      const zt = [0,0,0,0,0]; for (let q = 0; q < 40; q++) zt[zoneOf(pOf(comfort, cent))] += .1; for (let q = 0; q < 80; q++){ const m = low + (high - low)*(.5 - .5*Math.cos(Math.PI*q/79)); zt[zoneOf(pOf(m, cent))] += .1; }
      const tot = zt.reduce((a, b) => a + b, 0);
      return { at: lift ? '19:20' : '09:05', comfort:+comfort.toFixed(2), low:+low.toFixed(2), high:+high.toFixed(2), stab:+stab.toFixed(3), cent, actual, guess: r() < .2 + .7*t ? actual : clamp(actual + (r() < .8 ? 1 : -1), 0, 4), zones:zt.map(v => v/tot), exhale:+(12 + 16*t + (r() - .5)*3).toFixed(1), ctx: lift ? 'after' : undefined };
    };
    const prac = r() < .7, P = [mk(0)]; if (prac && r() < .8) P.push(mk(.9));
    out[k] = { prints:P, seconds: prac ? 600 + Math.round(r()*1200) : 0 };
  }
  SAMPLE = out; return out;
}
/* one accessor for both: her days or the sample */
function src(){
  if (H.sample){ const S = sampleData(); return { keys:Object.keys(S).sort(), P:k => S[k] ? S[k].prints : [], sec:k => S[k] ? S[k].seconds : 0, ex:() => ({}), notes:() => [], voiced:k => !!S[k], practised:k => !!(S[k] && S[k].seconds >= 60) }; }
  return { keys:Object.keys(data.days).sort().filter(hasAny), P:prints, sec:k => (data.days[k] || {}).seconds || 0, ex:k => (data.days[k] || {}).exhale || {}, notes:exNotes, voiced, practised };
}
const MONS = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
const MONN = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const inR = (k, s, e) => k >= dkey(s) && k <= dkey(e);
function period(S){
  const now = new Date();
  if (H.per === 'w'){ const s = addDays(monday(now), 7*H.off), e = addDays(s, 6); return { s, e, ps:addDays(s, -7), pe:addDays(s, -1), cmp:'неделей раньше', label: s.getMonth() === e.getMonth() ? s.getDate() + '–' + e.getDate() + ' ' + MONS[e.getMonth()] : s.getDate() + ' ' + MONS[s.getMonth()] + ' – ' + e.getDate() + ' ' + MONS[e.getMonth()] }; }
  if (H.per === 'm'){ const s = new Date(now.getFullYear(), now.getMonth() + H.off, 1), e = new Date(s.getFullYear(), s.getMonth() + 1, 0); return { s, e, ps:new Date(s.getFullYear(), s.getMonth() - 1, 1), pe:new Date(s.getFullYear(), s.getMonth(), 0), cmp:'месяцем раньше', label: MONN[s.getMonth()] + (s.getFullYear() !== now.getFullYear() ? ' ' + s.getFullYear() : '') }; }
  const s = S.keys.length ? parseKey(S.keys[0]) : now, f = d => String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getFullYear()).slice(2);
  return { s, e:now, ps:null, pe:null, cmp:'в первый месяц', label: f(s) + ' — ' + f(now) };
}
function statsOf(S, keys){
  const P = [], gs = []; keys.forEach(k => S.P(k).forEach(c => { P.push(c); if (c.guess != null) gs.push(c.guess === c.actual); }));
  const r = P.filter(c => c.low != null).map(c => c.high - c.low), st = P.filter(c => c.stab != null).map(c => c.stab);
  const ex = keys.map(k => Math.max(0, ...S.P(k).map(c => c.exhale || 0), ...Object.values(S.ex(k))));
  let range = r.length ? median(r) : null;
  if (range == null){ const m = []; keys.forEach(k => S.notes(k).forEach(n => m.push(n.midi))); if (m.length > 1) range = Math.max(...m) - Math.min(...m) || null; }
  return { days: keys.filter(S.voiced).length, mins: Math.round(keys.reduce((a, k) => a + (S.practised(k) ? S.sec(k) : 0), 0)/60), prac: keys.filter(S.practised).length,
    hits: gs.filter(Boolean).length, guessed: gs.length, range, stab: st.length ? mean(st) : null, exh: ex.length ? Math.max(0, ...ex) : 0, P };
}
/* where the voice lives over a period: time in each zone from prints and from every held note of the exercises */
function zonesOf(S, keys){
  const z = [0,0,0,0,0];
  keys.forEach(k => { S.P(k).forEach(c => (c.zones || []).forEach((v, i) => z[i] += v*16)); S.notes(k).forEach(n => z[zoneOf(pOf(n.midi, null))] += n.sec || 1); });
  const t = z.reduce((a, b) => a + b, 0); return t ? z.map(v => v/t) : null;
}
function comfortOf(S, keys){
  const m = []; keys.forEach(k => S.P(k).forEach(c => m.push(c.comfort)));
  if (m.length) return median(m);
  const e = []; keys.forEach(k => S.notes(k).slice(0, 3).forEach(n => e.push(n.midi)));
  return e.length ? median(e) : (H.sample ? null : data.profile.ref || null);
}
function profileHTML(){
  return `<section class="pr-sec pf" id="pf">
    <div class="pf-ctl"><div class="pf-seg" role="tablist" aria-label="Период">
      <button role="tab" data-pfper="w" aria-label="Неделя">Н</button><button role="tab" data-pfper="m" aria-label="Месяц">М</button><button role="tab" data-pfper="all" aria-label="Всё время">${ICO.inf}</button></div>
      <div class="pf-nav" id="pfNav"><button id="pfPrev" aria-label="Раньше">${ICO.chevL}</button><span id="pfLabel"></span><button id="pfNext" aria-label="Позже">${ICO.chev}</button></div></div>
    <div id="pfBody"></div></section>`;
}
function mountProfile(){
  const root = $('pf'); if (!root) return;
  root.querySelectorAll('[data-pfper]').forEach(b => b.onclick = () => { H.per = b.dataset.pfper; H.off = 0; renderProfile(); });
  $('pfPrev').onclick = () => { H.off--; renderProfile(); };
  $('pfNext').onclick = () => { H.off = Math.min(0, H.off + 1); renderProfile(); };
  renderProfile();
}
function renderProfile(){
  const root = $('pf'); if (!root) return;
  cancelAnimationFrame(map.raf); map.raf = 0;
  labView = H.lab;
  try { renderProfileIn(root); } finally { labView = null; }
}
function renderProfileIn(root){
  const S = src(), P = period(S), keys = S.keys.filter(k => inR(k, P.s, P.e));
  root.querySelectorAll('[data-pfper]').forEach(b => b.setAttribute('aria-selected', b.dataset.pfper === H.per));
  $('pfLabel').textContent = P.label;
  $('pfNav').classList.toggle('static', H.per === 'all');
  $('pfPrev').hidden = $('pfNext').hidden = H.per === 'all';
  $('pfNext').disabled = H.off >= 0; $('pfPrev').disabled = !S.keys.length || dkey(P.s) <= S.keys[0];
  let prevKeys = P.ps ? S.keys.filter(k => inR(k, P.ps, P.pe)) : null;
  if (H.per === 'all' && keys.length > 40){ const f = parseKey(keys[0]); prevKeys = keys.filter(k => inR(k, f, addDays(f, 30))); }
  const a = statsOf(S, keys), b = prevKeys && prevKeys.length ? statsOf(S, prevKeys) : null;
  const zones = zonesOf(S, keys), cm = comfortOf(S, keys), top = zones ? zones.indexOf(Math.max(...zones)) : null;
  const realFew = !H.sample && Object.keys(data.days).filter(k => prints(k).length).length < 3;
  const cmpTxt = (has, txt, def) => b && has ? P.cmp + ': ' + txt : def;
  const cal = H.per === 'w' ? `<div class="pf-cal w" id="pfCal"></div>`
    : `<div class="pf-maphead">${WD.map(w => `<span>${w}</span>`).join('')}</div><canvas class="pf-map" id="pfMap" role="img" aria-label="Дни кольцами: цвета — ноты дня; нажатие открывает день"></canvas>${H.per === 'all' ? `<p class="note">Каждый день — кольцо, окрашенное нотами, на которых звучал голос. Нажми на кольцо, чтобы открыть день.</p>` : ''}`;
  $('pfBody').innerHTML = `
    ${cal}
    <div class="pf-voice" id="prNoteCard">
      <div class="pf-vtop"><div class="pf-vtxt"><span class="note">Как звучит голос</span>
        ${cm != null ? `<b class="pf-note">${escH(nShort(cm))}</b><span>${OCTN[Math.floor(Math.round(cm)/12)] || ''} · ${Math.round(hz(cm))} Гц</span>${top != null ? `<span>чаще всего ${zIn(top)}</span>` : ''}`
          : `<b class="pf-note none">ещё не слышно</b><span class="note">Появится после первого отпечатка или голосового упражнения.</span>`}</div>
        <div class="mini" role="tablist" aria-label="Подписи"><button role="tab" data-lab="body" aria-selected="${labSet() === 'body'}">Тело</button><button role="tab" data-lab="chakra" aria-selected="${labSet() === 'chakra'}">Чакры</button></div></div>
      <canvas id="pfBodyCv" role="img" aria-label="Силуэт: доля времени, когда голос звучал в каждой зоне"></canvas>
      ${H.sample ? `<p class="note">Пример, не твои данные · <button class="lnk" data-pfs="0">мои данные</button></p>` : realFew ? `<p class="note"><button class="lnk" data-pfs="1">Показать пример</button>, как это выглядит через несколько месяцев.</p>` : ''}
    </div>
    <div class="pr-tiles">
      <div class="pr-tile b-breath"><span>Дней с голосом</span><b class="num">${a.days}</b><span>${cmpTxt(true, b ? b.days : '', 'отпечаток или практика')}</span></div>
      <div class="pr-tile b-body"><span>Диапазон</span>${a.range != null ? `<b class="num">${octs(a.range)}<small>окт.</small></b>` : '<b>—</b>'}<span>${cmpTxt(b && b.range != null, b && b.range != null ? octs(b.range) + ' окт.' : '', 'по сирене и упражнениям')}</span></div>
      <div class="pr-tile dark"><span>Минут практики</span><b class="num">${a.mins}</b><span>${cmpTxt(true, b ? b.mins + ' мин' : '', a.prac ? a.prac + ' ' + pl(a.prac, 'занятие', 'занятия', 'занятий') : 'пока без практики')}</span></div>
      <div class="pr-tile dark"><span>Слышишь себя</span>${a.guessed ? `<b class="num">${a.hits}<small>из ${a.guessed}</small></b>` : '<b>—</b>'}<span>${cmpTxt(b && b.guessed, b ? b.hits + ' из ' + b.guessed : '', 'догадка совпала с отпечатком')}</span></div>
      <div class="pr-tile dark"><span>Устойчивость</span>${a.stab != null ? `<b class="num">${Math.round(a.stab*100)}<small>%</small></b>` : '<b>—</b>'}<span>${cmpTxt(b && b.stab != null, b && b.stab != null ? Math.round(b.stab*100) + ' %' : '', 'насколько ровно «а»')}</span></div>
      <div class="pr-tile dark"><span>Долгий выдох</span>${a.exh ? `<b class="num">${Math.round(a.exh)}<small>с</small></b>` : '<b>—</b>'}<span>${cmpTxt(b && b.exh, b ? Math.round(b.exh) + ' с' : '', 'лучший за период')}</span></div>
    </div>
    ${a.P.length ? `<div class="pr-h"><h2>Диапазон и нота</h2></div><p class="note">Столбик — сирена от нижней ноты до верхней. Точка — комфортная нота её цветом.</p><div class="pf-fig"><canvas id="pfRange" role="img" aria-label="Диапазон по дням"></canvas><div class="pf-tip" id="pfTipR"></div></div>
    <div class="pr-h"><h2>Устойчивость</h2><span class="note">насколько ровно «а»</span></div><div class="pf-fig"><canvas id="pfStab" role="img" aria-label="Устойчивость по дням"></canvas><div class="pf-tip" id="pfTipS"></div></div>` : ''}`;
  $('pfBody').querySelectorAll('[data-lab]').forEach(x => x.onclick = () => { H.lab = x.dataset.lab; renderProfile(); });
  $('pfBody').querySelectorAll('[data-pfs]').forEach(x => x.onclick = () => { H.sample = x.dataset.pfs === '1'; H.off = 0; renderProfile(); });
  drawBodyShare($('pfBodyCv'), zones);
  if (H.per === 'w') drawCal($('pfCal'), S, P); else drawMap($('pfMap'), S, H.per === 'm' ? P : null);
  if (a.P.length){
    const D = keys.filter(k => S.P(k).length).map(k => { const L = S.P(k); return { date:k, m:L[L.length - 1] }; });
    drawRange($('pfRange'), $('pfTipR'), D);
    drawLine($('pfStab'), $('pfTipS'), D, d => d.m.stab == null ? null : d.m.stab*100, [40, 100], v => Math.round(v) + ' %');
  }
}
function drawBodyShare(cv, z){
  const w = cv.clientWidth, h = Math.round(Math.min(w*1.45, 580)), ctx = fit(cv, w, h); ctx.clearRect(0, 0, w, h);
  setBody(w, h, 1.62);
  const mx = z ? Math.max(...z) : 1;
  drawBody(ctx, body(w < 420 ? 2600 : 3400, 11), w, h, .64, z ? z.map(v => Math.pow(v/mx, .8)) : [0,0,0,0,0], C.kale, 0);
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i++){
    const y = h*bandMid(i), share = z ? Math.round(z[i]*100) : null;
    ctx.fillStyle = C.ink; ctx.globalAlpha = share ? 1 : .45; ctx.font = '700 15px "Inter Tight",sans-serif'; ctx.fillText(zName(i), 0, y - 8);
    ctx.fillStyle = C.muted; ctx.font = '500 12px "Inter Tight",sans-serif'; ctx.fillText(share != null ? share + ' %' : '—', 0, y + 9); ctx.globalAlpha = 1;
  }
}
function drawCal(el, S, P){
  if (!el) return;
  const tk = dkey(), keys = [];
  for (let d = new Date(P.s); dkey(d) <= dkey(P.e); d = addDays(d, 1)) keys.push(dkey(d));
  let h = H.per === 'w' ? '' : WD.map(w => `<span class="pf-wh">${w}</span>`).join('');
  if (H.per === 'm') for (let i = 0; i < (P.s.getDay() + 6) % 7; i++) h += '<span></span>';
  keys.forEach((k, i) => {
    const has = S.voiced(k) || S.P(k).length || S.notes(k).length, fut = k > tk;
    h += `<div class="pf-cd ${k === tk ? 't' : ''}">${has ? `<button class="pf-dc" data-pfday="${k}" aria-label="${escH(dateLong(parseKey(k)))}"><canvas data-pfk="${k}"></canvas></button>` : `<span class="pf-dc ${fut ? 'fut' : 'off'}"><i></i></span>`}<small class="num">${H.per === 'w' ? WD[i] : parseKey(k).getDate()}</small></div>`;
  });
  el.innerHTML = h;
  el.querySelectorAll('[data-pfday]').forEach(b => b.onclick = () => dayCard(b.dataset.pfday, S));
  el.querySelectorAll('canvas[data-pfk]').forEach(cv => {
    const k = cv.dataset.pfk;
    if (!H.sample){ paintDayCell(cv, k); return; }
    const s = cv.clientWidth; if (!s) return; const ctx = fit(cv, s, s), L = S.P(k), m = L[L.length - 1];
    ctx.clearRect(0, 0, s, s); V3.renderForm(ctx, s/2, s/2, s*.5, Math.round(uOfM(m.comfort)), Math.round(120 + s*5), 700 + parseInt(k.slice(8), 10), nCol(m.comfort), .55 + .45*m.stab, Math.max(.7, s/60), 0, true);
  });
}
/* the map of days (∞): one dust ring per day in a Mon–Sun grid, the rings overlap and interlock;
   a ring is split into arcs by the notes the day sounded on, coloured by note; a day without voice is a faint trace.
   The rings appear one after another, oldest first, and the dust keeps flowing around them. */
const map = { raf:0, t0:0, rings:[], cv:null, last:0, flow:0 };
function drawMap(cv, S, P){
  if (!cv) return;
  const keys = S.keys, today = new Date(), tk = dkey(today);
  if (!P && !keys.length){ fit(cv, cv.clientWidth, 40); return; }
  const from = P ? P.s : parseKey(keys[0]), to = P ? (dkey(P.e) < tk ? P.e : today) : today;
  const first = monday(from), weeks = Math.max(1, Math.round((monday(to) - first)/(7*864e5)) + 1);
  const W = cv.clientWidth, cw = W/7, rr = cw*.6, Hh = Math.round(weeks*cw + cw*.3), lo = dkey(from), hi = dkey(to);
  fit(cv, W, Hh);
  const rings = [];
  for (let w = 0; w < weeks; w++) for (let d = 0; d < 7; d++){
    const dt = addDays(first, w*7 + d), k = dkey(dt); if (k < lo || k > hi) continue;
    const notes = []; S.P(k).forEach(c => notes.push(c.comfort)); S.notes(k).slice(0, 6).forEach(n => notes.push(n.midi));
    const pcs = []; notes.forEach(m => { const p = pcOf(m); if (!pcs.includes(p)) pcs.push(p); });
    const has = S.voiced(k) || pcs.length > 0, r = FL.rng(parseInt(k.replace(/-/g, ''), 10) % 2147483647), G = [];
    for (let i = 0, n = has ? 120 : 50; i < n; i++) G.push({ s:r(), sp:.6 + r()*.8, o:FL.gs(r), z:.8 + r()*1.2, a:.45 + r()*.55 });
    rings.push({ k, num: P ? dt.getDate() : null, x:d*cw + cw/2, y:w*cw + cw/2 + cw*.15, has, cols: pcs.length ? pcs.slice(0, 6).map(p => data.profile.rain !== false ? V3.HUE[p] : C.ink) : [C.ink], G, idx:rings.length });
  }
  Object.assign(map, { rings, cv, t0:performance.now(), last:performance.now(), rr, W, Hh, hover:null, S });
  const hit = ev => { const b = cv.getBoundingClientRect(), x = ev.clientX - b.left, y = ev.clientY - b.top; let best = null, bd = 1e9; rings.forEach(R => { const q = Math.hypot(R.x - x, R.y - y); if (q < bd){ bd = q; best = R; } }); return best && bd < rr*.95 && best.has ? best : null; };
  cv.onclick = ev => { const R = hit(ev); if (R) dayCard(R.k, S); };
  cv.onpointermove = ev => { const R = hit(ev); map.hover = R ? R.k : null; cv.style.cursor = R ? 'pointer' : 'default'; };
  cv.onpointerleave = () => { map.hover = null; };
  cancelAnimationFrame(map.raf); map.raf = requestAnimationFrame(mapFrame);
}
function mapFrame(now){
  const cv = map.cv; if (!cv || !cv.isConnected){ map.raf = 0; return; }
  const dt = Math.min(.05, (now - map.last)/1000); map.last = now; map.flow += reduced() ? 0 : dt*.03;
  const ctx = cv.getContext('2d'), d = DPR(); ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, map.W, map.Hh);
  const n = map.rings.length, el = (now - map.t0)/1000, dur = Math.min(2.4, .4 + n*.02), tk = dkey();
  for (const R of map.rings){
    const appear = reduced() ? 1 : clamp((el - dur*R.idx/n)/.5, 0, 1); if (appear <= 0) continue;
    const nc = R.cols.length, on = map.hover === R.k, base = R.has ? (on ? 1.4 : 1) : .14, grow = on ? 1.08 : 1;
    for (const p of R.G){
      const u = ((p.s + map.flow*p.sp*(on ? 3 : 1)) % 1 + 1) % 1, an = -Math.PI/2 + u*Math.PI*2, rad = map.rr*grow*(1 + p.o*.035);
      ctx.fillStyle = R.cols[Math.min(nc - 1, Math.floor(p.s*nc))];
      ctx.globalAlpha = Math.min(1, p.a*base)*appear; ctx.fillRect(R.x + Math.cos(an)*rad - p.z/2, R.y + Math.sin(an)*rad - p.z/2, p.z, p.z);
    }
    if (R.num != null){ ctx.globalAlpha = appear; ctx.fillStyle = R.k === tk ? C.ink : C.muted; ctx.font = (R.k === tk ? '700 ' : '500 ') + '11px "Inter Tight",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(R.num, R.x, R.y); }
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
  map.raf = reduced() && el > dur + .6 ? 0 : requestAnimationFrame(mapFrame);
}
/* the card of a day: hers opens the app's day sheet; a day of the sample opens a sheet built from the sample */
function dayCard(k, S){
  if (!H.sample){ if (typeof openDay === 'function') openDay(k); return; }
  const P = S.P(k), last = P[P.length - 1]; if (!last) return;
  const d = parseKey(k), title = WDL[d.getDay()] + ', ' + d.getDate() + ' ' + MONG[d.getMonth()];
  openSheet(`<div class="sec-h"><h3>${escH(title)}</h3><button class="icon-btn plain" data-act="closesheet" aria-label="Закрыть">${ICO.x}</button></div>
    <div class="pf-sday"><canvas id="pfSday" aria-label="Нота дня"></canvas></div>
    <ul class="hist">${P.map(c => `<li><span>Отпечаток ${c.at}${c.ctx === 'after' ? ' · после практики' : ''}</span><span class="m"><span class="pt-dot" style="background:${nCol(c.comfort)}"></span>${escH(nName(c.comfort))} · ${zName(c.actual)}</span></li>`).join('')}
      <li><span>Практика</span><span class="m num">${Math.round(S.sec(k)/60)} мин</span></li>
      <li><span>Устойчивость «а»</span><span class="m num">${Math.round((last.stab || 0)*100)} %</span></li></ul>
    <p class="note">Пример, не твои данные.</p>`);
  const cv = $('pfSday'), sz = cv.clientWidth, ctx = fit(cv, sz, sz);
  P.forEach((c, i) => V3.renderForm(ctx, sz/2, sz/2, sz*.4, Math.round(uOfM(c.comfort)), 2200, 31 + i, nCol(c.comfort), i === P.length - 1 ? 1 : .35, Math.max(.9, sz/300), 0, true));
}
const WDL = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const MONG = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
/* charts: recessive grid, one ink series, crosshair + tooltip */
const dShort = k => { const d = parseKey(k); return d.getDate() + ' ' + MONS[d.getMonth()]; };
function chartFrame(cv, h, l){ const w = cv.clientWidth, ctx = fit(cv, w, h); ctx.clearRect(0, 0, w, h); return { ctx, w, h, l:l || 44, r:12, t:12, b:24 }; }
function xOf(F, D, i){ return F.l + (D.length === 1 ? .5 : i/(D.length - 1))*(F.w - F.l - F.r); }
function xAxis(F, D){
  const ctx = F.ctx; ctx.fillStyle = C.muted; ctx.font = '500 11px "Inter Tight",sans-serif'; ctx.textBaseline = 'alphabetic';
  const idx = D.length < 3 ? D.map((_, i) => i) : [0, Math.floor((D.length - 1)/2), D.length - 1];
  idx.forEach((i, k) => { ctx.textAlign = k === 0 && idx.length > 1 ? 'left' : k === idx.length - 1 && idx.length > 1 ? 'right' : 'center'; ctx.fillText(dShort(D[i].date), clamp(xOf(F, D, i), F.l, F.w - F.r), F.h - 6); });
  ctx.textAlign = 'left';
}
function hover(cv, tip, D, getF, html, yAt, redraw){
  const card = cv.parentElement;
  const show = ev => { const F = getF(), rc = cv.getBoundingClientRect(), x = ev.clientX - rc.left; let best = 0, bd = 1e9;
    D.forEach((_, i) => { const q = Math.abs(xOf(F, D, i) - x); if (q < bd){ bd = q; best = i; } });
    redraw(best); const tx = xOf(getF(), D, best), ty = yAt(best);
    tip.innerHTML = html(D[best]); tip.style.left = clamp(tx, 80, card.clientWidth - 80) + 'px'; tip.style.top = Math.max(8, ty - 10) + 'px'; tip.style.opacity = 1; };
  cv.onpointermove = show; cv.onpointerdown = show; cv.onpointerleave = () => { tip.style.opacity = 0; redraw(-1); };
}
function drawRange(cv, tip, D){
  const M = D.map(d => d.m), lo = Math.floor(Math.min(...M.map(m => m.low != null ? m.low : m.comfort)) - 2), hi = Math.ceil(Math.max(...M.map(m => m.high != null ? m.high : m.comfort)) + 2);
  let F; const yOf = v => F.t + (1 - (v - lo)/(hi - lo))*(F.h - F.t - F.b);
  const draw = sel => {
    F = chartFrame(cv, 210, 66); const ctx = F.ctx;
    ctx.font = '500 11px "Inter Tight",sans-serif'; ctx.textBaseline = 'middle';
    for (let v = Math.ceil(lo/12)*12; v <= hi; v += 12){ const y = yOf(v); ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(F.l, y); ctx.lineTo(F.w - F.r, y); ctx.stroke(); ctx.fillStyle = C.muted; ctx.fillText('до ' + (OCTS[v/12] || ''), 0, y); }
    const bw = Math.max(2, Math.min(10, (F.w - F.l - F.r)/D.length*.5)), dr = Math.max(2.4, Math.min(4.2, bw*.6));
    M.forEach((m, i) => { const x = xOf(F, D, i);
      if (sel === i){ ctx.strokeStyle = 'rgba(255,254,252,.25)'; ctx.beginPath(); ctx.moveTo(x, F.t); ctx.lineTo(x, F.h - F.b); ctx.stroke(); }
      if (m.low != null){ const y1 = yOf(m.high), y2 = yOf(m.low); ctx.fillStyle = sel === i ? 'rgba(244,242,236,.6)' : 'rgba(244,242,236,.28)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - bw/2, y1, bw, y2 - y1, bw/2); else ctx.rect(x - bw/2, y1, bw, y2 - y1); ctx.fill(); }
      const yc = yOf(m.comfort); ctx.fillStyle = C.ground; ctx.beginPath(); ctx.arc(x, yc, dr + 1.8, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = nCol(m.comfort); ctx.beginPath(); ctx.arc(x, yc, dr, 0, Math.PI*2); ctx.fill(); });
    xAxis(F, D);
  };
  draw(-1);
  hover(cv, tip, D, () => F, d => `<b>${dShort(d.date)}</b><br>комфортная: ${escH(nName(d.m.comfort))}<br>${d.m.low != null ? 'сирена: ' + nShort(d.m.low) + ' — ' + nShort(d.m.high) : 'без сирены'}`, i => yOf(M[i].high != null ? M[i].high : M[i].comfort), draw);
}
function drawLine(cv, tip, D, val, yr, fmt){
  let F; const vals = D.map(val), okv = vals.filter(v => v != null), lo = Math.min(yr[0], ...okv), hi = Math.max(yr[1], ...okv);
  const yOf = v => F.t + (1 - (v - lo)/(hi - lo))*(F.h - F.t - F.b);
  const draw = s => {
    F = chartFrame(cv, 150); const ctx = F.ctx;
    ctx.font = '500 11px "Inter Tight",sans-serif'; ctx.textBaseline = 'middle';
    [lo, (lo + hi)/2, hi].forEach(v => { const y = yOf(v); ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(F.l, y); ctx.lineTo(F.w - F.r, y); ctx.stroke(); ctx.fillStyle = C.muted; ctx.fillText(fmt(v), 0, y); });
    if (s >= 0){ const x = xOf(F, D, s); ctx.strokeStyle = 'rgba(255,254,252,.25)'; ctx.beginPath(); ctx.moveTo(x, F.t); ctx.lineTo(x, F.h - F.b); ctx.stroke(); }
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath(); let st = false;
    vals.forEach((v, i) => { if (v == null) return; const x = xOf(F, D, i), y = yOf(v); if (st) ctx.lineTo(x, y); else ctx.moveTo(x, y); st = true; }); ctx.stroke();
    vals.forEach((v, i) => { if (v == null || !(i === s || i === vals.length - 1 || D.length < 9)) return; const x = xOf(F, D, i), y = yOf(v);
      ctx.fillStyle = C.ground; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI*2); ctx.fill(); });
    xAxis(F, D);
  };
  draw(-1);
  hover(cv, tip, D, () => F, d => `<b>${dShort(d.date)}</b> · ${val(d) != null ? fmt(val(d)) : '—'}`, i => vals[i] != null ? yOf(vals[i]) : F.t, draw);
}

g.WT = { hasNote: k => noteKeys(k).length > 0, open, viewTrack, mountTrack, paintDay, gifLayout, gifText, LOOP, dayNotes, prints, voiced, streak, winBlock, doneNudge, dayRows, profileHTML, mountProfile, paintDayCell, setLabels, SAFE };
})(window);
