// Type shim so external TypeScript/Astro consumers can import this packaged
// .astro component by its subpath. Content is single-line plain text (the slot).
export interface LiquidGlassFontProps {
  class?: string;
}
declare const LiquidGlassFont: (props: LiquidGlassFontProps) => unknown;
export default LiquidGlassFont;
