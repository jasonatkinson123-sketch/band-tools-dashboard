import {
  $,
  esc
} from './common.js';
export class Reader {
  constructor(seek) {
    this.seek = seek;
    this.zoom = 100;
    this.page = 0;
    this.generation = 0
  }
  async select(part) {
    this.part = part;
    this.page = 0;
    const serial = ++this.generation;
    this.task?.cancel();
    this.pdf?.destroy();
    this.pdf = null;
    this.num = part?.pages?.length || 0;
    if (part?.pdfBlob) {
      const lib = await import('./vendor/pdf/pdf.min.mjs');
      lib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf/pdf.worker.min.mjs', import.meta.url).href;
      const doc = await lib.getDocument({
        data: new Uint8Array(await part.pdfBlob.arrayBuffer()),
        standardFontDataUrl: new URL('./vendor/pdf/standard_fonts/', import.meta.url).href,
        wasmUrl: new URL('./vendor/pdf/wasm/', import.meta.url).href,
        isEvalSupported: false
      }).promise;
      if (serial !== this.generation) {
        await doc.destroy();
        return
      }
      this.pdf = doc;
      this.num = doc.numPages
    }
    await this.render()
  }
  async render() {
    const token = ++this.generation;
    this.task?.cancel();
    this.task = null;
    const el = $('sheet');
    el.replaceChildren();
    el.style.width = this.zoom + '%';
    $('scorewell').scrollTop = 0;
    $('zoomPct').textContent = this.zoom + '%';
    $('pageInfo').textContent = (this.part?.name || 'Part') + '  ·  ' + (this.num ? 'Page ' + (this.page + 1) +
      ' of ' + this.num : 'No printed part');
    $('prevPage').disabled = this.page <= 0;
    $('nextPage').disabled = this.page + 1 >= this.num;
    if (!this.num) {
      el.innerHTML =
        '<div class="empty"><h3>No printed part yet</h3><p>Attach the instrumental PDF in Teacher desk to read it here.</p></div>';
      return
    }
    const asset = this.part.pages?.[this.page];
    if (this.pdf) {
      const page = await this.pdf.getPage(this.page + 1);
      if (token !== this.generation) return;
      const base = page.getViewport({
        scale: 1
      });
      const size = page.getViewport({
        scale: Math.min(3, Math.max(1.55, el.clientWidth * 1.45 / base.width))
      });
      const c = document.createElement('canvas');
      c.width = size.width;
      c.height = size.height;
      c.setAttribute('aria-label', this.part.name + ' page ' + (this.page + 1));
      el.append(c);
      const task = page.render({
        canvasContext: c.getContext('2d'),
        viewport: size
      });
      this.task = task;
      try {
        await task.promise
      } catch (e) {
        if (e.name !== 'RenderingCancelledException') throw e
      }
      if (token !== this.generation) return
    } else {
      const im = new Image();
      im.alt = this.part.name + ', page ' + (this.page + 1);
      im.width = asset.width;
      im.height = asset.height;
      im.src = asset.src;
      el.append(im)
    }
    const boxes = this.part.locations?.filter(x => x.page === this.page + 1) || asset?.boxes?.map(b => ({
      ...b,
      x: b.x * 100 / asset.width,
      y: b.y * 100 / asset.height,
      w: b.w * 100 / asset.width,
      h: b.h * 100 / asset.height
    })) || [];
    for (const b of boxes) {
      const box = document.createElement('button');
      box.className = 'box';
      box.dataset.n = b.n;
      box.title = 'Start at measure ' + b.n;
      box.setAttribute('aria-label', box.title);
      Object.assign(box.style, {
        left: b.x + '%',
        top: b.y + '%',
        width: b.w + '%',
        height: b.h + '%'
      });
      box.onclick = () => this.seek(b.n);
      el.append(box)
    }
    this.last = null
  }
  async highlight(n, follow) {
    if (this.last === n) return;
    const other = this.part?.locations?.find(x => x.n === n)?.page - 1;
    const at = Number.isFinite(other) ? other : this.part?.pages?.findIndex(p => p.boxes?.some(b => b.n === n));
    if (follow && at >= 0 && at !== this.page) {
      this.page = at;
      await this.render()
    }
    this.last = n;
    const current = $('sheet').querySelector('.box.current');
    current?.classList.remove('current');
    const b = $('sheet').querySelector('[data-n="' + Number(n) + '"]');
    b?.classList.add('current');
    if (follow && b) {
      const well = $('scorewell'),
        r = b.getBoundingClientRect(),
        w = well.getBoundingClientRect();
      if (r.bottom > w.bottom || r.top < w.top) well.scrollTop += r.top - w.top - well.clientHeight * .27
    }
  }
}
