'use client';

import { useId } from 'react';
import { Input } from './input';

type FloatingFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function FloatingField({ label, value, onChange }: FloatingFieldProps) {
  const id = useId();
  return <div className="relative"><Input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder=" " className="peer px-3 pb-2 pt-5 placeholder:text-transparent" /><label htmlFor={id} className="pointer-events-none absolute start-2 top-0 z-10 -translate-y-1/2 scale-75 bg-card px-1 text-sm text-muted-foreground transition-all duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:scale-75 peer-focus:text-primary">{label}</label></div>;
}
