import CredentialsProvider from 'next-auth/providers/credentials';
import type { NextAuthOptions } from 'next-auth';
import { compare, hash } from 'bcryptjs';
import { prisma } from './db';
import { rateLimit } from './rate-limit';
import { getSupabasePublicServerClient } from './supabase-public';
import { markEmailAsVerified } from './email-verification';

const authenticateWithSupabase = async (email: string, password: string) => {
  try {
    const supabase = getSupabasePublicServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { authenticated: false, confirmed: false };
    }

    const confirmed = Boolean(data.user?.email_confirmed_at);

    await supabase.auth.signOut().catch(() => undefined);
    return { authenticated: true, confirmed };
  } catch {
    return { authenticated: false, confirmed: false };
  }
};

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        const normalizedEmail = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);
        const ipHeader = req?.headers?.['x-forwarded-for'];
        const ip = Array.isArray(ipHeader) ? ipHeader[0] : ipHeader || 'unknown';
        const allowed = await rateLimit(
          `auth:signin:${normalizedEmail}:${ip}`,
          8,
          60
        );
        if (!allowed) {
          throw new Error('RATE_LIMIT');
        }
        const user = await prisma.user.findFirst({
          where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
          include: { roles: { include: { role: true } }, profile: true }
        });
        if (!user) return null;
        const privileged = user.roles.some((item) =>
          ['ADMIN', 'SUPPORT', 'MODERATOR', 'FINANCE'].includes(item.role.name)
        );
        let isVerified = Boolean(user.emailVerified);

        if (!isVerified && !privileged) {
          const supabaseAuth = await authenticateWithSupabase(user.email, password);
          if (!supabaseAuth.authenticated) {
            return null;
          }
          if (!supabaseAuth.confirmed) {
            throw new Error('EMAIL_NOT_VERIFIED');
          }
          await markEmailAsVerified(user.email);
          await prisma.user.update({
            where: { id: user.id },
            data: {
              emailVerified: user.emailVerified || new Date(),
              passwordHash: await hash(password, 10)
            }
          });
          isVerified = true;
        }

        let valid = await compare(password, user.passwordHash);
        if (!valid) {
          const supabaseAuth = await authenticateWithSupabase(user.email, password);
          if (!supabaseAuth.authenticated) return null;

          await prisma.user.update({
            where: { id: user.id },
            data: {
              passwordHash: await hash(password, 10),
              emailVerified: supabaseAuth.confirmed
                ? (user.emailVerified || new Date())
                : user.emailVerified
            }
          });

          if (!supabaseAuth.confirmed && !privileged) {
            throw new Error('EMAIL_NOT_VERIFIED');
          }
          if (supabaseAuth.confirmed && !user.emailVerified) {
            await markEmailAsVerified(user.email);
          }
          valid = true;
        }
        if (!valid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.profile?.name || user.email,
          roles: user.roles.map((r) => r.role.name)
        } as any;
      }
    })
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/auth/sign-in'
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.roles = (user as any).roles || [];
      }
      if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: String(token.id) },
            include: { roles: { include: { role: true } }, profile: true }
          });
          if (dbUser) {
            token.roles = dbUser.roles.map((r) => r.role.name);
            token.email = dbUser.email;
            token.name = dbUser.profile?.name || dbUser.email;
          }
        } catch {
          // Evita romper el login si hay un error temporal de DB.
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).roles = token.roles || [];
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET
};
