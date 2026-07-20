"use client";

import * as React from "react";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { mountGlassLens } from "@liquidglassjs/core";
import { cn } from "@/lib/utils";
import "@liquidglassjs/core/css";

const TRACK_W = 48;
const TRACK_H = 28;
const THUMB = 22;
const PAD = 3;
// The thumb slides TRACK_W - THUMB - 2*PAD = 20px on check. Keep the literal
// `[translate:20px]` class below in sync with this geometry (Tailwind only scans
// literal class strings, so it can't be interpolated).
const LENS = TRACK_H; // lens fills the track height

/**
 * Liquid-glass Switch — Base UI's Switch (a11y, keyboard) with a real glass thumb.
 * At rest the thumb is a solid bead; while pressed it turns to glass and the track
 * refracts *through* it — a live SVG feDisplacementMap lens over the track (works in
 * every browser, not just a Chromium backdrop-filter). Glass by @liquidglassjs/core,
 * behavior by Base UI. You own this file: restyle the track/thumb, or tune the lens.
 */
function GlassSwitch({
  className,
  strength = 14,
  chroma = 0.4,
  dome = 8,
  depth = 5,
  edge = 0.9,
  glow = 0.32,
  ...props
}: React.ComponentProps<typeof BaseSwitch.Root> & {
  strength?: number;
  chroma?: number;
  dome?: number;
  depth?: number;
  edge?: number;
  glow?: number;
}) {
  const rootRef = React.useRef<HTMLButtonElement>(null);
  const railRef = React.useRef<HTMLSpanElement>(null);
  const thumbRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const root = rootRef.current;
    const rail = railRef.current;
    const thumb = thumbRef.current;
    if (!root || !rail || !thumb) return;

    const lens = mountGlassLens({
      target: rail,
      host: root,
      lensW: LENS,
      lensH: LENS,
      radius: LENS / 2,
      strength,
      chroma,
      dome,
      depth,
      edge,
      glow,
      blur: 0,
      active: false, // solid until pressed
    });

    const place = () => {
      const rr = rail.getBoundingClientRect();
      const th = thumb.getBoundingClientRect();
      const cx = th.left - rr.left + th.width / 2;
      const cy = th.top - rr.top + th.height / 2;
      lens.setPos(cx - LENS / 2, cy - LENS / 2);
    };
    place();

    // Light the glass up for the duration of the press (Base UI toggles on release).
    const down = () => {
      place();
      lens.setActive(true);
    };
    const up = () => lens.setActive(false);
    root.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    root.addEventListener("pointercancel", up);
    const ro = new ResizeObserver(place);
    ro.observe(root);

    return () => {
      root.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      root.removeEventListener("pointercancel", up);
      ro.disconnect();
      lens.dispose();
    };
    // re-mount the lens when the glass params change (so the Tuner is live)
  }, [strength, chroma, dome, depth, edge, glow]);

  return (
    <BaseSwitch.Root
      ref={rootRef}
      style={{ width: TRACK_W, height: TRACK_H, padding: PAD }}
      className={cn(
        "group relative isolate inline-flex shrink-0 cursor-pointer items-center rounded-full outline-none ring-1 ring-white/15",
        "focus-visible:ring-2 focus-visible:ring-white/50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      {/* the track — the glass lens's refraction target, behind the thumb */}
      <span
        ref={railRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-full"
        style={{ background: "rgb(255 255 255 / 12%)" }}
      >
        <span
          className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-data-[checked]:opacity-100"
          style={{ background: "linear-gradient(90deg, #12d3ff, #8b6bff 52%, #ff5db1)" }}
        />
      </span>
      <BaseSwitch.Thumb
        ref={thumbRef}
        style={{ width: THUMB, height: THUMB }}
        className={cn(
          "relative z-10 rounded-full bg-white",
          "shadow-[inset_0_1px_1px_rgb(255_255_255/70%),inset_0_0_0_1px_rgb(255_255_255/25%),inset_0_-2px_4px_rgb(0_0_0/22%),0_2px_6px_-1px_rgb(0_0_0/40%)]",
          "transition-[transform,translate,background-color] duration-300 ease-[cubic-bezier(0.34,1.4,0.5,1)]",
          // slide on check (20px — see the geometry note above)
          "data-[checked]:[translate:20px]",
          // press → pop (springy) + go clear so the refracting track shows through the glass
          "group-active:[transform:scale(1.12)] group-active:[background-color:transparent]",
        )}
      />
    </BaseSwitch.Root>
  );
}

export { GlassSwitch };
