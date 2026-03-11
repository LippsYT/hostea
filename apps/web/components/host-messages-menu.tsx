import Link from 'next/link';

type MenuKey = 'inbox' | 'quick-replies' | 'automations';

const menuItems: { key: MenuKey; label: string; href: string }[] = [
  { key: 'inbox', label: 'Conversaciones', href: '/dashboard/host/messages' },
  {
    key: 'quick-replies',
    label: 'Respuestas rapidas',
    href: '/dashboard/host/messages/quick-replies'
  },
  {
    key: 'automations',
    label: 'Automatizaciones',
    href: '/dashboard/host/messages/automations'
  }
];

export const HostMessagesMenu = ({ active }: { active: MenuKey }) => {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {menuItems.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
            item.key === active
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
};
