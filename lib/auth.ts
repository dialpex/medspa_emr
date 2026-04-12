import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            clinicId: true,
            passwordHash: true,
            isActive: true,
            totpEnabled: true,
          },
        });

        if (!user || !user.isActive || !user.passwordHash) {
          return null;
        }

        const isValidPassword = await bcrypt.compare(password, user.passwordHash);

        if (!isValidPassword) {
          return null;
        }

        // Log successful login
        await prisma.auditLog.create({
          data: {
            clinicId: user.clinicId,
            userId: user.id,
            action: "Login",
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          clinicId: user.clinicId,
          totpEnabled: user.totpEnabled,
        } as any;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      // Run the edge-safe base logic first
      const result = await authConfig.callbacks!.jwt!({
        token,
        user,
        trigger,
      } as any);

      // Server-side only: check MFA verification from DB
      if (trigger === "update" && result?.mfaPending && !result.mfaVerified) {
        const dbUser = await prisma.user.findUnique({
          where: { id: result.id },
          select: { totpVerifiedAt: true },
        });
        if (dbUser?.totpVerifiedAt) {
          const verifiedAge = Date.now() - dbUser.totpVerifiedAt.getTime();
          if (verifiedAge < 5 * 60 * 1000) {
            result.mfaVerified = true;
            result.mfaPending = false;
          }
        }
      }

      return result;
    },
  },
});
