'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { usePathname } from 'next/navigation';

/**
 * App-like page transition. A Next.js `template` re-mounts on every navigation
 * (unlike `layout`), so this replays a subtle fade + rise each time you move
 * between screens — premium and direction-agnostic (reads the same in RTL
 * Arabic as in LTR English, unlike a horizontal slide).
 *
 * Notes:
 *  - Once the entrance finishes we drop the motion wrapper and render a plain
 *    div. Leaving a lingering `transform` would turn this into the containing
 *    block for any `position: fixed` modal inside the page — so we clear it.
 *  - The Conversations screen owns its own list/chat panels and drives the URL
 *    (?c=<id>) when switching chats; a full-page transition there would fire on
 *    every chat open, so we skip it. Respects reduced-motion too.
 */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [entered, setEntered] = useState(false);

  const skip = reduceMotion || !!pathname?.startsWith('/conversations');

  // `min-h-full` (not `h-full`) so tall pages GROW past the viewport instead of
  // being capped at 100% — a capped wrapper lets content overflow its box, which
  // hid page content behind the floating mobile bottom nav. `sm:h-full` keeps the
  // definite full height that full-height desktop screens (e.g. Conversations)
  // rely on. `pb-[var(--bottom-nav-space)]` reserves the nav's footprint (0 on sm+).
  const wrapperClass = 'min-h-full sm:h-full pb-[var(--bottom-nav-space)]';

  if (skip || entered) return <div className={wrapperClass}>{children}</div>;

  return (
    <motion.div
      className={wrapperClass}
      initial={{ opacity: 0, y: 14, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        // Spring on movement (native, physical), quick tween on opacity —
        // settles in ~250-300ms so navigation always feels responsive.
        y: { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 },
        scale: { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 },
        opacity: { duration: 0.2, ease: 'easeOut' },
      }}
      onAnimationComplete={() => setEntered(true)}
    >
      {children}
    </motion.div>
  );
}
