import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { loginWithMedplum } from '@/lib/medplum-auth';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const result = await loginWithMedplum(
          credentials.email as string,
          credentials.password as string
        );

        if (!result) return null;

        return {
          id: result.practitionerId,
          name: result.name,
          email: result.email,
          practitionerId: result.practitionerId,
          projectId: result.projectId,
        };
      },
    }),
  ],

  callbacks: {
    jwt({ token, user }) {
      // On first sign-in, copy custom fields into the JWT
      if (user) {
        token.practitionerId = (user as any).practitionerId;
        token.projectId = (user as any).projectId;
      }
      return token;
    },
    session({ session, token }) {
      // Expose custom fields to the client session
      (session.user as any).practitionerId = token.practitionerId;
      (session.user as any).projectId = token.projectId;
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: { strategy: 'jwt' },
});
