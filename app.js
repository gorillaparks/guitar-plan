(function(){
'use strict';
const P = window.PLAN, A = window.GAudio, $ = s => document.querySelector(s);
const L = P.lessons, BYDAY = {}, BYDATE = {}; L.forEach(l => { BYDAY[l.day] = l; BYDATE[l.date] = l; });
const SONG = {}; P.songs.forEach(s => SONG[s.id] = s);
const PH = {}; P.phases.forEach(p => PH[p.n] = p);
const INT = [1, 3, 7, 14, 30];
const COLORS = {'Warm-up & keepers':'#d79a2b','Flashcards':'#6d5a9c','Cooldown':'#a3445a','Use it in music':'#5f8f5a','Song lesson':'#5f8f5a','Improvise over the loop':'#5f8f5a','Jam':'#5f8f5a','Week review':'#2f7f86','Play':'#5f8f5a','Play for fun':'#5f8f5a'};
const colorOf = n => COLORS[n] || '#c8643b';
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
function todayLesson(){
  const t = today();
  if(BYDATE[t]) return {l: BYDATE[t], note: null};
  if(t < L[0].date) return {l: L[0], note: `The plan starts ${fmt(L[0].date, {weekday:'long', month:'long', day:'numeric'})}. Here's Day 1 so you can preview it.`};
  if(t > L[L.length-1].date) return {l: L[L.length-1], note: 'You finished the 26-week plan! 🎉 Keep your Review queue going.'};
  let d = t; while(!BYDATE[d]) d = addDays(d, 1);
  return {l: BYDATE[d], note: `It's the weekend — no lesson today. Optional: clear your Review queue or play a song lesson. Next up: ${fmt(d)}.`};
}
/* ---------- keepers (spaced repetition) ---------- */
function addKeeper(l){ if(!l.k || S.keepers[l.day]) return; S.keepers[l.day] = {stage: 0, due: addDays(today(), 1), added: today(), hist: []}; }
function grade(day, ok){
  const k = S.keepers[day]; if(!k) return; const t = today(); k.hist.push([t, ok ? 1 : 0]);
  if(ok){ k.stage++; if(k.stage >= INT.length){ k.mastered = true; k.due = addDays(t, 30); } else k.due = addDays(t, INT[k.stage]); }
  else { k.stage = 0; k.mastered = false; k.due = addDays(t, 1); }
  save();
}
const dueList = () => Object.entries(S.keepers).filter(([d, k]) => k.due <= today()).map(([d, k]) => ({day: +d, ...k})).sort((a, b) => a.due.localeCompare(b.due));
/* ---------- UI helpers ---------- */
function toast(m){ const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 1800); }
function tbar(split){ const tot = split.reduce((a, s) => a + s[0], 0);
  return `<div class="tbar">${split.map(s => `<i style="width:${s[0]/tot*100}%;background:${colorOf(s[1])}" title="${esc(s[1])}"></i>`).join('')}</div>
  <div class="legend">${split.map(s => `<span><b style="background:${colorOf(s[1])}"></b>${s[0]} min ${esc(s[1])}</span>`).join('')}</div>`; }
function dia(key, bpm){ const d = P.dia[key]; if(!d) return '';
  return `<div class="dia">${d.ex ? `<button class="btn sm s play" data-ex="${key}" data-bpm="${bpm||80}" aria-label="Play">▶</button>` : ''}${d.html}</div>`; }
function chordDia(name){ const c = P.chords[name]; if(!c) return '';
  return `<div class="dia"><button class="btn sm s play" data-chord="${esc(name)}" aria-label="Play ${esc(name)}">▶</button>${c.svg}</div>`; }
const songLink = id => SONG[id] ? `<a href="#song-${id}">${esc(SONG[id].title)} →</a>` : '';
function loopUI(loop, id){ if(!loop) return '';
  return `<div class="card loop" data-loop="${id}"><h3>🥁 Backing loop <small class="meta">${esc(loop.label||'')}</small></h3>
  <div class="now${loop.prog.length > 6 ? ' long' : ''}" data-now>${esc(loop.prog.join('  ·  '))}</div>
  <div class="beats" data-lbeats>${'<i></i>'.repeat(loop.feel === 'waltz' ? 3 : 4)}</div>
  <div class="row"><button class="btn t" data-lplay>▶ Play loop</button>
  <label class="row note"><input type="checkbox" data-ldrums checked> drums</label><label class="row note"><input type="checkbox" data-lchords checked> chords</label></div>
  <label class="note">Tempo <b data-lbpmv>${loop.bpm}</b> bpm<input type="range" min="40" max="180" value="${loop.bpm}" data-lbpm></label>
  <div class="note">Synthesized in the app (no recordings). Search term for a full track: ${loop.search ? esc(loop.search) : 'see lesson'}.</div></div>`; }
const LOOPS = {};
function wireLoops(root){
  root.querySelectorAll('[data-loop]').forEach(el => {
    const spec = LOOPS[el.dataset.loop]; if(!spec) return; let lp = null;
    const btn = el.querySelector('[data-lplay]'), now = el.querySelector('[data-now]'), beats = el.querySelectorAll('[data-lbeats] i');
    const rng = el.querySelector('[data-lbpm]'), bv = el.querySelector('[data-lbpmv]');
    btn.onclick = () => {
      if(lp){ lp.stop(); return; }
      lp = new A.Loop({prog: spec.prog, bpm: +rng.value, feel: spec.feel, drums: el.querySelector('[data-ldrums]').checked, chords: el.querySelector('[data-lchords]').checked,
        onBar: (i, n) => { now.innerHTML = spec.prog.map((c, j) => j === i ? `<u>${esc(c)}</u>` : esc(c)).join('  ·  '); },
        onBeat: b => beats.forEach((x, j) => x.classList.toggle('on', j === b)),
        onStop: () => { lp = null; btn.textContent = '▶ Play loop'; btn.classList.remove('playing'); beats.forEach(x => x.classList.remove('on')); }});
      lp.start(); btn.textContent = '■ Stop loop'; btn.classList.add('playing'); window.__loopStarted = (window.__loopStarted || 0) + 1;
    };
    rng.oninput = () => { bv.textContent = rng.value; if(lp) lp.setBpm(+rng.value); };
    el.querySelector('[data-ldrums]').onchange = e => { if(lp) lp.drums = e.target.checked; };
    el.querySelector('[data-lchords]').onchange = e => { if(lp) lp.chords = e.target.checked; };
  });
}
function wirePlay(root){
  root.querySelectorAll('[data-ex],[data-chord],[data-lex],[data-cardplay]').forEach(b => b.onclick = () => {
    if(b.classList.contains('playing')){ A.stopAll(); return; }
    let ex, bpm = +(b.dataset.bpm || 80);
    if(b.dataset.ex) ex = P.dia[b.dataset.ex].ex;
    else if(b.dataset.chord) ex = {t: 'chord', m: A.voice(b.dataset.chord)};
    else if(b.dataset.lex) ex = BYDAY[b.dataset.lex].ex;
    else ex = JSON.parse(b.dataset.cardplay);
    root.querySelectorAll('[data-ex].playing,[data-chord].playing,[data-lex].playing,[data-cardplay].playing').forEach(x => x.classList.remove('playing'));
    const label = b.textContent, short = label.trim().length <= 2; b.classList.add('playing'); b.textContent = short ? '■' : '■ Stop'; b.setAttribute('aria-pressed', 'true');
    A.playExample(ex, bpm, () => { b.classList.remove('playing'); b.textContent = label; b.setAttribute('aria-pressed', 'false'); });
  });
}
/* ---------- session timer ---------- */
let TM = null;
function timerUI(l){ return `<div class="card timer" id="timer"><h3>⏱ Session timer <small class="meta">${l.minutes} min</small></h3>
  <div class="tbig" data-t>${pad(l.split[0][0])}:00</div><div class="prog"><i data-p></i></div>
  <div class="tblocks">${l.split.map((s, i) => `<div data-b="${i}"><span>${esc(s[1])}</span><span>${s[0]} min</span></div>`).join('')}</div>
  <div class="row"><button class="btn" data-ts>▶ Start session</button><button class="btn s" data-tn>Next block ⏭</button><button class="btn s" data-tr>Reset</button></div>
  <div class="note">A chime plays when each block ends. Keep the screen on while you practice.</div></div>`; }
function wireTimer(l){
  const el = $('#timer'); if(!el) return; if(TM && TM.h) clearInterval(TM.h);
  TM = {i: 0, left: l.split[0][0]*60, run: false, h: null};
  const tEl = el.querySelector('[data-t]'), pEl = el.querySelector('[data-p]'), bs = el.querySelectorAll('[data-b]'), st = el.querySelector('[data-ts]');
  const total = l.minutes * 60;
  const draw = () => { tEl.textContent = `${pad(Math.floor(TM.left/60))}:${pad(TM.left%60)}`;
    const el2 = l.split.slice(0, TM.i).reduce((a, s) => a + s[0]*60, 0) + (l.split[TM.i] ? l.split[TM.i][0]*60 - TM.left : 0);
    pEl.style.width = Math.min(100, el2/total*100) + '%';
    bs.forEach((b, j) => { b.classList.toggle('cur', j === TM.i); b.classList.toggle('done', j < TM.i); }); };
  const next = () => { TM.i++; try{ A.chime(); }catch(e){} if(navigator.vibrate) navigator.vibrate(200);
    if(TM.i >= l.split.length){ clearInterval(TM.h); TM.run = false; st.textContent = '✓ Session complete'; TM.left = 0; draw(); toast('Session complete — mark it done!'); return; }
    TM.left = l.split[TM.i][0]*60; draw(); const blk = document.querySelector(`[data-blk="${TM.i}"]`); if(blk) blk.scrollIntoView({behavior:'smooth', block:'start'}); };
  st.onclick = () => { if(TM.i >= l.split.length) return; A.ensure();
    if(TM.run){ clearInterval(TM.h); TM.run = false; st.textContent = '▶ Resume'; return; }
    TM.run = true; st.textContent = '⏸ Pause'; TM.h = setInterval(() => { TM.left--; if(TM.left <= 0) next(); else draw(); }, 1000);
    if(navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {}); };
  el.querySelector('[data-tn]').onclick = () => { if(TM.i < l.split.length) next(); };
  el.querySelector('[data-tr]').onclick = () => { clearInterval(TM.h); TM = null; wireTimer(l); st.textContent = '▶ Start session'; };
  draw();
}
/* ---------- metronome ---------- */
let MET = null;
function metroUI(l){ const b = l.bpm || 70; const r = S.reps[l.day] || 0;
  return `<div class="card metro" id="metro"><h3>🎵 Metronome <small class="meta">target ${l.bpm ? l.bpm + ' bpm' : 'comfortable tempo'}</small></h3>
  <div class="row" style="justify-content:center"><button class="btn s sm" data-m="-5">−5</button><button class="btn s sm" data-m="-1">−1</button>
  <span class="bpm" data-bpm>${b}</span><button class="btn s sm" data-m="1">+1</button><button class="btn s sm" data-m="5">+5</button></div>
  <div class="beats" data-beats><i></i><i></i><i></i><i></i></div>
  <div class="row" style="justify-content:center"><button class="btn t" data-mp>▶ Start metronome</button></div>
  <div class="note" style="text-align:center">No sound? Flip off silent mode and turn up the volume.</div>
  <div class="row" style="justify-content:center"><span class="note">3 clean reps in a row:</span><span class="reps" data-reps>${[0,1,2].map(i => `<i class="${i < r ? 'on' : ''}"></i>`).join('')}<b data-repc>${r}/3</b></span>
  <button class="btn g sm" data-rep>Clean rep</button><button class="btn s sm" data-miss>Missed</button></div></div>`; }
function wireMetro(l){
  const el = $('#metro'); if(!el) return; if(MET) MET.stop();
  let bpm = l.bpm || 70; const bv = el.querySelector('[data-bpm]'), dots = el.querySelectorAll('[data-beats] i'), btn = el.querySelector('[data-mp]');
  MET = new A.Metronome({bpm, onBeat: i => dots.forEach((d, j) => { d.classList.toggle('on', j === i); d.classList.toggle('a', j === 0); })});
  window.__metro = MET;
  el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { bpm = Math.max(30, Math.min(220, bpm + +b.dataset.m)); bv.textContent = bpm; MET.setBpm(bpm); });
  btn.onclick = () => { if(MET.running){ MET.stop(); btn.textContent = '▶ Start metronome'; btn.classList.remove('playing'); dots.forEach(d => d.classList.remove('on')); } else { MET.start(); btn.textContent = '■ Stop metronome'; btn.classList.add('playing'); } };
  const reps = el.querySelector('[data-reps]'), rc = el.querySelector('[data-repc]');
  const drawReps = cls => { const n = S.reps[l.day] || 0; reps.querySelectorAll('i').forEach((d, j) => d.classList.toggle('on', j < n)); rc.textContent = `${n}/3`;
    if(cls){ reps.classList.remove('flash-g', 'flash-r'); void reps.offsetWidth; reps.classList.add(cls); } };
  el.querySelector('[data-rep]').onclick = () => { const was = S.reps[l.day] || 0; S.reps[l.day] = Math.min(3, was + 1); save(); drawReps('flash-g');
    toast(S.reps[l.day] === 3 ? (was === 3 ? 'Already 3/3 — locked in! Move on or bump +5 bpm.' : '3 clean reps — locked in! Move on.') : `Clean rep ${S.reps[l.day]} of 3 ✓`); };
  el.querySelector('[data-miss]').onclick = () => { S.reps[l.day] = 0; save(); drawReps('flash-r'); toast('Missed — streak reset to 0/3. Slow down and go again.'); };
}
/* ---------- lesson view ---------- */
function lessonView(l, note){
  const ph = PH[l.phase]; const blkIdx = name => l.split.findIndex(s => s[1] === name);
  const due = dueList().length; const isDone = !!S.done[l.day];
  if(l.loop){ LOOPS['L' + l.day] = Object.assign({}, l.loop, {search: l.track}); }
  const sec = (name, icon, body) => { const i = blkIdx(name); const s = l.split[i];
    return `<div class="blk" style="--c:${colorOf(name)}" ${i >= 0 ? `data-blk="${i}"` : ''}><h3>${icon} ${esc(name)} ${s ? `<small>· ${s[0]} min</small>` : ''}</h3>${body}</div>`; };
  const focusName = l.split.find(s => !/Warm|Flash|Cool|Use it|Song lesson|Improvise|Week review|^Play$/.test(s[1]));
  const playName = l.split.find(s => /Use it|Song lesson|Improvise|^Jam|^Play$|Jam & record|Play for fun|Set rehearsal|Lead the set|Celebrate/.test(s[1]));
  const rev = l.reviews.length ? `<div class="strip">${l.reviews.map(r => `<div class="rv"><a href="#${BYDAY[r.day].date}"><b>Day ${r.day} · ${r.n}d</b><br>${esc(r.k)}${r.n >= 7 ? ' <i>(+5 bpm)</i>' : ''}</a></div>`).join('')}</div>` : '<div class="note">No planned revisits today — enjoy the fresh start.</div>';
  const songs = (l.songs || []).map(s => `<span class="chip o">${esc(s[0])} · ${esc(s[1])} · ${esc(s[2])}</span>`).join('');
  return `${note ? `<div class="banner">${esc(note)}</div>` : ''}
  <div class="card" style="border-top:6px solid ${ph.color}" id="${l.anchor}">
   <span id="${l.date}"></span>
   <div class="meta">Day ${l.day} of 130 · Week ${l.week} · ${fmt(l.date, {weekday:'long', month:'short', day:'numeric', year:'numeric'})}</div>
   <h1>${esc(l.title)}</h1>
   <span class="chip" style="background:${ph.color}">Month ${ph.n}: ${esc(ph.name)}</span>${l.tag ? `<span class="chip o">${esc(l.tag)}</span>` : ''}${l.checkpoint ? '<span class="chip" style="background:#3b2f2a">Checkpoint</span>' : ''}
   <div class="meta">This week: ${esc(l.week_theme)}</div>${tbar(l.split)}
   <div class="row" style="margin-top:8px"><button class="btn ${isDone ? 'g' : ''}" data-done>${isDone ? '✓ Done' : 'Mark lesson done'}</button>
   ${l.ex ? `<button class="btn t" data-lex="${l.day}" data-bpm="${l.bpm || 80}">▶ Play example</button>` : ''}</div>
  </div>
  ${timerUI(l)}
  <div class="card">
  ${sec(l.split[0][1], '🔥', `<p>${esc(l.warm)}</p><p><b>Keeper revisits today</b> (spaced 1 · 3 · 7 · 14 · 30 days):</p>${rev}
     <div class="note">Your live queue: <a href="#review">${due} item${due === 1 ? '' : 's'} due in Review →</a></div>`)}
  ${l.deck ? sec('Flashcards', '🃏', `<p>2–3 minutes: <a href="#cards/${l.deck[0]}">${esc(l.deck[1])} drill →</a></p>`) : ''}
  ${sec(focusName ? focusName[1] : 'Focus', '🎯', `<div class="why"><b>Why this matters:</b> ${esc(l.why)}</div>
     <ol class="steps">${l.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
     ${l.dia.length ? `<div class="dias">${l.dia.map(k => dia(k, l.bpm)).join('')}</div>` : ''}
     ${l.dia.some(k => P.dia[k].kind === 'tab') ? '<div class="note">New to tab? <a href="#tab">How to read tab →</a></div>' : ''}
     <p class="note">🔁 ${esc(l.reps)}</p>`)}
  ${playName ? sec(playName[1], '🎸', `<p><b>48-hour rule:</b> ${esc(l.use)}</p>
     ${l.song ? `<p>Song lesson: ${songLink(l.song)}</p>` : ''}${songs ? `<div>${songs}</div>` : ''}
     ${l.track ? `<p class="note">Full backing track search: “${esc(l.track)}”</p>` : ''}${loopUI(l.loop, 'L' + l.day)}`) : ''}
  ${l.teach ? `<div class="blk" style="--c:#2f7f86"><h3>🗣 Teach it back <small>· 1 min</small></h3><p>${esc(l.teach)}</p></div>` : ''}
  ${sec('Cooldown', '🧊', `<p>${esc(l.cool)}</p>`)}
  <div class="win"><b>🏆 Win for today:</b> ${esc(l.win)}</div>
  ${l.checkpoint ? `<p><a class="btn s" href="#progress/cp${l.checkpoint}">Record Month ${l.checkpoint} checkpoint →</a></p>` : ''}
  </div>
  ${metroUI(l)}
  <div class="pager">${l.day > 1 ? `<a class="btn s pv" href="#${BYDAY[l.day-1].date}">← Day ${l.day-1}</a>` : '<span></span>'}
  <a class="btn s" href="#plan">All lessons</a>${l.day < 130 ? `<a class="btn s nx" href="#${BYDAY[l.day+1].date}">Day ${l.day+1} →</a>` : '<span></span>'}</div>`;
}
const pad3 = n => String(n).padStart(3, '0');
function wireLesson(l){
  const b = document.querySelector('[data-done]');
  if(b) b.onclick = () => { if(S.done[l.day]){ delete S.done[l.day]; const k = S.keepers[l.day]; if(k && !k.hist.length) delete S.keepers[l.day]; toast('Marked not done.'); } else { S.done[l.day] = today(); addKeeper(l); toast(l.k ? 'Done! Added to your Keeper List.' : 'Done!'); }
    save(); route(); };
  wireTimer(l); wireMetro(l); wirePlay(document); wireLoops(document);
}
/* ---------- review ---------- */
function reviewView(){
  const due = dueList(); const all = Object.entries(S.keepers).map(([d, k]) => ({day: +d, ...k}));
  const up = all.filter(k => k.due > today()).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 12);
  const mastered = all.filter(k => k.mastered);
  const row = k => { const l = BYDAY[k.day]; const nxt = k.stage + 1 < INT.length ? INT[k.stage + 1] : 30;
    return `<div class="kq"><div><b>${esc(l.k)}</b></div><div class="meta">From <a href="#${BYDAY[k.day].date}">Day ${k.day}: ${esc(l.title)}</a> · review #${k.hist.length + 1} · stage ${k.stage + 1}/5${k.stage >= 2 ? ' · try it +5 bpm' : ''}</div>
    <div class="row">${l.ex ? `<button class="btn s sm" data-lex="${l.day}" data-bpm="${l.bpm || 80}">▶ Hear it</button>` : ''}<button class="btn g sm" data-got="${k.day}">✓ Got it (next in ${INT[Math.min(k.stage + 1, 4)]}d)</button><button class="btn s sm" data-shaky="${k.day}">↺ Shaky (tomorrow)</button></div></div>`; };
  return `<h1>Review</h1><p class="meta">Your Keeper List grows every time you finish a lesson. Items come back after 1, 3, 7, 14 and 30 days. “Got it” pushes the next review further out; “Shaky” brings it back tomorrow. Aim for 3 clean reps before you tap “Got it”.</p>
  <div class="card">${P.gfx.retain_m}</div>
  <div class="card"><h2>Due today <span class="chip">${due.length}</span></h2>${due.length ? due.map(row).join('') : `<p>Nothing due. ${Object.keys(S.keepers).length ? 'Nice work — come back tomorrow.' : 'Finish a lesson (tap “Mark lesson done”) and its keeper item lands here tomorrow.'}</p>`}</div>
  <div class="card"><h2>Coming up</h2>${up.length ? `<div class="list">${up.map(k => `<a class="it" href="#${BYDAY[k.day].date}"><span>${esc(BYDAY[k.day].k)}</span><span class="d">${fmt(k.due)}</span></a>`).join('')}</div>` : '<p class="note">Nothing scheduled yet.</p>'}</div>
  <div class="card"><h2>Mastered <span class="chip" style="background:var(--green)">${mastered.length}</span></h2>${mastered.map(k => `<span class="chip o">${esc(BYDAY[k.day].k)}</span>`).join('') || '<p class="note">Items graduate after the 30-day review.</p>'}</div>
  <details><summary>The full Keeper List (all ${P.keepers.length} planned items)</summary><div class="list">${P.keepers.map(k => `<a class="it ${S.keepers[k.day] ? 'dn' : ''}" href="#${BYDAY[k.day].date}"><span>${esc(k.k)}</span><span class="d">Day ${k.day}</span></a>`).join('')}</div></details>`;
}
function wireReview(){
  document.querySelectorAll('[data-got]').forEach(b => b.onclick = () => { grade(+b.dataset.got, true); toast('Rescheduled further out.'); route(); });
  document.querySelectorAll('[data-shaky]').forEach(b => b.onclick = () => { grade(+b.dataset.shaky, false); toast('Back tomorrow — no worries.'); route(); });
  wirePlay(document);
}
/* ---------- flashcards ---------- */
const DECKS = {fretboard: 'Fretboard notes', nashville: 'Nashville numbers', chordtones: 'Chord tones', intervals: 'Interval shapes', mixed: 'Mixed'};
let FC = null;
function miniNeck(c){ const W = 300, H = 100, x0 = 22, fw = 21, y0 = 14, dy = 14;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="width:100%;height:auto" role="img" aria-label="fretboard">`;
  for(let i = 0; i < 6; i++) s += `<line x1="${x0}" y1="${y0+i*dy}" x2="${x0+12*fw}" y2="${y0+i*dy}" stroke="#3b2f2a" stroke-width="${0.8+i*0.25}"/><text x="4" y="${y0+i*dy+4}" class="sl">${'eBGDAE'[i]}</text>`;
  for(let f = 0; f <= 12; f++) s += `<line x1="${x0+f*fw}" y1="${y0}" x2="${x0+f*fw}" y2="${y0+5*dy}" stroke="#3b2f2a" stroke-width="${f ? 1 : 4}"/>`;
  for(let f = 1; f <= 12; f++) s += `<text x="${x0+(f-.5)*fw}" y="${y0+5*dy+16}" text-anchor="middle" class="fn">${f}</text>`;
  const dot = (st, f, col) => { const x = f === 0 ? x0 - 9 : x0 + (f - .5)*fw; return `<circle cx="${x}" cy="${y0+(st-1)*dy}" r="6.5" fill="${col}" stroke="#3b2f2a"/>`; };
  s += dot(c.s, c.f, '#c8643b'); if(c.s2) s += dot(c.s2, c.f2, '#2f7f86');
  return s + '</svg>'; }
const OPEN = {1:64,2:59,3:55,4:50,5:45,6:40};
function cardsView(deck){
  deck = DECKS[deck] ? deck : 'fretboard';
  let pool = deck === 'mixed' ? [].concat(...['fretboard','nashville','chordtones','intervals'].map(d => P.cards[d].map(c => Object.assign({deck: d}, c)))) : P.cards[deck].map(c => Object.assign({deck}, c));
  pool = pool.sort(() => Math.random() - .5);
  FC = {deck, pool, i: 0, shown: false, right: 0, wrong: 0, start: Date.now()};
  const st = S.cards[deck] || {r: 0, w: 0};
  return `<h1>Flashcards</h1><p class="meta">2–3 minutes most days. Say the answer out loud before you flip. Printable deck is in the PDF.</p>
  <div class="row">${Object.entries(DECKS).map(([k, v]) => `<a class="chip ${k === deck ? '' : 'o'}" href="#cards/${k}">${v}</a>`).join('')}</div>
  <div class="card fc" id="fc"></div>
  <div class="row" style="justify-content:space-between"><span class="note" id="fcs"></span><span class="note">All-time ${esc(DECKS[deck])}: ${st.r}✓ / ${st.w}✗</span></div>`;
}
function drawCard(){
  const el = $('#fc'); if(!el || !FC) return; const c = FC.pool[FC.i % FC.pool.length];
  const play = c.m ? {t: 'interval', m: c.m} : (c.s != null ? {t: 'seq', m: [[OPEN[c.s] + c.f]]} : null);
  el.innerHTML = `<div class="meta">${esc(DECKS[c.deck])} · card ${FC.i + 1}</div><div class="q">${esc(c.q)}</div>
   ${c.s != null ? `<div class="dia">${miniNeck(c)}</div>` : ''}
   ${FC.shown ? `<div class="a">${esc(c.a)}</div>` : ''}
   <div class="row" style="justify-content:center">${FC.shown ? `<button class="btn g" data-k="1">Knew it</button><button class="btn s" data-k="0">Missed</button>` : `<button class="btn" data-show>Show answer</button>`}
   ${play && FC.shown ? `<button class="btn s" data-cardplay='${JSON.stringify(play)}'>▶ Hear it</button>` : ''}</div>`;
  const secs = Math.floor((Date.now() - FC.start)/1000);
  $('#fcs').textContent = `This round: ${FC.right}✓ ${FC.wrong}✗ · ${Math.floor(secs/60)}:${pad(secs%60)}${secs >= 120 ? ' — 2 minutes done! 🎉' : ''}`;
  const sh = el.querySelector('[data-show]'); if(sh) sh.onclick = () => { FC.shown = true; drawCard(); };
  el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const ok = b.dataset.k === '1'; ok ? FC.right++ : FC.wrong++;
    const s = S.cards[c.deck] = S.cards[c.deck] || {r: 0, w: 0}; ok ? s.r++ : s.w++; S.cards.last = today(); save(); FC.i++; FC.shown = false; drawCard(); });
  wirePlay(el);
}
/* ---------- songs ---------- */
function songsView(){
  const groups = {}; P.songs.forEach(s => (groups[s.type] = groups[s.type] || []).push(s));
  return `<h1>Song lessons</h1><p class="meta">Step-by-step lessons with number charts, keys/capo options, strum & picking patterns, fills and a synthesized backing loop. Chord progressions only — no lyrics.</p>
  ${Object.entries(groups).map(([g, ss]) => `<div class="card"><h2>${esc(g)}</h2><div class="list">${ss.map(s => `<a class="it" href="#song-${s.id}"><span><b>${esc(s.title)}</b><br><small class="meta">${esc(s.credit)}</small></span><span class="d">${esc(s.key)} · ${s.bpm} bpm</span></a>`).join('')}</div></div>`).join('')}`;
}
const MAJ = [0, 2, 4, 5, 7, 9, 11];
function numToChord(tok, key){
  const m = tok.match(/^(b?)([1-7])([^/]*)(?:\/(b?)([1-7]))?$/); if(!m) return tok; const sc = P.keys[key];
  const deg = (fl, d) => { let n = sc[+d - 1]; if(fl){ const p = (A.pcOf(n) + 11) % 12; n = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'][p]; } return n; };
  return deg(m[1], m[2]) + m[3] + (m[5] ? '/' + deg(m[4], m[5]) : '');
}
const rootQ = c => { const m = c.match(/^([A-G][#b]?)(m(?!aj))?/); return m ? m[1] + (m[2] ? 'm' : '') : c; };
function voicingName(letter, s, key){
  if(key === s.key){ const hit = s.chords.find(c => c === letter) || (!letter.includes('/') && s.chords.find(c => !c.includes('/') && rootQ(c) === rootQ(letter) && !(/7$/.test(letter) && !c.includes('7'))));
    if(hit && P.chords[hit]) return hit; }
  return letter;
}
function songView(id, key){
  const s = SONG[id]; if(!s) return '<div class="card"><h1>Song not found</h1><p>That song link is out of date. <a href="#songs">See all song lessons →</a></p></div>'; key = P.keys[key] ? key : s.key;
  const used = L.filter(l => l.song === id);
  const letters = new Set(); s.sections.forEach(sec => sec[1].forEach(t => letters.add(numToChord(t, key))));
  const diaNames = key === s.key ? s.chords : [...letters].map(c => voicingName(c, s, key));
  s.sections.forEach((sec, i) => { LOOPS[`S${i}`] = {prog: sec[1].map(t => voicingName(numToChord(t, key), s, key)), bpm: s.bpm, feel: s.meter === '3/4' ? 'waltz' : (/Shuffle/i.test(sec[3]) ? 'shuffle' : (s.bpm >= 110 ? 'drive' : (/Pad/i.test(sec[3]) ? 'pad8' : '8ths'))), search: `${s.title} instrumental / ${key} major worship backing track`}; });
  const arrows = s.strum.split(' ').map(x => x === 'D' ? '↓' : x === 'U' ? '↑' : x).join(' ');
  return `<p><a href="#songs">← All songs</a></p><div class="card" style="border-top:6px solid var(--green)" id="song-${s.id}">
  <span class="chip" style="background:var(--green)">${esc(s.type)}</span><h1>${esc(s.title)}</h1><div class="meta">${esc(s.credit)} · ${esc(s.meter)} · ~${s.bpm} bpm · ${esc(s.feel)}</div>
  <p class="note">${esc(P.disclaimer)}</p>
  <div class="row"><span class="note">Key:</span>${[s.key, ...'GDAEC'.split('').filter(k => k !== s.key)].map(k => `<a class="chip ${k === key ? '' : 'o'}" href="#song-${s.id}/${k}">${k}${k === s.key ? ' (home)' : ''}</a>`).join('')}</div>
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
   <li><b>Keeper List:</b> each lesson adds one item; it rotates back at 1, 3, 7, 14 and 30 days (shown on every lesson card and in Review).</li>
   <li><b>Flashcards</b> 2–3 min Mon–Thu: fretboard notes, Nashville numbers, chord tones, intervals.</li>
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
function tabView(){ return `<p><a href="#plan">← Plan</a></p><div class="card"><h1>How to read tab</h1>
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
   <div><b>${ks.length}</b><small>keepers learned</small></div><div><b>${ks.filter(k => k.mastered).length}</b><small>mastered</small></div><div><b>${cr[0] + cr[1] ? Math.round(cr[0]/(cr[0]+cr[1])*100) + '%' : '—'}</b><small>flashcard accuracy</small></div></div>
  <div class="card"><h2>By month</h2>${P.phases.map(p => { const ls = L.filter(l => l.phase === p.n), d = ls.filter(l => S.done[l.day]).length;
    return `<div style="margin:8px 0"><div class="row" style="justify-content:space-between"><b>Month ${p.n}: ${esc(p.name)}</b><span class="meta">${d}/${ls.length}</span></div><div class="prog"><i style="width:${d/ls.length*100}%;background:${p.color}"></i></div></div>`; }).join('')}</div>
  <h2>Checkpoints</h2><p class="meta">At the end of each month, check off what you can do, rate yourself and leave a note. Streaks skip weekends and optional holidays.</p>
  ${P.phases.map(p => { const c = S.checkpoints[p.n] || {items: [], rating: 0, note: ''}; const day = L.find(l => l.checkpoint === p.n);
   return `<div class="card" id="cp${p.n}" style="border-left:6px solid ${p.color}"><h3>Month ${p.n} checkpoint <small class="meta">· <a href="#${BYDAY[day.day].date}">Day ${day.day}, ${fmt(day.date)}</a>${c.date ? ` · saved ${fmt(c.date)}` : ''}</small></h3>
   ${p.milestone.map((m, i) => `<label class="row" style="flex-wrap:nowrap;align-items:flex-start;margin:4px 0"><input type="checkbox" data-cp="${p.n}" data-i="${i}" ${c.items[i] ? 'checked' : ''}> <span>${esc(m)}</span></label>`).join('')}
   <div class="stars" data-stars="${p.n}">${[1,2,3,4,5].map(i => `<button data-r="${i}" class="${i <= c.rating ? 'on' : ''}" aria-label="${i} stars">★</button>`).join('')}</div>
   <textarea data-note="${p.n}" placeholder="What felt great? What needs another week?">${esc(c.note)}</textarea></div>`; }).join('')}
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
  if(sub){ const el = document.getElementById(sub); if(el) el.scrollIntoView(); }
}
/* ---------- router ---------- */
const TABS = [['today','🏠','Today'],['review','🔁','Review'],['cards','🃏','Cards'],['songs','🎶','Songs'],['plan','🗺','Plan'],['progress','📈','Progress']];
function route(){
  A.stopAll(); if(MET) { MET.stop(); MET = null; } if(TM && TM.h) clearInterval(TM.h);
  let h = decodeURIComponent(location.hash.slice(1)) || 'today'; let tab = 'today', html = '', after = null;
  let m;
  let viewing = null;
  if((m = h.match(/^day-(\d{1,3})$/)) && BYDAY[+m[1]]){ const l = BYDAY[+m[1]]; viewing = l; html = lessonView(l, null); after = () => wireLesson(l); }
  else if((m = h.match(/^(\d{4}-\d{2}-\d{2})$/))){ let d = m[1]; let l = BYDATE[d], note = null;
    if(!l){ if(d < L[0].date) { l = L[0]; } else if(d > L[L.length-1].date) { l = L[L.length-1]; } else { while(!BYDATE[d]) d = addDays(d, 1); l = BYDATE[d]; } note = d < L[0].date ? `The plan starts ${fmt(L[0].date)} — showing Day 1.` : d > L[L.length-1].date ? `The plan ended ${fmt(L[L.length-1].date)} — showing the last lesson (Day ${L[L.length-1].day}).` : `No lesson on ${fmt(m[1])} — it's the weekend. Showing the next lesson, ${fmt(l.date)}.`; }
    viewing = l; html = lessonView(l, note); after = () => wireLesson(l); }
  else if(h === 'today'){ const t = todayLesson(); viewing = t.l; html = lessonView(t.l, t.note); after = () => wireLesson(t.l); }
  else if(h === 'review'){ tab = 'review'; html = reviewView(); after = wireReview; }
  else if(h.startsWith('cards')){ tab = 'cards'; html = cardsView(h.split('/')[1] || 'fretboard'); after = drawCard; }
  else if(h === 'songs'){ tab = 'songs'; html = songsView(); }
  else if((m = h.match(/^song-([a-z0-9-]+?)(?:\/([A-G]b?))?$/))){ tab = 'songs'; html = songView(m[1], m[2]); after = () => { wirePlay(document); wireLoops(document); }; }
  else if(h === 'plan'){ tab = 'plan'; html = planView(); }
  else if(h === 'tab'){ tab = 'plan'; html = tabView(); after = () => wirePlay(document); }
  else if(h.startsWith('progress')){ tab = 'progress'; html = progressView(); after = () => wireProgress(h.split('/')[1]); }
  else { const t = todayLesson(); html = lessonView(t.l, null); after = () => wireLesson(t.l); }
  if(viewing) tab = viewing.date === todayLesson().l.date ? 'today' : 'plan';
  header(viewing); window.__viewing = viewing ? viewing.day : null;
  $('#view').innerHTML = html; window.scrollTo(0, 0);
  document.querySelectorAll('nav.tabs a').forEach(a => a.classList.toggle('on', a.dataset.t === tab));
  const due = dueList().length; const rb = document.querySelector('nav.tabs a[data-t=review] small'); if(rb) rb.textContent = due ? `Review (${due})` : 'Review';
  if(after) after();
  document.title = `Guitar Plan · ${tab[0].toUpperCase() + tab.slice(1)}`;
}
/* Header: always says which lesson is today's; when viewing a different lesson, says so and links back. */
function header(v){
  const t = today(), tl = todayLesson().l, sub = $('#sub');
  const todayTxt = BYDATE[t] ? `Today: Day ${tl.day} · ${fmt(tl.date)}` : t < L[0].date ? `Plan starts ${fmt(L[0].date)}` : t > L[L.length-1].date ? 'Plan complete 🎉' : `Next lesson: Day ${tl.day} · ${fmt(tl.date)}`;
  if(v && v.date !== tl.date) sub.innerHTML = `Viewing Day ${v.day} · ${esc(fmt(v.date))} · <a href="#today">${BYDATE[t] ? `Today: Day ${tl.day}` : esc(todayTxt)} →</a>`;
  else sub.textContent = todayTxt;
}
/* ---------- sound unlock banner ---------- */
function soundBanner(){
  const el = $('#snd'); if(!el) return;
  el.querySelector('button').onclick = () => { A.ensure(); };
  A.onState(() => { el.hidden = !!(A.unlocked && A.unlocked()); });
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
  soundBanner();
  $('#nav').innerHTML = TABS.map(t => `<a href="#${t[0]}" data-t="${t[0]}"><span>${t[1]}</span><small>${t[2]}</small></a>`).join('');
  window.addEventListener('hashchange', route); route();
}
window.GP = {state: () => S, grade, dueList, todayLesson};
init();
})();
