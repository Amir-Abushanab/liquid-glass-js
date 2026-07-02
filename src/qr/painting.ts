// "Painting" textures for the Glass QR — exact port of Aave's PaintingTexture
// (x), Splash ring (R) and Point (C) classes (bundle fc9f28cb 1359-1538).
//
// Each PaintingTexture is a small 2D canvas the QR shader samples:
//   • the colour instance tints the dots (cycles Aave's palette on each click)
//   • the shape instance (OffscreenCanvas) drives the per-dot shrink
// A click pushes a Splash — an expanding radial-gradient ring — and the cursor
// leaves a soft blurred-shadow trail of Points.

// Aave's splash palette (cycled on every click).
export const SPLASH_COLORS = ['#9896FF', '#39D1F9', '#FFB400', '#FF3200'];

export function nextColor(c: string): string {
  const i = SPLASH_COLORS.indexOf(c);
  return SPLASH_COLORS[(i + 1) % SPLASH_COLORS.length];
}

// Error-correction → painted-centre fraction (also reused for the logo scale).
export const EC_RADIUS: Record<string, number> = { L: 0.07, M: 0.15, Q: 0.25, H: 0.3 };

const DEFAULT_RING_START = 0.7;

// hex (+ alpha) → display-p3 css string, matching Aave's `d()`.
function p3(hex: string, alpha?: number): string {
  const [r, g, b] = hex
    .replace('#', '')
    .split(/(?=(?:..)*$)/)
    .map((h) => parseInt(h, 16));
  return `color(display-p3 ${r / 255} ${g / 255} ${b / 255} / ${alpha ?? 1})`;
}

// hex → [r,g,b] in 0..1, matching Aave's `b()`.
export function hexToRgb(hex: string): [number, number, number] {
  const t = hex.replace('#', '');
  return [
    parseInt(t.substring(0, 2), 16) / 255,
    parseInt(t.substring(2, 4), 16) / 255,
    parseInt(t.substring(4, 6), 16) / 255,
  ];
}

let p3Supported: boolean | undefined;
function supportsP3(): boolean {
  if (p3Supported !== undefined) return p3Supported;
  try {
    const c = document.createElement('canvas').getContext('2d', { colorSpace: 'display-p3' } as any);
    p3Supported = (c as any)?.colorSpace === 'display-p3';
  } catch {
    p3Supported = false;
  }
  return p3Supported;
}

interface Point {
  x: number;
  y: number;
  age: number;
  color: string;
}

// An expanding ring drawn as a radial gradient that grows then fades.
class Splash {
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private size: number;
  private radius = 0;
  private innerRadius: number;
  private outerRadius: number;
  private speed: number;
  private color: string;
  private clearColor: string;
  private originX: number;
  private originY: number;
  private fadeOpacity = 1;
  isComplete = false;

  constructor(o: {
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    size: number;
    color: string;
    speed: number;
    clearColor: string;
    initialInnerRadius: number;
    initialOuterRadius: number;
    originX?: number; // splash centre in canvas px (defaults to centre)
    originY?: number;
  }) {
    this.ctx = o.ctx;
    this.size = o.size;
    this.innerRadius = o.initialInnerRadius;
    this.outerRadius = o.initialOuterRadius;
    this.speed = o.speed;
    this.color = o.color;
    this.clearColor = o.clearColor;
    this.originX = o.originX ?? o.size / 2;
    this.originY = o.originY ?? o.size / 2;
  }

  private update(dt: number) {
    if (this.innerRadius < 1 - this.speed / 1000) {
      const t = this.innerRadius + (this.speed / 1000) * dt;
      this.innerRadius = t <= this.outerRadius ? t : this.outerRadius;
    }
    if (this.radius < 3 * this.size) {
      this.radius = this.radius + (this.size * this.speed) / 1000 * dt;
    }
    if (this.innerRadius >= this.outerRadius) {
      this.fadeOpacity -= (this.speed / 1000) * dt;
      if (this.fadeOpacity <= 0) {
        this.fadeOpacity = 0;
        this.isComplete = true;
      }
    }
  }

  draw(dt: number) {
    const prevAlpha = this.ctx.globalAlpha;
    this.ctx.globalAlpha = this.fadeOpacity;
    this.ctx.beginPath();
    const g = this.ctx.createRadialGradient(
      this.originX, this.originY, 0,
      this.originX, this.originY, this.radius
    );
    g.addColorStop(0, this.clearColor);
    g.addColorStop(this.innerRadius, this.color);
    g.addColorStop(this.outerRadius, this.color);
    g.addColorStop(1, 'transparent');
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, this.size, this.size);
    this.ctx.globalAlpha = prevAlpha;
    this.update(dt);
  }
}

export interface PaintingOptions {
  canvas?: HTMLCanvasElement;
  size: number;
  maxAge: number;
  radius: number;
  intensityFactor: number;
  useColor?: boolean;
  clearColor?: string;
  splashSpeed?: number;
  ringStart?: number;
  ringEnd?: number;
}

export class PaintingTexture {
  canvas: HTMLCanvasElement | OffscreenCanvas | null;
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private points: Point[] = [];
  private size: number;
  private radius: number;
  private maxAge: number;
  private intensityFactor: number;
  private mousePosition = { x: -1e4, y: -1e4 };
  private color: string;
  private useColor: boolean;
  private clearColor: string;
  private splashSpeed: number;
  private ringStart: number;
  private ringEnd: number;
  private splashes: Splash[] = [];

  constructor(o: PaintingOptions) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.size = Math.ceil(o.size * dpr);
    this.radius = o.radius * dpr;
    this.maxAge = o.maxAge;
    this.intensityFactor = o.intensityFactor;
    this.useColor = o.useColor ?? false;
    this.clearColor = o.clearColor ?? 'black';
    this.splashSpeed = o.splashSpeed ?? (this.useColor ? 10 : 13);
    this.ringStart = o.ringStart ?? DEFAULT_RING_START;
    this.ringEnd = o.ringEnd ?? 0.9;
    this.color = this.useColor ? SPLASH_COLORS[0] : '#ffffff';
    this.canvas = o.canvas ?? new OffscreenCanvas(this.size, this.size);
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    const ctx = this.canvas.getContext('2d', {
      alpha: false,
      willReadFrequently: true,
      colorSpace: supportsP3() ? 'display-p3' : 'srgb',
    } as any) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) throw new Error('Error getting context for the PaintingTexture canvas.');
    this.ctx = ctx;
    this.clear();
  }

  private clear() {
    this.ctx.fillStyle = this.clearColor;
    this.ctx.fillRect(0, 0, this.size, this.size);
  }

  updateClearColor(c: string) { this.clearColor = c; }
  updateRingStart(v: number) { this.ringStart = v; }
  updateRingEnd(v: number) { this.ringEnd = v; }
  updateSplashSpeed(v: number) { this.splashSpeed = v; } // read fresh in onClick()
  updateMousePosition(p: { x: number; y: number }) { this.mousePosition = p; }

  private addPoint(p: { x: number; y: number }) {
    this.points.push({ x: p.x, y: p.y, age: 0, color: this.color });
  }

  private drawPoint(p: Point) {
    const pt = { x: p.x * this.size, y: (1 - p.y) * this.size };
    const r = this.radius;
    const i = 1 - p.age / this.maxAge;
    const n = 5 * this.size;
    this.ctx.shadowOffsetX = n;
    this.ctx.shadowOffsetY = n;
    this.ctx.shadowBlur = +r;
    this.ctx.shadowColor = p3(p.color, this.intensityFactor * i);
    this.ctx.beginPath();
    this.ctx.fillStyle = p3(p.color);
    this.ctx.arc(pt.x - n, pt.y - n, r, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.closePath();
  }

  // nx/ny are normalised (0..1, top-left origin); default to the centre, which
  // is what the Glass QR uses. The Liquid button passes the press position.
  onClick(nx = 0.5, ny = 0.5) {
    const inner = Math.max(0, Math.min(this.ringStart, this.ringEnd - 0.01));
    const outer = Math.max(inner + 0.01, Math.min(1, this.ringEnd));
    this.splashes.push(
      new Splash({
        ctx: this.ctx,
        size: this.size,
        color: this.color,
        speed: this.splashSpeed,
        clearColor: this.clearColor,
        initialInnerRadius: inner,
        initialOuterRadius: outer,
        originX: nx * this.size,
        originY: ny * this.size,
      })
    );
    if (this.useColor) this.color = nextColor(this.color);
  }

  get pointCount() { return this.points.length; }
  get splashCount() { return this.splashes.length; }

  update(dt: number, addPoint: boolean) {
    this.clear();
    this.splashes = this.splashes.filter((s) => !s.isComplete);
    for (const s of this.splashes) s.draw(dt);
    for (let i = this.points.length - 1; i >= 0; i--) {
      const p = this.points[i];
      const ease = 1 - (1 - p.age / this.maxAge) ** 3;
      p.age += dt * (0.5 + 0.5 * ease);
      if (p.age > this.maxAge) this.points.splice(i, 1);
      else this.drawPoint(p);
    }
    if (addPoint) this.addPoint({ x: this.mousePosition.x, y: this.mousePosition.y });
  }

  cleanUp() {
    this.clear();
    this.canvas = null;
    (this.ctx as any).reset?.();
    this.points = [];
  }
}
