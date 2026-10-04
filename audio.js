/* Sound playback with plain HTML <audio> elements and pre-rendered files (app/audio/*.m4a|mp3).
   No Web Audio at runtime: media-element playback is what iOS plays reliably, including with the silent switch on.
   Every play() is started synchronously inside the tap handler; failures are shown on screen and in diagnostics. */
(function(){
const M = window.GMusic, F = window.AUDIO_FILES || {rev: 'none', d: {}};
const A = {voice: M.voice, pcOf: M.pcOf, noteName: M.noteName};
const probe = document.createElement('audio');
const can = t => { try{ return probe.canPlayType(t) || ''; }catch(e){ return ''; } };
A.support = {m4a: can('audio/mp4; codecs="mp4a.40.2"') || can('audio/mp4') || can('audio/x-m4a'), mp3: can('audio/mpeg')};
A.fmt = A.support.m4a ? 'm4a' : 'mp3';
const qf = new URLSearchParams(location.search).get('audio'); if(qf === 'm4a' || qf === 'mp3') A.fmt = qf;
A.files = F; A.has = n => Object.prototype.hasOwnProperty.call(F.d, n); A.dur = n => F.d[n];
A.url = n => `audio/${n}.${A.fmt}`;
A.metroBpms = Object.keys(F.d).filter(k => k.startsWith('metro-')).map(k => +k.slice(6)).sort((a, b) => a - b);

/* ---- diagnostics ---- */
const D = A.diag = {last: null, lastError: null, events: [], plays: 0, errors: 0};
const errSubs = [], uiSubs = [];
A.onError = f => errSubs.push(f); A.onChange = f => uiSubs.push(f);
const fire = () => uiSubs.forEach(f => { try{ f(); }catch(e){} });
const stamp = () => new Date().toLocaleTimeString();
function logEv(ch, ev, extra){ D.events.unshift(`${stamp()} ${ch}: ${ev}${extra ? ' ' + extra : ''}`); D.events.length = Math.min(D.events.length, 10); fire(); }
function fail(ch, name, e){
  const msg = (e && (e.name || 'Error')) + ': ' + ((e && e.message) || String(e));
  D.errors++; D.lastError = `${stamp()} ${ch} ${name} — ${msg}`; logEv(ch, 'play() failed', msg);
  errSubs.forEach(f => { try{ f(msg, name, ch); }catch(_){} });
}

/* ---- element pool: main (examples + loops + test), metro, fx (timer chime) ---- */
const els = {};
function el(ch){
  if(els[ch]) return els[ch];
  const a = document.createElement('audio'); a.preload = 'auto'; a.setAttribute('playsinline', ''); a.setAttribute('webkit-playsinline', ''); a.setAttribute('x-webkit-airplay', 'deny');
  a.dataset.ch = ch; a.style.display = 'none'; document.body.appendChild(a);
  ['playing', 'pause', 'ended', 'waiting', 'stalled', 'canplay', 'loadedmetadata'].forEach(ev => a.addEventListener(ev, () => logEv(ch, ev)));
  a.addEventListener('error', () => { const er = a.error; if(!a._name) return; fail(ch, a._name, {name: 'MediaError ' + (er ? er.code : '?'), message: (er && er.message) || ['', 'aborted', 'network error', 'decode error', 'format not supported'][er ? er.code : 0] || 'unknown'}); end(a); });
  a.addEventListener('ended', () => { if(!a.loop) end(a); });
  els[ch] = a; return a;
}
A.el = el; A.els = els;
function end(a){ const cb = a._onEnd; a._onEnd = null; a._token = null; if(cb) try{ cb(); }catch(e){} fire(); }

/* Play a pre-rendered sound. MUST be called synchronously from the tap/click handler. */
A.play = function(name, o){
  o = o || {}; const ch = o.ch || 'main', a = el(ch);
  A.stop(ch);
  if(!A.has(name)){ fail(ch, name, {name: 'MissingFile', message: `no recording named "${name}"`}); if(o.onEnd) o.onEnd(); return false; }
  const url = A.url(name);
  a.loop = !!o.loop; a.muted = false;
  if(a._src !== url){ a.src = url; a._src = url; } else { try{ a.currentTime = 0; }catch(e){} }
  a._name = name; const token = a._token = {}; a._onEnd = o.onEnd || null;
  D.plays++; D.last = `${stamp()} ${ch}: ${name}.${A.fmt}`; logEv(ch, 'play()', name);
  let p; try{ p = a.play(); }catch(e){ fail(ch, name, e); end(a); return false; }
  if(p && p.then) p.then(() => { D.lastOk = `${stamp()} ${ch}: ${name}`; fire(); }, e => { if(a._token !== token) return; fail(ch, name, e); end(a); });
  a._unlocked = true;
  return true;
};
A.stop = function(ch){ const a = els[ch || 'main']; if(!a) return; if(!a.paused) a.pause(); end(a); };
A.stopAll = () => A.stop('main');
A.isPlaying = (ch) => { const a = els[ch || 'main']; return !!a && !a.paused && !a.ended; };
/* Activate an element during a tap so it can play later without one (timer chime). */
A.prime = function(ch, name){
  const a = el(ch); if(a._unlocked || !A.has(name)) return; a._unlocked = true;
  a.src = a._src = A.url(name); a.muted = true;
  try{ const p = a.play(); if(p && p.then) p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; }, () => { a.muted = false; a._unlocked = false; }); }catch(e){ a.muted = false; }
};
A.chime = () => { const a = el('fx'); a.muted = false; A.play('chime', {ch: 'fx'}); };
A.test = (onEnd) => A.play('test-strum', {onEnd});

/* Beat/bar follower for looping tracks (drives the beat dots and chord highlight). */
function follow(ch, beatDur, cb){
  let last = -1; const h = setInterval(() => { const a = els[ch]; if(!a || a.paused) return; const b = Math.floor((a.currentTime + 0.03) / beatDur); if(b !== last){ last = b; cb(b); } }, 40);
  return () => clearInterval(h);
}
/* Backing loop: spec {prog, feel, bpm}; tempo + drums pick a pre-rendered variant. */
A.Loop = class{
  constructor(o){ Object.assign(this, {drums: true}, o); }
  name(){ return M.name.loop(this.spec, this.bpm, this.page === 'song' ? true : this.drums); }
  start(){
    const self = this, beats = this.spec.feel === 'waltz' ? 3 : 4, n = this.spec.prog.length;
    if(this.unfollow) this.unfollow();
    const tok = this.tok = {}; this.running = true;
    const ok = A.play(this.name(), {loop: true, onEnd: () => { if(self.tok === tok) self._ended(); }});
    this.unfollow = follow('main', 60 / this.bpm, b => { const bar = Math.floor(b / beats) % n;
      if(b % beats === 0 && self.onBar) self.onBar(bar, self.spec.prog[bar]); if(self.onBeat) self.onBeat(b % beats); });
    return ok;
  }
  restart(){ if(this.running) this.start(); }
  _ended(){ if(!this.running) return; this.running = false; if(this.unfollow) this.unfollow(); if(this.onStop) this.onStop(); }
  stop(){ A.stop('main'); this._ended(); }
};
/* Metronome: looping click track at the nearest available BPM. */
A.nearestBpm = b => A.metroBpms.reduce((x, y) => Math.abs(y - b) < Math.abs(x - b) ? y : x, A.metroBpms[0] || b);
A.stepBpm = (b, d) => { const L = A.metroBpms; if(!L.length) return b; const t = b + d;
  return d > 0 ? (L.find(x => x >= t) || L[L.length - 1]) : ([...L].reverse().find(x => x <= t) || L[0]); };
A.Metronome = class{
  constructor(o){ Object.assign(this, {bpm: 70, beats: 4}, o); this.bpm = A.nearestBpm(this.bpm); }
  start(){ const self = this, tok = this.tok = {}; if(this.unfollow) this.unfollow();
    A.play(M.name.metro(this.bpm), {ch: 'metro', loop: true, onEnd: () => { if(self.tok !== tok) return; self.running = false; if(self.unfollow) self.unfollow(); if(self.onStop) self.onStop(); }});
    this.running = true; this.count = 0;
    this.unfollow = follow('metro', 60 / this.bpm, b => { self.count++; if(self.onBeat) self.onBeat(b % self.beats); }); }
  setBpm(b){ this.bpm = A.nearestBpm(b); if(this.running) this.start(); }
  stop(){ this.running = false; if(this.unfollow) this.unfollow(); A.stop('metro'); }
};
/* Diagnostics snapshot (shown on screen so Parker can screenshot it). */
A.diagText = function(extra){
  const st = a => !a ? 'not created yet' : `${a.paused ? (a.ended ? 'ended' : 'paused') : 'PLAYING'} · ${a._name || '-'} · t=${a.currentTime.toFixed(2)}/${isFinite(a.duration) ? a.duration.toFixed(1) : '?'}s · ready=${a.readyState} net=${a.networkState}${a.error ? ` · MediaError ${a.error.code} ${a.error.message || ''}` : ''}${a.muted ? ' · muted' : ''}`;
  const sa = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  return [
    `App ${extra.app} · SW ${extra.sw} · audio files rev ${F.rev} (${Object.keys(F.d).length} sounds)`,
    `Format: ${A.fmt} · canPlay m4a="${A.support.m4a}" mp3="${A.support.mp3}"`,
    `main: ${st(els.main)}`, `metro: ${st(els.metro)}`, `fx: ${st(els.fx)}`,
    `Last play: ${D.last || '-'} · last OK: ${D.lastOk || '-'}`,
    `Last error: ${D.lastError || 'none'} (${D.errors} total)`,
    `Standalone (home-screen app): ${sa} · online: ${navigator.onLine}`,
    `UA: ${navigator.userAgent}`,
    'Recent events:', ...D.events.map(e => '  ' + e)].join('\n');
};
window.GAudio = A;
})();
