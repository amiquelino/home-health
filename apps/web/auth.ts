import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { verifyUser } from '@/lib/users';
import type { AppUser } from '@/lib/users';
import { authConfig } from './auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  logger: {
    // CredentialsSignin means the user typed a wrong password — a user event, not a system error.
    // Suppress it to keep logs clean; real auth errors (network, config) still surface.
    error: (error) => {
      if (error.name === 'CredentialsSignin') return;
      console.error('[auth]', error);
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        return verifyUser(credentials.email as string, credentials.password as string) as Promise<AppUser | null>;
      },
    }),
  ],
});
