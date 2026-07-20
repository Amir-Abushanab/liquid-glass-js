import * as React from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Prefix a route with the deploy base (`/` in dev, `/liquid-glass` on Pages). */
export const withBase = (path: string) => import.meta.env.BASE_URL.replace(/\/$/, '') + path
import {
  registry,
  categories,
  REGISTRY_URL,
  tuneDefaults,
  type RegistryItem,
  type TuneConfig,
} from '@/lib/registry'
import { CommandBlock, installCommand, shadcnAddCommand } from './package-manager'
import { Tuner } from './tuner'

/** The busy backdrop each preview sits on, so the glass has something to refract. */
export const SCENE =
  'repeating-linear-gradient(0deg, rgb(255 255 255 / 12%) 0 1px, transparent 1px 26px),' +
  'repeating-linear-gradient(90deg, rgb(255 255 255 / 12%) 0 1px, transparent 1px 26px),' +
  'radial-gradient(60% 80% at 15% 20%, #ff4f9d, transparent 60%),' +
  'radial-gradient(70% 80% at 85% 25%, #12d3ff, transparent 60%),' +
  'radial-gradient(70% 80% at 60% 100%, #ffc93f, transparent 60%),' +
  'linear-gradient(135deg, #7b3cff, #1f9dff 50%, #22e39b)'

function CopyIcon({ done }: { done: boolean }) {
  return done ? (
    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ) : (
    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [done, setDone] = React.useState(false)
  return (
    <button
      type="button"
      aria-label="Copy"
      onClick={() => {
        void navigator.clipboard?.writeText(value)
        setDone(true)
        setTimeout(() => setDone(false), 1500)
      }}
      className={cn(
        'absolute right-3 top-3 rounded-md border border-white/10 bg-white/10 p-1.5 text-white/70 transition hover:bg-white/20 hover:text-white',
        className,
      )}
    >
      <CopyIcon done={done} />
    </button>
  )
}

/**
 * Code with Shiki syntax highlighting, highlighted lazily on the client: Shiki
 * (and only the tsx grammar + the two themes it needs) is dynamically imported
 * the first time a Code panel mounts. Navigation never blocks on it and the
 * highlighter stays out of the main bundle. Renders plain instantly, then swaps
 * to highlighted markup when ready. Dual light/dark output — app.css activates
 * the dark palette under `.dark`.
 */
export function CodeBlock({ code, className }: { code: string; className?: string }) {
  const [html, setHtml] = React.useState<string | null>(null)
  React.useEffect(() => {
    let alive = true
    void import('shiki')
      .then(({ codeToHtml }) =>
        codeToHtml(code, {
          lang: 'tsx',
          themes: { light: 'github-light', dark: 'github-dark' },
        }),
      )
      .then((out) => {
        if (alive) setHtml(out)
      })
      .catch(() => {
        /* leave the plain fallback in place */
      })
    return () => {
      alive = false
    }
  }, [code])
  return (
    <div
      className={cn(
        'relative text-[13px] [&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:font-mono [&_pre]:leading-relaxed',
        className,
      )}
    >
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="bg-zinc-950 text-zinc-100">
          <code>{code}</code>
        </pre>
      )}
      <CopyButton value={code} />
    </div>
  )
}

export function InstallCommand({ item }: { item: RegistryItem }) {
  return (
    <CommandBlock
      command={(pm) =>
        item.npm
          ? installCommand(item.npm, pm)
          : shadcnAddCommand(`${REGISTRY_URL}/r/${item.slug}.json`, pm)
      }
    />
  )
}

export function PreviewBackdrop({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('grid min-h-[360px] place-items-center overflow-hidden p-10', className)}
      style={{ background: SCENE }}
    >
      {children}
    </div>
  )
}

/** Read tuned values from the URL hash (client-only), falling back to defaults. */
function readTuneValues(tune: TuneConfig): Record<string, number> {
  const out = tuneDefaults(tune)
  if (typeof window === 'undefined') return out
  const q = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  for (const p of tune.params) {
    const raw = q.get(p.key)
    if (raw != null && raw !== '' && !Number.isNaN(Number(raw))) out[p.key] = Number(raw)
  }
  return out
}

export function ComponentPreview({ item }: { item: RegistryItem }) {
  const [tab, setTab] = React.useState<'preview' | 'code'>('preview')
  const tune = item.tune
  const [values, setValues] = React.useState<Record<string, number>>(() =>
    tune ? tuneDefaults(tune) : {},
  )
  const [shared, setShared] = React.useState(false)
  // useDeferredValue keeps the sliders + code responsive while the (re-mounting) glass demo catches up.
  const demoValues = React.useDeferredValue(values)
  const Demo = item.Demo

  const dirty = !!tune && tune.params.some((p) => values[p.key] !== p.default)

  // Client-only: hydrate from the URL hash (a shared tuned link), matching SSR's defaults first.
  React.useEffect(() => {
    if (tune) setValues(readTuneValues(tune))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [])
  // Mirror the tuned state back into the URL hash so it's shareable (only while dirty).
  React.useEffect(() => {
    if (!tune || !dirty) return
    const q = new URLSearchParams()
    for (const p of tune.params) if (values[p.key] !== p.default) q.set(p.key, String(values[p.key]))
    window.history.replaceState(null, '', `#${q.toString()}`)
  }, [tune, values, dirty])

  const clearHash = () =>
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  const code = tune ? tune.code(values) : item.code

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="flex items-center gap-1 border-b bg-muted/30 px-2">
        {(['preview', 'code'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'relative px-3 py-2 text-sm font-medium capitalize transition-colors',
              tab === t ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
            {tab === t && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-foreground" />}
          </button>
        ))}
      </div>
      {tab === 'preview' ? (
        <>
          <PreviewBackdrop>
            <Demo values={demoValues} />
          </PreviewBackdrop>
          {tune && (
            <Tuner
              params={tune.params}
              values={values}
              onChange={setValues}
              onReset={() => {
                setValues(tuneDefaults(tune))
                clearHash()
              }}
              onShare={() => {
                void navigator.clipboard?.writeText(window.location.href)
                setShared(true)
                setTimeout(() => setShared(false), 1500)
              }}
              shared={shared}
              dirty={dirty}
            />
          )}
        </>
      ) : (
        <CodeBlock code={code} className="[&_pre]:rounded-none" />
      )}
    </div>
  )
}

export function Sidebar({ currentSlug }: { currentSlug?: string }) {
  const [query, setQuery] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const q = query.trim().toLowerCase()
  const matches = (i: RegistryItem) =>
    !q || i.title.toLowerCase().includes(q) || i.slug.includes(q)

  // "/" focuses the search from anywhere (unless you're already typing).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const groups = categories
    .map((cat) => ({ cat, items: registry.filter((i) => i.category === cat && matches(i)) }))
    .filter((g) => g.items.length > 0)

  return (
    <nav className="flex flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('')
          }}
          placeholder="Search components…"
          aria-label="Search components"
          className="w-full rounded-md border bg-muted/40 py-1.5 pr-3 pl-8 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:appearance-none"
        />
      </div>
      {groups.length === 0 ? (
        <p className="px-2 text-sm text-muted-foreground">No components match “{query.trim()}”.</p>
      ) : (
        groups.map(({ cat, items }) => (
          <div key={cat}>
            <h4 className="mb-2 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {cat}
            </h4>
            <ul className="space-y-0.5">
              {items.map((i) => {
                const Icon = i.icon
                const active = i.slug === currentSlug
                return (
                  <li key={i.slug}>
                    <a
                      href={withBase(`/components/${i.slug}`)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                        active
                          ? 'bg-muted font-medium text-foreground [&_svg]:opacity-100'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <Icon className="size-4 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
                      {i.title}
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        ))
      )}
    </nav>
  )
}
