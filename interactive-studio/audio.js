// Source positions are seconds at the score's original tempo. Every voice uses the same AudioContext clock.
export class Transport {
  constructor(onEnd) {
    this.onEnd = onEnd;
    this.pos = 0;
    this.rate = 1;
    this.volume = .7;
    this.sources = new Set();
    this.buses = new Map();
    this.muted = '';
    this.buffers = [];
    this.prepared = [];
    this.playing = false
  }
  async unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext({
        latencyHint: 'interactive'
      });
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.limiter = this.ctx.createDynamicsCompressor();
      this.master.connect(this.limiter).connect(this.ctx.destination)
    }
    await this.ctx.resume();
    return this.ctx
  }
  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, .015)
  }
  bus(id) {
    if (!this.buses.has(id)) {
      const b = this.ctx.createGain();
      b.gain.value = id === this.muted && id !== '' ? 0 : 1;
      b.connect(this.master);
      this.buses.set(id, b)
    }
    return this.buses.get(id)
  }
  mute(id) {
    this.muted = id;
    for (const [key, b] of this.buses) b.gain.setTargetAtTime(key === id && id !== '' ? 0 : 1, this.ctx.currentTime,
      .008)
  }
  reset() {
    this.stop();
    this.pos = 0;
    this.buffers = [];
    this.prepared = [];
    this.preparedRate = null;
    this.bufferKey = null;
    for (const b of this.buses.values()) b.disconnect();
    this.buses.clear()
  }
  async prepare(song, mode) {
    if (!['mix', 'stems'].includes(mode)) {
      this.prepared = [];
      this.preparedRate = null;
      return
    }
    const tracks = mode === 'mix' ? [{
      part: '',
      file: song.mix
    }] : song.stems;
    if (this.bufferKey !== song || this.mode !== mode) {
      this.buffers = [];
      this.bufferKey = null;
      this.preparedRate = null;
      let samples = 0;
      for (const track of tracks) {
        const buffer = await this.ctx.decodeAudioData(await track.file.arrayBuffer());
        samples += buffer.length * buffer.numberOfChannels;
        if (samples > 40000000) throw Error(
          'These tracks exceed the device playback budget. Use shorter sections or mono stems.');
        this.buffers.push({
          part: track.part,
          buffer
        })
      }
      this.bufferKey = song;
      this.mode = mode
    }
    if (this.preparedRate === this.rate) return;
    if (this.rate === 1) {
      this.prepared = this.buffers;
      this.preparedRate = 1;
      return
    }
    const data = this.buffers.map(({
      buffer
    }) => Array.from({
      length: buffer.numberOfChannels
    }, (_, i) => buffer.getChannelData(i).slice()));
    const worker = new Worker(new URL('./stretch.js', import.meta.url));
    let channels;
    try {
      channels = await new Promise((resolve, reject) => {
        worker.onmessage = e => e.data.error ? reject(Error(e.data.error)) : resolve(e.data.result);
        worker.onerror = e => reject(Error(e.message || 'Tempo processing failed.'));
        worker.postMessage({
          data,
          rate: this.rate,
          sr: this.ctx.sampleRate
        }, data.flat().map(a => a.buffer))
      })
    } finally {
      worker.terminate()
    }
    this.prepared = channels.map((ch, i) => {
      const buffer = this.ctx.createBuffer(ch.length, ch[0].length, this.ctx.sampleRate);
      ch.forEach((x, j) => buffer.copyToChannel(x, j));
      return {
        buffer,
        part: this.buffers[i].part
      }
    });
    this.preparedRate = this.rate
  }
  watch(src, nodes = []) {
    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
      src.disconnect();
      nodes.forEach(n => n.disconnect())
    }
  }
  tone(midi, when, d, id, click = false) {
    if (d < .004) return;
    const ctx = this.ctx,
      osc = ctx.createOscillator(),
      env = ctx.createGain(),
      filter = ctx.createBiquadFilter();
    const voice = (this.names?.get(id) || id).toLowerCase();
    const brass = /trumpet|horn|trombone|baritone|euphonium/.test(voice),
      reed = /clarinet|sax/.test(voice),
      mallet = /mallet|bell|percussion/.test(voice);
    osc.type = click || mallet ? 'sine' : brass ? 'sawtooth' : reed ? 'square' : 'triangle';
    osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    filter.type = 'lowpass';
    filter.frequency.value = brass ? 1750 : reed ? 1300 : 4200;
    const peak = click ? .23 : brass ? .082 : reed ? .074 : .12,
      at = Math.min(click ? .002 : .019, d * .22),
      release = Math.min(.045, d * .25);
    env.gain.setValueAtTime(.0001, when);
    env.gain.exponentialRampToValueAtTime(peak, when + at);
    env.gain.exponentialRampToValueAtTime(mallet ? peak * .1 : peak * .81, Math.max(when + at, when + d - release));
    env.gain.exponentialRampToValueAtTime(.0001, when + d);
    osc.connect(filter).connect(env).connect(this.bus(id));
    this.watch(osc, [filter, env]);
    osc.start(when);
    osc.stop(when + d)
  }
  start({
    song,
    mode,
    from,
    to,
    loop,
    count,
    onStart
  }) {
    this.stop(false);
    this.free = mode === "click" && !Number.isFinite(to);
    this.song = song;
    this.sourceMode = mode;
    this.from = from;
    this.to = to;
    this.loop = loop;
    this.names = new Map(song.parts.map(p => [p.id, p.name]));
    const initial = this.pos >= from && this.pos < to - .003 ? this.pos : from;
    this.pos = initial;
    const beat = 60 / (song.bpm || 96) / this.rate;
    this.origin = this.ctx.currentTime + .05 + (count ? 4 * beat : 0);
    this.countBeat = beat;
    this.initial = initial;
    this.nextCtx = this.origin;
    this.nextPos = initial;
    this.segmentHead = true;
    this.playing = true;
    onStart?.();
    if (count)
      for (let i = 0; i < 4; i++) this.tone(i ? 83 : 90, this.origin - (4 - i) * beat, .045, '@click', true);
    this.tick();
    this.timer = setInterval(() => this.tick(), 30)
  }
  get position() {
    if (!this.playing) return this.pos;
    const p = this.initial + Math.max(0, this.ctx.currentTime - this.origin) * this.rate;
    if (this.loop && p >= this.to) return this.from + (p - this.to) % (this.to - this.from);
    return Math.min(this.to, p)
  }
  get counting() {
    return this.playing ? Math.max(0, Math.ceil((this.origin - this.ctx.currentTime) / this.countBeat)) : 0
  }
  tick() {
    if (!this.playing) return;
    const now = this.ctx.currentTime,
      limit = now + .22;
    if (!this.loop && this.position >= this.to - .00001) {
      this.pos = this.to;
      this.stop(false);
      this.onEnd();
      return
    }
    // Skip a missed scheduler window after a background-tab stall; never replay late notes.
    if (this.nextCtx < now - .03) {
      this.nextCtx = now + .008;
      this.nextPos = this.position + .008 * this.rate;
      this.segmentHead = true
    }
    while (this.nextCtx < limit && this.playing) {
      if (this.nextPos >= this.to - 1e-7) {
        if (!this.loop) return;
        this.nextPos = this.from;
        this.segmentHead = true
      }
      const span = Math.min((limit - this.nextCtx) * this.rate, this.to - this.nextPos);
      if (span <= 1e-8) break;
      const begin = this.nextPos,
        end = begin + span,
        at = this.nextCtx;
      if (this.sourceMode === 'click') {
        const beat = 60 / (this.song.bpm || 96);
        for (let i = Math.ceil((begin - 1e-8) / beat); i * beat < end - 1e-8; i++) this.tone(84, at + (i * beat -
          begin) / this.rate, .04, '@click', true)
      } else if (this.sourceMode === 'synth') {
        const notes = this.song.notes;
        if (this.segmentHead) this.noteIndex = 0;
        for (let i = this.noteIndex; i < notes.length; i++) {
          const n = notes[i];
          if (n.t >= end - 1e-9) break;
          this.noteIndex = i + 1;
          if (n.t < begin - 1e-9 && (!this.segmentHead || n.t + n.d <= begin + .005)) continue;
          const onset = Math.max(begin, n.t),
            d = (Math.min(n.t + n.d, this.to) - onset) / this.rate;
          if (d > 0) this.tone(n.midi, at + (onset - begin) / this.rate, d, n.part)
        }
      } else if (this.segmentHead) {
        for (const {
            buffer,
            part
          }
          of this.prepared) {
          const offset = begin / this.rate,
            d = Math.min(buffer.duration - offset, (this.to - begin) / this.rate);
          if (d > .001) {
            const src = this.ctx.createBufferSource();
            src.buffer = buffer;
            src.connect(this.bus(part));
            this.watch(src);
            src.start(at, offset, d)
          }
        }
      }
      this.segmentHead = false;
      this.nextCtx += span / this.rate;
      this.nextPos = end
    }
  }
  stop(remember = true) {
    if (this.playing && remember) this.pos = this.position;
    this.playing = false;
    clearInterval(this.timer);
    for (const src of this.sources) {
      try {
        src.stop()
      } catch {}
    }
    this.sources.clear()
  }
}
