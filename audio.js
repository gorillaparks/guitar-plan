/* Synth audio: Karplus-Strong plucked strings, simple drums, metronome & sequencer. All generated in-browser. */
(function(){
const A = {}; let ctx = null, master = null, noise = null; const cache = {};
A.ensure = function(){
  if(!ctx){ const C = window.AudioContext || window.webkitAudioContext; ctx = new C();
    master = ctx.createGain(); master.gain.value = 0.85; const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    const len = ctx.sampleRate; noise = ctx.createBuffer(1, len, ctx.sampleRate); const nd = noise.getChannelData(0);
    for(let i=0;i<len;i++) nd[i] = Math.random()*2-1; }
  if(ctx.state === 'suspended') ctx.resume();
  return ctx;
};
A.ctx = () => ctx;
function ks(m){
  if(cache[m]) return cache[m];
  const sr = ctx.sampleRate, f = 440*Math.pow(2,(m-69)/12), N = Math.max(2, Math.round(sr/f)), len = Math.floor(sr*2.4);
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0), ring = new Float32Array(N);
  let prev = 0; for(let i=0;i<N;i++){ const r = Math.random()*2-1; prev = 0.6*r + 0.4*prev; ring[i] = prev; }
  const decay = 0.9965 + Math.min(0.0025, (64 - m) * 0.00006);
  let idx = 0;
  for(let i=0;i<len;i++){ const a = ring[idx], b = ring[(idx+1)%N]; d[i] = a; ring[idx] = (a+b)*0.5*decay; idx = (idx+1)%N; }
  return cache[m] = buf;
}
A.pluck = function(m, t, g, dur){
  A.ensure(); t = t || ctx.currentTime; g = g == null ? 0.45 : g; dur = dur || 2;
  const s = ctx.createBufferSource(); s.buffer = ks(m);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800;
  const gn = ctx.createGain(); gn.gain.setValueAtTime(g, t); gn.gain.setTargetAtTime(0, t + dur, 0.07);
  s.connect(lp); lp.connect(gn); gn.connect(master); s.start(t); s.stop(t + dur + 0.6);
};
A.strum = function(ms, t, dir, g, dur){
  const arr = dir === 'U' ? ms.slice().reverse().slice(0, Math.min(4, ms.length)) : ms;
  arr.forEach((m, i) => A.pluck(m, t + i*0.011, (g||0.32)*(dir==='U'?0.7:1), dur || 1.6));
};
function env(node, t, peak, dec){ node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t+0.003); node.gain.exponentialRampToValueAtTime(0.0001, t+dec); }
A.kick = function(t, g){ const o = ctx.createOscillator(), gn = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t+0.12);
  env(gn, t, g||0.9, 0.3); o.connect(gn); gn.connect(master); o.start(t); o.stop(t+0.35); };
function nz(t, type, freq, g, dec){ const s = ctx.createBufferSource(); s.buffer = noise; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const gn = ctx.createGain(); env(gn, t, g, dec); s.connect(f); f.connect(gn); gn.connect(master); s.start(t, Math.random()*0.5); s.stop(t+dec+0.05); }
A.snare = function(t, g){ nz(t, 'bandpass', 1900, g||0.45, 0.16); const o = ctx.createOscillator(), gn = ctx.createGain(); o.frequency.value = 190; env(gn, t, 0.18, 0.08); o.connect(gn); gn.connect(master); o.start(t); o.stop(t+0.1); };
A.hat = function(t, g){ nz(t, 'highpass', 7500, g||0.12, 0.045); };
A.click = function(t, accent){ const o = ctx.createOscillator(), gn = ctx.createGain(); o.type = 'square'; o.frequency.value = accent ? 1600 : 1050; env(gn, t, accent?0.35:0.22, 0.04); o.connect(gn); gn.connect(master); o.start(t); o.stop(t+0.06); };
A.chime = function(){ A.ensure(); const t = ctx.currentTime; [76, 83, 88].forEach((m,i)=>A.pluck(m, t+i*0.12, 0.35, 1)); };

/* Sequencer with lookahead scheduling */
class Seq{
  constructor(o){ this.bpm = o.bpm || 80; this.spb = o.spb || 1; this.onStep = o.onStep; this.swing = o.swing || 0; this.running = false; this.onUI = o.onUI; }
  start(){ A.ensure(); this.step = 0; this.next = ctx.currentTime + 0.08; this.running = true; this.timer = setInterval(() => this.tick(), 25); this.tick(); }
  tick(){ while(this.running && this.next < ctx.currentTime + 0.12){
      let t = this.next; if(this.swing && this.step % 2 === 1) t += (60/this.bpm/this.spb) * this.swing;
      const r = this.onStep(this.step, t); if(this.onUI){ const st = this.step, delay = Math.max(0, (t - ctx.currentTime)*1000); setTimeout(() => this.running && this.onUI(st), delay); }
      if(r === false){ this.stop(); return; }
      this.next += 60/this.bpm/this.spb; this.step++; } }
  stop(){ this.running = false; clearInterval(this.timer); }
}
A.Seq = Seq;

/* chord voicing from name */
const SH = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
function pcOf(n){ const b = {C:0,D:2,E:4,F:5,G:7,A:9,B:11}[n[0]]; let p = b; for(const c of n.slice(1)){ if(c==='#') p++; else if(c==='b') p--; } return (p+12)%12; }
A.pcOf = pcOf;
const QI = {'':[0,4,7],'m':[0,3,7],'7':[0,4,7,10],'m7':[0,3,7,10],'maj7':[0,4,7,11],'sus2':[0,2,7],'sus4':[0,5,7],'add9':[0,4,7,14],'°':[0,3,6],'dim':[0,3,6],'m7b5':[0,3,6,10],'6':[0,4,7,9]};
A.voice = function(name){
  const lib = (window.PLAN && PLAN.chords) || {};
  if(lib[name]) return lib[name].m;
  const mm = name.match(/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/); if(!mm) return [40, 47, 52];
  const r = pcOf(mm[1]); const q = mm[2].trim(); const iv = QI[q] || QI[q.replace(/\(.*\)/,'').trim()] || QI[''];
  const bass = 40 + ((r - 4 + 12) % 12); const out = [mm[3] ? 40 + ((pcOf(mm[3]) - 4 + 12) % 12) : bass];
  let base = bass + 12; if(base < 50) base += 12;
  iv.forEach(i => out.push(base + i)); if(!mm[3]) out.splice(1, 0, bass + 7);
  return out;
};
A.noteName = m => SH[m % 12];

/* Players */
let current = null;
A.stopAll = function(){ const c = current; current = null; if(c) c.stop(); };
A.isPlaying = () => !!current;
A.playExample = function(ex, bpm, onEnd){
  A.stopAll(); A.ensure(); bpm = bpm || 80;
  let seq;
  if(ex.t === 'chord'){
    const steps = [['S', ex.m]].concat(ex.m.map(m => ['N', [m]])); 
    seq = new Seq({bpm: 100, spb: 2, onStep: (i, t) => { if(i >= steps.length + 2) return false; const s = steps[i]; if(!s) return;
      if(s[0] === 'S') A.strum(s[1], t, 'D', 0.34, 2.2); else A.pluck(s[1][0], t, 0.4, 1.2); }});
  } else if(ex.t === 'prog'){
    const pat = 'D.DU.UDU'; const total = ex.chords.length * 8;
    seq = new Seq({bpm, spb: 2, onStep: (i, t) => { if(i >= total + 2) return false; if(i >= total) return; const c = ex.chords[Math.floor(i/8)], p = pat[i%8];
      if(p !== '.') A.strum(c, t, p, p==='D'?0.33:0.26, 1.2); }});
  } else if(ex.t === 'seq'){
    const st = ex.m;
    seq = new Seq({bpm, spb: 2, onStep: (i, t) => { if(i >= st.length + 3) return false; const s = st[i]; if(!s) return;
      if(s.length > 1) A.strum(s.slice().sort((a,b)=>a-b), t, 'D', 0.32, 1.4); else A.pluck(s[0], t, 0.45, 1.3); }});
  } else if(ex.t === 'interval'){
    seq = new Seq({bpm: 70, spb: 1, onStep: (i, t) => { if(i === 0) A.pluck(ex.m[0], t, .45, 1.2); else if(i === 1) A.pluck(ex.m[1], t, .45, 1.2);
      else if(i === 2){ A.pluck(ex.m[0], t, .4, 1.6); A.pluck(ex.m[1], t, .4, 1.6); } else if(i > 4) return false; }});
  }
  current = seq; const origStop = seq.stop.bind(seq);
  seq.stop = () => { origStop(); if(current === seq) current = null; if(!seq._e){ seq._e = 1; if(onEnd) onEnd(); } };
  seq.start(); return seq;
};
/* Backing loop: prog = chord names, one per bar. feel: 8ths | drive | pad | pad8 | shuffle | waltz */
A.Loop = class{
  constructor(o){ Object.assign(this, {drums: true, chords: true}, o); }
  start(){
    A.stopAll(); A.ensure(); const self = this; const waltz = this.feel === 'waltz'; const per = waltz ? 6 : 8;
    const vo = this.prog.map(n => A.voice(n));
    const pats = {'8ths':'D.DU.UDU', drive:'D.DUDUDU', pad:'D.......', pad8:'D...D...', shuffle:'D.D.D.DU', waltz:'B.D.D.'};
    const pat = pats[this.feel] || pats['8ths'];
    this.seq = new Seq({bpm: this.bpm, spb: 2, swing: this.feel === 'shuffle' ? 0.33 : 0,
      onStep(i, t){
        const bar = Math.floor(i / per), s = i % per, ch = vo[bar % vo.length], p = pat[s];
        if(self.chords){
          if(p === 'B') A.pluck(ch[0], t, 0.5, 1.4);
          else if(p === 'D' || p === 'U') A.strum(waltz ? ch.slice(1) : ch, t, p, p === 'D' ? 0.3 : 0.22, self.feel.startsWith('pad') ? 3.2 : 1.1);
        }
        if(self.drums && self.feel !== 'pad'){
          if(waltz){ if(s === 0) A.kick(t, .7); if(s === 2 || s === 4) A.hat(t, .1); }
          else if(self.feel === 'pad8'){ if(s === 0) A.kick(t, .6); if(s === 4) A.snare(t, .2); if(s % 2 === 0) A.hat(t, .06); }
          else { if(s === 0 || s === 4 || (self.feel === 'drive' && s === 5)) A.kick(t); if(s === 2 || s === 6) A.snare(t); A.hat(t, s % 2 ? .07 : .11); }
        }
      },
      onUI(i){ const bar = Math.floor(i / per); if(i % per === 0 && self.onBar) self.onBar(bar % self.prog.length, self.prog[bar % self.prog.length]); if(self.onBeat && i % 2 === 0) self.onBeat((i % per) / 2); }
    });
    this.seq.start(); current = this; return this;
  }
  setBpm(b){ this.bpm = b; if(this.seq) this.seq.bpm = b; }
  stop(){ if(this.seq) this.seq.stop(); if(current === this) current = null; if(this.onStop) this.onStop(); }
};
A.Metronome = class{
  constructor(o){ Object.assign(this, {bpm: 70, beats: 4}, o); }
  start(){ A.ensure(); const self = this; this.seq = new Seq({bpm: this.bpm, spb: 1, onStep(i, t){ A.click(t, i % self.beats === 0); }, onUI(i){ self.count = i + 1; if(self.onBeat) self.onBeat(i % self.beats); }}); this.seq.start(); this.running = true; }
  setBpm(b){ this.bpm = b; if(this.seq) this.seq.bpm = b; }
  stop(){ if(this.seq) this.seq.stop(); this.running = false; }
};
window.GAudio = A;
})();
