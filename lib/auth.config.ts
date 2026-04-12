import type { NextAuthConfig } from "next-auth";
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
    mfaRequired?: boolean;
    mfaEnrolled?: boolean;
  }
}

/** Roles that must have MFA enabled (HIPAA: access to PHI) */
export const MFA_REQUIRED_ROLES: Role[] = [
  "Owner",
  "Admin",
  "Provider",
  "MedicalDirector",
];

/**
 * Edge-safe NextAuth configuration.
 * No Prisma, bcrypt, or Node.js-only imports — not even dynamic ones.
 * Used by middleware.ts to read/verify JWT without pulling in heavy deps.
 *
 * The MFA DB check lives in lib/auth.ts (server-only jwt callback override).
 */
export const authConfig: NextAuthConfig = {
  providers: [], // Providers added in lib/auth.ts (server-only)
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.clinicId = user.clinicId;
        token.lastActivity = Date.now();
        // MFA flags
        const totpEnabled = (user as any).totpEnabled;
        token.mfaEnrolled = !!totpEnabled;
        token.mfaRequired = MFA_REQUIRED_ROLES.includes(user.role);
        if (totpEnabled) {
          token.mfaPending = true;
          token.mfaVerified = false;
        }
      }

      // Session timeout: 15 minutes of inactivity
      if (token.lastActivity) {
        const elapsed = Date.now() - token.lastActivity;
        if (elapsed > 15 * 60 * 1000) {
          return {} as any;
        }
      }

      // Refresh activity timestamp on session update
      if (trigger === "update") {
        token.lastActivity = Date.now();
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
};
