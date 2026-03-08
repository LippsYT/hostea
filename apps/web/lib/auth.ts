import CredentialsProvider from 'next-auth/providers/credentials';
import type { NextAuthOptions } from 'next-auth';
import { compare } from 'bcryptjs';
import { prisma } from './db';
import { rateLimit } from './rate-limit';

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
        const ipHeader = req?.headers?.['x-forwarded-for'];
        const ip = Array.isArray(ipHeader) ? ipHeader[0] : ipHeader || 'unknown';
        const allowed = await rateLimit(
          `auth:signin:${String(credentials.email).toLowerCase()}:${ip}`,
          8,
          60
        );
        if (!allowed) {
          throw new Error('RATE_LIMIT');
        }
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { roles: { include: { role: true } }, profile: true }
        });
        if (!user) return null;
        const privileged = user.roles.some((item) =>
          ['ADMIN', 'SUPPORT', 'MODERATOR', 'FINANCE'].includes(item.role.name)
        );
        if (!user.emailVerified && !privileged) {
          throw new Error('EMAIL_NOT_VERIFIED');
        }
        const valid = await compare(credentials.password, user.passwordHash);
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
