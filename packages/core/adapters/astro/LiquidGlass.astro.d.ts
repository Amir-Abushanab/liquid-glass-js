// Type shim so external TypeScript/Astro consumers can import this packaged
// .astro component by its subpath. Astro compiles the .astro at build time;
// this only supplies the prop types (loose factory return, like Astro's own).
export interface LiquidGlassProps {
  radius?: number;
  depth?: number;
  dome?: number;
  strength?: number;
  edge?: number;
  glow?: number;
  chroma?: number;
  blur?: number;
  tint?: number;
  spec?: number;
  vibrancy?: number;
  backdrop?: string;
  source?: string;
  mode?: 'auto' | 'svg' | 'webgl' | 'frost';
  class?: string;
}
declare const LiquidGlass: (props: LiquidGlassProps) => unknown;
export default LiquidGlass;
