'use client'

import * as React from 'react'
import type { TuneParam } from '@/lib/registry'

/**
 * Live glass-parameter tuner shown under a component preview. Dragging a slider
 * updates the demo (the parent throttles it with useDeferredValue) and the Code
 * tab regenerates from the same values; "Copy link" shares the tuned state via the
 * URL hash.
 */
export function Tuner({
  params,
  values,
  onChange,
  onReset,
  onShare,
  shared,
  dirty,
}: {
  params: TuneParam[]
  values: Record<string, number>
  onChange: (v: Record<string, number>) => void
  onReset: () => void
  onShare: () => void
  shared: boolean
  dirty: boolean
}) {
  return (
    <div className="border-t bg-muted/20 px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Tune</span>
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
      <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
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
              className="h-5 w-full min-w-0 cursor-ew-resize accent-[#8a7bff]"
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
