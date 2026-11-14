import { SparklesIcon } from '@heroicons/react/24/solid';

/** Mira's identity mark: a glowing gradient orb with sparkles (echoes the app's purple/blue glow). */
export function MiraAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const box = { sm: 'size-7', md: 'size-9', lg: 'size-14' }[size];
  const icon = { sm: 'size-4', md: 'size-5', lg: 'size-7' }[size];
  return (
    <span
      aria-hidden
      className={`relative inline-flex ${box} shrink-0 items-center justify-center rounded-full bg-linear-to-br from-sky-400 via-violet-500 to-indigo-600 shadow-[0_0_24px_-4px_rgba(139,92,246,0.7)] ring-1 ring-white/20`}
    >
      <SparklesIcon className={`${icon} text-white`} />
    </span>
  );
}
