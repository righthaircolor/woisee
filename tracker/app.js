/* woisee · трекер голоса — интерфейс: сегодня, замер по экранам, месяц, данные. */
(function(){
'use strict';
const T = window.TR, V3 = window.Voice3;
const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const { clamp } = T;
const I = {
  plus:'<svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  play:'<svg class="i" viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/></svg>',
  stop:'<svg class="i" viewBox="0 0 24 24"><rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none"/></svg>',
  pause:'<svg class="i" viewBox="0 0 24 24"><path d="M8.5 5.5v13M15.5 5.5v13"/></svg>',
  redo:'<svg class="i" viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19 4.5v4h-4"/></svg>',
  next:'<svg class="i" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  back:'<svg class="i" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  clock:'<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  bolt:'<svg class="i" viewBox="0 0 24 24"><path d="M13 3L5 14h6l-1 7 8-11h-6z"/></svg>'
};

/* =========================== data =========================== */
const SIM = T.simHistory(150);
let hist = true; try { hist = localStorage.getItem('woisee-tracker-hist') !== 'off'; } catch (e) {}
let DATA = [], byDate = new Map(), uOf = T.refU([{ comfort:55 }]);
function refresh(){
  const mine = T.loadMine(), md = new Set(mine.map(d => d.date));
  DATA = (hist ? SIM.filter(d => !md.has(d.date)) : []).concat(mine).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  byDate = new Map(DATA.map(d => [d.date, d]));
  uOf = T.refU(DATA.length ? DATA : [{ comfort:55 }]);
}
refresh();
const todayKey = () => T.dkey(new Date());
const fmtS = s => { s = Math.max(0, s); const m = Math.floor(s/60), r = Math.floor(s % 60); return m + ':' + String(r).padStart(2, '0'); };
const fmt1 = v => v.toFixed(1).replace('.', ',');
const semis = d => d.low != null ? Math.round(d.high - d.low) : null;
const octs = n => (n/12).toFixed(1).replace('.', ',');

/* =========================== tabs =========================== */
let tab = 'today';
function setTab(t){
  tab = t;
  $$('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  $('#vToday').hidden = t !== 'today'; $('#vData').hidden = t !== 'data';
  scrollTo(0, 0);
  if (t === 'today') renderToday(); else renderData();
}
$$('[data-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

/* =========================== СЕГОДНЯ =========================== */
const homeSolo = new V3.Solo(1500, 9);
homeSolo.opt.rain = false; homeSolo.opt.mono = '#F4F2EC'; homeSolo.opt.orbit = true;
homeSolo.target({ u:19, e:.35, vo:1, noise:0, stab:.45, hold:.3, amp:.32 });
let todayCache = null;
function renderToday(){
  const now = new Date(), tk = todayKey(), mon = T.monday(now), h = now.getHours();
  $('#greet').textContent = 'Как ты звучишь ' + (h < 5 ? 'этой ночью' : h < 12 ? 'этим утром' : h < 18 ? 'этим днём' : 'этим вечером') + '?';
  const days = [];
  for (let i = 0; i < 7; i++){ const k = T.dkey(T.addDays(mon, i)); days.push(k); }
  $('#week').innerHTML = days.map((k, i) => {
    const d = byDate.get(k), fut = k > tk, isT = k === tk;
    const cls = d ? '' : fut ? 'fut' : isT ? 'today' : 'miss';
    return `<div class="wd ${fut ? 'fut' : ''}"><span>${'ПВСЧПСВ'[i]}</span><button class="dc ${cls}" data-k="${k}" ${fut ? 'disabled' : ''} aria-label="${T.dLong(k)}${d ? ', ' + T.zName(d.actual) : ''}">${d ? '<canvas></canvas>' : isT ? I.plus : ''}</button></div>`;
  }).join('');
  $$('#week .dc').forEach(b => {
    const d = byDate.get(b.dataset.k), cv = b.querySelector('canvas');
    if (cv) T.miniForm(cv, d, b.clientWidth || 44, uOf, 700 + days.indexOf(b.dataset.k));
    b.addEventListener('click', () => { if (byDate.get(b.dataset.k)){ selDay = b.dataset.k; setPer('w'); setTab('data'); } else if (b.dataset.k === tk) openFlow(); });
  });
  const td = byDate.get(tk);
  todayCache = null;
  if (td){
    $('#ringCenter').innerHTML = '';
    $('#todayTxt').innerHTML = `<b>Сегодня ты звучишь ${T.zIn(td.actual)}</b><span class="chip"><span class="dot" style="background:${T.noteCol(td.comfort)}"></span>${T.noteName(td.comfort)}${td.time ? ' · ' + td.time : ''}</span><button class="next" id="again">${I.redo} Повторить замер</button>`;
    $('#again').addEventListener('click', openFlow);
  } else {
    $('#ringCenter').innerHTML = `<button class="plus" id="startBtn" aria-label="Начать замер">${I.plus}</button><span class="lbl">Замер</span>`;
    $('#startBtn').addEventListener('click', openFlow);
    $('#todayTxt').innerHTML = '';
  }
  const st = streak();
  $('#streak').innerHTML = st ? `${I.bolt}<b class="num">${st}</b><span class="m">${T.plural(st, 'день', 'дня', 'дней')} подряд</span>` : `${I.bolt}<span class="m">первый замер — сегодня</span>`;
  $('#histBtn').innerHTML = `Тестовая история: <b>${hist ? 'включена' : 'выключена'}</b>`;
}
function streak(){
  let k = new Date(), n = 0;
  if (!byDate.get(T.dkey(k))) k = T.addDays(k, -1);
  while (byDate.get(T.dkey(k))){ n++; k = T.addDays(k, -1); }
  return n;
}
$('#histBtn').addEventListener('click', () => { hist = !hist; try { localStorage.setItem('woisee-tracker-hist', hist ? 'on' : 'off'); } catch (e) {} refresh(); renderToday(); });
function weekProgress(){ const mon = T.monday(new Date()); let n = 0; for (let i = 0; i < 7; i++) if (byDate.get(T.dkey(T.addDays(mon, i)))) n++; return n/7; }
function drawRing(dt){
  const cv = $('#ringCv'), s = cv.clientWidth; if (!s) return;
  const ctx = T.fit(cv, s, s); ctx.clearRect(0, 0, s, s);
  const c = s/2, R = s*.44, lw = s*.07;
  ctx.lineCap = 'round'; ctx.lineWidth = lw;
  ctx.strokeStyle = 'rgba(255,254,252,.06)'; ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI*2); ctx.stroke();
  const wp = weekProgress();
  if (wp > 0){ const gr = ctx.createLinearGradient(0, 0, s, s); gr.addColorStop(0, 'rgba(244,242,236,.42)'); gr.addColorStop(1, 'rgba(244,242,236,.16)'); ctx.strokeStyle = gr; ctx.beginPath(); ctx.arc(c, c, R, -Math.PI/2, -Math.PI/2 + Math.PI*2*wp*.999); ctx.stroke(); }
  const td = byDate.get(todayKey());
  if (td){
    if (!todayCache){ todayCache = document.createElement('canvas'); const ic = T.fit(todayCache, s, s); V3.renderForm(ic, c, c, R*.78, uOf(td.comfort), Math.round(900 + s*4), 31, T.noteCol(td.comfort), .95, Math.max(.8, s/320), 0, true); }
    ctx.drawImage(todayCache, 0, 0, s, s);
  } else {
    homeSolo.ease(dt); homeSolo.step(dt);
    ctx.save(); ctx.beginPath(); ctx.arc(c, c, R - lw/2 - 2, 0, Math.PI*2); ctx.clip(); homeSolo.draw(ctx, s, s, .4, .5); ctx.restore();
  }
}

/* =========================== календарь периода (внутри «Данных») =========================== */
let selDay = null;
function renderCal(P){
  const el = $('#cal'); if (!el) return;
  const tk = todayKey(), keys = [];
  for (let d = new Date(P.s); T.dkey(d) <= T.dkey(P.e); d = T.addDays(d, 1)) keys.push(T.dkey(d));
  const withData = keys.filter(k => byDate.get(k));
  if (!selDay || !keys.includes(selDay) || !byDate.get(selDay)) selDay = withData.length ? withData[withData.length - 1] : null;
  const lead = (P.s.getDay() + 6) % 7;
  let html = ['П','В','С','Ч','П','С','В'].map(w => `<span class="wh">${w}</span>`).join('');
  for (let i = 0; i < lead; i++) html += '<span></span>';
  keys.forEach(k => {
    const d = byDate.get(k), fut = k > tk, isT = k === tk;
    const cls = d ? '' : fut ? 'fut' : isT ? 'today' : 'miss';
    html += `<div class="cd ${k === selDay ? 'sel' : ''}" data-k="${k}"><button class="dc ${cls}" data-k="${k}" ${d || isT ? '' : 'disabled'} aria-label="${T.dLong(k)}">${d ? '<canvas></canvas>' : isT ? I.plus : ''}</button><small class="num">${T.kdate(k).getDate()}</small></div>`;
  });
  el.innerHTML = html;
  $$('#cal .dc').forEach((b, i) => {
    const d = byDate.get(b.dataset.k), cv = b.querySelector('canvas');
    if (cv) T.miniForm(cv, d, b.clientWidth || 44, uOf, 900 + i);
    b.addEventListener('click', () => {
      if (!byDate.get(b.dataset.k)){ openFlow(); return; }
      selDay = b.dataset.k; $$('#cal .cd').forEach(c => c.classList.toggle('sel', c.dataset.k === selDay)); renderDayCard();
    });
  });
  renderDayCard();
}
function renderDayCard(){
  const el = $('#dayCard'), d = selDay && byDate.get(selDay);
  if (!el) return;
  if (!d){ el.innerHTML = `<div class="card"><div class="empty">За этот период замеров нет. Нажми на сегодняшний день, чтобы сделать замер.</div></div>`; return; }
  const s = semis(d), ok = d.guess === d.actual;
  el.innerHTML = `<div class="card">
    <div class="daytop"><div><div class="k">${T.dLong(d.date)}${d.time ? ' · ' + d.time : ''}</div><h2 style="margin-top:6px">Звучишь ${T.zIn(d.actual)}</h2><div class="sub">${d.guess == null ? '' : ok ? 'Догадка совпала' : 'Догадка: ' + T.zName(d.guess)}</div></div><div class="dayform"><canvas></canvas></div></div>
    <div class="rows">
      <div class="row"><span>Комфортная нота</span><b><span class="dot" style="background:${T.noteCol(d.comfort)}"></span>${T.noteName(d.comfort)} · <span class="num">${Math.round(T.hz(d.comfort))} Гц</span></b></div>
      <div class="row"><span>Диапазон сирены</span><b class="num">${s != null ? octs(s) + ' окт.<br><span style="color:var(--muted);font-weight:500;font-size:13px">' + T.noteName(d.low) + ' — ' + T.noteName(d.high) + '</span>' : '—'}</b></div>
      <div class="row"><span>Устойчивость «а»</span><b class="num">${d.stab != null ? Math.round(d.stab*100) + ' %' : '—'}</b></div>
      <div class="row"><span>Долгий выдох</span><b class="num">${d.exhale ? Math.round(d.exhale) + ' с' : '—'}</b></div>
    </div>${d.sim ? '<p class="sub" style="margin-top:10px">Тестовые данные</p>' : ''}</div>`;
  const cv = el.querySelector('canvas'); T.miniForm(cv, d, 96, uOf, 42);
}

/* =========================== ДАННЫЕ =========================== */
let per = 'm', pOff = 0;
function setPer(v){ per = v; pOff = 0; $$('[data-per]').forEach(x => x.setAttribute('aria-selected', x.dataset.per === v));
  if (selDay && v !== 'all'){ const now = new Date(), d = T.kdate(selDay); pOff = v === 'w' ? Math.round((T.monday(d) - T.monday(now))/(7*864e5)) : (d.getFullYear() - now.getFullYear())*12 + d.getMonth() - now.getMonth(); } }
$$('[data-per]').forEach(b => b.addEventListener('click', () => { setPer(b.dataset.per); renderData(); }));
$('#pPrev').addEventListener('click', () => { pOff--; renderData(); });
$('#pNext').addEventListener('click', () => { pOff = Math.min(0, pOff + 1); renderData(); });
function period(){
  const now = new Date();
  if (per === 'w'){ const s = T.addDays(T.monday(now), 7*pOff), e = T.addDays(s, 6); return { s, e, ps:T.addDays(s, -7), pe:T.addDays(s, -1), cmp:'неделей раньше', label: s.getMonth() === e.getMonth() ? s.getDate() + '–' + e.getDate() + ' ' + T.MON[e.getMonth()] : s.getDate() + ' ' + T.MON[s.getMonth()] + ' – ' + e.getDate() + ' ' + T.MON[e.getMonth()] }; }
  if (per === 'm'){ const s = new Date(now.getFullYear(), now.getMonth() + pOff, 1), e = new Date(s.getFullYear(), s.getMonth() + 1, 0); return { s, e, ps:new Date(s.getFullYear(), s.getMonth() - 1, 1), pe:new Date(s.getFullYear(), s.getMonth(), 0), cmp:'месяцем раньше', label: T.MONN[s.getMonth()] + (s.getFullYear() !== now.getFullYear() ? ' ' + s.getFullYear() : '') }; }
  const s = DATA.length ? T.kdate(DATA[0].date) : now, f = d => String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
  return { s, e:now, ps:null, pe:null, cmp:'в первый месяц', label: f(s) + ' — ' + f(now) };
}
const inR = (k, s, e) => k >= T.dkey(s) && k <= T.dkey(e);
function stats(D){
  const r = D.filter(d => d.low != null).map(d => d.high - d.low), st = D.filter(d => d.stab != null).map(d => d.stab), ex = D.map(d => d.exhale || 0);
  return { n:D.length, hits:D.filter(d => d.guess != null && d.guess === d.actual).length, guessed:D.filter(d => d.guess != null).length, range:r.length ? T.median(r) : null, stab:st.length ? T.mean(st) : null, exh:ex.length ? Math.max(...ex) : null };
}
function renderData(){
  const P = period(), D = DATA.filter(d => inR(d.date, P.s, P.e));
  let prev = P.ps ? DATA.filter(d => inR(d.date, P.ps, P.pe)) : null;
  if (per === 'all' && D.length > 40){ const f = T.kdate(D[0].date); prev = D.filter(d => inR(d.date, f, T.addDays(f, 30))); }
  $('#pLabel').textContent = P.label;
  $('#pNav').classList.toggle('static', per === 'all');
  $('#pPrev').hidden = $('#pNext').hidden = per === 'all';
  $('#pNext').disabled = pOff >= 0;
  $('#pPrev').disabled = !DATA.length || T.dkey(P.s) <= DATA[0].date;
  const body = $('#dataBody'), calHTML = per === 'all' ? '' : `<div class="cal" id="cal"></div><div id="dayCard"></div>`;
  if (!D.length){ body.innerHTML = calHTML + (per === 'all' ? `<div class="card" style="margin-top:14px"><div class="empty">Замеров пока нет.</div></div>` : '') + how(); renderCal(P); return; }
  const a = stats(D), b = prev && prev.length ? stats(prev) : null;
  const sub = (v, f) => b && v != null ? P.cmp + ': ' + f : '';
  body.innerHTML = calHTML + `
    <div class="tiles">
      <div class="tile"><div class="l">Слышишь себя</div><div class="v num">${a.hits}<small> из ${a.guessed}</small></div><div class="s">${b ? P.cmp + ': ' + b.hits + ' из ' + b.guessed : 'догадка совпала с замером'}</div></div>
      <div class="tile"><div class="l">Диапазон</div><div class="v num">${a.range != null ? octs(a.range) : '—'}<small> окт.</small></div><div class="s">${sub(b && b.range, b && b.range != null ? octs(b.range) + ' окт.' : '') || 'по сирене'}</div></div>
      <div class="tile"><div class="l">Устойчивость</div><div class="v num">${a.stab != null ? Math.round(a.stab*100) : '—'}<small> %</small></div><div class="s">${sub(b && b.stab, b && b.stab != null ? Math.round(b.stab*100) + ' %' : '') || 'ровность «а»'}</div></div>
      <div class="tile"><div class="l">Долгий выдох</div><div class="v num">${a.exh != null ? Math.round(a.exh) : '—'}<small> с</small></div><div class="s">${sub(b && b.exh, b && b.exh != null ? Math.round(b.exh) + ' с' : '') || 'лучший за период'}</div></div>
    </div>
    <figure class="card" style="margin:12px 0 0"><h2>Где звучит голос</h2><p class="sub">Доля времени в каждой зоне во время замеров.</p>
      <div class="mini" role="tablist" aria-label="Подписи"><button role="tab" data-lab="body" aria-selected="${T.lab.set === 'body'}">Тело</button><button role="tab" data-lab="chakra" aria-selected="${T.lab.set === 'chakra'}">Чакры</button></div>
      <canvas id="dBody" role="img" aria-label="Силуэт с долями времени по зонам"></canvas><figcaption id="dBodyCap"></figcaption></figure>
    <figure class="card" style="margin:12px 0 0"><h2>Слепок голоса</h2><p class="sub">Все замеры периода, наложенные друг на друга. Узор — комфортная нота, кольца — диапазон.</p><canvas id="dCast" role="img" aria-label="Слепок голоса"></canvas><figcaption id="dCastCap"></figcaption></figure>
    <figure class="card" style="margin:12px 0 0"><h2>Диапазон и комфортная нота</h2><p class="sub">Столбик — сирена от нижней ноты до верхней. Точка — комфортная нота её цветом.</p><canvas id="dRange" role="img" aria-label="Диапазон по дням"></canvas><div class="tip" id="tR"></div></figure>
    <figure class="card" style="margin:12px 0 0"><h2>Устойчивость</h2><p class="sub">Насколько ровно держится «а», в процентах.</p><canvas id="dStab" role="img" aria-label="Устойчивость по дням"></canvas><div class="tip" id="tS"></div></figure>
    <figure class="card" style="margin:12px 0 0"><h2>Долгий выдох</h2><p class="sub">Секунды на «с-с-с». Пунктир — цель 30 секунд.</p><canvas id="dExh" role="img" aria-label="Выдох по дням"></canvas><div class="tip" id="tE"></div></figure>` + how();
  body.querySelectorAll('[data-lab]').forEach(x => x.addEventListener('click', () => setLab(x.dataset.lab)));
  if (per !== 'all') renderCal(P);
  const share = T.drawBodyShare($('#dBody'), D), top = share.indexOf(Math.max(...share));
  const ga = [0,0,0,0,0], aa = [0,0,0,0,0]; D.forEach(d => { if (d.guess != null) ga[d.guess]++; aa[d.actual]++; });
  const gi = ga.indexOf(Math.max(...ga)), ai = aa.indexOf(Math.max(...aa));
  $('#dBodyCap').textContent = 'Больше всего времени голос проводит ' + T.zIn(top) + '. Комфортная нота чаще всего ' + T.zIn(ai) + (a.guessed ? (gi === ai ? ', и догадки чаще всего совпадают.' : ', а догадки чаще «' + T.zName(gi) + '».') : '.');
  T.drawCast($('#dCast'), D);
  const nn = {}; D.forEach(d => { const k = T.noteShort(d.comfort); nn[k] = (nn[k] || 0) + 1; }); const tops = Object.entries(nn).sort((x, y) => y[1] - x[1]);
  $('#dCastCap').textContent = D.length < 5 ? 'Слепок проявляется со временем: пока ' + D.length + ' ' + T.plural(D.length, 'замер', 'замера', 'замеров') + '.' : 'Чаще всего голос живёт на «' + tops[0][0] + '»' + (tops[1] ? ', иногда уходит на «' + tops[1][0] + '»' : '') + '. Двух одинаковых слепков не бывает.';
  T.drawRange($('#dRange'), $('#tR'), D);
  T.drawLine($('#dStab'), $('#tS'), D, d => d.stab == null ? null : d.stab*100, [40, 100], v => Math.round(v) + ' %', null);
  T.drawLine($('#dExh'), $('#tE'), D, d => d.exhale || null, [0, 40], v => Math.round(v) + ' с', 30);
}
function how(){ return `<section class="how"><h3>Как это считается</h3><ul>
  <li><b>Зона</b> — оценка по высоте ноты и яркости тембра. Низкие ноты ощущаются в груди, средние у гортани и в «маске» лица, высокие в голове. Границы — примерные регистровые переходы, одни для всех голосов.</li>
  <li><b>Цвет</b> — нота с хроматического круга: «до» жёлтое, «соль♯» красное.</li>
  <li><b>Чакры</b> — только другие подписи к тем же пяти зонам.</li>
  <li>Звук не записывается. В браузере остаются только цифры замера.</li>
  <li>Это не диагностика. Если голос сел, хрипит или болит дольше двух недель, нужен фониатр.</li></ul></section>`; }
function setLab(v){
  T.lab.set = v; try { localStorage.setItem('woisee-tracker-labels', v); } catch (e) {}
  buildZones(); if (!$('#flow').hidden) renderStep();
  if (tab === 'data') renderData(); else renderToday();
}

/* =========================== ЗАМЕР =========================== */
const flow = $('#flow'), stage = $('#stage'), stageCv = $('#stageCv'), zonesEl = $('#zones');
const L = new V3.Live(innerWidth < 700 ? 2600 : 4000); L.setOpts({ rain:true, crisp:true, mono:'#F4F2EC' });
const off = document.createElement('canvas');
let SW = 0, SH = 0, body = null;
const fl = { step:0, guess:null, demo:false, run:false, done:[false,false,false,false], err:'', curZ:-1, p:.3, pShown:.3, hl:[0,0,0,0,0], formA:0, result:null, info:null, auto:0 };
const acc = { a:null, s:null, x:null };
function resetStep(i){
  if (i === 1) acc.a = { t:0, voicedT:0, midis:[], stabs:[], cents:[], zoneT:[0,0,0,0,0] };
  if (i === 2) acc.s = { t:0, midis:[], zoneT:[0,0,0,0,0] };
  if (i === 3) acc.x = { t:0, exh:0, hiss:0, on:false };
  fl.done[i] = false;
}
const STEP = [
  { kick:'Шаг 1 из 4', title:'Где, по-твоему, звучит твой голос?', hint:'Прислушайся к себе и нажми на зону. Потом замер проверит.' },
  { kick:'Шаг 2 из 4 · а-а-а', title:'Скажи «а-а-а», как обычно говоришь', hint:'Ровно, на удобной ноте. Таймер идёт, только пока звучит голос.' },
  { kick:'Шаг 3 из 4 · сирена', title:'Сирена снизу вверх и обратно', hint:'От самой низкой удобной ноты до самой высокой и вниз. Без крика.' },
  { kick:'Шаг 4 из 4 · выдох', title:'Вдохни и тяни «с-с-с»', hint:'Вдохни, нажми ▶ и тяни ровно, пока хватает воздуха. Воздух закончился — нажми «Стоп».' }
];
const DUR = { 1:5, 2:11 };

function layoutStage(){
  const W = stage.clientWidth || Math.min(innerWidth, 480) - 32;
  const reserve = fl.step === 0 ? 300 : fl.step === 4 ? 470 : 330;
  const H = Math.round(clamp(innerHeight - reserve, 250, W*1.25));
  stage.style.height = H + 'px';
  if (W !== SW || H !== SH || !body){ SW = W; SH = H; T.fit(stageCv, SW, SH); body = T.makeBody(SW < 420 ? 2300 : 3200, 7); }
  stage.classList.toggle('compact', SH < 420);
  zonesEl.querySelectorAll('.zb').forEach(b => { const z = +b.dataset.z; b.style.top = (SH*(T.BAND[z][0] + T.BAND[z][1])/2) + 'px'; });
}
function buildZones(){
  zonesEl.innerHTML = [4,3,2,1,0].map(z => `<button class="zb" data-z="${z}" tabindex="-1"><b>${T.zName(z)}</b><span>${T.zSub(z)}</span></button>`).join('');
  zonesEl.querySelectorAll('.zb').forEach(b => b.addEventListener('click', () => {
    if (fl.step !== 0) return;
    fl.guess = +b.dataset.z; markZones(); renderCtl();
    clearTimeout(fl.auto); fl.auto = setTimeout(() => { if (fl.step === 0) go(1); }, 550);   // like a mood check-in: the tap moves on
  }));
  if (!flow.hidden) layoutStage();
  markZones();
}
function markZones(){
  zonesEl.querySelectorAll('.zb').forEach(b => {
    const z = +b.dataset.z;
    b.classList.toggle('guess', fl.guess === z && (fl.step === 0 || fl.step === 4));
    b.classList.toggle('on', z === fl.curZ && fl.step !== 0);
    b.tabIndex = fl.step === 0 ? 0 : -1;
  });
}
function openFlow(){
  fl.step = 0; fl.guess = null; fl.demo = false; fl.run = false; fl.err = ''; fl.result = null; fl.curZ = -1; fl.formA = 0;
  [1, 2, 3].forEach(resetStep);
  L.solo.target({ e:.08, hold:0, noise:0 });
  flow.hidden = false; document.body.style.overflow = 'hidden'; flow.scrollTop = 0;
  renderStep();
}
function closeFlow(){ if (L.on) L.stop(); fl.run = false; clearTimeout(fl.auto); flow.hidden = true; document.body.style.overflow = ''; if (tab === 'today') renderToday(); }
$('#fClose').addEventListener('click', closeFlow);
addEventListener('keydown', e => { if (e.key === 'Escape' && !flow.hidden) closeFlow(); });
function go(i){
  clearTimeout(fl.auto); fl.run = false;
  if (i === 4){ compute(); if (L.on) L.stop(); }
  fl.step = i; fl.curZ = i === 4 && fl.result && fl.result.comfort != null ? fl.result.actual : -1;
  if (i < 4) L.solo.target({ e:.08, hold:0, noise:0 });
  flow.scrollTop = 0; renderStep();
}
function renderStep(){
  const i = fl.step;
  $$('#fProg i').forEach((b, k) => { b.className = k < i || (k === i && fl.done[k]) ? 'on' : k === i ? 'cur' : ''; });
  stage.classList.toggle('pick', i === 0);
  if (i < 4){
    $('#fKick').textContent = STEP[i].kick + (fl.demo && i > 0 ? ' · демо' : '');
    $('#fTitle').textContent = STEP[i].title; $('#fHint').textContent = STEP[i].hint;
    $('#fRes').innerHTML = i === 0 ? `<div style="display:flex;justify-content:center"><button class="ghostlink" id="demoBtn">Нет микрофона? Пройти с демо-голосом</button></div>` : (fl.err ? `<p class="err">${fl.err} <button class="ghostlink" id="demoBtn">Демо-голос</button></p>` : '');
    const db = $('#demoBtn'); if (db) db.addEventListener('click', () => { fl.demo = true; fl.err = ''; if (fl.guess == null) fl.guess = 2; go(Math.max(1, fl.step)); });
  } else renderResult();
  layoutStage(); markZones(); renderCtl(); updateTimer();
}
function renderCtl(){
  const i = fl.step, c = $('#fCtl');
  if (i === 0){
    c.innerHTML = `<div class="labsw" role="tablist" aria-label="Подписи зон"><button role="tab" data-lab="body" aria-selected="${T.lab.set === 'body'}">Тело</button><button role="tab" data-lab="chakra" aria-selected="${T.lab.set === 'chakra'}">Чакры</button></div>
      <button class="next ${fl.guess != null ? 'go' : ''}" id="fNext" ${fl.guess == null ? 'disabled style="opacity:.4"' : ''}>Дальше ${I.next}</button>`;
    c.querySelectorAll('[data-lab]').forEach(x => x.addEventListener('click', () => setLab(x.dataset.lab)));
  } else if (i < 4){
    const done = fl.done[i];
    c.innerHTML = `<button class="rbtn back" id="fBack" aria-label="Назад">${I.back}</button>
      ${i === 3 && fl.run ? `<button class="play stop" id="fPlay" aria-label="Стоп">${I.stop}<span>Стоп</span></button>` : `<button class="play ${done ? 'done' : ''}" id="fPlay" aria-label="${done ? 'Ещё раз' : fl.run ? 'Пауза' : 'Старт'}">${done ? I.redo : fl.run ? I.pause : I.play}</button>`}
      <button class="next ${done ? 'go' : ''}" id="fNext">${done ? 'Дальше' : 'Пропустить'} ${I.next}</button>`;
    $('#fBack').addEventListener('click', () => go(i - 1));
    $('#fPlay').addEventListener('click', togglePlay);
  } else {
    const ok = fl.result && fl.result.comfort != null;
    c.innerHTML = `<button class="rbtn back" id="fBack" aria-label="Назад">${I.back}</button>` + (ok ? `<button class="wide" id="fSave">${fl.demo ? 'Готово · демо не сохраняется' : 'Сохранить замер'}</button>` : `<button class="wide" id="fRetry">Повторить «а-а-а»</button>`);
    $('#fBack').addEventListener('click', () => go(3));
    const sv = $('#fSave'); if (sv) sv.addEventListener('click', save);
    const rt = $('#fRetry'); if (rt) rt.addEventListener('click', () => { resetStep(1); go(1); });
  }
  const nx = $('#fNext'); if (nx) nx.addEventListener('click', () => { if (fl.step === 0 && fl.guess == null) return; go(fl.step + 1); });
}
async function togglePlay(){
  const i = fl.step;
  if (fl.done[i]){ resetStep(i); fl.run = true; renderStep(); return; }
  if (!fl.run && !fl.demo && !L.on){
    try { await L.start(); }
    catch (e){ fl.err = 'Микрофон недоступен.'; renderStep(); return; }
  }
  if (i === 3 && fl.run){ finishStep(); return; }   // the exhale has «Стоп», not a pause
  fl.run = !fl.run;
  if (!fl.run) L.solo.target({ e:.12, hold:0, noise:0 });
  renderCtl(); updateTimer();
}
function finishStep(){ fl.run = false; fl.done[fl.step] = true; L.solo.target({ hold:.2 }); renderCtl(); $$('#fProg i')[fl.step].className = 'on'; updateTimer(); }

/* ---- demo voice: scripted instead of the microphone ---- */
function demoInfo(i, t){
  if (i === 1){ if (t < .6) return { voiced:false, silent:true, act:false, noise:0 }; return { voiced:true, midi:55.2 + .18*Math.sin(t*5.5) + .06*Math.sin(t*17), stab:.86, act:true, silent:false, noise:0, cent:.2 }; }
  if (i === 2){ if (t > 10.4) return { voiced:false, silent:true, act:false, noise:0 }; return { voiced:true, midi:52 + 25*Math.sin(Math.PI*Math.min(t, 10)/10), stab:.7, act:true, silent:false, noise:0, cent:.3 }; }
  if (t < .5 || t > 17.5) return { voiced:false, silent:true, act:false, noise:0 };
  return { voiced:false, act:true, silent:false, noise:.95, cent:.85 };
}
function analyse(info, dt){
  const i = fl.step;
  let z = -1;
  if (info.voiced && info.midi > 30){ fl.p = T.pOf(info.midi, info.cent); z = T.zoneOf(fl.p); }
  if (i === 1){ const a = acc.a; a.t += dt;
    if (z >= 0){ a.voicedT += dt; a.midis.push(info.midi); a.stabs.push(info.stab); a.cents.push(info.cent); a.zoneT[z] += dt; }
    if (a.voicedT >= DUR[1]) finishStep();
  } else if (i === 2){ const s = acc.s; s.t += dt;
    if (z >= 0){ s.midis.push(info.midi); s.zoneT[z] += dt; }
    if (s.t >= DUR[2]) finishStep();
  } else if (i === 3){ const x = acc.x; x.t += dt;
    if (!info.voiced && info.act && info.noise > .5){ x.hiss += dt; x.on = true; }
    x.exh = x.t;   // a stopwatch: from ▶ to «Стоп», nothing stops it on its own
  }
  fl.curZ = i === 3 ? -1 : z >= 0 ? z : info.silent ? -1 : fl.curZ;
  fl.info = info;
}
function updateTimer(){
  const i = fl.step, n = $('#tNum'), s = $('#tSub'), info = fl.info;
  if (i === 0 || i === 4){ n.textContent = ''; s.textContent = ''; return; }
  if (i === 1) n.textContent = fmtS(Math.ceil(DUR[1] - acc.a.voicedT - 1e-6));
  if (i === 2) n.textContent = fmtS(Math.ceil(DUR[2] - acc.s.t - 1e-6));
  if (i === 3) n.textContent = fmt1(acc.x.exh);
  let sub;
  if (fl.done[i]) sub = i === 3 ? 'секунд выдоха' : 'готово';
  else if (!fl.run) sub = i === 3 ? 'нажми ▶ на вдохе' : 'нажми ▶ и начни';
  else if (i === 3) sub = 'нажми «Стоп», когда воздух закончится';
  else sub = info && info.voiced ? T.noteName(info.midi) + ' · ' + T.zName(T.zoneOf(T.pOf(info.midi, info.cent))) : 'жду звук…';
  s.textContent = sub;
}

/* ---- result ---- */
function compute(){
  const a = acc.a, s = acc.s, x = acc.x;
  const comfort = T.median(a.midis), all = a.midis.concat(s.midis), cent = T.mean(a.cents);
  const zt = a.zoneT.map((v, k) => v + s.zoneT[k]), tz = zt.reduce((p, q) => p + q, 0) || 1, now = new Date();
  const r = { date:T.dkey(now), time:String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), guess:fl.guess,
    comfort: comfort == null ? null : +comfort.toFixed(2), stab: a.stabs.length ? +clamp(T.mean(a.stabs), 0, 1).toFixed(3) : null,
    low: s.midis.length > 12 ? +T.pct(all, .04).toFixed(2) : null, high: s.midis.length > 12 ? +T.pct(all, .96).toFixed(2) : null,
    exhale: +x.exh.toFixed(1), cent: cent == null ? 0 : +cent.toFixed(3), zones: zt.map(v => +(v/tz).toFixed(3)) };
  r.actual = r.comfort == null ? null : T.zoneOf(T.pOf(r.comfort, r.cent));
  fl.result = r;
  if (r.comfort != null){ fl.p = T.pOf(r.comfort, r.cent); fl.pShown = fl.p; L.solo.target({ u: Math.round(r.comfort) - 12*(Math.floor(Math.round(r.comfort)/12) - 1), vo:1, noise:0, amp:.55, stab:Math.max(.7, r.stab || .7), e:1, hold:1, cent:.5 }); }
}
function renderResult(){
  const r = fl.result;
  if (!r || r.comfort == null){
    $('#fKick').textContent = 'Итог замера'; $('#fTitle').textContent = 'Голос не услышан';
    $('#fHint').textContent = 'Шаг «а-а-а» пропущен или микрофон не поймал звук. Без него не найти комфортную ноту.'; $('#fRes').innerHTML = ''; return;
  }
  const same = r.guess === r.actual, up = r.guess > r.actual;
  $('#fKick').textContent = 'Итог замера' + (fl.demo ? ' · демо' : '');
  $('#fTitle').innerHTML = `Ты звучишь <em style="color:${T.noteCol(r.comfort)}">${T.zIn(r.actual)}</em>`;
  $('#fHint').textContent = r.guess == null ? '' : same ? 'Догадка совпала. Это редкость: изнутри голос обычно звучит иначе, чем снаружи.'
    : up ? 'Ты думала: «' + T.zName(r.guess) + '». Голос ниже, чем кажется: он опирается на грудь, а внимание сосредоточено выше.'
         : 'Ты думала: «' + T.zName(r.guess) + '». Изнутри голос кажется ниже: кости черепа добавляют низких частот. Поэтому своя запись звучит выше.';
  const s = semis(r);
  $('#fRes').innerHTML = `<div class="chips"><span class="chip">${I.clock}Сегодня, ${r.time}</span><span class="chip"><span class="dot" style="background:${T.noteCol(r.comfort)}"></span>${T.noteName(r.comfort)} · <span class="num">${Math.round(T.hz(r.comfort))} Гц</span></span></div>
    <div class="card"><div class="rows" style="margin-top:0">
      <div class="row" style="border-top:0"><span>Диапазон сирены</span><b class="num">${s != null ? octs(s) + ' окт.<br><span style="color:var(--muted);font-weight:500;font-size:13px">' + T.noteName(r.low) + ' — ' + T.noteName(r.high) + '</span>' : '—'}</b></div>
      <div class="row"><span>Устойчивость «а»</span><b class="num">${r.stab != null ? Math.round(r.stab*100) + ' %' : '—'}</b></div>
      <div class="row"><span>Долгий выдох</span><b class="num">${r.exhale ? Math.round(r.exhale) + ' с' : '—'}</b></div>
    </div></div>`;
}
function save(){
  if (!fl.demo) T.saveDay(fl.result);
  refresh(); closeFlow(); setTab('today');
}

/* =========================== loop =========================== */
let last = performance.now(), TT = 0, prevZ = -2;
function frame(now){
  const dt = Math.min(.05, (now - last)/1000); last = now; TT += dt;
  if (!flow.hidden){
    const i = fl.step;
    if (i >= 1 && i <= 3 && fl.run){
      const t = i === 1 ? acc.a.t : i === 2 ? acc.s.t : acc.x.t;
      let info = null;
      if (fl.demo){
        info = demoInfo(i, t);
        if (info.voiced) L.solo.target({ u: info.midi - 36, vo:1, noise:0, amp:.62, stab:info.stab, e:1, hold:.9, cent:.5 });
        else if (info.noise > .5){ L.solo.target({ vo:0, noise:1, cent:.85, amp:.5, e:1, hold:0, stab:.25 }); L.solo.exh += dt; }
        else { L.solo.target({ e:.08, hold:0, noise:0 }); L.solo.exh = 0; }
      } else if (L.on) info = L.update(dt).info;
      if (info) analyse(info, dt);
      updateTimer();
    }
    if (i >= 1) L.step(dt);
    if (fl.curZ !== prevZ){ prevZ = fl.curZ; markZones(); }
    drawStage(dt);
  } else if (tab === 'today') drawRing(dt);
  requestAnimationFrame(frame);
}
function drawStage(dt){
  const i = fl.step, k = a => 1 - Math.pow(1 - a, dt*60);
  for (let z = 0; z < 5; z++){
    const tg = i === 0 ? (z === fl.guess ? .55 : 0) : z === fl.curZ ? 1 : 0;
    fl.hl[z] += (tg - fl.hl[z])*k(tg > fl.hl[z] ? .12 : .03);
  }
  fl.pShown += (fl.p - fl.pShown)*k(.08);
  const show = (i >= 1 && i <= 3 && (fl.run || fl.done[i])) || (i === 4 && fl.result && fl.result.comfort != null);
  fl.formA += ((show ? 1 : 0) - fl.formA)*k(.06);
  const ctx = stageCv.getContext('2d'), d = T.DPR(); ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.fillStyle = T.C.ground; ctx.fillRect(0, 0, SW, SH);
  const cxF = .62;
  const tint = i === 0 ? T.C.lime : i === 4 && fl.result && fl.result.comfort != null ? T.noteCol(fl.result.comfort) : fl.curZ >= 0 ? V3.toHex(L.solo.color()) : null;
  T.drawBody(ctx, body, SW, SH, cxF, fl.hl, tint, TT);
  const r = fl.result;
  if (i === 4 && r && r.comfort != null && r.guess != null && r.guess !== r.actual){
    const yg = SH*(T.BAND[r.guess][0] + T.BAND[r.guess][1])/2, ya = SH*T.yOfP(fl.pShown), x = SW*cxF + SH*.25;
    ctx.strokeStyle = T.C.lime; ctx.globalAlpha = .75; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(x, yg); ctx.lineTo(x, ya); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(x, yg, 3.5, 0, Math.PI*2); ctx.stroke(); ctx.fillStyle = T.C.lime; ctx.beginPath(); ctx.arc(x, ya, 3.5, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
  }
  if (fl.formA > .01){
    const F = Math.round(Math.min(SW*.52, SH*.62)), oc = T.fit(off, F, F); oc.clearRect(0, 0, F, F);
    L.draw(oc, F, F, .5);
    const y = SH*(i === 3 ? .5 : T.yOfP(fl.pShown));
    ctx.globalAlpha = fl.formA; ctx.drawImage(off, SW*cxF - F/2, clamp(y - F/2, -F*.25, SH - F*.75), F, F); ctx.globalAlpha = 1;
  }
}

/* =========================== start =========================== */
buildZones();
let rT = 0; addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { if (!flow.hidden) layoutStage(); if (tab === 'today') renderToday(); else renderData(); }, 150); });
const q = new URLSearchParams(location.search);
setTab(['month', 'data'].includes(q.get('tab')) ? 'data' : 'today');
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (tab === 'data') renderData(); });
requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
window.__tracker = { fl, acc, openFlow, go, setTab, refresh, get DATA(){ return DATA; } };
})();
