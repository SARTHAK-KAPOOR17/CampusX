// client/src/lib/motion.js

export const MOTION_TRANSITION_EASE = [0.25, 0.1, 0.25, 1];

export const MOTION_DURATIONS = {
  micro: 0.15,
  standard: 0.2,
  complex: 0.3,
};

export const MOTION_SPRINGS = {
  modal: {
    type: 'spring',
    damping: 25,
    stiffness: 300,
  },
  pop: {
    type: 'spring',
    damping: 15,
    stiffness: 350,
  },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: MOTION_DURATIONS.standard, ease: MOTION_TRANSITION_EASE },
  },
  exit: {
    opacity: 0,
    transition: { duration: MOTION_DURATIONS.micro, ease: MOTION_TRANSITION_EASE },
  },
};

export const slideUp = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: MOTION_DURATIONS.standard, ease: MOTION_TRANSITION_EASE },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: MOTION_DURATIONS.micro, ease: MOTION_TRANSITION_EASE },
  },
};

export const slideDown = {
  initial: { opacity: 0, y: -8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: MOTION_DURATIONS.standard, ease: MOTION_TRANSITION_EASE },
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: { duration: MOTION_DURATIONS.micro, ease: MOTION_TRANSITION_EASE },
  },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { ...MOTION_SPRINGS.modal },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: MOTION_DURATIONS.micro, ease: MOTION_TRANSITION_EASE },
  },
};

export const drawerSlideLeft = {
  initial: { opacity: 0, x: -40 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { ...MOTION_SPRINGS.modal },
  },
  exit: {
    opacity: 0,
    x: -40,
    transition: { duration: MOTION_DURATIONS.micro, ease: MOTION_TRANSITION_EASE },
  },
};

export const staggerContainer = (staggerChildren = 0.04, delayChildren = 0) => ({
  initial: {},
  animate: {
    transition: {
      staggerChildren,
      delayChildren,
    },
  },
});

export const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: MOTION_DURATIONS.standard, ease: MOTION_TRANSITION_EASE },
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: { duration: MOTION_DURATIONS.micro, ease: MOTION_TRANSITION_EASE },
  },
};

export const cardHoverMotion = {
  whileHover: {
    y: -4,
    transition: { duration: MOTION_DURATIONS.micro, ease: MOTION_TRANSITION_EASE },
  },
};

export const tapFeedback = {
  whileTap: {
    scale: 0.98,
    transition: { duration: 0.08 },
  },
};

export const heartPop = {
  initial: { scale: 1 },
  tap: { scale: 0.8 },
  popped: {
    scale: [0.8, 1.25, 1],
    transition: { duration: 0.28, ease: 'easeOut' },
  },
};

export const toastSlide = {
  initial: { opacity: 0, x: 20 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: MOTION_DURATIONS.standard, ease: MOTION_TRANSITION_EASE },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: MOTION_DURATIONS.micro, ease: MOTION_TRANSITION_EASE },
  },
};
