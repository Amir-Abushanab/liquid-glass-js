// Types for the side-effect stylesheet export (`import "@liquidglassjs/core/css"`).
// The stylesheet has no runtime exports — this type-only marker just makes the
// subpath a module so strict TypeScript resolves the side-effect import (otherwise
// TS2882) in consumers of the shell components.
export type GlassChromeCss = void;
