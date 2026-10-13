// src/components/panel/time-block-card.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Coffee, Loader2, Trash2 } from "lucide-react";
import type { BlockType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { removeTimeBlock } from "@/server/actions/remove-time-block";
import type { PanelTimeBlock } from "@/types/panel";
import { ConfirmAction } from "./confirm-action";

export const BLOCK_LABEL: Record<BlockType, string> = {
  BREAK: "Mola",
  OFF_DUTY: "İzin",
  EMERGENCY: "Acil durum",
};

export function TimeBlockCard({ block }: { block: PanelTimeBlock }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const res = await removeTimeBlock({ timeBlockId: block.id });
      if (res.success) toast.success(`${BLOCK_LABEL[block.type]} kaldırıldı.`);
      else toast.error(res.error.message);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed bg-muted/50 p-4">
      <Coffee className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{BLOCK_LABEL[block.type]}</p>
        {block.reason && <p className="truncate text-sm text-muted-foreground">{block.reason}</p>}
      </div>
      <ConfirmAction
        title={`${BLOCK_LABEL[block.type]} kaldırılsın mı?`}
        description="Bu zaman aralığı yeniden müşteri randevularına açılacak."
        confirmLabel="Kaldır"
        destructive
        onConfirm={remove}
        trigger={
          <Button variant="ghost" size="icon" disabled={isPending} aria-label="Molayı kaldır">
            {isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
          </Button>
        }
      />
    </div>
  );
}
