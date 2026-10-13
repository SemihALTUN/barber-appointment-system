// src/components/booking/use-slots.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionResult } from "@/lib/errors";
import type { SlotsResult } from "@/types/booking";

export type SlotsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: SlotsResult }
  | { status: "error"; message: string };

/**
 * requestKey değiştiğinde yükler; eski isteklerin geç gelen yanıtları yok sayılır.
 * load fonksiyonu her render'da yeniden oluşturulabilir — ref ile tutulur.
 */
export function useSlots(load: (() => Promise<ActionResult<SlotsResult>>) | null, requestKey: string | null) {
  const loadRef = useRef(load);
  loadRef.current = load;

  const [state, setState] = useState<SlotsState>({ status: "idle" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const fn = loadRef.current;
    if (!requestKey || !fn) {
      setState({ status: "idle" });
      return;
    }
    let active = true;
    setState({ status: "loading" });
    fn()
      .then((res) => {
        if (!active) return;
        setState(res.success ? { status: "ready", data: res.data } : { status: "error", message: res.error.message });
      })
      .catch(() => {
        if (active) setState({ status: "error", message: "Uygun saatler yüklenemedi." });
      });
    return () => {
      active = false;
    };
  }, [requestKey, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { state, reload };
}
