import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-11 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/20',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';
