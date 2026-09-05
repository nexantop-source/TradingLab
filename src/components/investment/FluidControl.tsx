'use client';
import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export function FluidControl<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[]; value: T; onChange: (value: T) => void; label: string;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  return <div className="invest-segment" role="group" aria-label={label}>
    {options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
      {value === option.value && <motion.span className="invest-segment-thumb" layoutId={id} transition={reduced ? { duration: 0 } : { type: 'spring', bounce: 0, duration: 0.32 }} />}
      <span>{option.label}</span>
    </button>)}
  </div>;
}
