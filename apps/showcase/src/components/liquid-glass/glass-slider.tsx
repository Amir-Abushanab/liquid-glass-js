'use client';

import * as React from 'react';
import { Slider as BaseSlider } from '@base-ui/react/slider';
import { mountGlassLens, type MapProfile } from '@liquidglassjs/core';
import { cn } from '@/lib/utils';
import '@liquidglassjs/core/css';

const RAIL = 28; // rail + lens height (px)
// The knob is a pill, not a bead: same height as the rail and the same corner radius
// as the rail's own end caps, so the two shapes agree instead of a circle sitting in a
// slot. RAIL / 2 is the radius the rail's `rounded-full` resolves to at this height.
const THUMB_W = 40;
const THUMB_H = RAIL;
const KNOB_R = RAIL / 2;

const firstNumber = (v: unknown): number | undefined =>
  Array.isArray(v) ? (v[0] as number) : (v as number | undefined);

/**
 * Liquid-glass Slider — Base UI's Slider (drag, keyboard, ARIA) with a real glass
 * thumb. At rest the thumb is a solid bead; while you drag, it turns to glass and
 * the rail refracts *through* it — a live SVG feDisplacementMap lens over the track
 * (the same engine as the showcase; works in every browser, not just a Chromium
 * backdrop-filter). Glass by @liquidglassjs/core, behavior by Base UI. You own this
 * file: restyle the rail/thumb, or tune the lens params in mountGlassLens below.
 */
function GlassSlider({
  className,
  strength = 11,
  chroma = 0.32,
  dome = 12,
  depth = 8,
  edge = 0.9,
  glow = 0.3,
  profile,
  ...props
}: React.ComponentProps<typeof BaseSlider.Root> & {
  strength?: number;
  chroma?: number;
  dome?: number;
  depth?: number;
  edge?: number;
  glow?: number;
  profile?: MapProfile;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const railRef = React.useRef<HTMLDivElement>(null);
  const fillRef = React.useRef<HTMLDivElement>(null);
  const thumbRef = React.useRef<HTMLDivElement>(null);

  const min = Number(props.min ?? 0);
  const max = Number(props.max ?? 100);
  const initial = firstNumber(props.value) ?? firstNumber(props.defaultValue) ?? min;
  const initialPct = max > min ? ((initial - min) / (max - min)) * 100 : 0;

  React.useEffect(() => {
    const host = hostRef.current;
    const rail = railRef.current;
    const fill = fillRef.current;
    const thumb = thumbRef.current;
    if (!host || !rail || !thumb) return;

    const lens = mountGlassLens({
      target: rail,
      host,
      lensW: THUMB_W,
      lensH: THUMB_H,
      radius: KNOB_R,
      strength,
      profile,
      chroma,
      dome,
      depth,
      edge,
      glow,
      blur: 0,
      active: false, // solid until pressed
    });

    // Keep the lens (and the fill) glued to the thumb; light up only while dragging.
    const place = () => {
      const rr = rail.getBoundingClientRect();
      const th = thumb.getBoundingClientRect();
      const cx = th.left - rr.left + th.width / 2;
      lens.setPos(cx - THUMB_W / 2, (rr.height - THUMB_H) / 2);
      if (fill) fill.style.width = `${Math.max(0, Math.min(100, (cx / rr.width) * 100))}%`;
    };
    const sync = () => {
      place();
      lens.setActive(thumb.hasAttribute('data-dragging'));
    };
    place();

    // Base UI rewrites the thumb's inline style on every move + toggles data-dragging.
    const mo = new MutationObserver(sync);
    mo.observe(thumb, { attributes: true, attributeFilter: ['data-dragging', 'style'] });
    const ro = new ResizeObserver(place);
    ro.observe(host);

    return () => {
      mo.disconnect();
      ro.disconnect();
      lens.dispose();
    };
    // re-mount the lens when the glass params change (so the Tuner is live)
  }, [strength, chroma, dome, depth, edge, glow, profile]);

  return (
    <BaseSlider.Root className={cn('w-full', className)} {...props}>
      <BaseSlider.Control
        ref={hostRef}
        className="relative isolate flex w-full touch-none items-center select-none"
        style={{ minHeight: RAIL }}
      >
        {/* the rail — the glass lens's refraction target, sitting behind the thumb */}
        <div
          ref={railRef}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-1/2 overflow-hidden rounded-full ring-1 ring-white/15"
          style={{ height: RAIL, background: 'rgb(255 255 255 / 10%)' }}
        >
          <div
            ref={fillRef}
            className="h-full rounded-full"
            style={{
              width: `${initialPct}%`,
              background: 'linear-gradient(90deg, #12d3ff, #8b6bff 52%, #ff5db1)',
            }}
          />
        </div>
        {/* Base UI's track carries the thumb; transparent so the rail shows through */}
        <BaseSlider.Track className="relative z-10 w-full" style={{ height: RAIL }}>
          <BaseSlider.Thumb
            ref={thumbRef}
            style={{ width: THUMB_W, height: THUMB_H, borderRadius: KNOB_R }}
            className={cn(
              'bg-white outline-none',
              'shadow-[inset_0_1px_1px_rgb(255_255_255/70%),inset_0_0_0_1px_rgb(255_255_255/25%),inset_0_-2px_5px_rgb(0_0_0/22%),0_4px_10px_-4px_rgb(0_0_0/45%)]',
              'transition-[box-shadow,background-color] duration-300 ease-[cubic-bezier(0.34,1.4,0.5,1)]',
              'focus-visible:ring-2 focus-visible:ring-white/60',
              // While dragging: go clear so the refracting rail shows through the glass. No
              // scale pop — the knob already fills the rail's height, so growing it would
              // spill over the track, and a size that changes every frame would rebuild the
              // lens map on every one of them.
              'data-[dragging]:[background-color:transparent]',
              'data-[dragging]:shadow-[inset_0_1px_1px_rgb(255_255_255/70%),inset_0_0_0_1px_rgb(255_255_255/35%),0_6px_14px_-4px_rgb(0_0_0/55%)]',
            )}
          />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}

export { GlassSlider };
