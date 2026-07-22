import { Info } from 'lucide-react'
import { GlassText } from '@liquidglassjs/react'
import { registry, registryBySlug } from '@/lib/registry'
import { ComponentPreview, InstallCommand, PreviewBackdrop, withBase } from '@/components/site'

/** The per-component docs page body (hydrated island). */
export function ComponentDoc({ slug }: { slug: string }) {
  const item = registryBySlug.get(slug)
  if (!item) {
    return (
      <div className="mx-auto max-w-3xl text-muted-foreground">
        No component named <code className="rounded bg-muted px-1.5 py-0.5 text-sm">{slug}</code>.
      </div>
    )
  }
  const Icon = item.icon
  return (
    <article className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg border bg-muted/40">
          <Icon className="size-5 text-foreground" />
        </span>
        <div>
          <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {item.category}
          </span>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{item.title}</h1>
        </div>
      </div>
      <p className="mt-3 text-lg text-muted-foreground">{item.description}</p>

      <div className="mt-8">
        <ComponentPreview item={item} />
      </div>

      <h2 className="mt-12 mb-3 text-lg font-semibold">Installation</h2>
      <InstallCommand item={item} />
      {!item.npm && (
        <p className="mt-3 text-sm text-muted-foreground">
          Copies the source into{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">components/liquid-glass/</code> and installs
          its dependencies. Requires a shadcn-initialized project.
        </p>
      )}

      <div className="mt-4 flex gap-3 rounded-lg border border-primary/25 bg-primary/[0.04] p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Remember to load the glass chrome CSS once</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.npm
              ? 'Import the component where you use it, then load the shared stylesheet a single time'
              : 'Load the shared stylesheet a single time'}{' '}
            (e.g. in your root layout or app entry):
          </p>
          <code className="mt-2.5 block w-fit rounded-md border bg-background px-3 py-1.5 font-mono text-sm">
            import "@liquidglassjs/core/css"
          </code>
        </div>
      </div>
    </article>
  )
}

/** The registry landing body: a glass hero + the component card grid. */
export function DocsLanding() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-10 overflow-hidden rounded-2xl border">
        <PreviewBackdrop className="min-h-[220px]">
          <GlassText className="text-center text-5xl font-black tracking-tight text-white sm:text-7xl">
            LIQUID GLASS
          </GlassText>
        </PreviewBackdrop>
      </div>

      <section className="mb-10">
        <p className="mb-2 text-sm font-medium text-muted-foreground">shadcn-compatible registry</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Components</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          React components in liquid glass, with real SVG refraction rather than a flat blur. Base UI
          provides the behavior; the glass is the skin. Install any of them with the shadcn CLI.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {registry.map((item) => {
          const Icon = item.icon
          return (
            <a
              key={item.slug}
              href={withBase(`/components/${item.slug}`)}
              className="group flex flex-col rounded-xl border p-5 transition-colors hover:border-foreground/25 hover:bg-muted/40"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg border bg-muted/40 transition-colors group-hover:bg-muted">
                  <Icon className="size-5 text-foreground" />
                </span>
                <span className="w-fit rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {item.category}
                </span>
              </div>
              <h3 className="font-medium">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              <span className="mt-4 text-sm font-medium text-foreground/60 transition-colors group-hover:text-foreground">
                View component →
              </span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
