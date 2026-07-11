// @liquidglassjs/element — the <liquid-glass> custom element, over @liquidglassjs/core.
//
// One framework-agnostic component for Vue, Svelte, Angular, plain HTML, and
// Astro. It mounts the auto-selected renderer on ITSELF, in light DOM (not shadow
// DOM) — the SVG-refract path has to filter the element's real children, which a
// shadow root would hide.
//
//   <liquid-glass radius="20" strength="16">
//     <div class="ps-glass__refract"><!-- live DOM to bend --></div>
//   </liquid-glass>
//
// Importing this module registers the element (a side effect). Import the chrome
// CSS once as well: `@liquidglassjs/core/css`.

import { mountGlass } from '@liquidglassjs/core';
import type { GlassInstance, GlassOptions } from '@liquidglassjs/core';

const NUMERIC = [
  'radius',
  'depth',
  'dome',
  'strength',
  'edge',
  'glow',
  'chroma',
  'blur',
  'tint',
  'spec',
  'vibrancy',
] as const;
const STRING = ['backdrop', 'source', 'mode'] as const;

export class LiquidGlassElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return [...NUMERIC, ...STRING];
  }

  #instance: GlassInstance | null = null;
  #raf = 0;

  connectedCallback(): void {
    // Custom elements are inline + statically positioned by default; the glass
    // surface layers are absolutely positioned, so give the host a positioned
    // block box even before the chrome CSS loads.
    if (!this.style.display) this.style.display = 'block';
    if (!this.style.position) this.style.position = 'relative';
    this.#mount();
  }

  disconnectedCallback(): void {
    this.#teardown();
  }

  attributeChangedCallback(): void {
    if (!this.isConnected) return;
    // Coalesce rapid attribute writes into a single remount on the next frame
    // (mountGlass has no live reconfigure, so an option change means remount).
    cancelAnimationFrame(this.#raf);
    this.#raf = requestAnimationFrame(() => this.#mount());
  }

  /** Read plain attributes into GlassOptions; absent/invalid ones fall through to core defaults. */
  #readOptions(): GlassOptions {
    const o: Record<string, unknown> = {};
    for (const k of NUMERIC) {
      const v = this.getAttribute(k);
      if (v == null || v === '') continue;
      const n = Number(v);
      if (!Number.isNaN(n)) o[k] = n;
    }
    for (const k of STRING) {
      const v = this.getAttribute(k);
      if (v) o[k] = v;
    }
    return o as GlassOptions;
  }

  #mount(): void {
    this.#teardown();
    this.#instance = mountGlass(this, this.#readOptions());
  }

  #teardown(): void {
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    this.#instance?.dispose();
    this.#instance = null;
  }
}

// Register once, browser-only (SSR-safe: no customElements on the server).
if (typeof customElements !== 'undefined' && !customElements.get('liquid-glass')) {
  customElements.define('liquid-glass', LiquidGlassElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'liquid-glass': LiquidGlassElement;
  }
}
