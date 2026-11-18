export class Microphone {
  constructor(engine, draw, capture = constraints => navigator.mediaDevices.getUserMedia(constraints)) {
    this.capture = capture;
    this.engine = engine;
    this.draw = draw;
    this.gainValue = 1;
    this.smart = true
  }
  async enable() {
    if (this.stream) return;
    const ctx = await this.engine.unlock();
    if (!navigator.mediaDevices?.getUserMedia) throw Error(
      'Microphone access requires an HTTPS page and a browser with microphone support.');
    this.stream = await this.capture({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1
      }
    });
    this.source = ctx.createMediaStreamSource(this.stream);
    this.gain = ctx.createGain();
    this.gain.gain.value = this.gainValue;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.source.connect(this.analyser);
    this.source.connect(this.gain);
    this.arr = new Float32Array(2048);
    this.stream.getAudioTracks()[0].onended = () => this.disable();
    this.calibrate();
    this.measure()
  }
  calibrate() {
    this.samples = [];
    this.until = performance.now() + 1400
  }
  measure() {
    if (!this.stream) return;
    this.analyser.getFloatTimeDomainData(this.arr);
    let sum = 0,
      peak = 0;
    for (const v of this.arr) {
      sum += v * v;
      peak = Math.max(peak, Math.abs(v))
    }
    const rms = Math.sqrt(sum / this.arr.length);
    let label = 'Listening';
    const now = performance.now();
    if (this.smart && now < this.until) {
      this.samples.push(rms);
      label = 'Measuring room noise. Stay quiet.'
    } else {
      if (this.samples?.length) {
        const sorted = this.samples.sort((a, b) => a - b);
        this.floor = Math.max(.002, sorted[Math.floor((sorted.length - 1) * .5)]);
        this.samples = []
      }
      if (peak > .985 || peak * this.gainValue > .985) this.clipUntil = now + 900;
      if (now < this.clipUntil) label = 'Clipping · move back or lower gain';
      else if (this.smart && rms < Math.max(.004, (this.floor || .008) * 1.8)) label = this.floor >= .04 ?
        'Loud room · move closer to the mic' : 'Room noise';
      else label = rms > .015 ? 'Instrument signal' : 'Low input'
    }
    this.draw(Math.min(100, Math.round(Math.sqrt(peak * this.gainValue) * 100)), label);
    this.frame = requestAnimationFrame(() => this.measure())
  }
  setGain(v) {
    this.gainValue = v;
    if (this.gain) this.gain.gain.setTargetAtTime(v, this.engine.ctx.currentTime, .012)
  }
  record(include, onBlob) {
    if (!this.stream || !window.MediaRecorder) throw Error(
      'Recording is unavailable in this browser. Open the studio in Chrome or Safari and allow the microphone.');
    const ctx = this.engine.ctx,
      dest = ctx.createMediaStreamDestination();
    this.gain.connect(dest);
    if (include) this.engine.limiter.connect(dest);
    const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t));
    let rec;
    const clean = () => {
      try {
        this.gain?.disconnect(dest)
      } catch {}
      if (include) try {
        this.engine.limiter.disconnect(dest)
      } catch {}
      dest.stream.getTracks().forEach(t => t.stop());
      dest.disconnect()
    };
    try {
      rec = new MediaRecorder(dest.stream, type ? {
        mimeType: type
      } : undefined)
    } catch (e) {
      clean();
      throw e
    }
    const chunks = [];
    rec.ondataavailable = e => {
      if (e.data.size) chunks.push(e.data)
    };
    rec.onstop = () => {
      clean();
      onBlob(new Blob(chunks, {
        type: rec.mimeType
      }), performance.now() - start)
    };
    let start = performance.now();
    try {
      rec.start(500)
    } catch (e) {
      clean();
      throw e
    }
    this.rec = rec
  }
  get recording() {
    return this.rec?.state === 'recording'
  }
  stop() {
    if (this.recording) this.rec.stop()
  }
  disable() {
    this.stop();
    cancelAnimationFrame(this.frame);
    this.stream?.getTracks().forEach(t => {
      t.onended = null;
      t.stop()
    });
    this.stream = null;
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.gain?.disconnect();
    this.draw(0, 'Use headphones to record with the band.')
  }
}
