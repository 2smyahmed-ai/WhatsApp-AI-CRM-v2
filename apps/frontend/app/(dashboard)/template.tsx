'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { usePathname } from 'next/navigation';

/**
 * App-like page transition. A Next.js `template` re-mounts on every navigation
 * (unlike `layout`), so this replays a subtle iOS-style slide + fade each time
 * you move between screens.
 *
 * Notes:
 *  - Once the entrance finishes we drop the motion wrapper and render a plain
 *    div. Leaving a lingering `transform` would turn this into the containing
 *    block for any `position: fixed` modal inside the page — so we clear it.
 *  - The Conversations screen owns its own list/chat panels and drives the URL
 *    (?c=<id>) when switching chats; a full-page slide there would fire on every
 *    chat open, so we skip it. Respects reduced-motion too.
 */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [entered, setEntered] = useState(false);

  const skip = reduceMotion || !!pathname?.startsWith('/conversations');

  if (skip || entered) return <div className="h-full">{children}</div>;

  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      onAnimationComplete={() => setEntered(true)}
    >
      {children}
    </motion.div>
  );
}
