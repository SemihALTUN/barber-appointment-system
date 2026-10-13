// src/lib/auth.ts — Auth.js v5 (Credentials + JWT). Panel girişi: STAFF ve ADMIN.
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // Rol değişikliği en geç 8 saatte yansır

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

/** Login action bu kodu okuyarak kullanıcıya doğru mesajı gösterir. */
export class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

// Kullanıcı yoksa da bcrypt çalıştırılır → yanıt süresinden e-posta varlığı anlaşılamaz.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  return (dummyHashPromise ??= hash("timing-equalizer-not-a-real-password", 12));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/panel/giris" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(raw) {
        const parsed = LoginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // authorize içinde: /api/auth/callback/credentials'a doğrudan POST da sınırlanır
        const limit = await checkRateLimit("login", email);
        if (!limit.ok) throw new RateLimitedSignin();

        const user = await prisma.user.findUnique({
          where: { email },
          include: { staffProfile: { select: { id: true, isActive: true } } },
        });

        if (!user?.passwordHash) {
          await compare(password, await getDummyHash());
          return null;
        }
        if (!(await compare(password, user.passwordHash))) return null;

        // Müşteriler misafir akışını kullanır; panel yalnızca personel ve yönetici içindir.
        if (user.role === "CUSTOMER") return null;
        if (user.role === "STAFF" && !user.staffProfile?.isActive) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          staffId: user.staffProfile?.id ?? null,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.staffId = user.staffId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub && token.role) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.staffId = token.staffId ?? null;
      }
      return session;
    },
  },
});
