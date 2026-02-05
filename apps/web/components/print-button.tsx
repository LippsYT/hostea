'use client';

import { Button } from '@/components/ui/button';

export const PrintButton = ({ label = 'Descargar PDF' }: { label?: string }) => {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      {label}
    </Button>
  );
};
