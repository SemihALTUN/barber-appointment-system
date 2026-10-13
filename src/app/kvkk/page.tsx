import type { Metadata } from "next";

export const metadata: Metadata = { title: "KVKK Aydınlatma Metni" };

// ÖNEMLİ: Bu sayfa yer tutucudur. Yayına almadan önce işletmenin hukuki danışmanı tarafından
// hazırlanmış aydınlatma metniyle değiştirilmelidir (veri sorumlusu, amaçlar, saklama süreleri,
// gelmeme kaydı / NoShowTracker, haklar ve başvuru yolları).
export default function KvkkPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">KVKK Aydınlatma Metni</h1>
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Bu metin henüz işletme tarafından yayımlanmamıştır.
      </p>
    </main>
  );
}
