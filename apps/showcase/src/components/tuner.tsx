'use client'

import * as React from 'react'
import { Tooltip } from '@base-ui/react/tooltip'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RenderPath, TuneParam } from '@/lib/registry'

/**
 * Render-path chip — the showcase's SVG/WebGL/Frost taxonomy (same colors as
 * its rp-chips), anchored in the Tuner header instead of overlaid on the glass
 * so it never blocks the preview.
 */
const RENDER_CHIP: Record<RenderPath, { label: string; className: string; title: string }> = {
  svg: {
    label: 'SVG',
    className: 'bg-[#e0922f]',
    title: 'SVG feDisplacementMap on live DOM — works in every browser',
  },
  webgl: {
    label: 'WebGL',
    className: 'bg-[#22a06b]',
    title: 'WebGL2 shader — for content an SVG filter can’t reach',
  },
  frost: {
    label: 'Frost',
    className: 'bg-[#6b7280]',
    title: 'backdrop-filter frost — refracts the page on Chromium, plain blur elsewhere',
  },
}

/**
 * Live glass-parameter tuner shown under a component preview. Dragging a slider
 * updates the demo (the parent throttles it with useDeferredValue) and the Code
 * tab regenerates from the same values; "Copy link" shares the tuned state via the
 * URL hash.
 *
 * `dead` marks params the current browser cannot preview (a frost shell without
 * backdrop-filter: url(), the QR without WebGL2 — see `TuneConfig.needs`): the
 * sliders gray out and disable instead of silently doing nothing, and `deadNote`
 * says why. Same convention as the showcase Tuner's dimmed rows.
 */
export function Tuner({
  params,
  values,
  onChange,
  onReset,
  onShare,
  shared,
  dirty,
  dead = false,
  deadNote,
  render,
}: {
  params: TuneParam[]
  values: Record<string, number>
  onChange: (v: Record<string, number>) => void
  onReset: () => void
  onShare: () => void
  shared: boolean
  dirty: boolean
  dead?: boolean
  deadNote?: string
  render?: RenderPath
}) {
  return (
    <div className="border-t bg-muted/20 px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Tune</span>
          {render && (
            <Tooltip.Root delay={200}>
              {/* real tooltip, not a title attr: no hover delay, styled, keyboard-focusable */}
              <Tooltip.Trigger
                className={cn(
                  'cursor-help rounded-md px-1.5 py-1 font-mono text-[0.62rem]/none font-semibold tracking-wider text-white uppercase',
                  RENDER_CHIP[render].className,
                )}
              >
                {RENDER_CHIP[render].label}
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={6} className="z-50">
                  <Tooltip.Popup
                    className={cn(
                      'max-w-64 origin-[var(--transform-origin)] rounded-md border bg-popover px-2.5 py-1.5 text-xs leading-relaxed text-popover-foreground shadow-md',
                      'transition-[transform,opacity] duration-150 ease-out',
                      'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
                      'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
                    )}
                  >
                    {RENDER_CHIP[render].title}
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onReset}
            disabled={!dirty}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onShare}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {shared ? 'Link copied' : 'Copy link'}
          </button>
        </div>
      </div>
      {dead && deadNote && (
        <p className="mb-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{deadNote}</span>
        </p>
      )}
      <div className={cn('grid gap-x-6 gap-y-2.5 sm:grid-cols-2', dead && 'opacity-40')}>
        {params.map((p) => (
          <label key={p.key} className="grid grid-cols-[4.5rem_1fr_2.75rem] items-center gap-2 text-xs">
            <span className="truncate text-muted-foreground">{p.label ?? p.key}</span>
            <input
              type="range"
              min={p.min}
              max={p.max}
              step={p.step}
              value={values[p.key] ?? p.default}
              onChange={(e) => onChange({ ...values, [p.key]: +e.target.value })}
              disabled={dead}
              className="h-5 w-full min-w-0 cursor-ew-resize accent-[#8a7bff] disabled:cursor-default"
              aria-label={p.label ?? p.key}
            />
            <span className="text-right font-mono tabular-nums text-muted-foreground">
              {values[p.key] ?? p.default}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
