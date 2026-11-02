import { motion } from 'framer-motion';

/** A check mark that draws itself in, for "done" moments. */
export function DrawnCheck({ size = 18, strokeWidth = 3.2, className = '' }: { size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <motion.path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, ease: [0.65, 0, 0.35, 1], delay: 0.08 }}
      />
    </svg>
  );
}
