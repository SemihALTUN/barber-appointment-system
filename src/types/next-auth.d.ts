// src/types/next-auth.d.ts
import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: Role;
    staffId: string | null;
  }
  interface Session {
    user: { id: string; role: Role; staffId: string | null } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    staffId?: string | null;
  }
}
