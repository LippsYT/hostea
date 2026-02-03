import { cookies } from 'next/headers';
import crypto from 'crypto';

const CSRF_COOKIE = 'hostea_csrf';

export const getCsrfToken = () => {
  const store = cookies();
  let token = store.get(CSRF_COOKIE)?.value;
  if (!token) {
    token = crypto.randomBytes(16).toString('hex');
    store.set(CSRF_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });
  }
  return token;
};

export const assertCsrf = (req: Request) => {
  const csrfHeader = req.headers.get('x-csrf-token');
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(/hostea_csrf=([^;]+)/);
  if (!csrfHeader || !match || csrfHeader !== match[1]) {
    throw new Error('CSRF token invalido');
  }
};
