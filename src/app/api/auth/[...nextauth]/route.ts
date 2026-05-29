import NextAuth from 'next-auth';
import TwitterProvider from 'next-auth/providers/twitter';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
  }
}

const handler = NextAuth({
  providers: [
    TwitterProvider({
      clientId:     process.env.X_CLIENT_ID!,
      clientSecret: process.env.X_CLIENT_SECRET!,
      version:      '2.0',
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken  = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt    = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
});

export { handler as GET, handler as POST };
