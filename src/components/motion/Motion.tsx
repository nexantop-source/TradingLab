'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@tl/ui';

/**
 * Motion primitives for the product surfaces.
 *
 * They keep motion progressive-enhancement only: if the user has requested
 * reduced motion, content is rendered in its final state with no entrance
 * transform or hover lift.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 20,
  amount = 0.18,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  amount?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={reduceMotion ? undefined : { duration: 0.62, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({
  children,
  className,
  delay = 0,
  stagger = 0.07,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : 'hidden'}
      whileInView={reduceMotion ? undefined : 'show'}
      viewport={{ once: true, amount: 0.16 }}
      variants={{
        hidden: {},
        show: {
          transition: { delayChildren: delay, staggerChildren: stagger },
        },
      }}
    >
      {React.Children.map(children, (child) => (
        <motion.div
          variants={
            reduceMotion
              ? undefined
              : {
                  hidden: { opacity: 0, y: 16 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
                }
          }
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

export function Lift({
  children,
  className,
  amount = 6,
}: {
  children: React.ReactNode;
  className?: string;
  amount?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn('will-change-transform', className)}
      whileHover={reduceMotion ? undefined : { y: -amount, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }}
    >
      {children}
    </motion.div>
  );
}

export function Float({
  children,
  className,
  distance = 8,
  duration = 7,
}: {
  children: React.ReactNode;
  className?: string;
  distance?: number;
  duration?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      animate={reduceMotion ? undefined : { y: [-distance / 2, distance / 2, -distance / 2] }}
      transition={reduceMotion ? undefined : { duration, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}
