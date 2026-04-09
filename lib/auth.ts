import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name: string;
    role: Role;
    clinicId: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      clinicId: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    clinicId: string;
    lastActivity?: number;
    mfaPending?: boolean;
    mfaVerified?: boolean;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
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
          mfaPending: user.totpEnabled || undefined,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.clinicId = user.clinicId;
        token.lastActivity = Date.now();
        // MFA pending flag
        const mfaPending = (user as any).mfaPending;
        if (mfaPending) {
          token.mfaPending = true;
          token.mfaVerified = false;
        }
      }

      // Session timeout: 15 minutes of inactivity
      if (token.lastActivity) {
        const elapsed = Date.now() - token.lastActivity;
        if (elapsed > 15 * 60 * 1000) {
          // Force re-login by clearing token
          return {} as any;
        }
      }

      // Refresh activity on session update (user activity)
      if (trigger === "update") {
        token.lastActivity = Date.now();

        // Check if MFA was just verified (DB stamp from /api/auth/verify-mfa)
        if (token.mfaPending && !token.mfaVerified) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id },
            select: { totpVerifiedAt: true },
          });
          if (dbUser?.totpVerifiedAt) {
            const verifiedAge = Date.now() - dbUser.totpVerifiedAt.getTime();
            if (verifiedAge < 5 * 60 * 1000) { // within last 5 minutes
              token.mfaVerified = true;
              token.mfaPending = false;
            }
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.clinicId = token.clinicId;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 15 * 60, // 15 minutes
  },
});
