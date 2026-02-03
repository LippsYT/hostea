import * as React from 'react';
import { cn } from '@/lib/utils';

export const Badge = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700',
      className
    )}
    {...props}
  />
);
