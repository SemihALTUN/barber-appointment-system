// src/server/actions/login.ts
"use server";

import { AuthError, type CredentialsSignin } from "next-auth";
import { signIn } from "@/lib/auth";

type LoginState = { error: string | null };

/** Açık yönlendirme (open redirect) önlemi: yalnızca panel içi göreli yollar. */
function safeCallbackUrl(value: FormDataEntryValue | null): string {
  if (typeof value === "string" && value.startsWith("/panel") && !value.startsWith("//") && !value.includes("\\")) {
    return value;
  }
  return "/panel";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: safeCallbackUrl(formData.get("callbackUrl")),
    });
    return { error: null };
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.type === "CredentialsSignin") {
        const code = (err as CredentialsSignin).code;
        return {
          error:
            code === "rate_limited"
              ? "Çok fazla başarısız deneme. Lütfen 15 dakika sonra tekrar deneyin."
              : "E-posta veya şifre hatalı.",
        };
      }
      return { error: "Giriş yapılamadı. Lütfen tekrar deneyin." };
    }
    throw err; // Başarılı girişte signIn'in fırlattığı NEXT_REDIRECT yayılmalı
  }
}
