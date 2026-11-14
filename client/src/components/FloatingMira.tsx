import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { lazy, Suspense } from 'react';
// The chat (and its Markdown parser) loads only when Mira is first opened.
const MentorChat = lazy(() => import('./MentorChat').then((m) => ({ default: m.MentorChat })));
import { MiraAvatar } from './MiraAvatar';
import { Spinner } from './ui';

/** Floating launcher: ask Mira from any page (Headless UI Popover — Escape / outside click closes it). */
export function FloatingMira({ onOpenFull }: { onOpenFull: () => void }) {
  return (
    <Popover className="fixed right-5 bottom-5 z-30">
      <PopoverButton
        aria-label="Ask Mira"
        className="group flex items-center gap-2 rounded-full bg-neutral-900/90 py-1.5 pr-4 pl-1.5 text-sm font-semibold text-white shadow-2xl ring-1 ring-white/15 backdrop-blur-xl hover:bg-neutral-800 focus:outline-none data-focus:outline-2 data-focus:outline-white"
      >
        <MiraAvatar size="md" />
        <span>Ask Mira</span>
      </PopoverButton>
      <PopoverPanel
        transition
        anchor={{ to: 'top end', gap: 12 }}
        className="z-40 flex h-[min(34rem,calc(100vh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-neutral-950/95 shadow-2xl ring-1 ring-white/15 backdrop-blur-2xl transition duration-200 ease-out data-closed:translate-y-2 data-closed:opacity-0"
      >
        {({ close }) => (
          <>
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <MiraAvatar size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">Mira</div>
                <div className="text-xs text-white/60">Grounded in your profile & progress</div>
              </div>
              <button
                onClick={() => {
                  close();
                  onOpenFull();
                }}
                className="rounded-md px-2 py-1 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
              >
                Open full chat
              </button>
              <button
                onClick={() => close()}
                aria-label="Close Mira chat"
                className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"
              >
                <XMarkIcon className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <Suspense
                fallback={
                  <p className="flex items-center gap-2 p-4 text-sm text-white/60">
                    <Spinner /> Loading…
                  </p>
                }
              >
                <MentorChat compact />
              </Suspense>
            </div>
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}
