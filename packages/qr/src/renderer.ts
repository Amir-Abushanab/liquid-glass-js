// WebGL2 procedural QR + glass renderer — exact port of Aave's class `p`
// and its shaders (bundle fc9f28cb 1037-1357).
//
// The QR is drawn entirely in the fragment shader: an R8 occupancy texture
// gives an O(1) per-module dot lookup, and the 3 finder "eyes" are SDF rounded
// rects. When a displacement lens is active it refracts the modules with a
// per-channel chroma split; two "painting" textures shrink + tint the dots so
// the click ripple sweeps across them.

import type { Eye } from './geometry';

const VERT = `#version 300 es
  in vec2 a_position;
  out vec2 v_uv;

  void main() {
    v_uv = (a_position * 0.5) + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAG = `#version 300 es
  precision highp float;
  precision highp sampler2D;

  in vec2 v_uv;
  out vec4 fragColor;

  uniform float u_dotRadius;
  uniform vec3 u_backgroundColor;
  uniform sampler2D u_PaintingTexture;

  uniform sampler2D u_occupancyTexture;
  uniform float u_gridOriginUV; // padding / size, in UV
  uniform float u_cellUV;       // cellSize / size, in UV
  uniform float u_invCellUV;    // 1 / cellUV
  uniform int u_matrixLength;

  uniform sampler2D u_displacementMap;
  uniform sampler2D u_paintingColorTexture;
  uniform int u_displacementActive;
  uniform vec2 u_lensOrigin;
  uniform vec2 u_lensSize;
  uniform vec2 u_displacementScale;
  uniform float u_chromaAmount;

  // Eye uniforms (3 groups)
  uniform vec2 u_eyeCenter[3];
  uniform vec3 u_eyeHalf[3];    // x=outer, y=mid, z=inner half-size
  uniform vec3 u_eyeRadius[3];  // x=outer, y=mid, z=inner corner radius
  uniform vec3 u_eyeColor[3];   // fill color per group (animated)
  uniform float u_eyeScale[3];  // hover scale per group
  uniform float u_eyeRefractionScale; // 0-1 multiplier for eye displacement

  float testDot(vec2 pos, float r2) {
    int i = int(floor((pos.x - u_gridOriginUV) * u_invCellUV));
    int j = int(floor((pos.y - u_gridOriginUV) * u_invCellUV));
    if (i < 0 || i >= u_matrixLength || j < 0 || j >= u_matrixLength)
      return 1.0;
    if (texelFetch(u_occupancyTexture, ivec2(i, j), 0).r < 0.5)
      return 1.0;
    vec2 c = vec2(u_gridOriginUV) + (vec2(float(i), float(j)) + 0.5) * u_cellUV;
    vec2 d = pos - c;
    return dot(d, d) < r2 ? 0.0 : 1.0;
  }

  float roundedRectSDF(vec2 p, float half_, float radius) {
    vec2 d = abs(p) - vec2(half_) + vec2(radius);
    return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - radius;
  }

  vec4 testEyes(vec2 pos) {
    for (int g = 0; g < 3; g++) {
      vec2 local = (pos - u_eyeCenter[g]) / u_eyeScale[g];
      if (roundedRectSDF(local, u_eyeHalf[g].z, u_eyeRadius[g].z) < 0.0)
        return vec4(u_eyeColor[g], 1.0);
      if (roundedRectSDF(local, u_eyeHalf[g].y, u_eyeRadius[g].y) < 0.0)
        return vec4(u_backgroundColor, 1.0);
      if (roundedRectSDF(local, u_eyeHalf[g].x, u_eyeRadius[g].x) < 0.0)
        return vec4(u_eyeColor[g], 1.0);
    }
    return vec4(0.0);
  }

  vec4 sampleStatic(vec2 pos, float r2) {
    vec4 eye = testEyes(pos);
    if (eye.a > 0.5) return eye;
    float hole = testDot(pos, r2);
    if (hole < 0.5) return vec4(0.0, 0.0, 0.0, -1.0);
    return vec4(u_backgroundColor, 1.0);
  }

  void main() {
    vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
    float paint = texture(u_PaintingTexture, uv).r;
    float r2 = pow(u_dotRadius * (1.0 - paint), 2.0);

    if (u_displacementActive == 0) {
      vec4 s = sampleStatic(uv, r2);
      if (s.a < 0.0) discard;
      fragColor = s;
      return;
    }

    vec2 lensUV = (uv - u_lensOrigin) / u_lensSize;
    bool insideLens = lensUV.x >= 0.0 && lensUV.x <= 1.0 &&
                      lensUV.y >= 0.0 && lensUV.y <= 1.0;

    if (!insideLens) {
      vec4 s = sampleStatic(uv, r2);
      if (s.a < 0.0) discard;
      fragColor = s;
      return;
    }

    vec4 dispSample = texture(u_displacementMap, lensUV);
    if (dispSample.a < 0.01) {
      vec4 s = sampleStatic(uv, r2);
      if (s.a < 0.0) discard;
      fragColor = s;
      return;
    }
    vec2 disp = (dispSample.rg - 0.5) * u_displacementScale;

    float scaleR = 1.0 + u_chromaAmount * 2.0;
    float scaleG = 1.0 + u_chromaAmount * 1.0;

    vec2 uvR = uv + disp * scaleR;
    vec2 uvG = uv + disp * scaleG;
    vec2 uvB = uv + disp;

    vec2 eyeDisp = disp * u_eyeRefractionScale;
    vec2 eyeUvR = uv + eyeDisp * scaleR;
    vec2 eyeUvG = uv + eyeDisp * scaleG;
    vec2 eyeUvB = uv + eyeDisp;

    vec4 eyeR = testEyes(eyeUvR);
    vec4 eyeG = testEyes(eyeUvG);
    vec4 eyeB = testEyes(eyeUvB);

    float r, g, b;

    if (eyeR.a > 0.5) {
      r = eyeR.r;
    } else {
      float holeR = testDot(uvR, r2);
      float paintR = texture(u_paintingColorTexture, uvR).r;
      r = mix(paintR, u_backgroundColor.r, holeR);
    }

    if (eyeG.a > 0.5) {
      g = eyeG.g;
    } else {
      float holeG = testDot(uvG, r2);
      float paintG = texture(u_paintingColorTexture, uvG).g;
      g = mix(paintG, u_backgroundColor.g, holeG);
    }

    if (eyeB.a > 0.5) {
      b = eyeB.b;
    } else {
      float holeB = testDot(uvB, r2);
      float paintB = texture(u_paintingColorTexture, uvB).b;
      b = mix(paintB, u_backgroundColor.b, holeB);
    }

    fragColor = vec4(r, g, b, 1.0);
  }
`;

function compile(gl: WebGL2RenderingContext, src: string, type: number): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('Failed to create shader.');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Shader compilation error: ${log ?? ''}`);
  }
  return sh;
}

/** Cached probe result. `null` = not yet probed (and never cached on the server). */
let webgl2Supported: boolean | null = null;

/**
 * Whether this environment can render a Glass QR (i.e. has a WebGL2 context).
 *
 * `mountGlassQR` throws where it can't — call this first to decide whether to
 * enhance at all. Browsers cap live WebGL contexts (~16), so the probe context
 * is released immediately and the answer cached; `false` on the server, where
 * nothing is cached so the client re-probes after hydration.
 *
 * ```ts
 * if (isGlassQRSupported()) mountGlassQR(el, { value });
 * ```
 */
export function isGlassQRSupported(): boolean {
  if (webgl2Supported !== null) return webgl2Supported;
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    probe.width = probe.height = 1;
    const gl = probe.getContext('webgl2');
    webgl2Supported = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl2Supported = false;
  }
  return webgl2Supported;
}

function texParams(gl: WebGL2RenderingContext, filter: number) {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
}

interface TexSize {
  w: number;
  h: number;
}

export interface QRRendererOptions {
  canvas: HTMLCanvasElement;
  size: number;
  eyes: Eye[];
  occupancy: Uint8Array;
  matrixLength: number;
  gridOriginUV: number;
  cellUV: number;
  dotRadius: number;
  dotColor?: string;
  backgroundColor?: string;
}

export class QRGlassRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private vertexShader: WebGLShader;
  private fragmentShader: WebGLShader;
  private program: WebGLProgram;
  private vertexBuffer: WebGLBuffer;
  private indexBuffer: WebGLBuffer;
  private indices: Uint16Array;
  private dotRadius: number;

  private occupancyTexture: WebGLTexture;
  private paintingTexture: WebGLTexture;
  private displacementTexture: WebGLTexture;
  private paintingColorTexture: WebGLTexture;

  private dispSize: TexSize = { w: 0, h: 0 };
  private paintSize: TexSize = { w: 0, h: 0 };
  private paintColorSize: TexSize = { w: 0, h: 0 };

  private u_backgroundColor: WebGLUniformLocation;
  private u_displacementActive: WebGLUniformLocation;
  private u_lensOrigin: WebGLUniformLocation;
  private u_lensSize: WebGLUniformLocation;
  private u_displacementScale: WebGLUniformLocation;
  private u_chromaAmount: WebGLUniformLocation;
  private u_eyeColor: WebGLUniformLocation[] = [];
  private u_eyeScale: WebGLUniformLocation[] = [];
  private u_eyeRefractionScale: WebGLUniformLocation;

  /** Cached 1×1 2D context used to normalize any CSS colour to sRGB bytes. */
  private colorProbe: CanvasRenderingContext2D | null = null;

  constructor(o: QRRendererOptions) {
    this.canvas = o.canvas;
    const dpr = 1.25 * Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.height = o.size * dpr;
    this.canvas.width = o.size * dpr;
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    this.indices = new Uint16Array([0, 1, 2, 2, 1, 3]);
    this.dotRadius = o.dotRadius;

    const gl = this.canvas.getContext('webgl2');
    if (!gl) throw new Error('Failed to get webgl2 context.');
    this.gl = gl;

    this.occupancyTexture = gl.createTexture()!;
    this.paintingTexture = gl.createTexture()!;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ZERO);

    this.vertexShader = compile(gl, VERT, gl.VERTEX_SHADER);
    this.fragmentShader = compile(gl, FRAG, gl.FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) throw new Error('Failed to create WebGL program.');
    gl.attachShader(program, this.vertexShader);
    gl.attachShader(program, this.fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program linking error: ${log ?? ''}`);
    }
    gl.useProgram(program);
    this.program = program;

    this.vertexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    this.indexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(gl.getUniformLocation(program, 'u_dotRadius'), this.dotRadius);
    this.u_backgroundColor = gl.getUniformLocation(program, 'u_backgroundColor')!;
    const [br, bgc, bb] = this.resolveCssColor(o.backgroundColor ?? '#ffffff');
    gl.uniform3f(this.u_backgroundColor, br, bgc, bb);

    this.setupOccupancyTexture(o.occupancy, o.matrixLength, o.gridOriginUV, o.cellUV);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.paintingTexture);
    texParams(gl, gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(program, 'u_PaintingTexture'), 2);

    this.displacementTexture = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.displacementTexture);
    texParams(gl, gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(program, 'u_displacementMap'), 1);

    this.paintingColorTexture = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.paintingColorTexture);
    texParams(gl, gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(program, 'u_paintingColorTexture'), 3);

    this.u_displacementActive = gl.getUniformLocation(program, 'u_displacementActive')!;
    this.u_lensOrigin = gl.getUniformLocation(program, 'u_lensOrigin')!;
    this.u_lensSize = gl.getUniformLocation(program, 'u_lensSize')!;
    this.u_displacementScale = gl.getUniformLocation(program, 'u_displacementScale')!;
    this.u_chromaAmount = gl.getUniformLocation(program, 'u_chromaAmount')!;
    gl.uniform1i(this.u_displacementActive, 0);

    const dotRgb = o.dotColor ? this.resolveCssColor(o.dotColor) : this.resolveCssColor('#000000');
    for (let e = 0; e < 3; e++) {
      const outer = o.eyes[3 * e];
      const mid = o.eyes[3 * e + 1];
      const innr = o.eyes[3 * e + 2];
      const cx = (outer.x + outer.width / 2) / o.size;
      const cy = (outer.y + outer.height / 2) / o.size;
      gl.uniform2f(gl.getUniformLocation(program, `u_eyeCenter[${e}]`), cx, cy);
      gl.uniform3f(
        gl.getUniformLocation(program, `u_eyeHalf[${e}]`),
        outer.width / 2 / o.size,
        mid.width / 2 / o.size,
        innr.width / 2 / o.size,
      );
      gl.uniform3f(
        gl.getUniformLocation(program, `u_eyeRadius[${e}]`),
        outer.rx / o.size,
        mid.rx / o.size,
        innr.rx / o.size,
      );
      const colorLoc = gl.getUniformLocation(program, `u_eyeColor[${e}]`)!;
      this.u_eyeColor.push(colorLoc);
      gl.uniform3f(colorLoc, dotRgb[0], dotRgb[1], dotRgb[2]);
      const scaleLoc = gl.getUniformLocation(program, `u_eyeScale[${e}]`)!;
      this.u_eyeScale.push(scaleLoc);
      gl.uniform1f(scaleLoc, 1);
    }
    this.u_eyeRefractionScale = gl.getUniformLocation(program, 'u_eyeRefractionScale')!;
    gl.uniform1f(this.u_eyeRefractionScale, 0.16);
  }

  resolveCssColor(value: string): [number, number, number] {
    // Resolve var()/light-dark()/currentColor against the live canvas, then let a
    // 2D canvas read the result back as sRGB bytes. That covers every CSS colour
    // syntax — rgb(), oklch(), oklab(), hsl(), lab(), hwb(), color(), named — and
    // gamut-maps wide-gamut colours into the renderer's sRGB WebGL canvas. (The
    // old `/\d+/g` scrape only understood rgb() and mis-read an oklch() lightness
    // like `.985` as a colour channel, which is why unstyled QRs rendered green.)
    const computed = this.resolveCssColorString(value);
    if (!this.colorProbe) {
      const probe = document.createElement('canvas');
      probe.width = probe.height = 1;
      this.colorProbe = probe.getContext('2d', { willReadFrequently: true });
      // `copy` replaces the pixel outright, so alpha never blends with the prior read.
      if (this.colorProbe) this.colorProbe.globalCompositeOperation = 'copy';
    }
    const ctx = this.colorProbe;
    if (!ctx) return [1, 1, 1];
    ctx.fillStyle = '#000'; // deterministic fallback if `computed` is unparseable
    ctx.fillStyle = computed;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r / 255, g / 255, b / 255];
  }

  /** The computed CSS color string for a value (resolves var()/light-dark() against the live canvas). */
  resolveCssColorString(value: string): string {
    this.canvas.style.color = value;
    const computed = getComputedStyle(this.canvas).color;
    this.canvas.style.color = '';
    return computed;
  }

  private setupOccupancyTexture(data: Uint8Array, n: number, gridOriginUV: number, cellUV: number) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.occupancyTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, n, n, 0, gl.RED, gl.UNSIGNED_BYTE, data);
    texParams(gl, gl.NEAREST);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_occupancyTexture'), 0);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_gridOriginUV'), gridOriginUV);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_cellUV'), cellUV);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_invCellUV'), 1 / cellUV);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_matrixLength'), n);
  }

  updateBackgroundColor(value: string) {
    const [r, g, b] = this.resolveCssColor(value);
    this.gl.uniform3f(this.u_backgroundColor, r, g, b);
  }
  updateEyeColor(i: number, r: number, g: number, b: number) {
    this.gl.uniform3f(this.u_eyeColor[i], r, g, b);
  }
  updateEyeScale(i: number, s: number) {
    this.gl.uniform1f(this.u_eyeScale[i], s);
  }
  updateEyeRefractionScale(v: number) {
    this.gl.uniform1f(this.u_eyeRefractionScale, v);
  }

  private uploadTexture(src: TexImageSource, format: number, size: TexSize) {
    const gl = this.gl;
    const w = (src as any).width;
    const h = (src as any).height;
    if (w !== size.w || h !== size.h) {
      gl.texImage2D(gl.TEXTURE_2D, 0, format, format, gl.UNSIGNED_BYTE, src);
      size.w = w;
      size.h = h;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, format, gl.UNSIGNED_BYTE, src);
    }
  }

  updateDisplacement(
    src: TexImageSource,
    lensOrigin: [number, number],
    lensSize: [number, number],
    scale: [number, number],
    chroma: number,
  ) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.displacementTexture);
    this.uploadTexture(src, gl.RGBA, this.dispSize);
    gl.uniform1i(this.u_displacementActive, 1);
    gl.uniform2f(this.u_lensOrigin, lensOrigin[0], lensOrigin[1]);
    gl.uniform2f(this.u_lensSize, lensSize[0], lensSize[1]);
    gl.uniform2f(this.u_displacementScale, scale[0], scale[1]);
    gl.uniform1f(this.u_chromaAmount, chroma);
  }

  clearDisplacement() {
    this.gl.uniform1i(this.u_displacementActive, 0);
  }

  updatePaintingTextureForScale(src: TexImageSource) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.paintingTexture);
    this.uploadTexture(src, gl.RGB, this.paintSize);
  }

  updatePaintingColorTexture(src: TexImageSource) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.paintingColorTexture);
    this.uploadTexture(src, gl.RGB, this.paintColorSize);
  }

  draw() {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, this.indices.length, gl.UNSIGNED_SHORT, 0);
  }

  cleanUp() {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteShader(this.vertexShader);
    gl.deleteShader(this.fragmentShader);
    gl.deleteBuffer(this.vertexBuffer);
    gl.deleteBuffer(this.indexBuffer);
    gl.deleteTexture(this.occupancyTexture);
    gl.deleteTexture(this.paintingTexture);
    gl.deleteTexture(this.displacementTexture);
    gl.deleteTexture(this.paintingColorTexture);
  }
}
