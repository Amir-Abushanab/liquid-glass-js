// The centre mark that sits in the QR's reserved middle.
//
// Built with createElementNS rather than innerHTML so the default path survives
// a `require-trusted-types-for 'script'` CSP — an increasingly common policy in
// exactly the fintech/payments contexts this package gets used in.
//
// The gradient ids are per-instance: `url(#id)` resolves document-wide, so two
// Glass QRs on one page would otherwise share (and visually shadow) each other's
// <defs>.

/** Bumped per default-logo build to keep gradient ids unique document-wide. */
let logoSeq = 0;

const SVG_NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function gradient(id: string, coords: [string, string, string, string], stops: [string, string]) {
  const grad = el('linearGradient', {
    id,
    x1: coords[0],
    y1: coords[1],
    x2: coords[2],
    y2: coords[3],
    gradientUnits: 'userSpaceOnUse',
  });
  grad.append(
    el('stop', { 'stop-color': stops[0] }),
    el('stop', { offset: '1', 'stop-color': stops[1] }),
  );
  return grad;
}

/** The built-in mark, used when no `logo` option is supplied. */
export function defaultLogo(): SVGSVGElement {
  const uid = `psqr-${++logoSeq}`;
  const bgId = `${uid}-bg`;
  const markId = `${uid}-mark`;

  const svg = el('svg', {
    viewBox: '0 0 56 56',
    width: '100%',
    height: '100%',
    fill: 'none',
    'aria-hidden': 'true',
  });
  const defs = el('defs', {});
  defs.append(
    gradient(bgId, ['28', '0', '28', '56'], ['#2a2730', '#16151b']),
    gradient(markId, ['17', '17', '39', '39'], ['#8a7bff', '#ff5ca8']),
  );
  svg.append(
    el('rect', {
      x: '0.5',
      y: '0.5',
      width: '55',
      height: '55',
      rx: '13.5',
      fill: `url(#${bgId})`,
      stroke: 'white',
      'stroke-opacity': '0.14',
    }),
    el('rect', {
      x: '17',
      y: '17',
      width: '22',
      height: '22',
      rx: '7',
      fill: `url(#${markId})`,
    }),
    defs,
  );
  return svg;
}

/**
 * Resolve the `logo` option to a node to mount (or `null` for "no logo").
 *
 * A `string` is assigned via innerHTML — that is the caller's markup and their
 * CSP's problem; pass a `Node` instead under Trusted Types. A `Node` is adopted
 * as-is (not cloned), so don't hand the same one to two mounts.
 */
export function resolveLogo(logo: string | Node | false | undefined): Node | null {
  if (logo === false) return null;
  if (logo === undefined) return defaultLogo();
  if (typeof logo === 'string') {
    const wrap = document.createElement('span');
    wrap.style.display = 'block';
    wrap.style.width = '100%';
    wrap.style.height = '100%';
    wrap.innerHTML = logo;
    return wrap;
  }
  return logo;
}
