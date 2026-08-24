// @liquidglassjs/element/loupe — the <glass-loupe> custom element, over
// @liquidglassjs/core's `mountGlassLoupe`.
//
//   <glass-loupe zoom="1.6" trigger="longpress">
//     <article>…text to magnify…</article>
//   </glass-loupe>
//
// A separate entry from <liquid-glass> on purpose: the loupe is a distinct, opt-in
// feature, and folding it into the main entry would put it in every consumer's
// bundle. Importing this module registers the element (a side effect). Import the
// chrome CSS once as well: `@liquidglassjs/core/css`.
//
// Light DOM, like <liquid-glass> — the loupe clones the element's real children
// and relies on the page's own cascade reaching them, which a shadow root would cut.

import { mountGlassLoupe } from '@liquidglassjs/core';
import type { GlassLoupe, GlassLoupeOptions, GlassLoupeTrigger } from '@liquidglassjs/core';

const NUMERIC = [
  'zoom',
  'width',
  'height',
  'offset-y',
  'radius',
  'depth',
  'dome',
  'edge',
  'glow',
  'strength',
  'chroma',
  'blur',
  'shade',
  'long-press-ms',
  'move-tolerance',
] as const;
const STRING = ['trigger', 'backdrop', 'glint'] as const;
const BOOLEAN = ['no-snap', 'no-clamp', 'allow-native'] as const;

// Attributes are kebab-case; the option names they map to are not.
const CAMEL: Record<string, string> = {
  'offset-y': 'offsetY',
  'long-press-ms': 'longPressMs',
  'move-tolerance': 'moveTolerance',
};

export class GlassLoupeElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return [...NUMERIC, ...STRING, ...BOOLEAN];
  }

  #instance: GlassLoupe | null = null;
  #raf = 0;

  // A cloned custom element is a real custom element: inserting the loupe's copy into
  // the document upgrades it, which runs the lifecycle callbacks again. Without this
  // every open would mount a second, pointless loupe inside the first — and pay for
  // its displacement map. It has to gate *both* callbacks: the upgrade fires
  // attributeChangedCallback for each present attribute before connectedCallback.
  get #isClone(): boolean {
    return !!this.closest('[data-ps-loupe]');
  }

  connectedCallback(): void {
    if (this.#isClone) return;
    // The loupe measures and clones this element, so it needs a block box.
    if (!this.style.display) this.style.display = 'block';
    this.#mount();
  }

  disconnectedCallback(): void {
    this.#teardown();
  }

  attributeChangedCallback(): void {
    if (!this.isConnected || this.#isClone) return;
    // Coalesce rapid attribute writes into one remount on the next frame.
    cancelAnimationFrame(this.#raf);
    this.#raf = requestAnimationFrame(() => this.#mount());
  }

  /** Open the loupe at a viewport point — for `trigger="none"` and custom gestures. */
  show(clientX: number, clientY: number): void {
    this.#instance?.show(clientX, clientY);
  }
  move(clientX: number, clientY: number): void {
    this.#instance?.move(clientX, clientY);
  }
  hide(): void {
    this.#instance?.hide();
  }
  /** Re-read the source after its content changed. */
  refresh(): void {
    this.#instance?.refresh();
  }

  #readOptions(): GlassLoupeOptions {
    const o: Record<string, unknown> = { source: this };
    for (const k of NUMERIC) {
      const v = this.getAttribute(k);
      if (v == null || v === '') continue;
      const n = Number(v);
      if (!Number.isNaN(n)) o[CAMEL[k] ?? k] = n;
    }
    for (const k of STRING) {
      const v = this.getAttribute(k);
      if (v) o[k] = v;
    }
    // Negative attributes, so the useful defaults hold with no markup at all.
    if (this.hasAttribute('no-snap')) o.snapToLine = false;
    if (this.hasAttribute('no-clamp')) o.clamp = false;
    if (this.hasAttribute('allow-native')) o.suppressNative = false;
    if (this.getAttribute('backdrop') === 'none') o.backdrop = false;
    return o as unknown as GlassLoupeOptions;
  }

  #mount(): void {
    this.#teardown();
    this.#instance = mountGlassLoupe(this.#readOptions());
  }

  #teardown(): void {
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    this.#instance?.dispose();
    this.#instance = null;
  }
}

// Register once, browser-only (SSR-safe: no customElements on the server).
if (typeof customElements !== 'undefined' && !customElements.get('glass-loupe')) {
  customElements.define('glass-loupe', GlassLoupeElement);
}

export type { GlassLoupeTrigger };

declare global {
  interface HTMLElementTagNameMap {
    'glass-loupe': GlassLoupeElement;
  }
}
