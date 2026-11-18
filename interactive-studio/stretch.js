// WSOLA. One alignment decision for all channels and stems keeps the ensemble together.
self.onmessage = ({
  data: {
    data,
    rate,
    sr
  }
}) => {
  try {
    const frames = Math.max(...data.map(ch => ch[0].length)),
      hop = Math.round(sr * .014),
      window = hop * 2,
      search = Math.floor(sr * .006),
      length = Math.ceil(frames / rate);
    const ref = new Float32Array(frames);
    for (const ch of data)
      for (const c of ch)
        for (let i = 0; i < c.length; i++) ref[i] += c[i] / data.length / ch.length;
    const result = data.map(ch => ch.map(() => new Float32Array(length)));
    let previous = 0;
    for (let out = 0; out < length; out += hop) {
      const predicted = Math.round(out * rate);
      let src = predicted;
      if (out) {
        let best = -Infinity;
        for (let candidate = Math.max(0, predicted - search); candidate <= Math.min(frames - 1, predicted +
          search); candidate += 4) {
          let xy = 0,
            xx = 1e-9,
            yy = 1e-9;
          for (let k = 0; k < hop; k += 8) {
            const a = ref[previous + hop + k] || 0,
              b = ref[candidate + k] || 0;
            xy += a * b;
            xx += a * a;
            yy += b * b
          }
          const score = xy / Math.sqrt(xx * yy) - .015 * Math.abs(candidate - predicted) / search;
          if (score > best) {
            best = score;
            src = candidate
          }
        }
      }
      const n = Math.min(window, length - out);
      for (let k = 0; k < n; k++) {
        const weight = k < hop ? (out ? k / hop : 1) : 1 - (k - hop) / hop;
        for (let t = 0; t < data.length; t++)
          for (let c = 0; c < data[t].length; c++) result[t][c][out + k] += (data[t][c][src + k] || 0) * weight
      }
      previous = src
    }
    self.postMessage({
      result
    }, result.flat().map(c => c.buffer))
  } catch (e) {
    self.postMessage({
      error: e.message
    })
  }
}
