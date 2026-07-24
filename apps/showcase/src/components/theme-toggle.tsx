import * as React from 'react';
import { flushSync } from 'react-dom';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> };
};

/**
 * MagicUI-style animated theme toggle: a circular View-Transitions reveal wipes
 * the new theme in from the button's center. The theme defaults to the system
 * preference — the no-flash script in the document head applies it before
 * hydration and no explicit choice is stored until you toggle. Falls back to an
 * instant swap where View Transitions or reduced-motion apply.
 */
export function AnimatedThemeToggle({ className }: { className?: string }) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = React.useState(false);
  const [dark, setDark] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const apply = React.useCallback(() => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try {
      window.localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
    setDark(next);
  }, []);

  const toggle = React.useCallback(async () => {
    const el = ref.current;
    const start = (document as ViewTransitionDocument).startViewTransition;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!el || reduce || typeof start !== 'function') {
      apply();
      return;
    }
    await start.call(document, () => flushSync(apply)).ready;
    const { top, left, width, height } = el.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const maxRadius = Math.hypot(
      Math.max(left, window.innerWidth - left),
      Math.max(top, window.innerHeight - top),
    );
    document.documentElement.animate(
      {
        clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${maxRadius}px at ${x}px ${y}px)`],
      },
      {
        duration: 640,
        easing: 'ease-in-out',
        pseudoElement: '::view-transition-new(root)',
      },
    );
  }, [apply]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className={cn(
        'grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      {mounted ? (
        dark ? (
          <Sun className="size-4" />
        ) : (
          <Moon className="size-4" />
        )
      ) : (
        <span className="size-4" />
      )}
    </button>
  );
}
