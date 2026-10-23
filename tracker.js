/* woisee · замер голоса (трекер) внутри приложения.
   Замер до занятия → упражнения → замер после. Где в теле звучит голос, комфортная нота, сирена, выдох.
   Отсюда же: карточки замера в пути дня, центр и орбита картинки дня, история замеров в профиле.
   Пользуется глобальными данными и функциями приложения (data, getDay, saveDay, dkey, ensureLive, paintAt…);
   они вызываются только из функций, поэтому файл подключается до основного скрипта. */
(function (g) {
'use strict';
const V3 = g.Voice3, FL = g.Field;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const sm = t => { t = clamp(t, 0, 1); return t*t*(3 - 2*t); };
const DPR = () => Math.min(g.devicePixelRatio || 1, 2);
const reduced = () => g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
const C = { ink:'#F4F2EC', muted:'#9AA7A3', ground:'#0E1514', rule:'rgba(255,254,252,.10)', lime:'#ECF176', kale:'#5EA879' };
function fit(cv, w, h){ const d = DPR(); const W = Math.max(1, Math.round(w*d)), H = Math.max(1, Math.round(h*d)); if (cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; } cv.style.height = h + 'px'; const ctx = cv.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0); return ctx; }
const ICO = {
  play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  pause:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8.5 5.5v13M15.5 5.5v13"/></svg>',
  stop:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="6.5" width="11" height="11" rx="2"/></svg>',
  redo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19 4.5v4h-4"/></svg>',
  next:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  chevL:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  inf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12c-2.2-2.6-3.9-4-5.6-4a4 4 0 0 0 0 8c1.7 0 3.4-1.4 5.6-4zm0 0c2.2 2.6 3.9 4 5.6 4a4 4 0 0 0 0-8c-1.7 0-3.4 1.4-5.6 4z"/></svg>'
};
const escH = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const pl = (n, a, b, c) => { const k = Math.abs(n) % 100, l = k % 10; return k > 10 && k < 20 ? c : l === 1 ? a : l > 1 && l < 5 ? b : c; };

/* ---------- notes ---------- */
const OCTN = { 1:'субконтроктавы', 2:'контроктавы', 3:'большой', 4:'малой', 5:'первой', 6:'второй', 7:'третьей' };
const pcOf = m => ((Math.round(m) % 12) + 12) % 12;
const nName = m => V3.NAMES[pcOf(m)] + ' ' + (OCTN[Math.floor(Math.round(m)/12)] || '');
const nShort = m => V3.NAMES[pcOf(m)];
const hz = m => 440*Math.pow(2, (m - 69)/12);
const nCol = m => V3.HUE[pcOf(m)];
const octs = n => (n/12).toFixed(1).replace('.', ',');
const fmtS = s => { s = Math.max(0, s); return Math.floor(s/60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
const fmt1 = v => v.toFixed(1).replace('.', ',');

/* ---------- zones: pitch (+ brightness) → place in the body ----------
   boundaries in MIDI: E2 · E3 · D4 · G4 · D5 · D6 — rough register transitions, the same for every voice */
const ZB = [40, 52, 62, 67, 74, 86];
const LABELS = {
  body:   [['Низ груди','рёбра, солнечное сплетение'], ['Грудь','грудина, ключицы'], ['Шея','гортань, переход'], ['Маска','скулы, нос, губы'], ['Голова','лоб, темя']],
  chakra: [['Манипура','солнечное сплетение'], ['Анахата','сердце'], ['Вишудха','горло'], ['Аджна','третий глаз'], ['Сахасрара','макушка']]
};
const ZIN = { body:['в низу груди','в груди','в шее','в маске','в голове'], chakra:['в манипуре','в анахате','в вишудхе','в аджне','в сахасраре'] };
const labSet = () => (typeof data !== 'undefined' && data.profile && data.profile.zoneLabels === 'chakra') ? 'chakra' : 'body';
const zName = i => LABELS[labSet()][i][0], zSub = i => LABELS[labSet()][i][1], zIn = i => ZIN[labSet()][i];
const BAND = [[.64, .90], [.415, .64], [.28, .415], [.165, .28], [.05, .165]];
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
function makeBody(n, seed){
  const r = FL.rng(seed), X = [], Y = [], S = [], A = [], Zn = [];
  while (X.length < n){ const x = (r() - .5)*.46, y = .05 + r()*.93; if (r() < shape(x, y)){ X.push(x); Y.push(y); S.push(.6 + r()*r()*1.3); A.push(r()); Zn.push(zoneOfY(y)); } }
  const byZ = [[], [], [], [], []]; Zn.forEach((z, i) => byZ[z].push(i));
  return { X, Y, S, A, byZ };
}
function drawBody(ctx, B, W, H, cxF, hl, tint, t){
  const cx = W*cxF, sh = reduced() ? 0 : 1;
  for (let z = 0; z < 5; z++){
    const h = hl[z] || 0; ctx.fillStyle = h > .04 && tint ? tint : C.ink;
    const list = B.byZ[z];
    for (let k = 0; k < list.length; k++){
      const i = list[k], a = B.A[i];
      ctx.globalAlpha = (.16 + .14*a) + h*(.3 + .45*a);
      const x = cx + (B.X[i] + sh*.0025*Math.sin(t*.9 + a*40))*H, y = (B.Y[i] + sh*.0018*Math.cos(t*.7 + a*31))*H, s = B.S[i]*(1 + .35*h);
      ctx.fillRect(x - s/2, y - s/2, s, s);
    }
  }
  ctx.globalAlpha = 1;
}

/* =========================== data =========================== */
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length/2)] : null; };
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[clamp(Math.round(q*(s.length - 1)), 0, s.length - 1)] : null; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0)/a.length : null;
const valid = c => c && !c.skip && c.comfort != null;
function checksOf(k){ const d = data.days[k]; return d && d.checks || null; }
/* the note of the day: after the exercises if there was a measurement then, otherwise before */
function mainOf(k){ const c = checksOf(k); if (!c) return null; return valid(c.after) ? c.after : valid(c.before) ? c.before : null; }
/* where the day stands on the path */
function gate(d){
  if (!d || !d.plan) return null;
  const c = d.checks || {};
  if (!c.before && !(d.done || []).length) return 'before';
  if (curOf(d)) return 'ex';
  if (!c.after) return 'after';
  return 'done';
}

/* =========================== path cards =========================== */
function pathCard(kind, d){
  const gt = gate(d), c = (d.checks || {})[kind], isCur = gt === kind;
  const idx = kind === 'before' ? '00' : '05', title = kind === 'before' ? 'Замер до' : 'Замер после';
  const sub = kind === 'before' ? 'Где сейчас звучит голос · полминуты' : 'Что изменилось после занятия · 20 секунд';
  const open = isCur || valid(c) || (c && c.skip);
  let row = '';
  if (isCur) row = `<li><button class="row cur" data-act="check" data-v="${kind}"><span class="t">${kind === 'before' ? 'Догадка, «а-а-а», сирена, выдох' : 'Догадка, «а-а-а», сирена'}</span><span class="d num">${kind === 'before' ? '0:40' : '0:25'}</span><span class="box">${ICO.play}</span></button></li>
    <li class="ck-skip"><button class="lnk" data-act="checkskip" data-v="${kind}">Пропустить замер</button></li>`;
  else if (valid(c)) row = `<li><button class="row ck-done" data-act="checkres" data-v="${kind}"><span class="t">Звучишь ${zIn(c.actual)} · ${escH(nName(c.comfort))}</span><span class="d num">${c.at || ''}</span><span class="ck-dot" style="background:${nCol(c.comfort)}"></span></button></li>`;
  else if (c && c.skip) row = `<li><div class="row dn"><span class="t">Пропущен</span><span class="d"></span><span></span></div></li>`;
  else row = `<li><div class="row lk" aria-disabled="true"><span class="t">${kind === 'before' ? 'Догадка, «а-а-а», сирена, выдох' : 'После всех упражнений'}</span><span class="d num"></span><span class="box">${typeof ICON_LOCK !== 'undefined' ? ICON_LOCK : ''}</span></div></li>`;
  return `<article class="blk b-check ${open ? '' : 'closed'}"><header><div><span class="idx">${idx}</span><h3>${title}</h3><p class="sub">${sub}</p></div><span class="cnt num">${valid(c) ? '1' : '0'}<small>/1</small></span></header>
    ${open ? `<ul>${row}</ul>` : ''}</article>`;
}

/* =========================== the measurement flow =========================== */
const STEPS = {
  pick: { title:'Где, по-твоему, звучит твой голос?', hint:'Прислушайся к себе и нажми на зону. Потом замер проверит.' },
  a:    { title:'Скажи «а-а-а», как обычно говоришь', hint:'Ровно, на удобной ноте. Таймер идёт, только пока звучит голос.', dur:5 },
  siren:{ title:'Сирена снизу вверх и обратно', hint:'От самой низкой удобной ноты до самой высокой и вниз. Без крика.', dur:11 },
  sss:  { title:'Вдохни и тяни «с-с-с»', hint:'Нажми ▶ и тяни ровно, пока хватает воздуха. Воздух закончился — нажми «Стоп».' }
};
const fl = { onClose:null, kind:'before', steps:[], step:0, guess:null, demo:false, run:false, done:{}, err:'', curZ:-1, p:.3, pShown:.3, hl:[0,0,0,0,0], formA:0, result:null, info:null, auto:0, raf:0, last:0, T:0, onDone:null, key:'' };
const acc = { a:null, s:null, x:null };
let SW = 0, SH = 0, body = null, off = null, prevZ = -2, L = null;
function resetStep(id){
  if (id === 'a') acc.a = { t:0, voicedT:0, midis:[], stabs:[], cents:[], zoneT:[0,0,0,0,0] };
  if (id === 'siren') acc.s = { t:0, midis:[], zoneT:[0,0,0,0,0] };
  if (id === 'sss') acc.x = { t:0, exh:0 };
  fl.done[id] = false;
}
function build(){
  if ($('ck')) return;
  const el = document.createElement('section');
  el.className = 'ck'; el.id = 'ck'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'ckTitle');
  el.innerHTML = `<div class="ck-in">
    <header class="ck-top"><button class="ck-rb" id="ckClose" aria-label="Закрыть замер">${ICO.x}</button><div class="ck-prog" id="ckProg"></div><span class="ck-sp"></span></header>
    <div class="ck-head"><span class="ck-kick" id="ckKick"></span><h2 id="ckTitle"></h2><p id="ckHint"></p></div>
    <div class="ck-stage" id="ckStage"><canvas id="ckCv" aria-label="Силуэт из точек: зоны, где ощущается голос"></canvas><div class="ck-zones" id="ckZones"></div>
      <div class="ck-timer" aria-live="polite"><b class="num" id="ckNum"></b><span id="ckSub"></span></div></div>
    <div class="ck-res" id="ckRes"></div>
    <footer class="ck-ctl" id="ckCtl"></footer></div>`;
  document.body.appendChild(el);
  $('ckClose').addEventListener('click', close);
  addEventListener('keydown', e => { if (e.key === 'Escape' && !el.hidden) close(); });
  addEventListener('resize', () => { if (!el.hidden) layout(); });
  off = document.createElement('canvas');
}
function buildZones(){
  const zs = $('ckZones'); if (!zs) return;
  zs.innerHTML = [4,3,2,1,0].map(z => `<button class="ck-zb" data-z="${z}" tabindex="-1"><b>${zName(z)}</b><span>${zSub(z)}</span></button>`).join('');
  zs.querySelectorAll('.ck-zb').forEach(b => b.addEventListener('click', () => {
    if (fl.steps[fl.step] !== 'pick') return;
    fl.guess = +b.dataset.z; markZones(); renderCtl();
    clearTimeout(fl.auto); fl.auto = setTimeout(() => { if (fl.steps[fl.step] === 'pick') go(fl.step + 1); }, 550);
  }));
  layout(); markZones();
}
function layout(){
  const st = $('ckStage'); if (!st) return;
  const id = fl.steps[fl.step], W = st.clientWidth || Math.min(innerWidth, 520) - 36;
  const reserve = id === 'pick' ? 300 : id === 'res' ? 480 : 330;
  const H = Math.round(clamp(innerHeight - reserve, 250, W*1.25));
  st.style.height = H + 'px';
  if (W !== SW || H !== SH || !body){ SW = W; SH = H; fit($('ckCv'), SW, SH); body = makeBody(SW < 420 ? 2300 : 3200, 7); }
  st.classList.toggle('compact', SH < 420);
  $('ckZones').querySelectorAll('.ck-zb').forEach(b => { const z = +b.dataset.z; b.style.top = (SH*(BAND[z][0] + BAND[z][1])/2) + 'px'; });
}
function markZones(){
  const id = fl.steps[fl.step];
  $('ckZones').querySelectorAll('.ck-zb').forEach(b => {
    const z = +b.dataset.z;
    b.classList.toggle('guess', fl.guess === z && (id === 'pick' || id === 'res'));
    b.classList.toggle('on', z === fl.curZ && id !== 'pick');
    b.tabIndex = id === 'pick' ? 0 : -1;
  });
}
/* kind: 'before' | 'after'; onDone(record) after «save» */
function open(kind, onDone, onClose){
  if (typeof HAS_FORM !== 'undefined' && !HAS_FORM) return;
  build();
  L = ensureLive(); L.setOpts({ rain: data.profile.rain !== false, crisp: data.profile.lace !== true, mono: '#F4F2EC' });
  L.solo.ghosts.length = 0; L.solo.exh = 0; L.mixT = 0; L.many = 0;
  Object.assign(fl, { onClose: onClose || null, kind, steps: kind === 'before' ? ['pick','a','siren','sss','res'] : ['pick','a','siren','res'], step:0, guess:null, demo:false, run:false, done:{}, err:'', result:null, curZ:-1, formA:0, info:null, onDone, key:dkey() });
  ['a','siren','sss'].forEach(resetStep);
  L.solo.target({ e:.08, hold:0, noise:0 });
  const el = $('ck'); el.hidden = false; el.scrollTop = 0; document.body.style.overflow = 'hidden';
  buildZones(); renderStep();
  cancelAnimationFrame(fl.raf); fl.last = performance.now(); fl.raf = requestAnimationFrame(frame);
}
function close(){
  if (L && L.on) L.stop();
  fl.run = false; clearTimeout(fl.auto); cancelAnimationFrame(fl.raf); fl.raf = 0;
  const el = $('ck'); if (el) el.hidden = true; document.body.style.overflow = '';
  if (fl.onClose){ const f = fl.onClose; fl.onClose = null; f(); return; }
  if (typeof render === 'function' && !(typeof ex !== 'undefined' && ex.open)) render();
}
function go(i){
  clearTimeout(fl.auto); fl.run = false;
  const id = fl.steps[i];
  if (id === 'res'){ compute(); if (L.on) L.stop(); }
  fl.step = i; fl.curZ = id === 'res' && fl.result && fl.result.comfort != null ? fl.result.actual : -1;
  if (id !== 'res') L.solo.target({ e:.08, hold:0, noise:0 });
  $('ck').scrollTop = 0; renderStep();
}
function renderStep(){
  const id = fl.steps[fl.step], n = fl.steps.length - 1;
  $('ckProg').innerHTML = fl.steps.slice(0, -1).map((s, k) => `<i class="${k < fl.step || (k === fl.step && fl.done[s]) ? 'on' : k === fl.step ? 'cur' : ''}"></i>`).join('');
  $('ckStage').classList.toggle('pick', id === 'pick');
  const head = fl.kind === 'before' ? 'Замер до' : 'Замер после';
  if (id !== 'res'){
    const S = STEPS[id];
    $('ckKick').textContent = head + ' · ' + (fl.step + 1) + ' из ' + n + (fl.demo && id !== 'pick' ? ' · демо' : '');
    $('ckTitle').textContent = S.title; $('ckHint').textContent = S.hint;
    $('ckRes').innerHTML = id === 'pick' ? `<div class="ck-c"><button class="ck-lnk" id="ckDemo">Нет микрофона? Пройти с демо-голосом</button></div>`
      : fl.err ? `<p class="ck-err">${fl.err} <button class="ck-lnk" id="ckDemo">Демо-голос</button></p>`
      : !fl.demo && !(L && L.on) ? `<div class="ck-c"><button class="ck-lnk" id="ckDemo">Нет микрофона? Демо-голос</button></div>` : '';
    const db = $('ckDemo'); if (db) db.addEventListener('click', () => { fl.demo = true; fl.err = ''; if (fl.guess == null) fl.guess = 2; go(Math.max(1, fl.step)); });
  } else renderResult();
  layout(); markZones(); renderCtl(); updateTimer();
}
function renderCtl(){
  const id = fl.steps[fl.step], c = $('ckCtl');
  if (id === 'pick'){
    const ls = labSet();
    c.innerHTML = `<div class="ck-sw" role="tablist" aria-label="Подписи зон"><button role="tab" data-lab="body" aria-selected="${ls === 'body'}">Тело</button><button role="tab" data-lab="chakra" aria-selected="${ls === 'chakra'}">Чакры</button></div>
      <button class="ck-next ${fl.guess != null ? 'go' : ''}" id="ckNext" ${fl.guess == null ? 'disabled' : ''}>Дальше ${ICO.next}</button>`;
    c.querySelectorAll('[data-lab]').forEach(x => x.addEventListener('click', () => { setLabels(x.dataset.lab); }));
  } else if (id !== 'res'){
    const done = fl.done[id];
    const mid = id === 'sss' && fl.run ? `<button class="ck-play stop" id="ckPlay" aria-label="Стоп">${ICO.stop}<span>Стоп</span></button>`
      : `<button class="ck-play ${done ? 'done' : ''}" id="ckPlay" aria-label="${done ? 'Ещё раз' : fl.run ? 'Пауза' : 'Старт'}">${done ? ICO.redo : fl.run ? ICO.pause : ICO.play}</button>`;
    c.innerHTML = `<button class="ck-rb" id="ckBack" aria-label="Назад">${ICO.back}</button>${mid}<button class="ck-next ${done ? 'go' : ''}" id="ckNext">${done ? 'Дальше' : 'Пропустить'} ${ICO.next}</button>`;
    $('ckBack').addEventListener('click', () => go(fl.step - 1));
    $('ckPlay').addEventListener('click', togglePlay);
  } else {
    const ok = fl.result && fl.result.comfort != null;
    const label = !ok ? 'Повторить «а-а-а»' : fl.kind === 'before' ? 'К упражнениям' : 'Картинка дня';
    c.innerHTML = `<button class="ck-rb" id="ckBack" aria-label="Назад">${ICO.back}</button><button class="ck-wide" id="ckSave">${label}</button>`;
    $('ckBack').addEventListener('click', () => go(fl.step - 1));
    $('ckSave').addEventListener('click', () => { if (ok) save(); else { resetStep('a'); go(1); } });
  }
  const nx = $('ckNext'); if (nx) nx.addEventListener('click', () => { if (fl.steps[fl.step] === 'pick' && fl.guess == null) return; go(fl.step + 1); });
}
async function togglePlay(){
  const id = fl.steps[fl.step];
  if (fl.done[id]){ resetStep(id); fl.run = true; renderStep(); return; }
  if (!fl.run && !fl.demo && !L.on){
    if (data.profile.micOff === true){ fl.err = 'Микрофон выключен в настройках.'; renderStep(); return; }
    try { await L.start(); data.profile.mic = data.profile.mic || 'asked'; }
    catch (e){ fl.err = 'Микрофон недоступен.'; renderStep(); return; }
  }
  if (id === 'sss' && fl.run){ finishStep(); return; }
  fl.run = !fl.run;
  if (!fl.run) L.solo.target({ e:.12, hold:0, noise:0 });
  renderCtl(); updateTimer();
}
function finishStep(){ const id = fl.steps[fl.step]; fl.run = false; fl.done[id] = true; L.solo.target({ hold:.2 }); renderCtl(); const b = $('ckProg').children[fl.step]; if (b) b.className = 'on'; updateTimer(); }

function demoInfo(id, t){
  const up = fl.kind === 'after' ? 1.6 : 0;
  if (id === 'a'){ if (t < .6) return { voiced:false, silent:true, act:false, noise:0 }; return { voiced:true, midi:55.2 + up + .18*Math.sin(t*5.5) + .06*Math.sin(t*17), stab:fl.kind === 'after' ? .9 : .78, act:true, silent:false, noise:0, cent:.2 }; }
  if (id === 'siren'){ if (t > 10.4) return { voiced:false, silent:true, act:false, noise:0 }; return { voiced:true, midi:52 - up*.6 + (25 + up*2)*Math.sin(Math.PI*Math.min(t, 10)/10), stab:.7, act:true, silent:false, noise:0, cent:.3 }; }
  if (t < .5 || t > 17.5) return { voiced:false, silent:true, act:false, noise:0 };
  return { voiced:false, act:true, silent:false, noise:.95, cent:.85 };
}
function analyse(info, dt){
  const id = fl.steps[fl.step];
  let z = -1;
  if (info.voiced && info.midi > 30){ fl.p = pOf(info.midi, info.cent); z = zoneOf(fl.p); }
  if (id === 'a'){ const a = acc.a; a.t += dt;
    if (z >= 0){ a.voicedT += dt; a.midis.push(info.midi); a.stabs.push(info.stab); a.cents.push(info.cent); a.zoneT[z] += dt; }
    if (a.voicedT >= STEPS.a.dur) finishStep();
  } else if (id === 'siren'){ const s = acc.s; s.t += dt;
    if (z >= 0){ s.midis.push(info.midi); s.zoneT[z] += dt; }
    if (s.t >= STEPS.siren.dur) finishStep();
  } else if (id === 'sss'){ const x = acc.x; x.t += dt; x.exh = x.t; }
  fl.curZ = id === 'sss' ? -1 : z >= 0 ? z : info.silent ? -1 : fl.curZ;
  fl.info = info;
}
function updateTimer(){
  const id = fl.steps[fl.step], n = $('ckNum'), s = $('ckSub'), info = fl.info;
  if (id === 'pick' || id === 'res'){ n.textContent = ''; s.textContent = ''; return; }
  if (id === 'a') n.textContent = fmtS(Math.ceil(STEPS.a.dur - acc.a.voicedT - 1e-6));
  if (id === 'siren') n.textContent = fmtS(Math.ceil(STEPS.siren.dur - acc.s.t - 1e-6));
  if (id === 'sss') n.textContent = fmt1(acc.x.exh);
  let sub;
  if (fl.done[id]) sub = id === 'sss' ? 'секунд выдоха' : 'готово';
  else if (!fl.run) sub = id === 'sss' ? 'нажми ▶ на вдохе' : 'нажми ▶ и начни';
  else if (id === 'sss') sub = 'нажми «Стоп», когда воздух закончится';
  else sub = info && info.voiced ? nName(info.midi) + ' · ' + zName(zoneOf(pOf(info.midi, info.cent))) : 'жду звук…';
  s.textContent = sub;
}
/* the siren as a short contour of notes: it makes the centre of the day picture move */
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
    contour: contour(s.midis, 32), cent: cent == null ? 0 : +cent.toFixed(3), zones: zt.map(v => +(v/tz).toFixed(3)) };
  if (fl.kind === 'before') r.exhale = +x.exh.toFixed(1);
  if (fl.demo) r.demo = true;
  r.actual = r.comfort == null ? null : zoneOf(pOf(r.comfort, r.cent));
  fl.result = r;
  if (r.comfort != null){ fl.p = pOf(r.comfort, r.cent); fl.pShown = fl.p; const m = Math.round(r.comfort); L.solo.target({ u: m - 12*(Math.floor(m/12) - 1), vo:1, noise:0, amp:.55, stab:Math.max(.7, r.stab || .7), e:1, hold:1, cent:.5 }); }
}
function guessLine(r){
  if (r.guess == null) return '';
  if (r.guess === r.actual) return 'Догадка совпала. Это редкость: изнутри голос обычно звучит иначе, чем снаружи.';
  return r.guess > r.actual ? 'Ты думала: «' + zName(r.guess) + '». Голос ниже, чем кажется: он опирается на грудь, а внимание сосредоточено выше.'
    : 'Ты думала: «' + zName(r.guess) + '». Изнутри голос кажется ниже: кости черепа добавляют низких частот. Поэтому своя запись звучит выше.';
}
const semis = c => c && c.low != null ? Math.round(c.high - c.low) : null;
function delta(v, unit){ if (v == null || !isFinite(v)) return ''; const r = Math.round(v); return r === 0 ? '<span class="ck-dl">без изменений</span>' : `<span class="ck-dl ${r > 0 ? 'up' : ''}">${r > 0 ? '+' : '−'}${Math.abs(r)}${unit}</span>`; }
function renderResult(){
  const r = fl.result, k = fl.key;
  if (!r || r.comfort == null){
    $('ckKick').textContent = (fl.kind === 'before' ? 'Замер до' : 'Замер после') + ' · итог'; $('ckTitle').textContent = 'Голос не услышан';
    $('ckHint').textContent = 'Шаг «а-а-а» пропущен или микрофон не поймал звук. Без него не найти комфортную ноту.'; $('ckRes').innerHTML = ''; return;
  }
  const s = semis(r), b = fl.kind === 'after' ? (checksOf(k) || {}).before : null, hasB = valid(b);
  $('ckKick').textContent = (fl.kind === 'before' ? 'Замер до · итог' : 'Замер после · итог') + (fl.demo ? ' · демо' : '');
  if (fl.kind === 'after' && hasB){
    const moved = r.actual - b.actual;
    $('ckTitle').innerHTML = moved === 0 ? `Голос остался <em style="color:${nCol(r.comfort)}">${zIn(r.actual)}</em>` : `Голос ${moved > 0 ? 'поднялся' : 'опустился'} <em style="color:${nCol(r.comfort)}">${zIn(r.actual)}</em>`;
    $('ckHint').textContent = guessLine(r);
    const sb = semis(b);
    $('ckRes').innerHTML = `<div class="ck-chips"><span class="ck-chip"><span class="ck-dot" style="background:${nCol(b.comfort)}"></span>${escH(nName(b.comfort))}</span><span class="ck-ar">→</span><span class="ck-chip"><span class="ck-dot" style="background:${nCol(r.comfort)}"></span>${escH(nName(r.comfort))}</span></div>
      <div class="ck-card"><div class="ck-rows">
        <div class="ck-row"><span>Зона</span><b>${zName(b.actual)} → ${zName(r.actual)}</b></div>
        <div class="ck-row"><span>Комфортная нота</span><b class="num">${Math.round(hz(b.comfort))} → ${Math.round(hz(r.comfort))} Гц ${delta(r.comfort - b.comfort, ' пт')}</b></div>
        <div class="ck-row"><span>Диапазон сирены</span><b class="num">${sb != null ? octs(sb) : '—'} → ${s != null ? octs(s) : '—'} окт. ${sb != null && s != null ? delta(s - sb, ' пт') : ''}</b></div>
        <div class="ck-row"><span>Устойчивость «а»</span><b class="num">${b.stab != null ? Math.round(b.stab*100) : '—'} → ${r.stab != null ? Math.round(r.stab*100) : '—'} % ${b.stab != null && r.stab != null ? delta((r.stab - b.stab)*100, ' п.') : ''}</b></div>
      </div></div>`;
  } else {
    $('ckTitle').innerHTML = `Ты звучишь <em style="color:${nCol(r.comfort)}">${zIn(r.actual)}</em>`;
    $('ckHint').textContent = guessLine(r);
    $('ckRes').innerHTML = `<div class="ck-chips"><span class="ck-chip">${r.at}</span><span class="ck-chip"><span class="ck-dot" style="background:${nCol(r.comfort)}"></span>${escH(nName(r.comfort))} · <span class="num">${Math.round(hz(r.comfort))} Гц</span></span></div>
      <div class="ck-card"><div class="ck-rows">
        <div class="ck-row"><span>Диапазон сирены</span><b class="num">${s != null ? octs(s) + ' окт.<small>' + escH(nName(r.low)) + ' — ' + escH(nName(r.high)) + '</small>' : '—'}</b></div>
        <div class="ck-row"><span>Устойчивость «а»</span><b class="num">${r.stab != null ? Math.round(r.stab*100) + ' %' : '—'}</b></div>
        ${fl.kind === 'before' ? `<div class="ck-row"><span>Долгий выдох</span><b class="num">${r.exhale ? Math.round(r.exhale) + ' с' : '—'}</b></div>` : ''}
      </div></div>`;
  }
}
function save(){
  const k = fl.key, d = getDay(k);
  d.checks = d.checks || {}; d.checks[fl.kind] = fl.result; saveDay(k);
  if (fl.result.comfort != null && !data.profile.ref){ data.profile.ref = Math.round(fl.result.comfort); saveProfile(); }
  const cb = fl.onDone, r = fl.result;
  if (L && L.on) L.stop();
  fl.run = false; cancelAnimationFrame(fl.raf); fl.raf = 0; $('ck').hidden = true; document.body.style.overflow = '';
  if (cb) cb(r);
}
function frame(now){
  const el = $('ck'); if (!el || el.hidden){ fl.raf = 0; return; }
  const dt = Math.min(.05, (now - fl.last)/1000); fl.last = now; fl.T += dt;
  const id = fl.steps[fl.step];
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
    updateTimer();
  }
  if (id !== 'pick') L.step(dt);
  if (fl.curZ !== prevZ){ prevZ = fl.curZ; markZones(); }
  drawStage(dt);
  fl.raf = requestAnimationFrame(frame);
}
function drawStage(dt){
  const id = fl.steps[fl.step], k = a => 1 - Math.pow(1 - a, dt*60);
  for (let z = 0; z < 5; z++){
    const tg = id === 'pick' ? (z === fl.guess ? .55 : 0) : z === fl.curZ ? 1 : 0;
    fl.hl[z] += (tg - fl.hl[z])*k(tg > fl.hl[z] ? .12 : .03);
  }
  fl.pShown += (fl.p - fl.pShown)*k(.08);
  const r = fl.result, ok = id === 'res' && r && r.comfort != null;
  const show = (['a','siren','sss'].includes(id) && (fl.run || fl.done[id])) || ok;
  fl.formA += ((show ? 1 : 0) - fl.formA)*k(.06);
  const ctx = $('ckCv').getContext('2d'), d = DPR(); ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.fillStyle = C.ground; ctx.fillRect(0, 0, SW, SH);
  const cxF = .62, tint = id === 'pick' ? C.lime : ok ? nCol(r.comfort) : fl.curZ >= 0 ? V3.toHex(L.solo.color()) : null;
  drawBody(ctx, body, SW, SH, cxF, fl.hl, tint, fl.T);
  if (ok && r.guess != null && r.guess !== r.actual){
    const yg = SH*(BAND[r.guess][0] + BAND[r.guess][1])/2, ya = SH*yOfP(fl.pShown), x = SW*cxF + SH*.25;
    ctx.strokeStyle = C.lime; ctx.globalAlpha = .75; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(x, yg); ctx.lineTo(x, ya); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(x, yg, 3.5, 0, Math.PI*2); ctx.stroke(); ctx.fillStyle = C.lime; ctx.beginPath(); ctx.arc(x, ya, 3.5, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
  }
  if (fl.formA > .01){
    const F = Math.round(Math.min(SW*.52, SH*.62)), oc = fit(off, F, F); oc.clearRect(0, 0, F, F);
    L.draw(oc, F, F, .5);
    const y = SH*(id === 'sss' ? .5 : yOfP(fl.pShown));
    ctx.globalAlpha = fl.formA; ctx.drawImage(off, SW*cxF - F/2, clamp(y - F/2, -F*.25, SH - F*.75), F, F); ctx.globalAlpha = 1;
  }
}
function setLabels(v){
  data.profile.zoneLabels = v; saveProfile();
  if ($('ck') && !$('ck').hidden){ buildZones(); renderStep(); }
}
/* a saved measurement, opened from its card in the path */
function showSaved(kind){
  const k = dkey(), c = (checksOf(k) || {})[kind]; if (!valid(c)) return;
  const b = kind === 'after' ? (checksOf(k) || {}).before : null, s = semis(c);
  openSheet(`<div class="sec-h"><h3>${kind === 'before' ? 'Замер до' : 'Замер после'} · ${c.at || ''}</h3><button class="icon-btn plain" data-act="closesheet" aria-label="Закрыть">${ICO.x}</button></div>
    <p style="font-size:22px;font-weight:700;letter-spacing:-.02em">Звучишь ${zIn(c.actual)}</p>
    <ul class="hist">
      <li><span>Догадка</span><span class="m">${c.guess == null ? '—' : c.guess === c.actual ? 'совпала' : zName(c.guess)}</span></li>
      <li><span>Комфортная нота</span><span class="m num">${escH(nName(c.comfort))} · ${Math.round(hz(c.comfort))} Гц${valid(b) ? ' (до: ' + escH(nName(b.comfort)) + ')' : ''}</span></li>
      <li><span>Диапазон сирены</span><span class="m num">${s != null ? octs(s) + ' окт.' : '—'}</span></li>
      <li><span>Устойчивость «а»</span><span class="m num">${c.stab != null ? Math.round(c.stab*100) + ' %' : '—'}</span></li>
      ${c.exhale ? `<li><span>Долгий выдох</span><span class="m num">${Math.round(c.exhale)} с</span></li>` : ''}
    </ul>
    <div class="sheet-acts"><button class="ghost wide" data-act="checkredo" data-v="${kind}">Перемерить</button></div>`);
}

/* =========================== picture of the day =========================== */
/* The day as one moving picture, period 8 s (96 frames at 12 fps):
   centre — the note of the day from the measurement; it holds, then runs along the recorded siren and comes back,
     so the centre changes symmetry and colour note by note; the «before» note stays under it as a pale ghost;
   rings of dust — the siren range before (faint) and after (bright);
   orbit — the exercises of the day, each one its own living clip (or rebuilt form), around the centre. */
const LOOP = 96;
function uAt(m, ph){
  const base = m.comfort, ct = m.contour && m.contour.length > 3 ? m.contour : null;
  if (!ct || ph < .35) return base;
  if (ph < .85){ const q = (ph - .35)/.5*(ct.length - 1), i = Math.floor(q), f = sm(q - i); return ct[i] + (ct[Math.min(ct.length - 1, i + 1)] - ct[i])*f; }
  const f = sm((ph - .85)/.15); return ct[ct.length - 1] + (base - ct[ct.length - 1])*f;
}
function noteForm(ctx, cx, cy, R, midi, N, seed, alpha, dot, rot, mono){
  const rain = data.profile.rain !== false, crisp = data.profile.lace !== true;
  const uf = uOfMidi(midi), u0 = Math.floor(uf), f = uf - u0;
  const col = u => mono || (rain ? V3.noteColor(u) : FC.dot);
  if (f < .02 || f > .98){ const u = Math.round(uf); V3.renderForm(ctx, cx, cy, R, u, N, seed, col(u), alpha, dot, rot, crisp); return; }
  V3.renderForm(ctx, cx, cy, R, u0, N, seed, col(u0), alpha*(1 - f), dot, rot, crisp);
  V3.renderForm(ctx, cx, cy, R, u0 + 1, N, seed, col(u0 + 1), alpha*f, dot, rot, crisp);
}
function dustRing(ctx, cx, cy, r, n, seed, color, alpha, ph, dot){
  const rr = FL.rng(seed); ctx.fillStyle = color;
  for (let i = 0; i < n; i++){
    const a0 = rr()*Math.PI*2, sp = .6 + rr()*.8, a = a0 + (reduced() ? 0 : Math.PI*2*ph*(i % 2 ? 1 : -1)*sp*.25), off = FL.gs(rr)*r*.03, z = (.7 + rr()*1.2)*dot;
    ctx.globalAlpha = alpha*(.45 + .55*rr());
    ctx.fillRect(cx + Math.cos(a)*(r + off) - z/2, cy + Math.sin(a)*(r + off) - z/2, z, z);
  }
  ctx.globalAlpha = 1;
}
/* returns false when the day has no measurement: the caller then paints the day as before */
function paintComp(ctx, k, clips, i, cx, cy, P, mono){
  const m = mainOf(k); if (!m) return false;
  const c = checksOf(k) || {}, ph = ((i % LOOP) + LOOP) % LOOP/LOOP, T2 = Math.PI*2;
  const dot = Math.max(.9, P/150), Rc = P*.44, Ro = P*.77, Rs = P*.19;
  /* orbit: exercises */
  const sway = reduced() ? 0 : .22*Math.sin(T2*ph), rot0 = -Math.PI/2 + sway;
  if (clips && clips.length){
    const n = clips.length;
    clips.forEach((cl, j) => { const a = rot0 + T2*j/n, fr = cl.frames[pingpong(i, cl.frames.length)]; if (fr) paintAt(ctx, [fr], .95, cx + Math.cos(a)*Ro, cy + Math.sin(a)*Ro, Rs, .55, mono); });
  } else {
    const Ls = synthLayers(k), n = Ls.length, NN = Math.max(120, Math.min(800, Math.round(Rs*Rs*.5)));
    Ls.forEach((l, j) => { const a = rot0 + T2*j/n, x = cx + Math.cos(a)*Ro, y = cy + Math.sin(a)*Ro;
      if (l.t === 'n') V3.renderForm(ctx, x, y, Rs, l.u, NN, l.seed, mono || (data.profile.rain !== false ? V3.noteColor(l.u) : FC.dot), .9, dot*.8, 0, data.profile.lace !== true);
      else V3.renderNoise(ctx, x, y, Rs, l.t === 'z' ? l.cent : .15, Math.round(NN*(l.t === 'z' ? 1 : .6)), l.seed, mono || FC.dot, l.t === 'z' ? .8 : .45, dot*.8); });
  }
  /* rings: siren range before and after */
  const ringR = cc => P*(.5 + .11*clamp(semis(cc)/36, 0, 1));
  if (valid(c.before) && semis(c.before) != null) dustRing(ctx, cx, cy, ringR(c.before), Math.round(P*2.2), 41, mono || nCol(c.before.high), valid(c.after) ? .35 : .7, ph, dot);
  if (valid(c.after) && semis(c.after) != null) dustRing(ctx, cx, cy, ringR(c.after), Math.round(P*3), 43, mono || nCol(c.after.high), .85, ph, dot);
  /* centre: the «before» ghost, then the note of the day running along its siren */
  const N = Math.round(clamp(P*P*.12, 800, 4200));
  if (valid(c.before) && valid(c.after)) noteForm(ctx, cx, cy, Rc, c.before.comfort, Math.round(N*.6), 77, .26, dot, .35, mono);
  noteForm(ctx, cx, cy, Rc, uAt(m, ph), N, 31, 1, dot, reduced() ? 0 : .12*Math.sin(T2*ph), mono);
  return true;
}

/* =========================== history (profile) =========================== */
const H = { per:'m', off:0, sel:null, sample:false };
function realDays(){ return Object.keys(data.days).sort().map(k => { const c = checksOf(k) || {}, m = mainOf(k); return m ? { date:k, m, b:valid(c.before) ? c.before : null, a:valid(c.after) ? c.after : null } : null; }).filter(Boolean); }
let SAMPLE = null;
function sampleDays(){
  if (SAMPLE) return SAMPLE;
  const r = FL.rng(2026), out = [], today = new Date(), days = 120, K = 45, norm = 1 - Math.exp(-(days - 1)/K);
  for (let d = 0; d < days; d++){
    if (r() < .14){ r(); r(); continue; }
    const t = (1 - Math.exp(-d/K))/norm, tired = r() < .07 ? 1 : 0, k = dkey(addDays(today, -(days - d)));
    const mk = (lift) => {
      const comfort = 54.2 + 1.3*t + lift + (r() - .5)*.9 - tired*1.1, low = 50.8 - 5*t - lift*.4 + (r() - .5)*1.3, high = 67.8 + 11.5*Math.pow(t, .8) + lift*1.5 + (r() - .5)*2.2 - tired*4.5;
      const stab = clamp(.55 + .27*t + lift*.05 + (r() - .5)*.08 - tired*.16, .3, .97), cent = .2 + .3*t;
      const actual = zoneOf(pOf(comfort, cent)), guess = r() < .2 + .7*t ? actual : clamp(actual + (r() < .8 ? 1 : -1), 0, 4);
      const zt = [0,0,0,0,0]; for (let q = 0; q < 40; q++) zt[zoneOf(pOf(comfort, cent))] += .1; for (let q = 0; q < 80; q++){ const m = low + (high - low)*(.5 - .5*Math.cos(Math.PI*q/79)); zt[zoneOf(pOf(m, cent))] += .1; }
      const tot = zt.reduce((a, b) => a + b, 0);
      const ct = []; for (let q = 0; q < 32; q++) ct.push(+(low + (high - low)*Math.sin(Math.PI*q/31)).toFixed(1));
      return { comfort:+comfort.toFixed(2), low:+low.toFixed(2), high:+high.toFixed(2), stab:+stab.toFixed(3), cent, actual, guess, zones:zt.map(v => v/tot), contour:ct, exhale:+(12 + 16*t + (r() - .5)*3).toFixed(1) };
    };
    const b = mk(0), a = r() < .8 ? mk(.9) : null;
    out.push({ date:k, b, a, m:a || b, sample:true });
  }
  SAMPLE = out; return out;
}
function histDays(){ return H.sample ? sampleDays() : realDays(); }
function period(D){
  const now = new Date();
  if (H.per === 'w'){ const s = addDays(mondayOf(now), 7*H.off), e = addDays(s, 6); return { s, e, ps:addDays(s, -7), pe:addDays(s, -1), cmp:'неделей раньше', label: s.getMonth() === e.getMonth() ? s.getDate() + '–' + e.getDate() + ' ' + MONS[e.getMonth()] : s.getDate() + ' ' + MONS[s.getMonth()] + ' – ' + e.getDate() + ' ' + MONS[e.getMonth()] }; }
  if (H.per === 'm'){ const s = new Date(now.getFullYear(), now.getMonth() + H.off, 1), e = new Date(s.getFullYear(), s.getMonth() + 1, 0); return { s, e, ps:new Date(s.getFullYear(), s.getMonth() - 1, 1), pe:new Date(s.getFullYear(), s.getMonth(), 0), cmp:'месяцем раньше', label: MONN[s.getMonth()] + (s.getFullYear() !== now.getFullYear() ? ' ' + s.getFullYear() : '') }; }
  const s = D.length ? parseKey(D[0].date) : now, f = d => String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getFullYear()).slice(2);
  return { s, e:now, ps:null, pe:null, cmp:'в первый месяц', label: f(s) + ' — ' + f(now) };
}
const MONS = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
const MONN = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONG = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const WDL = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
const mondayOf = dt => { const x = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; };
const dShort = k => { const d = parseKey(k); return d.getDate() + ' ' + MONS[d.getMonth()]; };
const dLong = k => { const d = parseKey(k); return WDL[d.getDay()].replace(/^./, c => c.toUpperCase()) + ', ' + d.getDate() + ' ' + MONG[d.getMonth()]; };
const inR = (k, s, e) => k >= dkey(s) && k <= dkey(e);
function stats(D){
  const r = D.filter(d => d.m.low != null).map(d => d.m.high - d.m.low), st = D.filter(d => d.m.stab != null).map(d => d.m.stab);
  const ex = D.map(d => Math.max(d.b && d.b.exhale || 0, ...Object.values((data.days[d.date] || {}).exhale || {}).concat([0])));
  const gs = []; D.forEach(d => [d.b, d.a].forEach(c => { if (c && c.guess != null) gs.push(c.guess === c.actual); }));
  return { n:D.length, hits:gs.filter(Boolean).length, guessed:gs.length, range:r.length ? median(r) : null, stab:st.length ? mean(st) : null, exh:ex.length ? Math.max(...ex) : null };
}
function historyHTML(){
  return `<section class="pr-sec" id="ckHist"><div class="pr-h"><h2>Замеры</h2><span class="note" id="ckHistNote"></span></div>
    <div class="ckh-ctl"><div class="ckh-seg" role="tablist" aria-label="Период">
      <button role="tab" data-ckper="w" aria-label="Неделя">Н</button><button role="tab" data-ckper="m" aria-label="Месяц">М</button><button role="tab" data-ckper="all" aria-label="Всё время">${ICO.inf}</button></div>
      <div class="ckh-nav" id="ckhNav"><button id="ckhPrev" aria-label="Раньше">${ICO.chevL}</button><span id="ckhLabel"></span><button id="ckhNext" aria-label="Позже">${ICO.chev}</button></div></div>
    <div id="ckhBody"></div></section>`;
}
function historyMount(){
  const root = $('ckHist'); if (!root) return;
  root.querySelectorAll('[data-ckper]').forEach(b => b.onclick = () => { H.per = b.dataset.ckper; H.off = 0; histRender(); });
  $('ckhPrev').onclick = () => { H.off--; histRender(); };
  $('ckhNext').onclick = () => { H.off = Math.min(0, H.off + 1); histRender(); };
  histRender();
}
function histRender(){
  const root = $('ckHist'); if (!root) return;
  const ALL = histDays(), P = period(ALL), D = ALL.filter(d => inR(d.date, P.s, P.e));
  root.querySelectorAll('[data-ckper]').forEach(b => b.setAttribute('aria-selected', b.dataset.ckper === H.per));
  $('ckhLabel').textContent = P.label;
  $('ckhNav').classList.toggle('static', H.per === 'all');
  $('ckhPrev').hidden = $('ckhNext').hidden = H.per === 'all';
  $('ckhNext').disabled = H.off >= 0; $('ckhPrev').disabled = !ALL.length || dkey(P.s) <= ALL[0].date;
  $('ckHistNote').innerHTML = H.sample ? '<button class="lnk" id="ckhReal">мои замеры</button>' : realDays().length < 3 ? '<button class="lnk" id="ckhSample">показать пример</button>' : '';
  const sb = $('ckhSample'); if (sb) sb.onclick = () => { H.sample = true; H.off = 0; histRender(); };
  const rb = $('ckhReal'); if (rb) rb.onclick = () => { H.sample = false; H.off = 0; histRender(); };
  let prev = P.ps ? ALL.filter(d => inR(d.date, P.ps, P.pe)) : null;
  if (H.per === 'all' && D.length > 40){ const f = parseKey(D[0].date); prev = D.filter(d => inR(d.date, f, addDays(f, 30))); }
  const body = $('ckhBody'), cal = H.per === 'all' ? '' : `<div class="ckh-cal" id="ckhCal"></div><div id="ckhDay"></div>`;
  if (!D.length){ body.innerHTML = cal + (H.per === 'all' ? `<p class="note">Замеров пока нет. Первый — в начале занятия.</p>` : ''); calRender(P, ALL); return; }
  const a = stats(D), b = prev && prev.length ? stats(prev) : null, sub = (ok, txt, def) => b && ok ? P.cmp + ': ' + txt : def;
  body.innerHTML = cal + `
    <div class="pr-tiles">
      <div class="pr-tile b-breath"><span>Слышишь себя</span><b class="num">${a.hits}<small>из ${a.guessed}</small></b><span>${sub(true, b ? b.hits + ' из ' + b.guessed : '', 'догадка совпала с замером')}</span></div>
      <div class="pr-tile b-body"><span>Диапазон</span><b class="num">${a.range != null ? octs(a.range) : '—'}<small>окт.</small></b><span>${sub(b && b.range != null, b && b.range != null ? octs(b.range) + ' окт.' : '', 'по сирене')}</span></div>
      <div class="pr-tile dark"><span>Устойчивость</span><b class="num">${a.stab != null ? Math.round(a.stab*100) : '—'}<small>%</small></b><span>${sub(b && b.stab != null, b && b.stab != null ? Math.round(b.stab*100) + ' %' : '', 'ровность «а»')}</span></div>
      <div class="pr-tile dark"><span>Долгий выдох</span><b class="num">${a.exh ? Math.round(a.exh) : '—'}<small>с</small></b><span>${sub(b && b.exh, b && b.exh ? Math.round(b.exh) + ' с' : '', 'лучший за период')}</span></div>
    </div>
    <div class="ckh-fig"><h3>Где звучит голос</h3><canvas id="ckhBodyCv" role="img" aria-label="Силуэт с долями времени по зонам"></canvas><p class="note" id="ckhBodyCap"></p></div>
    <div class="ckh-fig"><h3>Слепок голоса</h3><p class="note">Все замеры периода, наложенные друг на друга. Узор — комфортная нота, кольца — диапазон.</p><canvas id="ckhCast" role="img" aria-label="Слепок голоса"></canvas><p class="note" id="ckhCastCap"></p></div>
    <div class="ckh-fig"><h3>Диапазон и комфортная нота</h3><p class="note">Столбик — сирена от нижней ноты до верхней. Точка — комфортная нота её цветом.</p><canvas id="ckhRange" role="img" aria-label="Диапазон по дням"></canvas><div class="ckh-tip" id="ckhTipR"></div></div>
    <div class="ckh-fig"><h3>Устойчивость</h3><canvas id="ckhStab" role="img" aria-label="Устойчивость по дням"></canvas><div class="ckh-tip" id="ckhTipS"></div></div>`;
  calRender(P, ALL);
  const share = drawBodyShare($('ckhBodyCv'), D), top = share.indexOf(Math.max(...share)), aa = [0,0,0,0,0]; D.forEach(d => aa[d.m.actual]++);
  $('ckhBodyCap').textContent = 'Больше всего времени голос проводит ' + zIn(top) + ', комфортная нота чаще всего ' + zIn(aa.indexOf(Math.max(...aa))) + '.';
  drawCast($('ckhCast'), D.map(d => d.m));
  const nn = {}; D.forEach(d => { const q = nShort(d.m.comfort); nn[q] = (nn[q] || 0) + 1; }); const tops = Object.entries(nn).sort((x, y) => y[1] - x[1]);
  $('ckhCastCap').textContent = D.length < 5 ? 'Слепок проявляется со временем: пока ' + D.length + ' ' + pl(D.length, 'замер', 'замера', 'замеров') + '.' : 'Чаще всего голос живёт на «' + tops[0][0] + '»' + (tops[1] ? ', иногда уходит на «' + tops[1][0] + '»' : '') + '.';
  drawRange($('ckhRange'), $('ckhTipR'), D);
  drawLine($('ckhStab'), $('ckhTipS'), D, d => d.m.stab == null ? null : d.m.stab*100, [40, 100], v => Math.round(v) + ' %');
}
function calRender(P, ALL){
  const el = $('ckhCal'); if (!el) return;
  const by = new Map(ALL.map(d => [d.date, d])), tk = dkey(), keys = [];
  for (let d = new Date(P.s); dkey(d) <= dkey(P.e); d = addDays(d, 1)) keys.push(dkey(d));
  const withData = keys.filter(k => by.get(k));
  if (!H.sel || !keys.includes(H.sel) || !by.get(H.sel)) H.sel = withData.length ? withData[withData.length - 1] : null;
  let html = ['П','В','С','Ч','П','С','В'].map(w => `<span class="ckh-wh">${w}</span>`).join('');
  for (let i = 0; i < (P.s.getDay() + 6) % 7; i++) html += '<span></span>';
  keys.forEach(k => { const d = by.get(k), fut = k > tk, prac = !d && typeof ok === 'function' && ok(k);
    html += `<div class="ckh-cd ${k === H.sel ? 'sel' : ''}" data-k="${k}"><button class="ckh-dc ${d ? '' : fut ? 'fut' : prac ? 'prac' : 'miss'}" data-k="${k}" ${d ? '' : 'disabled'} aria-label="${dLong(k)}">${d ? '<canvas></canvas>' : ''}</button><small class="num">${parseKey(k).getDate()}</small></div>`; });
  el.innerHTML = html;
  const uOf = refU(ALL.map(d => d.m));
  el.querySelectorAll('.ckh-dc').forEach((b, i) => { const d = by.get(b.dataset.k), cv = b.querySelector('canvas'); if (cv) miniForm(cv, d.m, b.clientWidth || 40, uOf, 900 + i);
    b.onclick = () => { H.sel = b.dataset.k; el.querySelectorAll('.ckh-cd').forEach(c => c.classList.toggle('sel', c.dataset.k === H.sel)); dayCard(by, uOf); }; });
  dayCard(by, uOf);
}
function dayCard(by, uOf){
  const el = $('ckhDay'); if (!el) return;
  const d = H.sel && by.get(H.sel);
  if (!d){ el.innerHTML = `<p class="note" style="margin-top:10px">За этот период замеров нет.</p>`; return; }
  const m = d.m, s = semis(m), b = d.b, a = d.a;
  const row = (l, v) => `<li><span>${l}</span><span class="m num">${v}</span></li>`;
  el.innerHTML = `<div class="ckh-day"><div class="ckh-dtop"><div><span class="note">${dLong(d.date)}</span><b>Звучишь ${zIn(m.actual)}</b><span class="note">${a && b ? (a.actual === b.actual ? 'до и после занятия' : 'до занятия — ' + zIn(b.actual)) : a ? 'после занятия' : 'до занятия'}</span></div><div class="ckh-df"><canvas></canvas></div></div>
    <ul class="hist">
      ${row('Комфортная нота', `<span class="ck-dot" style="background:${nCol(m.comfort)}"></span>${escH(nName(m.comfort))}${a && b ? ' <span class="note">(до: ' + escH(nShort(b.comfort)) + ')</span>' : ''}`)}
      ${row('Диапазон сирены', s != null ? octs(s) + ' окт.' + (a && b && semis(b) != null ? ' <span class="note">(до: ' + octs(semis(b)) + ')</span>' : '') : '—')}
      ${row('Устойчивость «а»', m.stab != null ? Math.round(m.stab*100) + ' %' : '—')}
      ${row('Догадка', [b, a].filter(Boolean).map(c => c.guess == null ? '—' : c.guess === c.actual ? 'совпала' : zName(c.guess)).join(' / '))}
    </ul>${d.sample ? '<p class="note">Пример, не твои данные</p>' : `<button class="ghost" data-act="day" data-v="${d.date}">Картинка дня</button>`}</div>`;
  miniForm(el.querySelector('canvas'), m, 88, uOf, 42);
}
const refU = D => { const c = median(D.map(d => d.comfort)) || 55; return m => clamp(Math.round(m) - 12*(Math.floor(c/12) - 1), 0, 47); };
function miniForm(cv, d, s, uOf, seed){
  const ctx = fit(cv, s, s); ctx.clearRect(0, 0, s, s);
  V3.renderForm(ctx, s/2, s/2, s*.5, uOf(d.comfort), Math.round(120 + s*5), seed || 700, data.profile.rain !== false ? nCol(d.comfort) : FC.dot, .55 + .45*(d.stab || .5), Math.max(.7, s/60), 0, data.profile.lace !== true);
}
/* charts: recessive grid, one ink series, crosshair + tooltip */
function chartFrame(cv, h, l){ const w = cv.clientWidth, ctx = fit(cv, w, h); ctx.fillStyle = C.ground; ctx.fillRect(0, 0, w, h); return { ctx, w, h, l:l || 44, r:12, t:12, b:24 }; }
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
    D.forEach((_, i) => { const dx = Math.abs(xOf(F, D, i) - x); if (dx < bd){ bd = dx; best = i; } });
    redraw(best); const tx = xOf(getF(), D, best), ty = yAt(best);
    tip.innerHTML = html(D[best]); tip.style.left = clamp(cv.offsetLeft + tx, 80, card.clientWidth - 80) + 'px'; tip.style.top = (cv.offsetTop + Math.max(8, ty - 10)) + 'px'; tip.style.opacity = 1; };
  cv.onpointermove = show; cv.onpointerdown = show; cv.onpointerleave = () => { tip.style.opacity = 0; redraw(-1); };
}
function drawRange(cv, tip, D){
  const M = D.map(d => d.m), lo = Math.floor(Math.min(...M.map(m => m.low != null ? m.low : m.comfort)) - 2), hi = Math.ceil(Math.max(...M.map(m => m.high != null ? m.high : m.comfort)) + 2);
  let F; const yOf = v => F.t + (1 - (v - lo)/(hi - lo))*(F.h - F.t - F.b);
  const draw = sel => {
    F = chartFrame(cv, 220, 70); const ctx = F.ctx;
    ctx.font = '500 11px "Inter Tight",sans-serif'; ctx.textBaseline = 'middle';
    for (let v = Math.ceil(lo/12)*12; v <= hi; v += 12){ const y = yOf(v); ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(F.l, y); ctx.lineTo(F.w - F.r, y); ctx.stroke(); ctx.fillStyle = C.muted; ctx.fillText('до ' + (OCTN[v/12] || ''), 6, y); }
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
    [lo, (lo + hi)/2, hi].forEach(v => { const y = yOf(v); ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(F.l, y); ctx.lineTo(F.w - F.r, y); ctx.stroke(); ctx.fillStyle = C.muted; ctx.fillText(fmt(v), 6, y); });
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
function drawCast(cv, M){
  const s = cv.clientWidth, ctx = fit(cv, s, s), cx = s/2, cy = s/2, uOf = refU(M), R = s*.36;
  ctx.fillStyle = C.ground; ctx.fillRect(0, 0, s, s);
  const r = FL.rng(5), n = M.length, per = n > 60 ? 30 : 70, fN = Math.round((500 + s*1.2)*clamp(36/Math.max(1, n), .3, 1));
  M.forEach((m, i) => { if (m.low == null) return; const rad = s*(.3 + clamp((m.high - m.low)/34, 0, 1)*.18);
    ctx.fillStyle = nCol(m.high); ctx.globalAlpha = .16 + .3*(i/(n - 1 || 1));
    for (let q = 0; q < per; q++){ const a = r()*Math.PI*2, rr = rad*(1 + (r() - .5)*.05); ctx.fillRect(cx + Math.cos(a)*rr - .6, cy + Math.sin(a)*rr - .6, 1.2, 1.2); }
    ctx.globalAlpha = 1; });
  M.forEach((m, i) => V3.renderForm(ctx, cx, cy, R, uOf(m.comfort), fN, 300 + i, nCol(m.comfort), (.1 + .45*(m.stab || .5))*clamp(32/Math.max(1, n), .42, 1), Math.max(.7, s/560), i*.015, true));
}
function drawBodyShare(cv, D){
  const w = cv.clientWidth, h = Math.round(Math.min(w*1.2, 540)), ctx = fit(cv, w, h);
  const z = [0,0,0,0,0]; D.forEach(d => (d.m.zones || []).forEach((v, i) => z[i] += v));
  const tot = z.reduce((a, b) => a + b, 0) || 1, mx = Math.max(...z) || 1, B = makeBody(w < 420 ? 2000 : 2800, 11);
  ctx.fillStyle = C.ground; ctx.fillRect(0, 0, w, h);
  drawBody(ctx, B, w, h, .64, z.map(v => Math.pow(v/mx, .8)), C.kale, 0);
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i++){ const y = h*(BAND[i][0] + BAND[i][1])/2, share = Math.round(z[i]/tot*100);
    ctx.fillStyle = C.ink; ctx.globalAlpha = share > 0 ? 1 : .45; ctx.font = '700 15px "Inter Tight",sans-serif'; ctx.fillText(zName(i), 14, y - 8);
    ctx.fillStyle = C.muted; ctx.font = '500 12px "Inter Tight",sans-serif'; ctx.fillText(share + ' %', 14, y + 9); ctx.globalAlpha = 1; }
  return z.map(v => v/tot);
}
/* a measurement line for the day sheet */
function dayRows(k){
  const c = checksOf(k) || {}; if (!valid(c.before) && !valid(c.after)) return '';
  const r = (l, cc) => valid(cc) ? `<li><span>${l}</span><span class="m">${zName(cc.actual)} · ${escH(nName(cc.comfort))}</span></li>` : '';
  return r('Замер до', c.before) + r('Замер после', c.after);
}

g.WT = { gate, pathCard, open, showSaved, paintComp, historyHTML, historyMount, dayRows, mainOf, LOOP, setLabels, valid };
})(window);
