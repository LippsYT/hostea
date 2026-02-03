'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

export type LegalPage = {
  slug: string;
  title: string;
  content: string;
};

export const AdminLegalForm = ({ pages }: { pages: LegalPage[] }) => {
  const [csrf, setCsrf] = useState('');
  const [local, setLocal] = useState(pages);

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const onSave = async (page: LegalPage) => {
    await fetch('/api/admin/legal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      },
      body: JSON.stringify(page)
    });
    alert('Pagina legal actualizada');
  };

  return (
    <div className="grid gap-4">
      {local.map((page, idx) => (
        <div key={page.slug} className="surface-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">/{page.slug}</p>
              <h4 className="text-lg font-semibold text-slate-900">Contenido legal</h4>
            </div>
            <Button size="sm" onClick={() => onSave(local[idx])}>Guardar</Button>
          </div>
          <div className="mt-5 grid gap-3">
            <Input
              value={page.title}
              onChange={(e) => {
                const copy = [...local];
                copy[idx] = { ...copy[idx], title: e.target.value };
                setLocal(copy);
              }}
            />
            <Textarea
              value={page.content}
              onChange={(e) => {
                const copy = [...local];
                copy[idx] = { ...copy[idx], content: e.target.value };
                setLocal(copy);
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
