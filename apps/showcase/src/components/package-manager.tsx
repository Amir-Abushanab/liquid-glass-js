import * as React from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun'
export const PACKAGE_MANAGERS: PackageManager[] = ['pnpm', 'npm', 'yarn', 'bun']

const STORAGE_KEY = 'preferred-pm'

function readStoredPm(): PackageManager {
  if (typeof window === 'undefined') return 'pnpm'
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v && (PACKAGE_MANAGERS as string[]).includes(v)) return v as PackageManager
  } catch {
    /* ignore */
  }
  return 'pnpm'
}

/**
 * The chosen package manager, persisted to localStorage and kept in sync across
 * every command block on the page (like the shadcn docs). Defaults to pnpm; SSR
 * renders pnpm and the stored choice is applied after mount.
 */
export function usePackageManager(): [PackageManager, (pm: PackageManager) => void] {
  const [pm, setPm] = React.useState<PackageManager>('pnpm')
  React.useEffect(() => {
    setPm(readStoredPm())
    const sync = () => setPm(readStoredPm())
    window.addEventListener('pm-change', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('pm-change', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  const update = React.useCallback((next: PackageManager) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event('pm-change'))
  }, [])
  return [pm, update]
}

/** `npx shadcn@latest add <url>`, mapped to each manager's package runner. */
export function shadcnAddCommand(url: string, pm: PackageManager): string {
  switch (pm) {
    case 'pnpm':
      return `pnpm dlx shadcn@latest add ${url}`
    case 'yarn':
      return `yarn dlx shadcn@latest add ${url}`
    case 'bun':
      return `bunx shadcn@latest add ${url}`
    default:
      return `npx shadcn@latest add ${url}`
  }
}

/** `npm install <pkg>`, mapped to each manager's add command. */
export function installCommand(pkg: string, pm: PackageManager): string {
  switch (pm) {
    case 'pnpm':
      return `pnpm add ${pkg}`
    case 'yarn':
      return `yarn add ${pkg}`
    case 'bun':
      return `bun add ${pkg}`
    default:
      return `npm install ${pkg}`
  }
}

function CommandCopyButton({ value }: { value: string }) {
  const [done, setDone] = React.useState(false)
  return (
    <button
      type="button"
      aria-label="Copy command"
      onClick={() => {
        void navigator.clipboard?.writeText(value)
        setDone(true)
        setTimeout(() => setDone(false), 1500)
      }}
      className="absolute top-2 right-2.5 grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  )
}

/**
 * A shadcn-docs-style command block with a package-manager tab strip. `command`
 * builds the shown command for whichever manager is active.
 */
export function CommandBlock({ command }: { command: (pm: PackageManager) => string }) {
  const [pm, setPm] = usePackageManager()
  const cmd = command(pm)
  return (
    <div className="overflow-hidden rounded-lg border bg-muted/40">
      <div className="flex items-center gap-1 border-b bg-muted/50 px-2">
        {PACKAGE_MANAGERS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setPm(m)}
            className={cn(
              'relative px-2.5 py-2 font-mono text-xs transition-colors',
              pm === m ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m}
            {pm === m && (
              <span className="absolute inset-x-2.5 -bottom-px h-0.5 rounded-full bg-foreground" />
            )}
          </button>
        ))}
      </div>
      <div className="relative">
        <div className="overflow-x-auto py-3 pr-12 pl-4 font-mono text-sm">
          <span className="text-muted-foreground select-none">$ </span>
          <span className="whitespace-nowrap" suppressHydrationWarning>
            {cmd}
          </span>
        </div>
        <CommandCopyButton value={cmd} />
      </div>
    </div>
  )
}
