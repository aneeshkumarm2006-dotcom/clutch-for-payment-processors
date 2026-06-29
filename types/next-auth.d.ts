import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/lib/enums";

/**
 * Augment NextAuth's types so `session.user.id` and `session.user.role` are
 * typed everywhere (set in the jwt/session callbacks in `lib/auth.ts`).
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
  }
}
