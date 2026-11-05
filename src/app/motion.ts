import type { Transition } from 'framer-motion';

/** The app's one spring. Snappy, no overshoot wobble. */
export const spring: Transition = { type: 'spring', stiffness: 400, damping: 30 };

/** Slightly softer spring for full-screen pushes and sheets. */
export const pageSpring: Transition = { type: 'spring', stiffness: 380, damping: 38, mass: 0.9 };

/**
 * Pass as `onUpdate` to keep an opacity/filter animation in Motion's own frame
 * loop. Otherwise the browser runs it, and when it hands the final value back
 * the element flashes its starting value for one frame.
 */
export const inJsLoop = () => undefined;
