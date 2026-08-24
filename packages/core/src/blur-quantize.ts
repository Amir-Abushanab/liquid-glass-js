// Making `feGaussianBlur` render the same in all three engines.
//
// THE MEASUREMENT
//
// A hard white/black edge blurred by a true Gaussian of sigma has a 10%->90% rise of
// 2.563 * sigma, so the sigma an engine ACTUALLY applies can be read straight off the
// rendered pixels. Sampled at deviceScaleFactor 1, every 0.1 from 0 to 4, with the
// unblurred edge's own rise removed in quadrature:
//
//   stdDeviation   chromium   webkit   firefox        stdDeviation   chromium   webkit   firefox
//     0.0             0          0        0             2.0            2.196     2.507    2.196
//     0.1-0.7         0        1.474    0 -> 0.763      2.1-2.3        2.196     2.507    2.196
//     0.8             1.071    1.474    0.853           2.4-2.9        2.507     2.507    2.507   <- agree
//     0.9-1.3         1.071    1.474    0.921 -> 1.279  3.0-3.4        3.210     3.533    3.210
//     1.4             1.474    1.474    1.422   <- agree 3.5-3.9       3.533     3.533    3.533   <- agree
//     1.5             1.474    1.474    1.515   <- agree 4.0           4.257     4.600    4.257
//     1.6-1.8         1.474    1.474    1.611 -> 1.785
//     1.9             2.196    2.507    1.862
//
// Nobody is applying a Gaussian. The SVG spec says to approximate one with three box
// blurs of size `d = floor(s * 3 * sqrt(2*PI) / 4 + 0.5)`, and that quantisation is
// exactly what the plateaus are — every transition above lands on an integer step of
// `d`. Three boxes of odd width `d` have variance 3*(d^2-1)/12, so the sigma an engine
// can actually deliver is sqrt(d^2-1)/2 and nothing in between.
//
// The same story shows up as COLOUR, which is how it was first found. WebKit
// desaturates a partially transparent source the moment the blur is non-zero — mean
// saturation of a translucent canvas of colour emoji:
//
//   stdDeviation   0     0.2    0.35   0.5    0.75   1      1.5    2      3
//     webkit     124.1   95.9   95.9   95.9   95.9   95.9   95.9   82.3   73.9
//     firefox    123.6  123.6  122.7  117.4  109.6  104.2   95.3   85.9   76.2
//     chromium   123.8  123.8  123.8  123.8  123.8  102.7   95.7   86.0   76.1
//
// Same plateaus, same edges — it is not a separate bug, it is the same box widths
// seen through a premultiply round-trip. A 0.4px blur nobody asked to see cost the
// emoji orb a quarter of its colour.
//
// The three differ in WHICH d they will produce:
//
//   chromium   every d. d <= 1 renders as no blur at all.
//   webkit     ODD d only, and never below 3 — which is why every stdDeviation from
//              0.1 to 1.8 gives the identical sigma 1.47 there. Safari cannot blur by
//              less than ~1.4px. That is the whole "0.4 looks like a real blur in
//              Safari and like nothing in Chrome" bug.
//   firefox    a real Gaussian below d=4 (its sigma tracks stdDeviation almost
//              exactly from 0.3 to 1.9), box-quantised like chromium above it.
//
// THE FIX
//
// The set of sigmas all three can produce is WebKit's: 0, and sqrt(d^2-1)/2 for odd
// d >= 3 — so 0, 1.414, 2.449, 3.464, 4.472, ... Snap the requested blur to the
// nearest of those rungs and emit a stdDeviation that lands every engine on it, and
// the three render the same picture.
//
// Which stdDeviation lands on rung d: anything in [(d-0.5)/K, (d+0.5)/K) with
// K = 3*sqrt(2*PI)/4. For d >= 5 all three are box-quantised, so the band centre d/K
// serves. d=3 is the one band where Gecko is still a true Gaussian, so it needs the
// single point where its curve crosses the box value — sigma itself, sqrt(2).
//
// The cost is honest and unavoidable: the rungs are ~1px apart, so `blur: 1` renders
// as 1.41 everywhere rather than as 1.07 / 1.47 / 0.99. There is no stdDeviation that
// makes Safari blur by 1.0, so matching the engines means moving to a value it can
// reach. Below sqrt(2)/2 the nearest rung is 0 — which is what a sub-pixel blur was
// already being rounded to, now falling out of the same rule instead of a threshold.

// d = floor(s * K + 0.5), from the SVG filter spec's box-blur approximation.
const K = (3 * Math.sqrt(2 * Math.PI)) / 4; // 1.87997...

/** The sigma three box blurs of odd width `d` actually deliver. */
const rungSigma = (d: number): number => Math.sqrt(d * d - 1) / 2;

/** A stdDeviation that lands every engine on rung `d`. */
const rungStd = (d: number): number => (d === 3 ? Math.SQRT2 : d / K);

// Halfway to the first rung: under this, "no blur" is the closer answer.
const FIRST_RUNG = rungSigma(3); // sqrt(2)
const ZERO_CUTOFF = FIRST_RUNG / 2; // 0.7071

/**
 * The `stdDeviation` to put on a pre-blur so that Chromium, WebKit and Gecko all
 * render the same amount of blur. EVERY chain in this library goes through it.
 *
 * Returns 0 for anything below ~0.71 (no engine can blur less than ~1.4px and still
 * agree), otherwise the value for the nearest rung the three share. See the top of
 * this file for the measurements and why the rungs are where they are.
 *
 * It returns 0 rather than asking callers to drop the primitive, because
 * `stdDeviation="0"` is a true pass-through: measured through a real chain on a
 * translucent colour-emoji source, "no feGaussianBlur at all" and "feGaussianBlur
 * stdDeviation=0" are identical in every engine (saturation 50.8/50.7/50.7, edge ramp
 * 0 across the board). Keeping the primitive gives the chain one shape, so a renderer
 * that updates blur live still does it with a single setAttribute.
 */
export function preBlurStd(blur: number): number {
  if (!(blur >= ZERO_CUTOFF)) return 0;
  // the box width that would deliver exactly `blur`, snapped to the nearest odd one
  const ideal = Math.sqrt(4 * blur * blur + 1);
  const d = Math.max(3, Math.round((ideal - 1) / 2) * 2 + 1);
  return rungStd(d);
}
