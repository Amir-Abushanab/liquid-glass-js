// Re-capture docs/media as ANIMATED WebP from the live showcase.
//
// The README's stills undersold a library whose whole point is motion — the
// lens drifts and merges, the nyan card scrolls, the dropdown materializes.
// This drives real headless Chromium over raw CDP (node >= 22 has a WebSocket
// client, so no puppeteer dependency) and assembles frames with `img2webp`
// (brew install webp). Frames are captured in real time — rAF runs in
// headless=new — at devicePixelRatio 2, so the files stay retina-crisp at the
// README's display widths.
//
// Usage: pnpm dev (in another shell), then  node scripts/capture-media.mjs
// Optionally pass shot names to re-do a subset: node scripts/capture-media.mjs lens dropdown
//
// Each shot scrolls its subject into view, optionally performs a gesture
// (the dropdown opens and closes; the typeface is stroked by a synthetic
// pointer), captures ~FPS frames per second for its duration, and encodes
// lossy WebP. Sizes land well under a megabyte a piece at -q 62.

import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.SHOWCASE_URL || 'http://localhost:4321/';
const OUT = new URL('../docs/media/', import.meta.url).pathname;
const CHROME =
  process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FPS = 12;
// Capture scale: 2 is retina-crisp but the filtered scene re-rasters per frame
// and throughput drops to ~5fps; 1 sustains the full FPS. Motion beats pixels
// for animated docs media, so 1 is the default — bump per run if a shot needs it.
const SCALE = Number(process.env.CAPTURE_SCALE || 1);

/** @type {Record<string, {sel: string, seconds: number, theme?: 'dark'|'light', out?: string, gesture?: string}>} */
const SHOTS = {
  lens: { sel: '.lens-stage', seconds: 6, theme: 'dark', out: 'lens.webp' },
  'render-paths-dark': { sel: '.pathstage', seconds: 5, theme: 'dark' },
  'render-paths-light': { sel: '.pathstage', seconds: 5, theme: 'light' },
  dropdown: { sel: '.gm-stage', seconds: 5, theme: 'dark', gesture: 'dropdown' },
  typeface: { sel: '.lgfstage', seconds: 5, theme: 'dark', gesture: 'stroke' },
  anything: { sel: '.gshape-stage', seconds: 5, theme: 'dark' },
};

// ── minimal flat-mode CDP client ──
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      } else if (m.method && this.listeners.has(m.method)) {
        for (const fn of this.listeners.get(m.method)) fn(m.params, m.sessionId);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const only = process.argv.slice(2);
  const names = Object.keys(SHOTS).filter((n) => !only.length || only.includes(n));

  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      '--no-first-run',
      '--hide-scrollbars',
      `--user-data-dir=${mkdtempSync(join(tmpdir(), 'lg-capture-'))}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    chrome.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) resolve(m[1]);
    });
    chrome.on('exit', () => reject(new Error('chrome exited early')));
    setTimeout(() => reject(new Error('no devtools endpoint\n' + buf)), 15000);
  });
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
  const cdp = new CDP(ws);

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: s } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, s);
  await cdp.send('Runtime.enable', {}, s);
  await cdp.send(
    'Emulation.setDeviceMetricsOverride',
    // DSF 1: the clip re-rasterizes at scale 2 per capture, which is the
    // retina path that actually works headless (screencast starves; DSF-2
    // surfaces made clip coordinates ambiguous).
    { width: 1200, height: 760, deviceScaleFactor: 1, mobile: false },
    s,
  );

  const evaluate = async (expr) => {
    const r = await cdp.send(
      'Runtime.evaluate',
      { expression: expr, awaitPromise: true, returnByValue: true },
      s,
    );
    if (r.exceptionDetails)
      throw new Error(
        (r.exceptionDetails.exception?.description || r.exceptionDetails.text) +
          ' in: ' +
          expr.slice(0, 120),
      );
    return r.result.value;
  };

  for (const name of names) {
    const shot = SHOTS[name];
    const out = shot.out || `${name}.webp`;
    process.stdout.write(`${name}: `);
    await cdp.send(
      'Emulation.setEmulatedMedia',
      { features: [{ name: 'prefers-color-scheme', value: shot.theme || 'dark' }] },
      s,
    );
    const loaded = new Promise((r) => cdp.on('Page.loadEventFired', () => r()));
    await cdp.send('Page.navigate', { url: BASE }, s);
    await loaded;
    await sleep(2500); // glass mounts, maps decode, fonts settle
    // Strip the interactive chrome that would photobomb a fixed-position shot:
    // the Glass Tuner panel, and the render-path badge overlay if it's on.
    await evaluate(`(() => {
      document.querySelector('.cfg')?.remove();
      const t = document.getElementById('rp-toggle');
      if (t && t.checked) t.click();
    })()`);

    // Scroll the subject to the viewport centre and get its rect.
    const rect = await evaluate(`(async () => {
      // dev-server cold transforms can take a while on first hit — poll.
      let el = null;
      for (let i = 0; i < 100 && !el; i++) {
        el = document.querySelector(${JSON.stringify(shot.sel)});
        if (!el) await new Promise(r => setTimeout(r, 200));
      }
      if (!el) throw new Error('no ' + ${JSON.stringify(shot.sel)} + ' (title: ' + document.title + ', body: ' + document.body.innerHTML.length + ')');
      el.scrollIntoView({ block: 'center' });
      await new Promise(r => setTimeout(r, 600));
      const r2 = el.getBoundingClientRect();
      // captureScreenshot's clip indexes the DOCUMENT, not the viewport.
      return { x: r2.left + scrollX, y: r2.top + scrollY, w: r2.width, h: r2.height };
    })()`);
    const clip = {
      x: Math.max(0, Math.floor(rect.x) - 2),
      y: Math.max(0, Math.floor(rect.y) - 2),
      width: Math.ceil(rect.w) + 4,
      height: Math.ceil(rect.h) + 4,
    };

    // Gestures run alongside the capture loop, in page time.
    if (shot.gesture === 'dropdown') {
      evaluate(`(async () => {
        const dd = document.querySelector(${JSON.stringify(shot.sel)});
        const btn = dd.querySelector('[data-gm-trigger]');
        await new Promise(r => setTimeout(r, 500));
        btn.click(); // materialize open
        await new Promise(r => setTimeout(r, 2600));
        btn.click(); // and away
      })()`).catch(() => {});
    } else if (shot.gesture === 'stroke') {
      // Sweep a real pointer across the letterforms: the typeface deepens its
      // refraction under the pointer, so the stroke is the animation.
      (async () => {
        const cx = clip.x + clip.width / 2;
        const cy = clip.y + clip.height / 2;
        for (let t = 0; t < shot.seconds * 1000; t += 80) {
          const x = clip.x + clip.width * (0.15 + 0.7 * (0.5 + 0.5 * Math.sin(t / 900)));
          await cdp
            .send(
              'Input.dispatchMouseEvent',
              { type: 'mouseMoved', x: Math.round(x), y: Math.round(cy) },
              s,
            )
            .catch(() => {});
          await sleep(80);
        }
      })();
    }

    if (process.env.DEBUG_CAPTURE) {
      console.log('clip', JSON.stringify(clip));
      console.log(
        await evaluate(`(() => {
          const st = document.querySelector(${JSON.stringify(shot.sel)});
          const card = st.querySelector('.lens-stage__card') || st.firstElementChild;
          const cs = getComputedStyle(card);
          return JSON.stringify({
            children: st.children.length,
            cardBg: cs.backgroundColor,
            cardFilter: cs.filter.slice(0, 60),
            cardVisible: cs.visibility + '/' + cs.display,
            docBg: getComputedStyle(document.body).backgroundColor,
          });
        })()`),
      );
      const full = await cdp.send('Page.captureScreenshot', { format: 'png' }, s);
      writeFileSync(join(OUT, '..', '..', 'debug-viewport.png'), Buffer.from(full.data, 'base64'));
    }
    const dir = mkdtempSync(join(tmpdir(), `lg-${name}-`));
    // Capture loop. Screencast would be the elegant answer, but headless
    // starves it (~1.5fps delivered); a JPEG captureScreenshot with a scaled
    // clip sustains a usable rate, and the animation runs in real time either
    // way — measured wall-clock per frame becomes the WebP frame duration, so
    // playback speed is honest whatever rate we achieved.
    const frames = [];
    const total = Math.round(shot.seconds * FPS);
    const interval = 1000 / FPS;
    const t0 = Date.now();
    for (let i = 0; i < total; i++) {
      const target = t0 + i * interval;
      const wait = target - Date.now();
      if (wait > 0) await sleep(wait);
      const { data } = await cdp.send(
        'Page.captureScreenshot',
        { format: 'jpeg', quality: 92, clip: { ...clip, scale: SCALE }, fromSurface: true },
        s,
      );
      const f = join(dir, `f${String(i).padStart(3, '0')}.jpg`);
      writeFileSync(f, Buffer.from(data, 'base64'));
      frames.push(f);
    }
    const elapsed = Date.now() - t0;
    const frameMs = Math.round(elapsed / frames.length);
    execFileSync('img2webp', [
      '-loop',
      '0',
      '-lossy',
      '-q',
      '68',
      '-d',
      String(frameMs),
      ...frames,
      '-o',
      join(OUT, out),
    ]);
    if (process.env.DEBUG_CAPTURE) console.log('frames kept at', dir);
    else rmSync(dir, { recursive: true, force: true });
    const kb = Math.round(statSync(join(OUT, out)).size / 1024);
    console.log(`${frames.length} frames @ ~${Math.round(1000 / frameMs)}fps → ${out} (${kb}KB)`);
  }

  chrome.kill();
  ws.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
