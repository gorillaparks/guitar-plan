/* Guided session builder (v7). Turns one lesson from data.js into a short, linear step script:
   warm-up → quick reviews → new material (listen → copy slowly → ×5 with the click → extra drills) → play with the band
   → 2–3 quiz questions → once more from memory. Pure function of (lesson, options); shared by app.js, the offline audio
   renderer (src/web/synth.js lists every sound a step can ask for) and src/qa.py. */
(function(){
const G = {}, M = window.GMusic;
const PL = () => window.PLAN;
const OPEN = {1:64,2:59,3:55,4:50,5:45,6:40};
G.slowBpm = b => Math.max(40, Math.round(b * 0.75 / 5) * 5);
G.cardPlay = c => c.m ? {t: 'interval', m: c.m} : (c.s != null ? {t: 'seq', m: [[OPEN[c.s] + c.f]]} : null);
G.chordName = k => { const d = PL().dia[k]; const m = d && d.html.match(/aria-label="(.+?) chord diagram"/); return m ? m[1] : k.replace(/^ch_/, '').replace('over', '/').replace(/s$/, '#'); };
function rng(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, r){ const a = arr.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const exDias = l => l.dia.filter(k => { const d = PL().dia[k]; return d && d.ex && d.kind !== 'chord' && d.kind !== 'table'; });
/* The lesson's main example sound (what "Listen to this" plays) and its slow twin. */
G.mainSound = l => { const b = l.bpm || 80; if(l.ex) return {name: M.name.lesson(l.day), ex: l.ex, bpm: b};
  const k = exDias(l)[0] || l.dia.find(k => PL().dia[k] && PL().dia[k].ex); return k ? {name: M.name.ex(k, b), ex: PL().dia[k].ex, bpm: b} : null; };
G.slowSound = l => { const m = G.mainSound(l); if(!m || m.ex.t === 'chord') return null; const s = G.slowBpm(m.bpm); return s < m.bpm ? {name: M.name.slow(m.name, s), ex: m.ex, bpm: s} : null; };
const loopA = (spec, bpm, secs) => ({kind: 'loop', spec, bpm, drums: true, secs: secs || 75});
const metroA = (bpm, secs) => ({kind: 'metro', bpm, secs: secs || 75});
const firstDia = l => { const k = exDias(l)[0] || l.dia.find(k => PL().dia[k] && PL().dia[k].kind !== 'table'); return k ? [k] : []; };
/* What a Keeper review plays: the day's example, else its first diagram's example, else its loop, else a click. */
G.reviewAudio = l => { const m = G.mainSound(l); if(m) return {kind: 'play', name: m.name};
  if(l.loop) return loopA(l.loop, l.loop.bpm, 45); return metroA(l.bpm || 70, 45); };
const short = s => String(s || '').trim();
const chordsOf = prog => [...new Set(prog)].join(' · ');

G.build = function(l, o){
  o = o || {}; const P = PL(), steps = [], bpm = l.bpm || 70, slow = G.slowBpm(bpm);
  const add = s => { s.mins = s.mins || 1; steps.push(s); return s; };
  const holiday = l.minutes <= 10, jamDay = !l.ex && !l.dia.length && !!l.loop;
  /* 1. warm-up */
  if(!holiday){ const quiet = /something you love|anything|free play/i.test(l.warm || '');
    add({kind: 'warm', label: 'Warm-up', title: quiet ? 'Warm up: play anything you like for a minute.' : 'Warm up your fingers for a minute.', text: short(l.warm),
      audio: quiet ? null : metroA(/strum/i.test(l.warm) ? bpm : 60, 60), mins: 1.5}); }
  /* 2. quick reviews (Keeper items due + the plan's revisits), max 3 */
  (o.reviews || []).slice(0, holiday ? 1 : 3).forEach(r => { const rl = P.lessons[r.day - 1]; if(!rl || !rl.k) return;
    add({kind: 'review', label: 'Quick review', title: 'Quick review: play this 3 times.', text: `${rl.k} (from Day ${rl.day})`, dia: firstDia(rl), audio: G.reviewAudio(rl), reps: 3, review: rl.day, mins: 1.5}); });
  /* 3. new material */
  const D = l.dia.map(k => ({k, d: P.dia[k]})).filter(x => x.d);
  const chords = D.filter(x => x.d.kind === 'chord'), others = D.filter(x => x.d.kind !== 'chord' && x.d.kind !== 'table' && x.d.ex), tables = D.filter(x => x.d.kind === 'table');
  const drillDia = () => chords.length ? chords.slice(0, 4).map(x => x.k) : firstDia(l).length ? firstDia(l) : tables.length ? [tables[0].k] : [];
  tables.forEach(x => add({kind: 'look', label: 'Look', title: 'Look at this chart for a moment.', text: short(l.why), dia: [x.k], audio: null, mins: 1}));
  chords.slice(0, 6).forEach(x => { const n = G.chordName(x.k);
    add({kind: 'chord', label: 'New chord', title: `Make the ${n} shape. Strum it 5 times.`, text: 'Listen first, then copy it. Strum slowly and let every string ring.', dia: [x.k], audio: {kind: 'play', name: M.name.ex(x.k, l.bpm || 80)}, reps: 5, mins: 1.3}); });
  if(l.song && !chords.length && P.songs){ const s = P.songs.find(x => x.id === l.song);
    if(s && !jamDay && !holiday) s.chords.filter(c => P.chords[c]).slice(0, 4).forEach(c =>
      add({kind: 'chord', label: 'Song chord', title: `Make the ${c} shape. Strum it 5 times.`, text: `You need it for “${s.title}”. Listen, then copy it.`, chord: c, audio: {kind: 'play', name: M.name.chord(c)}, reps: 5, mins: 1.2})); }
  const main = G.mainSound(l), sl = G.slowSound(l), prog = l.ex && l.ex.t === 'prog';
  if(main && prog){
    add({kind: 'listen', label: 'Listen', title: 'Listen to the chords changing.', text: short(l.ex.label), dia: chords.slice(0, 4).map(x => x.k), audio: {kind: 'play', name: main.name}, mins: 0.6});
    add({kind: 'reps', label: 'Your turn', title: 'Now you: play the changes 5 times, slowly, with the click.', text: 'Four strums per chord. Keep your strumming hand moving, even while you change.', dia: chords.slice(0, 4).map(x => x.k), audio: metroA(slow, 90), reps: 5, mins: 3});
  } else if(main){
    const dia = others.length ? [others[0].k] : chords.slice(0, 3).map(x => x.k);
    add({kind: 'listen', label: 'Listen', title: 'Listen to this.', text: `${short(l.ex ? l.ex.label : 'Hear it')}. Watch the diagram while it plays.`, dia, audio: {kind: 'play', name: main.name}, mins: 0.6});
    if(sl) add({kind: 'copy', label: 'Your turn', title: 'Now you try it once, slowly.', text: 'Here it is again, slower. Play along, or right after it. Mistakes are fine.', dia, audio: {kind: 'play', name: sl.name}, reps: 1, mins: 1.2});
    add({kind: 'reps', label: 'Your turn', title: 'Play it 5 times, slowly, with the click.', text: `One note per click is fine. Tap the big button after each time.`, dia, audio: metroA(sl ? sl.bpm : slow, 90), reps: 5, mins: 3});
    others.slice(1, 3).forEach(x => add({kind: 'reps', label: 'One more shape', title: 'Listen, then play this one 5 times.', text: 'Same idea, new shape.', dia: [x.k], audio: {kind: 'play', name: M.name.ex(x.k, l.bpm || 80)}, reps: 5, mins: 2}));
  }
  /* the teacher's written steps, as short "do this" drills (max 3) */
  let drills = 0; const hadNew = !!main || chords.length > 0;
  (l.steps || []).forEach((t, i) => {
    if(drills >= 3 || steps.some(x => x.kind === 'jam')) return;
    if(/^(search|find a track)|search '|backing track'/i.test(t) && l.loop) return;          // the app supplies the band
    if(i === 0 && hadNew && /(tab|diagram|shapes)\b/i.test(t) && /^(learn|play)/i.test(t)) return;   // already covered by listen/copy
    let s; const ts = l.loop ? M.loopTempos(l.loop.bpm) : [];
    if(/^that's it/i.test(t)) return;
    if(/\brecord\b/i.test(t)) s = {kind: 'do', label: 'Bonus', title: 'Record yourself on your phone (optional).', text: t, audio: l.loop ? loopA(l.loop, l.loop.bpm, 75) : null, mins: 1.5};
    else if(/improvis|solo|just play|\d+\s*min|minutes?\b/i.test(t)){ const mm = t.match(/(\d+)\s*min/); const secs = Math.min(150, mm ? +mm[1] * 40 : 90);
      s = l.loop ? {kind: 'jam', label: 'Play', title: 'Now make it up. Play along with the band.', text: t, audio: loopA(l.loop, l.loop.bpm, secs), mins: secs / 50}
                 : {kind: 'jam', label: 'Play', title: 'Keep going on your own for a minute or two.', text: t, audio: holiday ? null : metroA(bpm, secs), mins: secs / 50}; }
    else if(l.loop && /\btrack\b|\bpass\b|\bloop\b/i.test(t)) s = {kind: 'band', label: 'Play with the band', title: 'Play along with the band.', text: t, audio: loopA(l.loop, ts[1] || ts[0], 75), mins: 2.5};
    else if(holiday || (/^(read|spot|notice|note|look|think|listen|pick|choose|write|let)\b/i.test(t) && !/\b(play|strum|pick out)\b/i.test(t))) s = {kind: 'do', label: 'Try this', title: 'Try this:', text: t, dia: holiday ? [] : drillDia(), audio: null, mins: 1};
    else if(/\b(say|name|explain)\b/i.test(t) && !/\b(play|strum|pick)\b/i.test(t)) s = {kind: 'do', label: 'Say it', title: 'Say it out loud 3 times.', text: t, audio: null, reps: 3, mins: 1};
    else { const nm = t.match(/\b(\d|two|three|four|five)\s+times\b/i), N = nm ? ({two: 2, three: 3, four: 4, five: 5}[nm[1].toLowerCase()] || Math.min(5, +nm[1]) || 5) : 5;
      s = {kind: 'do', label: 'Do this', title: `Now do this ${N} times, slowly.`, text: t, dia: drillDia(), audio: metroA(slow, 90), reps: N, mins: 2.2}; }
    add(s); drills++;
  });
  /* 4. play it in music */
  if(l.loop && !steps.some(s => s.kind === 'jam')){
    const ts = M.loopTempos(l.loop.bpm);
    if(jamDay || holiday){ if(ts[1]) add({kind: 'band', label: 'Play with the band', title: 'Play along with the band, a little slower.', text: `Chords: ${chordsOf(l.loop.prog)}. Strum along, or play notes that sound good.`, audio: loopA(l.loop, ts[1], 75), mins: 2.5});
      add({kind: 'band', label: 'Play with the band', title: 'Now at full speed. Just play!', text: `Chords: ${chordsOf(l.loop.prog)}.`, audio: loopA(l.loop, ts[0], 90), mins: 3}); }
    else add({kind: 'band', label: 'Play with the band', title: 'Play it along with the band.', text: `Chords: ${chordsOf(l.loop.prog)}. Use what you just learned. Keep going, even if you slip.`, audio: loopA(l.loop, ts[1] || ts[0], 75), mins: 3});
  } else if(main && !l.loop) add({kind: 'reps', label: 'Full speed', title: `Now play it with the click at full speed, 5 times.`, text: `${bpm} beats per minute. If it falls apart, go back to slow: that's normal.`, dia: firstDia(l), audio: metroA(bpm, 75), reps: 5, mins: 2.5});
  if(l.teach) add({kind: 'teach', label: 'Teach it', title: 'Teach it back (1 minute).', text: short(l.teach), audio: null, mins: 1});
  /* 5. quick quiz (replaces the Flashcards screen) */
  const deck = l.deck ? l.deck[0] : (holiday ? null : 'nashville');
  if(deck && P.cards[deck]){ const r = rng(l.day * 7919 + 13), pool = P.cards[deck], n = steps.length > 11 ? 2 : 3;
    shuffle(pool.map((c, i) => i), r).slice(0, n).forEach((ci, qi) => { const c = pool[ci];
      const sig = a => (/^[b#]?[0-9]/.test(a) ? 'n' : 'c') + a.split(' ').length, others = shuffle([...new Set(pool.map(x => x.a).filter(a => a !== c.a))], r);
      const wrong = others.filter(a => sig(a) === sig(c.a)).concat(others.filter(a => sig(a) !== sig(c.a))).slice(0, 2);
      const play = G.cardPlay(c);
      add({kind: 'quiz', label: `Quick quiz ${qi + 1}/${n}`, title: c.q, text: '', neck: c.s != null ? {s: c.s, f: c.f, s2: c.s2, f2: c.f2} : null,
        quiz: {deck, card: ci, options: shuffle([c.a, ...wrong], r), answer: c.a}, audio: play ? {kind: 'play', name: M.name.card(play)} : null, mins: 0.6}); }); }
  /* 6. once more from memory */
  add({kind: 'memory', label: 'Last one', title: holiday || jamDay ? 'Play your favorite thing from today, once more.' : 'Play it once more from memory. No peeking!',
    text: holiday || jamDay ? 'Then stop while it still feels good.' : `${l.k || 'Today\'s new thing'}, one time, then stop while it still feels good.`, audio: metroA(bpm, 45), reps: 1, mins: 1});
  /* keep it around 20 minutes: drop extra drills, then extra chord steps */
  const tot = () => steps.reduce((a, s) => a + s.mins, 0);
  for(const kind of ['do', 'chord']) while(tot() > 23 && steps.filter(s => s.kind === kind).length > 1){ const i = steps.map(s => s.kind).lastIndexOf(kind); steps.splice(i, 1); }
  steps.forEach((s, i) => { s.i = i; });
  return {day: l.day, steps, minutes: Math.max(5, Math.round(tot()))};
};
/* Every sound any step of any lesson can request (for the renderer and the reference check). */
G.allSounds = function(){
  const P = PL(), out = {};
  const want = (a, l) => { if(!a) return; if(a.kind === 'play') out[a.name] = out[a.name] || {kind: 'have'};
    else if(a.kind === 'metro') out[M.name.metro(a.bpm)] = {kind: 'have'}; else out[M.name.loop(a.spec, a.bpm, a.drums)] = {kind: 'have'}; };
  P.lessons.forEach(l => { const sl = G.slowSound(l); if(sl) out[sl.name] = {kind: 'example', ex: sl.ex, bpm: sl.bpm};
    const b = G.build(l, {reviews: P.lessons.filter(x => x.day < l.day && x.k).slice(-3).map(x => ({day: x.day}))});
    b.steps.forEach(s => want(s.audio, l)); P.lessons.filter(x => x.k).forEach(x => want(G.reviewAudio(x))); });
  return out;
};
window.GSession = G;
})();
