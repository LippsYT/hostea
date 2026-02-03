export const Footer = () => (
  <footer className="border-t border-neutral-100 px-8 py-10 text-sm text-neutral-500">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <span>© 2026 HOSTEA. Hospedajes premium.</span>
      <div className="flex gap-4">
        <a href="/legal/terms">Términos</a>
        <a href="/legal/privacy">Privacidad</a>
        <a href="/legal/cookies">Cookies</a>
        <a href="/legal/cancellation">Cancelación</a>
      </div>
    </div>
  </footer>
);
