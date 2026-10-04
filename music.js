/* Pure music helpers + stable audio-file names. Shared by the app (app.js/audio.js) and the offline
   audio renderer (src/render_audio.py), so the names the app asks for always match the files on disk. */
(function(){
const M = {};
const SH = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
function pcOf(n){ const b = {C:0,D:2,E:4,F:5,G:7,A:9,B:11}[n[0]]; let p = b; for(const c of n.slice(1)){ if(c==='#') p++; else if(c==='b') p--; } return (p+12)%12; }
M.pcOf = pcOf; M.noteName = m => SH[m % 12];
const QI = {'':[0,4,7],'m':[0,3,7],'7':[0,4,7,10],'m7':[0,3,7,10],'maj7':[0,4,7,11],'sus2':[0,2,7],'sus4':[0,5,7],'add9':[0,4,7,14],'°':[0,3,6],'dim':[0,3,6],'m7b5':[0,3,6,10],'6':[0,4,7,9]};
M.voice = function(name){
  const lib = (window.PLAN && PLAN.chords) || {};
  if(lib[name]) return lib[name].m;
  const mm = name.match(/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/); if(!mm) return [40, 47, 52];
  const r = pcOf(mm[1]); const q = mm[2].trim(); const iv = QI[q] || QI[q.replace(/\(.*\)/,'').trim()] || QI[''];
  const bass = 40 + ((r - 4 + 12) % 12); const out = [mm[3] ? 40 + ((pcOf(mm[3]) - 4 + 12) % 12) : bass];
  let base = bass + 12; if(base < 50) base += 12;
  iv.forEach(i => out.push(base + i)); if(!mm[3]) out.splice(1, 0, bass + 7);
  return out;
};
/* Nashville number -> chord letter in a key */
M.numToChord = function(tok, key){
  const m = tok.match(/^(b?)([1-7])([^/]*)(?:\/(b?)([1-7]))?$/); if(!m) return tok; const sc = PLAN.keys[key];
  const deg = (fl, d) => { let n = sc[+d - 1]; if(fl){ const p = (pcOf(n) + 11) % 12; n = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'][p]; } return n; };
  return deg(m[1], m[2]) + m[3] + (m[5] ? '/' + deg(m[4], m[5]) : '');
};
const rootQ = c => { const m = c.match(/^([A-G][#b]?)(m(?!aj))?/); return m ? m[1] + (m[2] ? 'm' : '') : c; };
M.voicingName = function(letter, s, key){
  if(key === s.key){ const hit = s.chords.find(c => c === letter) || (!letter.includes('/') && s.chords.find(c => !c.includes('/') && rootQ(c) === rootQ(letter) && !(/7$/.test(letter) && !c.includes('7'))));
    if(hit && PLAN.chords[hit]) return hit; }
  return letter;
};
M.songKeys = s => [s.key, ...'GDAEC'.split('').filter(k => k !== s.key)];
M.songLoops = function(s, key){
  return s.sections.map(sec => ({prog: sec[1].map(t => M.voicingName(M.numToChord(t, key), s, key)), bpm: s.bpm,
    feel: s.meter === '3/4' ? 'waltz' : (/Shuffle/i.test(sec[3]) ? 'shuffle' : (s.bpm >= 110 ? 'drive' : (/Pad/i.test(sec[3]) ? 'pad8' : '8ths'))),
    search: `${s.title} instrumental / ${key} major worship backing track`, page: 'song'}));
};
/* ---- stable audio file names ---- */
const pad3 = n => String(n).padStart(3, '0');
const slug = s => String(s).replace(/#/g, 's').replace(/°/g, 'dim').replace(/\//g, '_over_').replace(/[^A-Za-z0-9_-]/g, '');
function hash(str){ let h = 0x811c9dc5; for(let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); }
M.hash = hash;
M.name = {
  ex: (diaKey, bpm) => `ex-${slug(diaKey)}-${bpm}`,
  lesson: day => `lesson-${pad3(day)}`,
  chord: name => `chord-${slug(name)}`,
  card: play => play.t === 'interval' ? `int-${play.m[0]}-${play.m[1]}` : `note-${play.m[0][0]}`,
  loop: (spec, bpm, drums) => `loop-${spec.feel}-${bpm}${drums === false ? '-nd' : ''}-${hash(spec.prog.join(' '))}`,
  metro: bpm => `metro-${bpm}`,
};
/* Tempo options offered for every backing loop (pre-rendered; no live tempo changes). */
M.loopTempos = bpm => [bpm, bpm - 10, bpm - 20].filter(b => b >= 40);
/* Metronome BPMs that have click tracks: a 5-bpm grid 40-200 plus every lesson target / loop BPM. */
M.metroBpms = function(){ const s = new Set(); for(let b = 40; b <= 200; b += 5) s.add(b);
  (PLAN.lessons || []).forEach(l => { if(l.bpm) s.add(l.bpm); if(l.loop) s.add(l.loop.bpm); }); (PLAN.songs || []).forEach(x => s.add(x.bpm));
  return [...s].filter(b => b >= 40 && b <= 200).sort((a, b) => a - b); };
window.GMusic = M;
})();
