"use client";

import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { LiquidGlass } from "@liquidglassjs/react";
import { cn } from "@/lib/utils";
import "@liquidglassjs/core/css";

/**
 * Liquid-glass Dialog — Base UI's Dialog (focus trap, scroll lock, dismissal, and
 * all the ARIA) wearing a frosted liquid-glass panel. Behavior is Base UI's; the
 * glass is the skin. You own this file: restyle the panel, backdrop, and animation.
 *
 *   <GlassDialog>
 *     <GlassDialogTrigger>Open</GlassDialogTrigger>
 *     <GlassDialogContent>
 *       <GlassDialogHeader>
 *         <GlassDialogTitle>Title</GlassDialogTitle>
 *         <GlassDialogDescription>Subtitle</GlassDialogDescription>
 *       </GlassDialogHeader>
 *       <p>…body…</p>
 *       <GlassDialogFooter>
 *         <GlassDialogClose>Cancel</GlassDialogClose>
 *       </GlassDialogFooter>
 *     </GlassDialogContent>
 *   </GlassDialog>
 *
 * Compose a custom trigger/close with Base UI's `render` prop, e.g.
 *   <GlassDialogTrigger render={<Button />}>Open</GlassDialogTrigger>
 *
 * Theming: the frosted fill reads `--glass-frost-bg` (from @liquidglassjs/core/css);
 * override it per theme, e.g. `.dark { --glass-frost-bg: rgb(20 20 24 / 55%); }`.
 */

const GlassDialog = BaseDialog.Root;
const GlassDialogTrigger = BaseDialog.Trigger;
const GlassDialogClose = BaseDialog.Close;
const GlassDialogPortal = BaseDialog.Portal;

function GlassDialogContent({
  className,
  children,
  showClose = true,
  strength = 12,
  chroma = 0.4,
  dome = 10,
  depth = 8,
  edge = 0.9,
  glow = 0.3,
  ...props
}: React.ComponentProps<typeof BaseDialog.Popup> & {
  showClose?: boolean;
  strength?: number;
  chroma?: number;
  dome?: number;
  depth?: number;
  edge?: number;
  glow?: number;
}) {
  return (
    <BaseDialog.Portal>
      {/* a light page frost, fading with the dialog — dims just enough to lift the
          modal without blacking out the page behind it */}
      <BaseDialog.Backdrop
        className={cn(
          "fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px] transition-opacity duration-200 ease-out",
          "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
        )}
      />
      {/* positioning + scroll container */}
      <BaseDialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
        <BaseDialog.Popup
          className={cn(
            // shadow lives on the wrapper — the glass root's overflow:hidden would clip it
            "relative w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl outline-none",
            "transition duration-200 ease-out motion-reduce:transition-none",
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {/* frosted-glass panel — blurs the page behind the modal; sits BEHIND the
              content so titles/buttons stay crisp (not refracted). radius matches
              rounded-2xl (16px). */}
          <LiquidGlass
            mode="frost"
            radius={16}
            strength={strength}
            chroma={chroma}
            dome={dome}
            depth={depth}
            edge={edge}
            glow={glow}
            className="pointer-events-none absolute inset-0"
          />
          {/* crisp, interactive content on top */}
          <div className="relative z-10 p-6">
            {children}
            {showClose && (
              <BaseDialog.Close
                aria-label="Close"
                className="absolute right-4 top-4 rounded-md p-1 text-foreground/70 opacity-80 transition hover:bg-white/10 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </BaseDialog.Close>
            )}
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Viewport>
    </BaseDialog.Portal>
  );
}

function GlassDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 pr-8", className)} {...props} />;
}

function GlassDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function GlassDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function GlassDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Description>) {
  return (
    <BaseDialog.Description
      className={cn("text-sm text-foreground/70", className)}
      {...props}
    />
  );
}

export {
  GlassDialog,
  GlassDialogTrigger,
  GlassDialogPortal,
  GlassDialogClose,
  GlassDialogContent,
  GlassDialogHeader,
  GlassDialogFooter,
  GlassDialogTitle,
  GlassDialogDescription,
};
