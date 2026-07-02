// Liquid-glass WebGL renderer (Path B) — faithful to Aave's WebGL glass
// (bundle 3963…). Multi-pass: source texture → separable Gaussian (→ u_blurred)
// → composite. The composite samples a BAKED displacement map (RG = dome-warped
// displacement, B = specular) from displacement.ts, computes an analytical SDF
// lens mask in-shader, does chroma + frost, then Aave's two signature moves:
// adaptive specular (additive on dark / multiplicative on bright) and adaptive
// brightness/vibrancy (pull toward mid-gray for legibility through the glass).
import { renderDisplacementMap } from './displacement';

export interface GlassGLConfig {
  radius: number;
  depth: number;
  dome: number; // px sagitta
  strength: number; // displacement px
  chroma: number;
  frost: number; // Gaussian spread (texels)
  spec: number; // adaptive specular strength
  vibrancy: number; // adaptive brightness pull
  specLo: number; // luma where specular starts shifting additive → multiplicative
  specHi: number; // luma where it finishes
}

const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main(){
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// Aave's separable 9-tap Gaussian.
const BLUR_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_source;
uniform vec2 u_dir;
uniform float u_premul; // premultiply on the first pass so transparent edges don't bleed dark
vec4 fetch(vec2 uv){
  vec4 c = texture(u_source, uv);
  if (u_premul > 0.5) c.rgb *= c.a;
  return c;
}
void main(){
  vec4 c = fetch(v_uv) * 0.2042;
  c += (fetch(v_uv + 1.0 * u_dir) + fetch(v_uv - 1.0 * u_dir)) * 0.1801;
  c += (fetch(v_uv + 2.0 * u_dir) + fetch(v_uv - 2.0 * u_dir)) * 0.1240;
  c += (fetch(v_uv + 3.0 * u_dir) + fetch(v_uv - 3.0 * u_dir)) * 0.0663;
  c += (fetch(v_uv + 4.0 * u_dir) + fetch(v_uv - 4.0 * u_dir)) * 0.0276;
  fragColor = c;
}`;

const MAIN_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_src;
uniform sampler2D u_map;
uniform sampler2D u_blurred;
uniform vec2 u_res;
uniform vec2 u_texSize;
uniform vec2 u_coverA;
uniform vec2 u_coverB;
uniform vec2 u_center;
uniform vec2 u_half;
uniform float u_radius;
uniform float u_strength;
uniform float u_chroma;
uniform float u_hasBlur;
uniform float u_spec;
uniform float u_vibrancy;
uniform float u_specLo;
uniform float u_specHi;

vec2 toUV(vec2 px){ return ((px + u_coverB) / u_coverA) / u_texSize; }

// Aave premultiplies u_blurred; unpremultiply back to straight alpha.
vec4 sampleBlur(vec2 uv){
  vec4 b = texture(u_blurred, uv);
  b.rgb = b.a > 1e-4 ? b.rgb / b.a : b.rgb;
  return b;
}

void main(){
  vec2 px = v_uv * u_res;
  vec3 straight = texture(u_src, toUV(px)).rgb;

  // analytical rounded-rect SDF mask (AA via fwidth)
  vec2 p = px - u_center;
  vec2 q = abs(p) - u_half + vec2(u_radius);
  float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - u_radius;
  float aa = max(fwidth(dist), 1e-4);
  float mask = 1.0 - smoothstep(-aa, aa, dist);
  if (mask < 0.001){ fragColor = vec4(straight, 1.0); return; }

  // displacement from the baked map (RG = dome-warped disp, B = specular)
  vec2 lensUV = (px - (u_center - u_half)) / (2.0 * u_half);
  vec4 d = texture(u_map, lensUV);
  vec2 off = (d.rg - 0.5) * u_strength;

  // chroma-split sample, frosted toward the blurred copy inside the lens
  float blurMix = u_hasBlur * mask;
  vec2 uvR = toUV(px + off * (1.0 + u_chroma * 0.2));
  vec2 uvG = toUV(px + off * (1.0 + u_chroma * 0.1));
  vec2 uvB = toUV(px + off);
  vec3 col;
  col.r = mix(texture(u_src, uvR).r, sampleBlur(uvR).r, blurMix);
  col.g = mix(texture(u_src, uvG).g, sampleBlur(uvG).g, blurMix);
  col.b = mix(texture(u_src, uvB).b, sampleBlur(uvB).b, blurMix);

  // adaptive specular: add light on dark backdrops, darken on bright ones
  float spec = d.b - 0.502;
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  float darkBlend = smoothstep(min(u_specLo, u_specHi), max(u_specLo, u_specHi), luma);
  vec3 specAdd = col + spec * u_spec;
  vec3 specMul = col * (1.0 - spec * u_spec);
  col = max(mix(specAdd, specMul, darkBlend), 0.0);

  // adaptive brightness / vibrancy: pull toward mid-gray inside the lens
  col += (0.5 - luma) * u_vibrancy * mask;

  fragColor = vec4(mix(straight, col, mask), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('[GlassGL] shader compile failed:\n' + log);
  }
  return sh;
}

function program(gl: WebGL2RenderingContext, frag: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('[GlassGL] link failed:\n' + gl.getProgramInfoLog(p));
  }
  return p;
}

function makeTex(gl: WebGL2RenderingContext): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return t;
}

export class GlassGL {
  private gl: WebGL2RenderingContext;
  private mainProg: WebGLProgram;
  private blurProg: WebGLProgram;
  private srcTex: WebGLTexture;
  private mapTex: WebGLTexture;
  private fboTex: [WebGLTexture, WebGLTexture];
  private fbo: [WebGLFramebuffer, WebGLFramebuffer];
  private texSize: [number, number] = [1, 1];
  private cssW = 0;
  private cssH = 0;
  private blurDirty = true;
  center: [number, number] = [200, 200];
  half: [number, number] = [180, 120];
  // where the backdrop is displayed, in this canvas's px (null = cover-fit the canvas)
  view: { x: number; y: number; w: number; h: number } | null = null;
  cfg: GlassGLConfig;

  constructor(private canvas: HTMLCanvasElement, cfg: GlassGLConfig) {
    this.cfg = cfg;
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, antialias: false });
    if (!gl) throw new Error('[GlassGL] WebGL2 unavailable');
    this.gl = gl;
    this.mainProg = program(gl, MAIN_FRAG);
    this.blurProg = program(gl, BLUR_FRAG);

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    for (const prog of [this.mainProg, this.blurProg]) {
      const loc = gl.getAttribLocation(prog, 'a_pos');
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }

    this.srcTex = makeTex(gl);
    this.mapTex = makeTex(gl);
    this.fboTex = [makeTex(gl), makeTex(gl)];
    this.fbo = [gl.createFramebuffer()!, gl.createFramebuffer()!];
  }

  setBackdrop(src: TexImageSource, w: number, h: number) {
    const gl = this.gl;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    this.texSize = [w, h];
    // (re)allocate the blur ping-pong targets at source resolution
    for (let i = 0; i < 2; i++) {
      gl.bindTexture(gl.TEXTURE_2D, this.fboTex[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fboTex[i], 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.blurDirty = true;
  }

  // Bake the displacement map (RG dome-warped disp + B specular) for the lens.
  bakeMap() {
    const gl = this.gl;
    const w = Math.max(2, Math.round(this.half[0] * 2));
    const h = Math.max(2, Math.round(this.half[1] * 2));
    const cv = renderDisplacementMap({
      width: w,
      height: h,
      radius: this.cfg.radius,
      depth: this.cfg.depth,
      dome: this.cfg.dome,
      edge: 1.0,
      glow: 0.35,
      margin: 0,
    });
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.bindTexture(gl.TEXTURE_2D, this.mapTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
  }

  // Re-upload an animated source (canvas/video) without reallocating FBOs.
  updateSource(src: TexImageSource) {
    const gl = this.gl;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    this.blurDirty = true;
  }

  markBlurDirty() { this.blurDirty = true; }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssW = this.canvas.clientWidth;
    this.cssH = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.cssW * dpr);
    this.canvas.height = Math.round(this.cssH * dpr);
  }

  private runBlur() {
    const gl = this.gl;
    const [w, h] = this.texSize;
    const spread = this.cfg.frost;
    gl.useProgram(this.blurProg);
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(gl.getUniformLocation(this.blurProg, 'u_source'), 0);
    const premul = gl.getUniformLocation(this.blurProg, 'u_premul');
    // horizontal: src → fbo0 (premultiply once)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[0]);
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.uniform1f(premul, 1);
    gl.uniform2f(gl.getUniformLocation(this.blurProg, 'u_dir'), spread / w, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // vertical: fbo0 → fbo1 (= u_blurred, already premultiplied)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[1]);
    gl.bindTexture(gl.TEXTURE_2D, this.fboTex[0]);
    gl.uniform1f(premul, 0);
    gl.uniform2f(gl.getUniformLocation(this.blurProg, 'u_dir'), 0, spread / h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.blurDirty = false;
  }

  render() {
    const gl = this.gl;
    if (this.blurDirty) this.runBlur();

    const { cssW: W, cssH: H } = this;
    const [tw, th] = this.texSize;
    // backdrop display rect in canvas px; default = cover-fit to the canvas
    let vx: number, vy: number, vw: number, vh: number;
    if (this.view) {
      ({ x: vx, y: vy, w: vw, h: vh } = this.view);
    } else {
      const s = Math.max(W / tw, H / th);
      vw = tw * s; vh = th * s; vx = (W - vw) / 2; vy = (H - vh) / 2;
    }
    const m = this.mainProg;
    gl.useProgram(m);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.uniform1i(gl.getUniformLocation(m, 'u_src'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.mapTex);
    gl.uniform1i(gl.getUniformLocation(m, 'u_map'), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.fboTex[1]);
    gl.uniform1i(gl.getUniformLocation(m, 'u_blurred'), 2);

    const u = (n: string) => gl.getUniformLocation(m, n);
    gl.uniform2f(u('u_res'), W, H);
    gl.uniform2f(u('u_texSize'), tw, th);
    gl.uniform2f(u('u_coverA'), vw / tw, vh / th);
    gl.uniform2f(u('u_coverB'), -vx, -vy);
    gl.uniform2f(u('u_center'), this.center[0], this.center[1]);
    gl.uniform2f(u('u_half'), this.half[0], this.half[1]);
    gl.uniform1f(u('u_radius'), this.cfg.radius);
    gl.uniform1f(u('u_strength'), this.cfg.strength);
    gl.uniform1f(u('u_chroma'), this.cfg.chroma);
    gl.uniform1f(u('u_hasBlur'), this.cfg.frost > 0 ? 1 : 0);
    gl.uniform1f(u('u_spec'), this.cfg.spec);
    gl.uniform1f(u('u_vibrancy'), this.cfg.vibrancy);
    gl.uniform1f(u('u_specLo'), this.cfg.specLo);
    gl.uniform1f(u('u_specHi'), this.cfg.specHi);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
