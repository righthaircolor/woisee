/* woisee · трекер голоса — ядро: ноты, зоны тела, силуэт из зерна, хранение, тестовая история, графики.
   Нужны window.Voice3 и window.Field. */
(function (g) {
'use strict';
const V3 = g.Voice3, FL = g.Field;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const sm = t => { t = clamp(t, 0, 1); return t*t*(3 - 2*t); };
const DPR = () => Math.min(g.devicePixelRatio || 1, 2);
const reduced = () => g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = { ink:'#F4F2EC', muted:'#9AA7A3', ground:'#0E1514', card:'#1D2826', rule:'rgba(255,254,252,.10)', lime:'#ECF176', kale:'#5EA879' };
function fit(cv, w, h){ const d = DPR(); const W = Math.max(1, Math.round(w*d)), H = Math.max(1, Math.round(h*d)); if (cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; } cv.style.height = h + 'px'; const ctx = cv.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0); return ctx; }

/* ---------- notes ---------- */
const OCTN = { 1:'субконтроктавы', 2:'контроктавы', 3:'большой', 4:'малой', 5:'первой', 6:'второй', 7:'третьей' };
const pcOf = m => ((Math.round(m) % 12) + 12) % 12;
const noteName = m => V3.NAMES[pcOf(m)] + ' ' + (OCTN[Math.floor(Math.round(m)/12)] || '');
const noteShort = m => V3.NAMES[pcOf(m)];
const plural = (n, a, b, c) => { const k = Math.abs(n) % 100, l = k % 10; return k > 10 && k < 20 ? c : l === 1 ? a : l > 1 && l < 5 ? b : c; };
const hz = m => 440*Math.pow(2, (m - 69)/12);
const noteCol = m => V3.HUE[pcOf(m)];

/* ---------- zones: pitch (+ brightness) → place in the body ----------
   boundaries in MIDI: E2 · E3 · D4 · G4 · D5 · D6 — rough register transitions, the same for every voice.
   Male speech lands in zone 0, female speech in zone 1. */
const ZB = [40, 52, 62, 67, 74, 86];
const LABELS = {
  body:   [['Низ груди','рёбра, солнечное сплетение'], ['Грудь','грудина, ключицы'], ['Шея','гортань, переход'], ['Маска','скулы, нос, губы'], ['Голова','лоб, темя']],
  chakra: [['Манипура','солнечное сплетение'], ['Анахата','сердце'], ['Вишудха','горло'], ['Аджна','третий глаз'], ['Сахасрара','макушка']]
};
const lab = { set: 'body' };
try { const v = localStorage.getItem('woisee-tracker-labels'); if (v === 'chakra') lab.set = v; } catch (e) {}
const zName = i => LABELS[lab.set][i][0];
const zSub = i => LABELS[lab.set][i][1];
/* «в груди», «в шее»… — for sentences */
const ZIN = { body:['в низу груди','в груди','в шее','в маске','в голове'], chakra:['в манипуре','в анахате','в вишудхе','в аджне','в сахасраре'] };
const zIn = i => ZIN[lab.set][i];
/* vertical bands on the silhouette, as fractions of stage height (zone 0 at the bottom) */
const BAND = [[.64, .90], [.415, .64], [.28, .415], [.165, .28], [.05, .165]];
function pOf(midi, cent){
  let p;
  if (midi <= ZB[0]) p = 0; else if (midi >= ZB[5]) p = 1;
  else { let i = 0; while (midi > ZB[i + 1]) i++; p = (i + (midi - ZB[i])/(ZB[i + 1] - ZB[i]))/5; }
  if (cent != null) p += 0.04*clamp(cent, 0, 1);   // a brighter, more forward tone sits a little higher; most vowels read ~0
  return clamp(p, 0, 0.999);
}
const zoneOf = p => Math.min(4, Math.max(0, Math.floor(p*5)));
function yOfP(p){ const i = zoneOf(p), f = p*5 - i, b = BAND[i]; return b[1] - f*(b[1] - b[0]); }
function zoneOfY(y){ for (let i = 0; i < 5; i++) if (y >= BAND[i][0] && y <= BAND[i][1]) return i; return y > BAND[0][1] ? 0 : 4; }

/* ---------- silhouette made of grain ---------- */
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
  return { X, Y, S, A, byZ, n };
}
/* hl: highlight 0..1 per zone; tint: one colour or null */
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

/* ---------- dates ---------- */
const dkey = dt => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
const kdate = k => { const p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
const addDays = (dt, n) => { const x = new Date(dt); x.setDate(x.getDate() + n); return x; };
const monday = dt => { const x = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()); const w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); return x; };
const MON = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
const MONG = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONN = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const WD = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const WDL = ['понедельник','вторник','среда','четверг','пятница','суббота','воскресенье'];
const dLabel = k => { const d = kdate(k); return d.getDate() + ' ' + MON[d.getMonth()]; };
const dLong = k => { const d = kdate(k); return WDL[(d.getDay() + 6) % 7].replace(/^./, c => c.toUpperCase()) + ', ' + d.getDate() + ' ' + MONG[d.getMonth()]; };

/* ---------- storage ---------- */
const LS = 'woisee-tracker-v1';
function loadMine(){ try { const v = JSON.parse(localStorage.getItem(LS) || '[]'); return Array.isArray(v) ? v.filter(d => d && d.date && d.comfort != null) : []; } catch (e) { return []; } }
function saveDay(d){ try { const all = loadMine().filter(x => x.date !== d.date); all.push(d); all.sort((a, b) => a.date < b.date ? -1 : 1); localStorage.setItem(LS, JSON.stringify(all.slice(-400))); return true; } catch (e) { return false; } }

/* ---------- test history: ~5 months of a female voice that grows ---------- */
function simHistory(days){
  const r = FL.rng(2026), out = [], today = new Date(), K = 55, norm = 1 - Math.exp(-(days - 1)/K);
  for (let d = 0; d < days; d++){
    const skip = r() < .13, tired = r() < .07;
    const dt = addDays(today, -(days - d));        // ends yesterday
    if (skip) { r(); r(); r(); r(); continue; }
    const t = (1 - Math.exp(-d/K))/norm, k = tired ? 1 : 0;
    const comfort = 54.2 + 1.3*t + (r() - .5)*.9 - k*1.1;
    const low = 50.8 - 5*t + (r() - .5)*1.3 + k*1.2;
    const high = 67.8 + 11.5*Math.pow(t, .8) + (r() - .5)*2.2 - k*4.5;
    const stab = clamp(.58 + .27*t + (r() - .5)*.08 - k*.16, .3, .97);
    const exhale = 12 + 16*t + (r() - .5)*3.2 - k*4;
    const cent = .2 + .3*t + (r() - .5)*.1;
    const zt = [0,0,0,0,0];
    for (let q = 0; q < 50; q++) zt[zoneOf(pOf(comfort + (r() - .5)*.6, cent))] += .1;
    for (let q = 0; q < 100; q++){ const m = low + (high - low)*(.5 - .5*Math.cos(Math.PI*q/99)); zt[zoneOf(pOf(m, cent))] += .1; }
    const tot = zt.reduce((a, b) => a + b, 0), actual = zoneOf(pOf(comfort, cent));
    const correct = r() < .2 + .7*t;
    const guess = correct ? actual : clamp(actual + (r() < .8 ? 1 : -1), 0, 4);   // most people guess higher: they listen in the throat
    const hh = 8 + Math.floor(r()*13), mm = Math.floor(r()*60);
    out.push({ date: dkey(dt), time: String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'), comfort:+comfort.toFixed(2), low:+low.toFixed(2), high:+high.toFixed(2), stab:+stab.toFixed(3), exhale:+exhale.toFixed(1), cent:+cent.toFixed(3), zones: zt.map(v => +(v/tot).toFixed(3)), guess, actual, sim:true });
  }
  return out;
}

/* ---------- small helpers ---------- */
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length/2)] : null; };
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[clamp(Math.round(q*(s.length - 1)), 0, s.length - 1)] : null; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0)/a.length : null;
/* note → index on the form scale, relative to the octave of the typical comfortable note */
const refU = D => { const c = median(D.map(d => d.comfort)) || 55; return m => clamp(Math.round(m) - 12*(Math.floor(c/12) - 1), 0, 47); };

/* the form of one day, drawn into a small canvas */
function miniForm(cv, d, s, uOf, seed){
  const ctx = fit(cv, s, s); ctx.clearRect(0, 0, s, s);
  V3.renderForm(ctx, s/2, s/2, s*.5, uOf(d.comfort), Math.round(120 + s*5), seed || 700, noteCol(d.comfort), .55 + .45*(d.stab || .5), Math.max(.7, s/60), 0, true);
}

/* ---------- charts: recessive grid, one ink series, crosshair + tooltip ---------- */
function chartFrame(cv, h, l){ const w = cv.clientWidth, ctx = fit(cv, w, h); ctx.fillStyle = C.ground; ctx.fillRect(0, 0, w, h); return { ctx, w, h, l:l || 44, r:12, t:12, b:24 }; }
function xOf(F, D, i){ return F.l + (D.length === 1 ? .5 : i/(D.length - 1))*(F.w - F.l - F.r); }
function xAxis(F, D){
  const ctx = F.ctx; ctx.fillStyle = C.muted; ctx.font = '500 11px "Inter Tight",sans-serif'; ctx.textBaseline = 'alphabetic';
  const idx = D.length < 3 ? D.map((_, i) => i) : [0, Math.floor((D.length - 1)/2), D.length - 1];
  idx.forEach((i, k) => { ctx.textAlign = k === 0 && idx.length > 1 ? 'left' : k === idx.length - 1 && idx.length > 1 ? 'right' : 'center'; ctx.fillText(dLabel(D[i].date), clamp(xOf(F, D, i), F.l, F.w - F.r), F.h - 6); });
  ctx.textAlign = 'left';
}
function hover(cv, tip, D, getF, html, yAt, redraw){
  const card = cv.parentElement;
  const show = ev => {
    const F = getF(), rc = cv.getBoundingClientRect(), x = ev.clientX - rc.left; let best = 0, bd = 1e9;
    D.forEach((_, i) => { const dx = Math.abs(xOf(F, D, i) - x); if (dx < bd){ bd = dx; best = i; } });
    redraw(best);
    const tx = xOf(getF(), D, best), ty = yAt(best);
    tip.innerHTML = html(D[best]); tip.style.left = clamp(cv.offsetLeft + tx, 80, card.clientWidth - 80) + 'px'; tip.style.top = (cv.offsetTop + Math.max(8, ty - 10)) + 'px'; tip.style.opacity = 1;
  };
  cv.onpointermove = show; cv.onpointerdown = show; cv.onpointerleave = () => { tip.style.opacity = 0; redraw(-1); };
}
function drawRange(cv, tip, D){
  const lo = Math.floor(Math.min(...D.map(d => d.low != null ? d.low : d.comfort)) - 2), hi = Math.ceil(Math.max(...D.map(d => d.high != null ? d.high : d.comfort)) + 2);
  let F;
  const yOf = m => F.t + (1 - (m - lo)/(hi - lo))*(F.h - F.t - F.b);
  const draw = sel => {
    F = chartFrame(cv, 230, 70); const ctx = F.ctx;
    ctx.font = '500 11px "Inter Tight",sans-serif'; ctx.textBaseline = 'middle';
    for (let m = Math.ceil(lo/12)*12; m <= hi; m += 12){ const y = yOf(m); ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(F.l, y); ctx.lineTo(F.w - F.r, y); ctx.stroke(); ctx.fillStyle = C.muted; ctx.fillText('до ' + (OCTN[m/12] || ''), 6, y); }
    const bw = Math.max(2, Math.min(10, (F.w - F.l - F.r)/D.length*.5)), dr = Math.max(2.4, Math.min(4.2, bw*.6));
    D.forEach((d, i) => {
      const x = xOf(F, D, i);
      if (sel === i){ ctx.strokeStyle = 'rgba(255,254,252,.25)'; ctx.beginPath(); ctx.moveTo(x, F.t); ctx.lineTo(x, F.h - F.b); ctx.stroke(); }
      if (d.low != null){ const y1 = yOf(d.high), y2 = yOf(d.low); ctx.fillStyle = sel === i ? 'rgba(244,242,236,.6)' : 'rgba(244,242,236,.28)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - bw/2, y1, bw, y2 - y1, bw/2); else ctx.rect(x - bw/2, y1, bw, y2 - y1); ctx.fill(); }
      const yc = yOf(d.comfort); ctx.fillStyle = C.ground; ctx.beginPath(); ctx.arc(x, yc, dr + 1.8, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = noteCol(d.comfort); ctx.beginPath(); ctx.arc(x, yc, dr, 0, Math.PI*2); ctx.fill();
    });
    xAxis(F, D);
  };
  draw(-1);
  hover(cv, tip, D, () => F, d => `<b>${dLabel(d.date)}</b><br>комфортная: ${noteName(d.comfort)}<br>${d.low != null ? 'сирена: ' + noteShort(d.low) + ' — ' + noteShort(d.high) + ', ' + Math.round(d.high - d.low) + ' ' + plural(Math.round(d.high - d.low), 'полутон', 'полутона', 'полутонов') : 'без сирены'}`, i => yOf(D[i].high != null ? D[i].high : D[i].comfort), draw);
}
function drawLine(cv, tip, D, val, yr, fmt, goal){
  let F;
  const vals = D.map(val), ok = vals.filter(v => v != null), lo = Math.min(yr[0], ...ok), hi = Math.max(yr[1], ...ok);
  const yOf = v => F.t + (1 - (v - lo)/(hi - lo))*(F.h - F.t - F.b);
  const draw = s => {
    F = chartFrame(cv, 160); const ctx = F.ctx;
    ctx.font = '500 11px "Inter Tight",sans-serif'; ctx.textBaseline = 'middle';
    [lo, (lo + hi)/2, hi].forEach(v => { const y = yOf(v); ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(F.l, y); ctx.lineTo(F.w - F.r, y); ctx.stroke(); ctx.fillStyle = C.muted; ctx.fillText(fmt(v), 6, y); });
    if (goal != null){ const y = yOf(goal); ctx.strokeStyle = 'rgba(236,241,118,.6)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(F.l, y); ctx.lineTo(F.w - F.r, y); ctx.stroke(); ctx.setLineDash([]); }
    if (s >= 0){ const x = xOf(F, D, s); ctx.strokeStyle = 'rgba(255,254,252,.25)'; ctx.beginPath(); ctx.moveTo(x, F.t); ctx.lineTo(x, F.h - F.b); ctx.stroke(); }
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath(); let started = false;
    vals.forEach((v, i) => { if (v == null) return; const x = xOf(F, D, i), y = yOf(v); if (started) ctx.lineTo(x, y); else ctx.moveTo(x, y); started = true; }); ctx.stroke();
    vals.forEach((v, i) => { if (v == null) return; if (!(i === s || i === vals.length - 1 || D.length < 9)) return; const x = xOf(F, D, i), y = yOf(v);
      ctx.fillStyle = C.ground; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI*2); ctx.fill(); });
    xAxis(F, D);
  };
  draw(-1);
  hover(cv, tip, D, () => F, d => `<b>${dLabel(d.date)}</b> · ${val(d) != null ? fmt(val(d)) : '—'}`, i => vals[i] != null ? yOf(vals[i]) : F.t, draw);
}
/* all the measurements of a period laid over each other: the pattern is the comfortable note, the rings the range */
function drawCast(cv, D){
  const s = cv.clientWidth, ctx = fit(cv, s, s), cx = s/2, cy = s/2, uOf = refU(D), R = s*.36;
  ctx.fillStyle = C.ground; ctx.fillRect(0, 0, s, s);
  const r = FL.rng(5), n = D.length, per = n > 60 ? 30 : 70, fN = Math.round((500 + s*1.2)*clamp(36/Math.max(1, n), .3, 1));
  D.forEach((d, i) => {
    if (d.low == null) return;
    const rad = s*(.3 + clamp((d.high - d.low)/34, 0, 1)*.18);
    ctx.fillStyle = noteCol(d.high); ctx.globalAlpha = .16 + .3*(i/(n - 1 || 1));
    for (let q = 0; q < per; q++){ const a = r()*Math.PI*2, rr = rad*(1 + (r() - .5)*.05); ctx.fillRect(cx + Math.cos(a)*rr - .6, cy + Math.sin(a)*rr - .6, 1.2, 1.2); }
    ctx.globalAlpha = 1;
  });
  D.forEach((d, i) => V3.renderForm(ctx, cx, cy, R, uOf(d.comfort), fN, 300 + i, noteCol(d.comfort), (.1 + .45*(d.stab || .5))*clamp(32/Math.max(1, n), .42, 1), Math.max(.7, s/560), i*.015, true));
}
/* body with the share of time per zone */
function drawBodyShare(cv, D, cxF){
  const w = cv.clientWidth, h = Math.round(Math.min(w*1.2, 560)), ctx = fit(cv, w, h);
  const z = [0,0,0,0,0]; D.forEach(d => (d.zones || []).forEach((v, i) => z[i] += v));
  const tot = z.reduce((a, b) => a + b, 0) || 1, mx = Math.max(...z) || 1;
  const B = makeBody(w < 420 ? 2000 : 2800, 11);
  ctx.fillStyle = C.ground; ctx.fillRect(0, 0, w, h);
  drawBody(ctx, B, w, h, cxF || .64, z.map(v => Math.pow(v/mx, .8)), C.kale, 0);
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i++){
    const y = h*(BAND[i][0] + BAND[i][1])/2, share = Math.round(z[i]/tot*100);
    ctx.fillStyle = C.ink; ctx.globalAlpha = share > 0 ? 1 : .45; ctx.font = '700 15px "Inter Tight",sans-serif'; ctx.fillText(zName(i), 14, y - 8);
    ctx.fillStyle = C.muted; ctx.font = '500 12px "Inter Tight",sans-serif'; ctx.fillText(share + ' %', 14, y + 9); ctx.globalAlpha = 1;
  }
  return z.map(v => v/tot);
}

g.TR = { C, clamp, sm, DPR, reduced, fit, OCTN, pcOf, noteName, noteShort, plural, hz, noteCol, ZB, LABELS, lab, zName, zSub, zIn, BAND, pOf, zoneOf, yOfP, zoneOfY,
  makeBody, drawBody, dkey, kdate, addDays, monday, MON, MONG, MONN, WD, dLabel, dLong, loadMine, saveDay, simHistory, median, pct, mean, refU, miniForm,
  drawRange, drawLine, drawCast, drawBodyShare };
})(window);
