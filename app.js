(function(){
'use strict';
/* Guitar Plan v7: one guided session player. Open the app -> today's lesson -> one big Start button -> short steps,
   one at a time (instruction, diagram, auto-playing audio, rep counter, Next). Everything else lives under ☰ More. */
const P = window.PLAN, A = window.GAudio, GM = window.GMusic, GS = window.GSession, $ = s => document.querySelector(s);
const APP_VERSION = 'v7';
const L = P.lessons, BYDAY = {}, BYDATE = {}; L.forEach(l => { BYDAY[l.day] = l; BYDATE[l.date] = l; });
const SONG = {}; P.songs.forEach(s => SONG[s.id] = s);
const PH = {}; P.phases.forEach(p => PH[p.n] = p);
const INT = [1, 3, 7, 14, 30];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* ---------- state ---------- */
const KEY = 'gp.v1';
let S; try { S = JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e){ S = {}; }
S.done = S.done || {}; S.keepers = S.keepers || {}; S.cards = S.cards || {}; S.checkpoints = S.checkpoints || {}; S.reps = S.reps || {};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){} };
/* ---------- dates ---------- */
const qd = new URLSearchParams(location.search).get('date');
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today = () => qd || iso(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const fmt = (s, o) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', o || {weekday:'short', month:'short', day:'numeric'});
const LONG = {weekday:'long', month:'long', day:'numeric'};
function lessonFor(d){
  if(BYDATE[d]) return {l: BYDATE[d], note: null};
  if(d < L[0].date) return {l: L[0], note: `The plan starts ${fmt(L[0].date, LONG)}. Here's Day 1 so you can try it early.`};
  if(d > L[L.length-1].date) return {l: L[L.length-1], note: 'You finished the whole 26-week plan! 🎉 Here is the last lesson again.'};
  let x = d; while(!BYDATE[x]) x = addDays(x, 1);
  return {l: BYDATE[x], note: `No lesson ${d === today() ? 'today' : 'on ' + fmt(d, LONG)}: it's the weekend. Here's the next one (${fmt(x, LONG)}).`, weekend: true};
}
const todayLesson = () => lessonFor(today());
/* ---------- keepers (spaced repetition, fully automatic) ---------- */
function addKeeper(l){ if(!l.k || S.keepers[l.day]) return; S.keepers[l.day] = {stage: 0, due: addDays(today(), 1), added: today(), hist: []}; }
function grade(day, ok){
  const k = S.keepers[day]; if(!k) return; const t = today(); k.hist.push([t, ok ? 1 : 0]);
  if(ok){ k.stage++; if(k.stage >= INT.length){ k.mastered = true; k.due = addDays(t, 30); } else k.due = addDays(t, INT[k.stage]); }
  else { k.stage = 0; k.mastered = false; k.due = addDays(t, 1); }
  save();
}
const dueList = () => Object.entries(S.keepers).filter(([d, k]) => k.due <= today()).map(([d, k]) => ({day: +d, ...k})).sort((a, b) => a.due.localeCompare(b.due));
/* Reviews folded into a session: Keeper items that are due, then the plan's planned revisits for that day. Max 3. */
function reviewsFor(l){
  const out = [], seen = new Set(), push = d => { if(d < l.day && BYDAY[d] && BYDAY[d].k && !seen.has(d)){ seen.add(d); out.push({day: d}); } };
  if(l.date <= today() || l.date === todayLesson().l.date) dueList().forEach(k => push(k.day));
  l.reviews.forEach(r => push(r.day));
  return out.slice(0, 3);
}
/* ---------- UI helpers ---------- */
function toast(m){ const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 2600); }
let GEST = 0; document.addEventListener('click', () => { GEST = performance.now(); }, true);

function dia(key, bpm){ const d = P.dia[key]; if(!d) return '';
  return `<div class="dia">${d.ex ? `<button class="btn sm s play" data-ex="${key}" data-bpm="${bpm||80}" aria-label="Play">▶</button>` : ''}${d.html}</div>`; }
function chordDia(name){ const c = P.chords[name]; if(!c) return '';
  return `<div class="dia"><button class="btn sm s play" data-chord="${esc(name)}" aria-label="Play ${esc(name)}">▶</button>${c.svg}</div>`; }
const songLink = id => SONG[id] ? `<a href="#song-${id}">${esc(SONG[id].title)} →</a>` : '';
function loopUI(loop, id){ if(!loop) return ''; const song = loop.page === 'song', tempos = song ? [loop.bpm] : GM.loopTempos(loop.bpm);
  return `<div class="card loop" data-loop="${id}"><h3>🥁 Backing loop <small class="meta">${esc(loop.label||'')}</small></h3>
  <div class="now${loop.prog.length > 6 ? ' long' : ''}" data-now>${esc(loop.prog.join('  ·  '))}</div>
  <div class="beats" data-lbeats>${'<i></i>'.repeat(loop.feel === 'waltz' ? 3 : 4)}</div>
  <div class="row"><button class="btn t" data-lplay>▶ Play loop</button>${song ? '' : '<label class="row note"><input type="checkbox" data-ldrums checked> drums</label>'}</div>
  ${tempos.length > 1 ? `<div class="row tempos"><span class="note">Tempo:</span>${tempos.map((b, i) => `<button class="chip ${i ? 'o' : ''}" data-ltempo="${b}" aria-pressed="${!i}">${b} bpm${i ? '' : ' (target)'}</button>`).join('')}</div>` : `<div class="note">Tempo ${loop.bpm} bpm</div>`}
  <div class="note">Pre-recorded loop (synthesized guitar &amp; drums). Search term for a full track: ${loop.search ? esc(loop.search) : 'see lesson'}.</div></div>`; }
const LOOPS = {};
function wireLoops(root){
  root.querySelectorAll('[data-loop]').forEach(el => {
    const spec = LOOPS[el.dataset.loop]; if(!spec) return; let lp = null, bpm = spec.bpm;
    const btn = el.querySelector('[data-lplay]'), now = el.querySelector('[data-now]'), beats = el.querySelectorAll('[data-lbeats] i'), dr = el.querySelector('[data-ldrums]');
    const idle = () => { btn.textContent = '▶ Play loop'; btn.classList.remove('playing'); beats.forEach(x => x.classList.remove('on')); now.textContent = spec.prog.join('  ·  '); };
    const begin = () => {
      lp = new A.Loop({spec, bpm, page: spec.page, drums: dr ? dr.checked : true,
        onBar: i => { now.innerHTML = spec.prog.map((c, j) => j === i ? `<u>${esc(c)}</u>` : esc(c)).join('  ·  '); },
        onBeat: b => beats.forEach((x, j) => x.classList.toggle('on', j === b)),
        onStop: () => { lp = null; idle(); }});
      if(lp.start() !== false){ btn.textContent = '■ Stop loop'; btn.classList.add('playing'); }
      window.__loopStarted = (window.__loopStarted || 0) + 1;
    };
    btn.onclick = () => { if(lp){ lp.stop(); return; } begin(); };
    el.querySelectorAll('[data-ltempo]').forEach(t => t.onclick = () => { bpm = +t.dataset.ltempo;
      el.querySelectorAll('[data-ltempo]').forEach(x => { x.classList.toggle('o', x !== t); x.setAttribute('aria-pressed', String(x === t)); });
      if(lp){ lp.onStop = null; lp.stop(); lp = null; begin(); } });
    if(dr) dr.onchange = () => { if(lp){ lp.onStop = null; lp.stop(); lp = null; begin(); } };
  });
}
function soundName(b){
  if(b.dataset.ex) return GM.name.ex(b.dataset.ex, +(b.dataset.bpm || 80));
  if(b.dataset.chord) return GM.name.chord(b.dataset.chord);
  if(b.dataset.lex) return GM.name.lesson(+b.dataset.lex);
  return GM.name.card(JSON.parse(b.dataset.cardplay));
}
function wirePlay(root){
  root.querySelectorAll('[data-ex],[data-chord],[data-lex],[data-cardplay]').forEach(b => b.onclick = () => {
    if(b.classList.contains('playing')){ A.stopAll(); return; }
    root.querySelectorAll('[data-ex].playing,[data-chord].playing,[data-lex].playing,[data-cardplay].playing').forEach(x => x.classList.remove('playing'));
    const label = b.textContent, short = label.trim().length <= 2; b.classList.add('playing'); b.textContent = short ? '■' : '■ Stop'; b.setAttribute('aria-pressed', 'true');
    A.play(soundName(b), {onEnd: () => { b.classList.remove('playing'); b.textContent = label; b.setAttribute('aria-pressed', 'false'); }});
  });
}

/* ---------- home: today's lesson + one big Start button ---------- */
const nextLabel = l => { const n = BYDAY[l.day + 1]; if(!n) return null;
  const t = today(); const when = n.date === addDays(t, 1) ? 'Tomorrow' : n.date > t ? fmt(n.date, {weekday: 'long'}) : `Day ${n.day}`;
  return {when, n}; };
function homeView(l, note, wk){
  const isToday = l.date === todayLesson().l.date, plan = GS.build(l, {reviews: reviewsFor(l)}), n = plan.steps.length;
  const resume = S.sess && S.sess.day === l.day && S.sess.i > 0 && S.sess.i < n, done = S.done[l.day], nx = nextLabel(l);
  const tl = todayLesson().l;
  const startTxt = isToday ? (wk ? '▶ Start the next lesson' : '▶ Start today\'s lesson') : '▶ Start this lesson';
  return `<div class="home" data-home="${l.day}">
   ${note ? `<div class="banner">${esc(note)}</div>` : ''}
   <div class="hday">${esc(fmt(l.date, {weekday: 'long', month: 'short', day: 'numeric'}))} · Day ${l.day}${l.tag ? ' · optional' : ''}</div>
   <h1 class="htitle">${esc(l.title)}</h1>
   ${done ? `<div class="hdone">✓ You finished this lesson${done !== l.date ? ` (${esc(fmt(done))})` : ''}. ${nx ? `${esc(nx.when)}: Day ${nx.n.day}.` : ''}</div>` : ''}
   <p class="hsub">About ${plan.minutes} minutes · ${n} short steps.<br>Just press start. The app tells you what to do, one step at a time.</p>
   ${resume ? `<button class="btn huge" data-start="resume">▶ Keep going (step ${S.sess.i + 1} of ${n})</button><button class="btn s" data-start="over">Start over from step 1</button>`
            : `<button class="btn huge${done ? ' s' : ''}" data-start="new">${done ? '↻ Do it again' : startTxt}</button>`}
   <p class="note">🎸 Grab your guitar and turn the volume up.</p>
   ${!isToday ? `<p class="note"><a href="#today">Today's lesson is Day ${tl.day} →</a></p>` : ''}
  </div>`;
}
function wireHome(l){
  document.querySelectorAll('[data-start]').forEach(b => b.onclick = () => startSession(l, b.dataset.start !== 'resume'));
}
/* ---------- the guided session ---------- */
let SESS = null, SA = null;
function buildSess(l){ return GS.build(l, {reviews: (S.sess.reviews || []).map(d => ({day: d}))}); }
function startSession(l, fresh){
  if(fresh || !S.sess || S.sess.day !== l.day) S.sess = {day: l.day, reviews: reviewsFor(l).map(r => r.day), i: 0, reps: {}, hard: {}, quiz: {}, started: today()};
  save(); SESS = {l, plan: buildSess(l)};
  try{ if(navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {}); }catch(e){}
  showStep(S.sess.i, true);
}
function stopStepAudio(){ const sa = SA; SA = null; if(sa){ clearTimeout(sa.h); if(sa.obj) sa.obj.stop(); } A.stop('main'); A.stop('metro'); }
function setHash(h, push){ if(location.hash === h) return; history[push ? 'pushState' : 'replaceState']({gp: 1}, '', h); LASTH = location.hash; }
const audioCh = a => a.kind === 'metro' ? 'metro' : 'main';
const audioName = a => a.kind === 'play' ? a.name : a.kind === 'metro' ? GM.name.metro(A.nearestBpm(a.bpm)) : GM.name.loop(a.spec, a.bpm, a.drums);
function neckSvg(c){ return miniNeck(c); }
function stepHTML(st, i, n, l){
  const D = (st.dia || []).filter(k => P.dia[k]);
  let dias = D.map(k => `<div class="sd">${P.dia[k].html.replace(' Press ▶ to hear it.', '')}</div>`).join('');
  if(st.chord && P.chords[st.chord]) dias += `<div class="sd">${P.chords[st.chord].svg}</div>`;
  if(st.neck) dias += `<div class="sd neck">${neckSvg(st.neck)}</div>`;
  const a = st.audio, r = st.reps || 0, got = S.sess.reps[i] || 0, last = i === n - 1;
  const band = a && a.kind === 'loop' ? `<div class="sband"><div class="snow" data-now>${esc(a.spec.prog[0])}</div><div class="sthen" data-nextc>then ${esc(a.spec.prog[1 % a.spec.prog.length])}</div></div>` : '';
  const beats = a && a.kind !== 'play' ? `<div class="beats" data-beats>${'<i></i>'.repeat(a.spec && a.spec.feel === 'waltz' ? 3 : 4)}</div>` : '';
  const q = st.quiz, ans = S.sess.quiz[i];
  return `<div class="sess" data-step="${i}" data-kind="${st.kind}">
  <div class="sbar"><button class="sx" data-exit aria-label="Stop the lesson">✕</button><div class="sprog" aria-hidden="true"><i style="width:${Math.round((i + 1) / n * 100)}%"></i></div>
   <span class="scount" data-count>Step ${i + 1} of ${n}</span><button class="sx" data-more aria-label="More">☰</button></div>
  <div class="sbody">
   <div class="slabel">${esc(st.label)}</div>
   <h1 class="stitle">${esc(st.title)}</h1>
   ${st.text ? `<p class="stext">${esc(st.text)}</p>` : ''}
   ${dias ? `<div class="sdias${D.length > 2 ? ' many' : ''}">${dias}</div>` : ''}
   ${band}
   ${q ? `<div class="squiz">${q.options.map(o => `<button class="qopt${ans != null ? (o === q.answer ? ' right' : o === ans ? ' wrong' : ' dim') : ''}" data-opt="${esc(o)}"${ans != null ? ' disabled' : ''}>${esc(o)}</button>`).join('')}</div>
     <div class="qfb" data-qfb role="status">${ans != null ? (ans === q.answer ? '✓ Right!' : `Not quite. It's ${esc(q.answer)}.`) : 'Tap your answer.'}</div>` : ''}
   ${a ? `<div class="saud"><button class="btn t" data-aud></button>${beats}</div>` : ''}
   <div class="sfail" data-fail hidden><b>Can't hear anything?</b> Turn the volume up and flip the side switch off silent, then tap the button.
     <div class="row"><button class="btn t" data-test>🔊 Test sound</button><a href="#sound">Sound details</a></div></div>
   ${r ? `<button class="repbig${got >= r ? ' full' : ''}" data-rep><span data-replbl>${got >= r ? (r > 1 ? `All ${r} done! 🎉` : 'Done! 🎉') : (r > 1 ? 'Tap here after each one' : 'Tap here when you\'ve done it')}</span>
     <b data-repn>${Math.min(got, r)} / ${r}</b><span class="rdots">${Array.from({length: r}, (_, j) => `<i class="${j < got ? 'on' : ''}"></i>`).join('')}</span></button>` : ''}
  </div>
  <div class="sfoot"><button class="btn s sback" data-prev aria-label="Previous step"${i ? '' : ' disabled'}>←</button>
   ${st.kind === 'review' ? '<button class="btn s shard" data-hard>😬 Too hard</button>' : ''}
   <button class="btn snext${(r && got >= r) || (q && ans != null) ? ' ready' : ''}" data-next>${last ? 'Finish ✓' : 'Next →'}</button></div>
 </div>`;
}
function showStep(i, push){
  stopStepAudio(); A.stop('fx');
  const l = SESS.l, plan = SESS.plan, n = plan.steps.length;
  if(i >= n) return finish(push);
  i = Math.max(0, i); S.sess.i = i; save();
  setHash(`#${l.date}/${i + 1}`, push);
  document.body.classList.add('insess'); header(null);
  const st = plan.steps[i];
  $('#view').innerHTML = stepHTML(st, i, n, l); window.scrollTo(0, 0);
  window.__step = {day: l.day, i, n, kind: st.kind, reps: st.reps || 0, audio: st.audio ? {kind: st.audio.kind, ch: audioCh(st.audio), name: audioName(st.audio)} : null, quiz: st.quiz ? {answer: st.quiz.answer} : null};
  document.title = `Step ${i + 1} of ${n} · Guitar Plan`;
  wireStep(st, i, n);
  if(st.audio) playStep(st);   /* synchronous inside the Start/Next tap, so iOS allows it */
}
function audUI(st, on){
  const b = document.querySelector('[data-aud]'); if(!b) return; const k = st.audio.kind;
  b.classList.toggle('playing', on);
  b.textContent = on ? (k === 'play' ? '■ Stop' : k === 'metro' ? '■ Stop the click' : '■ Stop the band') : (k === 'play' ? '↻ Hear it again' : k === 'metro' ? '▶ Start the click' : '▶ Play the band');
  if(!on) document.querySelectorAll('[data-beats] i').forEach(x => x.classList.remove('on'));
}
function playStep(st){
  stopStepAudio(); const a = st.audio, sa = SA = {kind: a.kind};
  const done = () => { if(SA !== sa) return; clearTimeout(sa.h); SA = null; audUI(st, false); };
  const beat = b => document.querySelectorAll('[data-beats] i').forEach((x, j) => { x.classList.toggle('on', j === b); x.classList.toggle('a', j === 0); });
  audUI(st, true);
  if(a.kind === 'play') A.play(a.name, {onEnd: done});
  else if(a.kind === 'metro'){ sa.obj = new A.Metronome({bpm: a.bpm, onBeat: beat, onStop: done}); sa.obj.start(); sa.h = setTimeout(() => { if(SA === sa){ sa.obj.stop(); done(); } }, a.secs * 1000); }
  else { const now = $('[data-now]'), nx = $('[data-nextc]'), pr = a.spec.prog;
    sa.obj = new A.Loop({spec: a.spec, bpm: a.bpm, drums: a.drums, page: a.page, onBeat: beat, onStop: done,
      onBar: bar => { if(now) now.textContent = pr[bar]; if(nx) nx.textContent = 'then ' + pr[(bar + 1) % pr.length]; }});
    sa.obj.start(); sa.h = setTimeout(() => { if(SA === sa){ sa.obj.stop(); done(); } }, a.secs * 1000); }
}
function wireStep(st, i, n){
  const v = $('#view');
  v.querySelector('[data-next]').onclick = () => showStep(i + 1, true);
  v.querySelector('[data-prev]').onclick = () => { if(i > 0) showStep(i - 1, true); };
  v.querySelector('[data-exit]').onclick = () => { stopStepAudio(); go(`#${SESS.l.date}`); };
  v.querySelector('[data-more]').onclick = openMore;
  const hard = v.querySelector('[data-hard]'); if(hard) hard.onclick = () => { S.sess.hard[i] = true; save(); toast('No problem. It comes back tomorrow.'); showStep(i + 1, true); };
  const ab = v.querySelector('[data-aud]'); if(ab){ audUI(st, false); ab.onclick = () => { if(SA) { stopStepAudio(); audUI(st, false); } else playStep(st); }; }
  const tb = v.querySelector('[data-test]'); if(tb) tb.onclick = () => { stopStepAudio(); tb.classList.add('playing'); tb.textContent = '■ Playing test sound…'; A.test(() => { tb.classList.remove('playing'); tb.textContent = '🔊 Test sound'; }); };
  const rb = v.querySelector('[data-rep]'); if(rb) rb.onclick = () => {
    const r = st.reps, got = S.sess.reps[i] = (S.sess.reps[i] || 0) + 1; save();
    rb.querySelectorAll('.rdots i').forEach((d, j) => d.classList.toggle('on', j < got));
    rb.querySelector('[data-repn]').textContent = `${Math.min(got, r)} / ${r}`;
    rb.classList.remove('flash'); void rb.offsetWidth; rb.classList.add('flash');
    if(got >= r){ rb.classList.add('full'); rb.querySelector('[data-replbl]').textContent = r > 1 ? `All ${r} done! 🎉 Tap Next.` : 'Done! 🎉 Tap Next.';
      v.querySelector('[data-next]').classList.add('ready'); if(SA && SA.kind !== 'play'){ stopStepAudio(); audUI(st, false); } }
    else rb.querySelector('[data-replbl]').textContent = `Nice! ${r - got} more.`;
  };
  v.querySelectorAll('[data-opt]').forEach(b => b.onclick = () => {
    if(S.sess.quiz[i] != null) return; const q = st.quiz, ok = b.dataset.opt === q.answer; S.sess.quiz[i] = b.dataset.opt;
    const c = S.cards[q.deck] = S.cards[q.deck] || {r: 0, w: 0}; ok ? c.r++ : c.w++; S.cards.last = today(); save();
    v.querySelectorAll('[data-opt]').forEach(x => { x.disabled = true; x.classList.add(x.dataset.opt === q.answer ? 'right' : x === b ? 'wrong' : 'dim'); });
    v.querySelector('[data-qfb]').textContent = ok ? '✓ Right!' : `Not quite. It's ${q.answer}.`;
    v.querySelector('[data-next]').classList.add('ready');
  });
}
/* ---------- finish: everything is saved automatically ---------- */
function finish(push){
  stopStepAudio();
  const l = SESS.l, ss = S.sess || {hard: {}}, t = today();
  if(!S.done[l.day]) S.done[l.day] = t;
  addKeeper(l);
  SESS.plan.steps.filter(s => s.kind === 'review').forEach(s => {
    if(!S.keepers[s.review]) S.keepers[s.review] = {stage: 0, due: t, added: t, hist: []};
    if(!S.keepers[s.review].hist.some(h => h[0] === t)) grade(s.review, !ss.hard[s.i]); });
  S.last = {day: l.day, date: t}; delete S.sess; save();
  setHash(`#${l.date}/done`, push);
  renderFinish(l); A.chime();
}
function finishHTML(l){
  const nx = nextLabel(l), due = dueList().length, done = Object.keys(S.done).length;
  return `<div class="fin" data-finish="${l.day}">
   <div class="fcheck">✓</div><h1>Done for today ✓</h1>
   <p class="fwin"><b>Today's win:</b> ${esc(l.win)}</p>
   ${nx ? `<div class="ftmr"><small>${esc(nx.when)}${nx.when === 'Tomorrow' ? '' : ` · ${esc(fmt(nx.n.date))}`}:</small><b>Day ${nx.n.day}: ${esc(nx.n.title)}</b></div>` : '<div class="ftmr"><b>That was the last lesson of the plan. Amazing work! 🎉</b></div>'}
   <p class="meta">Saved. ${done} lesson${done === 1 ? '' : 's'} done. Your review songs and licks are scheduled automatically.</p>
   <button class="btn huge" data-gohome>Back to start</button>
  </div>`;
}
function renderFinish(l){
  document.body.classList.remove('insess'); header(l);
  $('#view').innerHTML = finishHTML(l); window.scrollTo(0, 0); window.__step = {day: l.day, finished: true};
  document.title = 'Done for today · Guitar Plan';
  $('[data-gohome]').onclick = () => go('#today');
}

function miniNeck(c){ const W = 300, H = 100, x0 = 22, fw = 21, y0 = 14, dy = 14;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="width:100%;height:auto" role="img" aria-label="fretboard">`;
  for(let i = 0; i < 6; i++) s += `<line x1="${x0}" y1="${y0+i*dy}" x2="${x0+12*fw}" y2="${y0+i*dy}" stroke="#3b2f2a" stroke-width="${0.8+i*0.25}"/><text x="4" y="${y0+i*dy+4}" class="sl">${'eBGDAE'[i]}</text>`;
  for(let f = 0; f <= 12; f++) s += `<line x1="${x0+f*fw}" y1="${y0}" x2="${x0+f*fw}" y2="${y0+5*dy}" stroke="#3b2f2a" stroke-width="${f ? 1 : 4}"/>`;
  for(let f = 1; f <= 12; f++) s += `<text x="${x0+(f-.5)*fw}" y="${y0+5*dy+16}" text-anchor="middle" class="fn">${f}</text>`;
  const dot = (st, f, col) => { const x = f === 0 ? x0 - 9 : x0 + (f - .5)*fw; return `<circle cx="${x}" cy="${y0+(st-1)*dy}" r="6.5" fill="${col}" stroke="#3b2f2a"/>`; };
  s += dot(c.s, c.f, '#c8643b'); if(c.s2) s += dot(c.s2, c.f2, '#2f7f86');
  return s + '</svg>'; }

/* ---------- review ---------- */
function reviewView(){
  const due = dueList(); const all = Object.entries(S.keepers).map(([d, k]) => ({day: +d, ...k}));
  const up = all.filter(k => k.due > today()).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 12);
  const mastered = all.filter(k => k.mastered);
  const row = k => { const l = BYDAY[k.day]; const nxt = k.stage + 1 < INT.length ? INT[k.stage + 1] : 30;
    return `<div class="kq"><div><b>${esc(l.k)}</b></div><div class="meta">From <a href="#${BYDAY[k.day].date}">Day ${k.day}: ${esc(l.title)}</a> · review #${k.hist.length + 1} · stage ${k.stage + 1}/5${k.stage >= 2 ? ' · try it +5 bpm' : ''}</div>
    <div class="row">${l.ex ? `<button class="btn s sm" data-lex="${l.day}" data-bpm="${l.bpm || 80}">▶ Hear it</button>` : ''}<button class="btn g sm" data-got="${k.day}">✓ Got it (next in ${INT[Math.min(k.stage + 1, 4)]}d)</button><button class="btn s sm" data-shaky="${k.day}">↺ Shaky (tomorrow)</button></div></div>`; };
  return `<h1>My review list</h1><p class="meta">You don't need to do anything here: due items show up automatically as “Quick review” steps in your next lesson. Items come back after 1, 3, 7, 14 and 30 days.</p>
  <div class="card">${P.gfx.retain_m}</div>
  <div class="card"><h2>Due today <span class="chip">${due.length}</span></h2>${due.length ? due.map(row).join('') : `<p>Nothing due. ${Object.keys(S.keepers).length ? 'Nice work — come back tomorrow.' : 'Finish a guided lesson and its keeper item lands here tomorrow.'}</p>`}</div>
  <div class="card"><h2>Coming up</h2>${up.length ? `<div class="list">${up.map(k => `<a class="it" href="#${BYDAY[k.day].date}"><span>${esc(BYDAY[k.day].k)}</span><span class="d">${fmt(k.due)}</span></a>`).join('')}</div>` : '<p class="note">Nothing scheduled yet.</p>'}</div>
  <div class="card"><h2>Mastered <span class="chip" style="background:var(--green)">${mastered.length}</span></h2>${mastered.map(k => `<span class="chip o">${esc(BYDAY[k.day].k)}</span>`).join('') || '<p class="note">Items graduate after the 30-day review.</p>'}</div>
  <details><summary>The full Keeper List (all ${P.keepers.length} planned items)</summary><div class="list">${P.keepers.map(k => `<a class="it ${S.keepers[k.day] ? 'dn' : ''}" href="#${BYDAY[k.day].date}"><span>${esc(k.k)}</span><span class="d">Day ${k.day}</span></a>`).join('')}</div></details>`;
}
function wireReview(){
  document.querySelectorAll('[data-got]').forEach(b => b.onclick = () => { grade(+b.dataset.got, true); toast('Rescheduled further out.'); route(); });
  document.querySelectorAll('[data-shaky]').forEach(b => b.onclick = () => { grade(+b.dataset.shaky, false); toast('Back tomorrow — no worries.'); route(); });
  wirePlay(document);
}

/* ---------- songs ---------- */
function songsView(){
  const groups = {}; P.songs.forEach(s => (groups[s.type] = groups[s.type] || []).push(s));
  return `<h1>Song lessons</h1><p class="meta">Step-by-step lessons with number charts, keys/capo options, strum & picking patterns, fills and a synthesized backing loop. Chord progressions only — no lyrics.</p>
  ${Object.entries(groups).map(([g, ss]) => `<div class="card"><h2>${esc(g)}</h2><div class="list">${ss.map(s => `<a class="it" href="#song-${s.id}"><span><b>${esc(s.title)}</b><br><small class="meta">${esc(s.credit)}</small></span><span class="d">${esc(s.key)} · ${s.bpm} bpm</span></a>`).join('')}</div></div>`).join('')}`;
}
const numToChord = GM.numToChord, voicingName = GM.voicingName;
function songView(id, key){
  const s = SONG[id]; if(!s) return '<div class="card"><h1>Song not found</h1><p>That song link is out of date. <a href="#songs">See all song lessons →</a></p></div>'; key = P.keys[key] ? key : s.key;
  const used = L.filter(l => l.song === id);
  const letters = new Set(); s.sections.forEach(sec => sec[1].forEach(t => letters.add(numToChord(t, key))));
  const diaNames = key === s.key ? s.chords : [...letters].map(c => voicingName(c, s, key));
  GM.songLoops(s, key).forEach((sp, i) => { LOOPS[`S${i}`] = sp; });
  const arrows = s.strum.split(' ').map(x => x === 'D' ? '↓' : x === 'U' ? '↑' : x).join(' ');
  return `<p><a href="#songs">← All songs</a></p><div class="card" style="border-top:6px solid var(--green)" id="song-${s.id}">
  <span class="chip" style="background:var(--green)">${esc(s.type)}</span><h1>${esc(s.title)}</h1><div class="meta">${esc(s.credit)} · ${esc(s.meter)} · ~${s.bpm} bpm · ${esc(s.feel)}</div>
  <p class="note">${esc(P.disclaimer)}</p>
  <div class="row"><span class="note">Key:</span>${GM.songKeys(s).map(k => `<a class="chip ${k === key ? '' : 'o'}" href="#song-${s.id}/${k}">${k}${k === s.key ? ' (home)' : ''}</a>`).join('')}</div>
  <table class="tbl"><tr><th>Sounding key</th><th>How</th><th>Why</th></tr>${s.capo.map(c => `<tr><td>${esc(c[0])}</td><td>${esc(c[1])}</td><td>${esc(c[2])}</td></tr>`).join('')}</table></div>
  <div class="card"><h2>Step by step</h2><ol class="steps">${s.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>
  <div class="card"><h2>Chords (key of ${key})</h2><div class="dias">${diaNames.filter((v, i, a) => a.indexOf(v) === i).map(n => P.chords[n] ? chordDia(n) : `<span class="chip o">${esc(n)}</span>`).join('')}</div></div>
  <div class="card"><h2>Chart — numbers & chords</h2><p class="note">One box = one bar (4 beats${s.meter === '3/4' ? '; this song is in 3' : ''}). Top: chord in ${key}. Bottom: Nashville number.</p>
  ${s.sections.map((sec, i) => `<h3>${esc(sec[0])} <small class="meta">×${sec[2]} · ${esc(sec[3])}</small></h3>
   <div class="chart">${sec[1].map(t => `<div class="bar"><b>${esc(numToChord(t, key))}</b><small>${esc(t)}</small></div>`).join('')}</div>
   ${loopUI(Object.assign({label: `${sec[0]} in ${key}`}, LOOPS['S' + i]), 'S' + i)}`).join('')}</div>
  <div class="card"><h2>Rhythm</h2><p><b>Strum:</b> <span style="font:700 1.2rem ui-monospace,monospace">${esc(arrows)}</span><br><span class="note">Count: 1 & 2 & 3 & 4 & — ↓ = down, ↑ = up, − = miss the strings but keep your arm moving.</span></p>
  <p><b>Fingerpicking:</b> ${esc(s.pick)}</p></div>
  <div class="card"><h2>Lead & fill ideas</h2><ul>${s.lead.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="note">Tab for these licks lives in the linked daily lessons. <a href="#tab">How to read tab →</a></p></div>
  ${used.length ? `<div class="card"><h2>Used in your plan</h2><div class="list">${used.map(l => `<a class="it" href="#${BYDAY[l.day].date}"><span>Day ${l.day}: ${esc(l.title)}</span><span class="d">${fmt(l.date)}</span></a>`).join('')}</div></div>` : ''}`;
}
/* ---------- plan ---------- */
function planView(){
  const weeks = {}; L.forEach(l => (weeks[l.week] = weeks[l.week] || []).push(l));
  return `<div class="hero"><h1>Parker's 6-Month Guitar Plan</h1><p>Theory · neck navigation · worship guitar · soloing · jamming</p><p>130 weekday lessons · 20–30 min each · Oct 5, 2026 → Apr 2, 2027</p></div>
  <div class="card"><h2>Roadmap</h2>${P.gfx.roadmap_m}</div>
  <div class="card"><h2>Weekly rhythm</h2>${P.gfx.rhythm}</div>
  <div class="card"><h2>How it sticks</h2>${P.gfx.retain_m}<ul>
   <li><b>Keeper List:</b> each lesson adds one item; it comes back as a quick review step after 1, 3, 7, 14 and 30 days.</li>
   <li><b>Quick quiz</b> at the end of most lessons: fretboard notes, Nashville numbers, chord tones, intervals.</li>
   <li><b>48-hour rule:</b> every new skill is used in real music (song, jam or loop) within two days.</li>
   <li><b>Overlearning:</b> 3 clean reps in a row at the target tempo before moving on; +5 bpm when it comes back.</li>
   <li><b>Teach it back</b> every Friday, and a <b>cooldown</b> “play it once more from memory” every session.</li></ul>
   <p><a href="#tab">How to read tab →</a> · No standard notation is used anywhere — only tab, chord boxes and fretboard maps.</p></div>
  ${P.phases.map(p => `<div class="card" style="border-left:6px solid ${p.color}"><h2>Month ${p.n}: ${esc(p.name)} <small class="meta">${esc(p.sub)} · weeks ${p.weeks[0]}–${p.weeks[1]}</small></h2>
   <p>${esc(p.theme)}</p><b>By the end you can…</b><ul>${p.milestone.map(m => `<li>${esc(m)}</li>`).join('')}</ul>
   ${Object.keys(weeks).filter(w => w >= p.weeks[0] && w <= p.weeks[1]).map(w => `<details ${weeks[w].some(l => l.date === todayLesson().l.date) ? 'open' : ''}><summary>Week ${w}: ${esc(P.week_themes[w])}${P.review_weeks[w] ? ` <span class="chip o">${esc(P.review_weeks[w])}</span>` : ''}</summary>
    <div class="list">${weeks[w].map(l => `<a class="it ${S.done[l.day] ? 'dn' : ''}" href="#${BYDAY[l.day].date}"><span><b>${l.weekday}</b> ${esc(l.title)}</span><span class="d">D${l.day} · ${fmt(l.date, {month:'short', day:'numeric'})}</span></a>`).join('')}</div></details>`).join('')}</div>`).join('')}
  <p class="note">Data version ${P.version} · generated ${esc(P.generated)}</p>`;
}
function tabView(){ return `<div class="card"><h1>How to read tab</h1>
  <p>Tab is a picture of your guitar neck — no music reading needed.</p>
  <ul><li><b>6 lines = 6 strings.</b> Top line = high e (thinnest), bottom line = low E (thickest). It's the neck as you see it looking down at it.</li>
  <li><b>Numbers = frets.</b> 3 on the B line = 3rd fret of the B string. <b>0</b> = open string.</li>
  <li><b>Stacked numbers</b> are played together (a chord). Left-to-right is the order in time.</li>
  <li><b>Rhythm:</b> counts under the tab (1 & 2 & …), the lesson's BPM on the metronome, and the ▶ audio example.</li>
  <li><b>Symbols:</b> h = hammer-on, p = pull-off, / = slide up, \\ = slide down, b = bend (7b9 = bend fret 7 up to the pitch of fret 9), ~ = vibrato, | = bar line.</li>
  <li><b>Strums:</b> D (↓) = downstroke, U (↑) = upstroke, − = keep the arm moving but miss the strings.</li></ul>
  <div class="dias">${dia('tab_howto', 70)}</div>
  <p><b>Chord boxes</b> are vertical: strings run top to bottom, low E on the left. ○ = open, × = don't play, numbers in dots = which finger (1 index … 4 pinky), orange dot = the root.</p>
  <div class="dias">${chordDia('G')}${chordDia('Cadd9')}</div>
  <p><b>Fretboard maps</b> are horizontal like tab (high e on top). Orange = root, teal = highlighted tones (3rds, color notes), white = other scale notes.</p></div>`; }

/* ---------- progress ---------- */
function streak(){
  const t = today(); const past = L.filter(l => l.date <= t); let n = 0;
  for(let i = past.length - 1; i >= 0; i--){ const l = past[i]; if(S.done[l.day]) n++; else if(l.date === t || (l.tag || '').startsWith('Holiday')) continue; else break; }
  return n;
}
function progressView(sub){
  const done = Object.keys(S.done).length, mins = Object.keys(S.done).reduce((a, d) => a + BYDAY[d].minutes, 0);
  const ks = Object.values(S.keepers); const cr = Object.entries(S.cards).filter(([k]) => k !== 'last').reduce((a, [k, v]) => [a[0] + v.r, a[1] + v.w], [0, 0]);
  return `<h1>Progress</h1><div class="stat"><div><b>${streak()}</b><small>lesson streak</small></div><div><b>${done}</b><small>of 130 lessons</small></div><div><b>${Math.round(mins/60*10)/10}</b><small>hours played</small></div>
   <div><b>${ks.length}</b><small>keepers learned</small></div><div><b>${ks.filter(k => k.mastered).length}</b><small>mastered</small></div><div><b>${cr[0] + cr[1] ? Math.round(cr[0]/(cr[0]+cr[1])*100) + '%' : '—'}</b><small>quiz accuracy</small></div></div>
  <div class="card"><h2>By month</h2>${P.phases.map(p => { const ls = L.filter(l => l.phase === p.n), d = ls.filter(l => S.done[l.day]).length;
    return `<div style="margin:8px 0"><div class="row" style="justify-content:space-between"><b>Month ${p.n}: ${esc(p.name)}</b><span class="meta">${d}/${ls.length}</span></div><div class="prog"><i style="width:${d/ls.length*100}%;background:${p.color}"></i></div></div>`; }).join('')}</div>
  <h2>Checkpoints</h2><p class="meta">At the end of each month, check off what you can do, rate yourself and leave a note. Streaks skip weekends and optional holidays.</p>
  ${P.phases.map(p => { const c = S.checkpoints[p.n] || {items: [], rating: 0, note: ''}; const day = L.find(l => l.checkpoint === p.n);
   return `<div class="card" id="cp${p.n}" style="border-left:6px solid ${p.color}"><h3>Month ${p.n} checkpoint <small class="meta">· <a href="#${BYDAY[day.day].date}">Day ${day.day}, ${fmt(day.date)}</a>${c.date ? ` · saved ${fmt(c.date)}` : ''}</small></h3>
   ${p.milestone.map((m, i) => `<label class="row" style="flex-wrap:nowrap;align-items:flex-start;margin:4px 0"><input type="checkbox" data-cp="${p.n}" data-i="${i}" ${c.items[i] ? 'checked' : ''}> <span>${esc(m)}</span></label>`).join('')}
   <div class="stars" data-stars="${p.n}">${[1,2,3,4,5].map(i => `<button data-r="${i}" class="${i <= c.rating ? 'on' : ''}" aria-label="${i} stars">★</button>`).join('')}</div>
   <textarea data-note="${p.n}" placeholder="What felt great? What needs another week?">${esc(c.note)}</textarea></div>`; }).join('')}
  <p><a class="btn s" href="#sound">🔊 Test sound</a></p>
  <div class="card"><h3>Data</h3><p class="note">Progress is stored only on this device (localStorage).</p><div class="row"><button class="btn s sm" data-export>Copy backup</button><button class="btn s sm" data-reset>Reset all progress</button></div><textarea data-backup readonly hidden></textarea></div>`;
}
function wireProgress(sub){
  const cp = n => S.checkpoints[n] = S.checkpoints[n] || {items: [], rating: 0, note: ''};
  document.querySelectorAll('[data-cp]').forEach(b => b.onchange = () => { const c = cp(b.dataset.cp); c.items[+b.dataset.i] = b.checked; c.date = today(); save(); });
  document.querySelectorAll('[data-stars]').forEach(g => g.querySelectorAll('button').forEach(b => b.onclick = () => { const c = cp(g.dataset.stars); c.rating = +b.dataset.r; c.date = today(); save(); route(); }));
  document.querySelectorAll('[data-note]').forEach(t => t.onchange = () => { const c = cp(t.dataset.note); c.note = t.value; c.date = today(); save(); toast('Saved'); });
  const ex = document.querySelector('[data-export]'); if(ex) ex.onclick = () => { const txt = JSON.stringify(S);
    const fallback = () => { const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, txt.length); let ok = false; try{ ok = document.execCommand('copy'); }catch(e){} ta.remove();
      if(ok) toast('Backup copied to clipboard'); else { const box = document.querySelector('[data-backup]'); box.hidden = false; box.value = txt; box.focus(); box.select(); toast('Select the text below and copy it'); } };
    try{ if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => toast('Backup copied to clipboard'), fallback); else fallback(); }catch(e){ fallback(); } };
  const rs = document.querySelector('[data-reset]'); if(rs) rs.onclick = () => { if(confirm('Erase all progress on this device?')){ localStorage.removeItem(KEY); location.reload(); } };
  wireSound(document);
  if(sub){ const el = document.getElementById(sub); if(el) el.scrollIntoView(); }
}

/* ---------- reference pages (behind ☰ More) ---------- */
let MET = null;
function metroUI(l){ const b = A.nearestBpm(l.bpm || 70);
  return `<div class="card metro" id="metro"><h3>🎵 Metronome <small class="meta">target ${l.bpm ? l.bpm + ' bpm' : 'comfortable tempo'}</small></h3>
  <div class="row" style="justify-content:center"><button class="btn s sm" data-m="-10">−10</button><button class="btn s sm" data-m="-5">−5</button>
  <span class="bpm" data-bpm>${b}</span><button class="btn s sm" data-m="5">+5</button><button class="btn s sm" data-m="10">+10</button></div>
  <div class="beats" data-beats><i></i><i></i><i></i><i></i></div>
  <div class="row" style="justify-content:center"><button class="btn t" data-mp>▶ Start metronome</button></div></div>`; }
function wireMetro(l){
  const el = $('#metro'); if(!el) return; if(MET) MET.stop();
  let bpm = A.nearestBpm(l.bpm || 70); const bv = el.querySelector('[data-bpm]'), dots = el.querySelectorAll('[data-beats] i'), btn = el.querySelector('[data-mp]');
  const idle = () => { btn.textContent = '▶ Start metronome'; btn.classList.remove('playing'); dots.forEach(d => d.classList.remove('on')); };
  MET = new A.Metronome({bpm, onBeat: i => dots.forEach((d, j) => { d.classList.toggle('on', j === i); d.classList.toggle('a', j === 0); }), onStop: idle});
  window.__metro = MET;
  el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { bpm = A.stepBpm(bpm, +b.dataset.m); bv.textContent = bpm; MET.setBpm(bpm); });
  btn.onclick = () => { if(MET.running){ MET.stop(); idle(); } else { MET.start(); btn.textContent = '■ Stop metronome'; btn.classList.add('playing'); } };
}
function notesView(l){
  const ph = PH[l.phase];
  if(l.loop) LOOPS['L' + l.day] = Object.assign({}, l.loop, {search: l.track});
  const songs = (l.songs || []).map(s => `<span class="chip o">${esc(s[0])} · ${esc(s[1])} · ${esc(s[2])}</span>`).join('');
  const nav = d => BYDAY[d] ? `#notes-${BYDAY[d].date}` : '';
  return `<p><a href="#${l.date}">← Back to the guided lesson</a></p>
  <div class="card" style="border-top:6px solid ${ph.color}">
   <div class="meta">Day ${l.day} of 130 · Week ${l.week} · ${fmt(l.date, {weekday:'long', month:'short', day:'numeric', year:'numeric'})}</div>
   <h1>${esc(l.title)}</h1><span class="chip" style="background:${ph.color}">Month ${ph.n}: ${esc(ph.name)}</span>${l.tag ? `<span class="chip o">${esc(l.tag)}</span>` : ''}
   <p class="note">The full written notes for this lesson. You don't need them: the guided lesson walks you through all of it.</p></div>
  <div class="card">
   <h3>Why this matters</h3><p>${esc(l.why)}</p>
   <h3>Warm-up</h3><p>${esc(l.warm)}</p>
   <h3>Steps</h3><ol class="steps">${l.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
   ${l.dia.length ? `<div class="dias">${l.dia.map(k => dia(k, l.bpm)).join('')}</div>` : ''}
   ${l.ex ? `<p><button class="btn t" data-lex="${l.day}" data-bpm="${l.bpm || 80}">▶ Play example</button></p>` : ''}
   <p class="note">🔁 ${esc(l.reps)}</p>
   <h3>Use it in music</h3><p>${esc(l.use)}</p>${l.song ? `<p>Song lesson: ${songLink(l.song)}</p>` : ''}${songs ? `<div>${songs}</div>` : ''}
   ${loopUI(l.loop, 'L' + l.day)}
   ${l.teach ? `<h3>Teach it back</h3><p>${esc(l.teach)}</p>` : ''}
   <h3>Cooldown</h3><p>${esc(l.cool)}</p>
   <div class="win"><b>🏆 Win for today:</b> ${esc(l.win)}</div></div>
  ${metroUI(l)}
  <div class="pager">${nav(l.day - 1) ? `<a class="btn s pv" href="${nav(l.day - 1)}">← Day ${l.day - 1}</a>` : '<span></span>'}<a class="btn s" href="#plan">All lessons</a>${nav(l.day + 1) ? `<a class="btn s nx" href="${nav(l.day + 1)}">Day ${l.day + 1} →</a>` : '<span></span>'}</div>`;
}
function soundCard(){ return `<div class="card sound" data-sound><button class="btn t big" data-test>🔊 Test sound</button>
  <div class="note">Plays a short guitar strum. No sound? Turn the volume up and flip the side switch off silent.</div>
  <details data-diag open><summary>Sound diagnostics</summary><pre class="diag" data-diagtxt></pre><button class="btn s sm" data-diagcopy>Copy diagnostics</button></details></div>`; }
const soundView = () => `<h1>Test sound</h1><p class="meta">If a lesson step plays nothing, test here. If the strum plays here but not in a lesson, tap Copy diagnostics and send it over.</p>${soundCard()}`;

let SWV = '?';
function swVersion(){ if(window.caches) caches.keys().then(k => { SWV = (k.filter(x => x.startsWith('guitar-plan-')).join(',') || 'no cache') + (navigator.serviceWorker && navigator.serviceWorker.controller ? ' (active)' : ' (not controlling)'); }).catch(() => {}); }
function wireSound(root){
  const c = (root || document).querySelector('[data-sound]'); if(!c) return;
  const b = c.querySelector('[data-test]'), d = c.querySelector('[data-diag]'), pre = c.querySelector('[data-diagtxt]');
  b.onclick = () => { if(b.classList.contains('playing')){ A.stopAll(); return; }
    b.classList.add('playing'); b.textContent = '■ Playing test sound…';
    A.test(() => { b.classList.remove('playing'); b.textContent = '🔊 Test sound'; }); };
  const draw = () => { if(d.open) pre.textContent = A.diagText({app: APP_VERSION, sw: SWV}); };
  d.ontoggle = () => { swVersion(); draw(); }; clearInterval(wireSound.h); wireSound.h = setInterval(draw, 500);
  c.querySelector('[data-diagcopy]').onclick = () => copyText(A.diagText({app: APP_VERSION, sw: SWV}), 'Diagnostics copied');
}
function copyText(txt, okMsg){
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, txt.length); let ok = false; try{ ok = document.execCommand('copy'); }catch(e){} ta.remove(); toast(ok ? okMsg : 'Copy failed — take a screenshot instead'); return ok; };
  try{ if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => toast(okMsg), fallback); else fallback(); }catch(e){ fallback(); }
}

A.onError((msg, name, ch) => {
  const soft = /NotAllowed/.test(msg) && performance.now() - GEST > 1500;   // autoplay without a tap (reload / back button): just wait for a tap
  if(soft){ toast('Tap ▶ to hear it.'); return; }
  toast(`⚠️ Sound didn't play: ${msg}`);
  const f = document.querySelector('[data-fail]'); if(f) f.hidden = false;
  const d = document.querySelector('[data-diag]'); if(d && !d.open) d.open = true;
});
/* ---------- ☰ More ---------- */
function moreItems(){ const cur = (SESS && document.body.classList.contains('insess')) ? SESS.l : (window.__viewing ? BYDAY[window.__viewing] : todayLesson().l);
  return [['#today', '🏠', "Today's lesson"], ['#plan', '🗓', 'All lessons (the plan)'], ['#songs', '🎶', 'Songs'], ['#progress', '📈', 'My progress'],
    ['#review', '🔁', 'My review list'], ['#tab', '📖', 'How to read tab'], [`#notes-${cur.date}`, '📝', `Written notes for Day ${cur.day}`], ['#sound', '🔊', 'Test sound']]; }
function openMore(){
  const m = $('#more'); m.innerHTML = `<div class="pan" role="dialog" aria-label="More"><div class="row" style="justify-content:space-between"><b>More</b><button class="sx" data-close aria-label="Close">✕</button></div>
   ${moreItems().map(([h, i, t]) => `<a href="${h}" data-mi="${h.slice(1).split('-')[0]}"><span>${i}</span>${esc(t)}</a>`).join('')}
   ${document.body.classList.contains('insess') ? '<p class="note">Your place in the lesson is saved. Come back any time and tap “Keep going”.</p>' : ''}</div>`;
  m.hidden = false;
  m.onclick = e => { if(e.target === m || e.target.closest('[data-close]')) m.hidden = true; else if(e.target.closest('a')) { m.hidden = true; stopStepAudio(); } };
}
/* ---------- router ---------- */
let LASTH = null;
function go(h){ if(location.hash === h){ LASTH = null; route(); } else location.hash = h; }
function route(){
  LASTH = location.hash; $('#more').hidden = true;
  A.stopAll(); stopStepAudio(); A.stop('fx'); if(MET) { MET.stop(); MET = null; }
  document.body.classList.remove('insess');
  let h = decodeURIComponent(location.hash.slice(1)) || 'today', m, html = '', after = null, viewing = null, title = 'Today';
  if((m = h.match(/^(\d{4}-\d{2}-\d{2})\/(\d+|done)$/)) || (m = h.match(/^day-(\d{1,3})\/(\d+|done)$/))){
    const l = /^\d{4}/.test(m[1]) ? lessonFor(m[1]).l : BYDAY[+m[1]];
    if(l && m[2] === 'done' && S.done[l.day]){ SESS = {l, plan: null}; renderFinish(l); window.__viewing = l.day; return; }
    if(l && m[2] !== 'done' && S.sess && S.sess.day === l.day){ SESS = {l, plan: buildSess(l)}; showStep(+m[2] - 1, false); return; }
    history.replaceState({gp: 1}, '', `#${l ? l.date : 'today'}`); return route();
  }
  if(/^(cards|today$)/.test(h) && h !== 'today'){ history.replaceState({gp: 1}, '', '#today'); h = 'today'; }
  if((m = h.match(/^day-(\d{1,3})$/)) && BYDAY[+m[1]]){ const l = BYDAY[+m[1]]; viewing = l; html = homeView(l, null); after = () => wireHome(l); }
  else if((m = h.match(/^(\d{4}-\d{2}-\d{2})$/))){ const r = lessonFor(m[1]); viewing = r.l;
    const note = r.note && m[1] !== today() ? r.note.replace("Here's Day 1 so you can try it early.", 'Showing Day 1.') : r.note;
    html = homeView(r.l, note, r.weekend); after = () => wireHome(r.l); }
  else if(h === 'today'){ const t = todayLesson(); viewing = t.l; html = homeView(t.l, t.note, t.weekend); after = () => wireHome(t.l); }
  else if((m = h.match(/^notes-(\d{4}-\d{2}-\d{2}|day-\d{1,3})$/))){ const l = m[1].startsWith('day-') ? BYDAY[+m[1].slice(4)] : lessonFor(m[1]).l; viewing = l; title = 'Notes';
    html = l ? notesView(l) : ''; after = () => { wireMetro(l); wirePlay(document); wireLoops(document); }; }
  else if(h === 'review'){ title = 'Review'; html = reviewView(); after = wireReview; }
  else if(h === 'songs'){ title = 'Songs'; html = songsView(); }
  else if((m = h.match(/^song-([a-z0-9-]+?)(?:\/([A-G]b?))?$/))){ title = 'Song'; html = songView(m[1], m[2]); after = () => { wirePlay(document); wireLoops(document); }; }
  else if(h === 'plan'){ title = 'Plan'; html = planView(); }
  else if(h === 'tab'){ title = 'How to read tab'; html = tabView(); after = () => wirePlay(document); }
  else if(h.startsWith('progress')){ title = 'Progress'; html = progressView(); after = () => wireProgress(h.split('/')[1]); }
  else if(h === 'sound'){ title = 'Test sound'; html = soundView(); after = () => wireSound(document); }
  else { const t = todayLesson(); viewing = t.l; html = homeView(t.l, null, t.weekend); after = () => wireHome(t.l); }
  header(viewing); window.__viewing = viewing ? viewing.day : null; window.__step = null;
  $('#view').innerHTML = html; window.scrollTo(0, 0);
  if(after) after();
  document.title = `Guitar Plan · ${title}`;
}
/* Header: always says which lesson is today's. */
function header(v){
  const t = today(), tl = todayLesson().l, sub = $('#sub');
  const todayTxt = BYDATE[t] ? `Today: Day ${tl.day} · ${fmt(tl.date)}` : t < L[0].date ? `Plan starts ${fmt(L[0].date)}` : t > L[L.length-1].date ? 'Plan complete 🎉' : `Next lesson: Day ${tl.day} · ${fmt(tl.date)}`;
  if(v && v.date !== tl.date) sub.innerHTML = `Viewing Day ${v.day} · <a href="#today">${BYDATE[t] ? `Today is Day ${tl.day}` : esc(todayTxt)} →</a>`;
  else sub.textContent = todayTxt;
}

/* ---------- service worker (offline + updates) ---------- */
function registerSW(){
  if(!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  const hadCtl = !!navigator.serviceWorker.controller; let shown = false;
  const showUpdate = () => { if(shown) return; shown = true; const u = $('#upd'); if(u){ u.hidden = false; u.onclick = () => location.reload(); } };
  navigator.serviceWorker.addEventListener('controllerchange', () => { if(hadCtl) showUpdate(); });
  navigator.serviceWorker.register('./sw.js', {scope: './', updateViaCache: 'none'}).then(reg => {
    window.__swReg = reg;
    document.addEventListener('visibilitychange', () => { if(!document.hidden) reg.update().catch(() => {}); });
  }).catch(e => console.warn('SW registration failed', e));
}

function init(){
  try{ registerSW(); }catch(e){ console.warn('SW', e); }
  swVersion();
  $('#morebtn').onclick = openMore;
  const onNav = () => { if(location.hash === LASTH) return; route(); };
  window.addEventListener('hashchange', onNav); window.addEventListener('popstate', onNav);
  route();
}
window.GP = {state: () => S, grade, dueList, todayLesson, reviewsFor, plan: l => GS.build(typeof l === 'number' ? BYDAY[l] : l, {reviews: reviewsFor(typeof l === 'number' ? BYDAY[l] : l)})};
init();
})();
