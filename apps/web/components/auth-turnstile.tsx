'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
        }
      ) => string;
    };
  }
}

type AuthTurnstileProps = {
  onToken: (token: string) => void;
  onExpire?: () => void;
};

export function AuthTurnstile({ onToken, onExpire }: AuthTurnstileProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current) return;
      containerRef.current.innerHTML = '';
      window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: onToken,
        'expired-callback': () => onExpire?.()
      });
    };

    const existing = document.getElementById('hostea-turnstile-script');
    if (existing) {
      renderWidget();
      return;
    }

    const script = document.createElement('script');
    script.id = 'hostea-turnstile-script';
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = renderWidget;
    document.body.appendChild(script);
  }, [siteKey, onExpire, onToken]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="mt-2 min-h-[70px]" />;
}
