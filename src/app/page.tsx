// src/app/page.tsx — Dükkân vitrini (ana sayfa)
import Link from "next/link";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { CalendarCheck, Camera, MapPin, MessageCircle, Phone, Search } from "lucide-react";
import { MobileMenu } from "@/components/landing/mobile-menu";
import { HoursTable, OpenStatus } from "@/components/landing/shop-hours";
import { SHOP, SHOP_MAPS_URL } from "@/config/shop";
import { formatDuration, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getBookingCatalog } from "@/server/queries/booking-catalog";
import type { BookingCatalog } from "@/types/booking";

// Hizmet ve ekip listesi 5 dakikada bir tazelenir; açık/kapalı bilgisi istemcide hesaplanır.
export const revalidate = 300;

const display = Barlow_Condensed({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
  variable: "--font-display",
});
const body = Barlow({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

const BOOK_HREF = "/randevu-al";
const LOOKUP_HREF = "/randevu-sorgula";

/** Üst çubuk bölüm bağlantıları: masaüstünde yatay, mobilde hamburger menüde */
const SECTION_LINKS = [
  { href: "#hizmetler", label: "Fiyatlar" },
  { href: "#ekip", label: "Ustalarımız" },
  { href: "#saatler", label: "Saatler" },
  { href: "#iletisim", label: "Adres" },
] as const;

async function loadCatalog(): Promise<BookingCatalog> {
  try {
    return await getBookingCatalog();
  } catch (err) {
    // Veritabanına ulaşılamasa da vitrin açılmalı; liste bölümleri gizlenir.
    console.error("[LANDING] Hizmet kataloğu yüklenemedi:", err);
    return { services: [], staff: [] };
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("tr-TR"))
    .join("");
}

/** Sayfadaki ana eylem: koyu zeminde beyaz, "basılabilir" alt kenarlı tek buton. Renkler tema değişkenlerinden gelir. */
function BookButton({ className, children = "Hemen Randevu Al" }: { className?: string; children?: React.ReactNode }) {
  return (
    <Link
      href={BOOK_HREF}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md bg-primary-foreground font-semibold text-primary",
        "shadow-[0_5px_0_0_var(--color-muted-foreground)] transition-[transform,box-shadow] duration-100",
        "hover:-translate-y-0.5 hover:shadow-[0_7px_0_0_var(--color-muted-foreground)]",
        "active:translate-y-1 active:shadow-[0_1px_0_0_var(--color-muted-foreground)]",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-foreground/50",
        className
      )}
    >
      <CalendarCheck className="size-5" aria-hidden />
      {children}
    </Link>
  );
}

const sectionHeading = "font-[family-name:var(--font-display)] text-4xl font-bold uppercase leading-none sm:text-5xl";

export default async function HomePage() {
  const { services, staff } = await loadCatalog();
  const year = new Date().getFullYear();

  return (
    <div className={cn(display.variable, body.variable, "bg-background font-[family-name:var(--font-body)] text-foreground")}>
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-background focus:px-4 focus:py-2"
      >
        İçeriğe geç
      </a>

      {/* Üst çubuk */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-primary text-primary-foreground">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-6">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
          >
            {SHOP.name}
          </Link>
          <nav aria-label="Sayfa bölümleri" className="hidden items-center gap-6 text-sm text-primary-foreground/75 md:flex">
            {SECTION_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-primary-foreground">
                {link.label}
              </a>
            ))}
          </nav>
          {/* Masaüstü: Randevu Al butonu. Mobil: hamburger menü (randevu butonu ayrıca alttaki sabit çubukta) */}
          <Link
            href={BOOK_HREF}
            className="hidden rounded-md bg-primary-foreground px-4 py-2 text-sm font-semibold text-primary hover:bg-primary-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground md:inline-flex"
          >
            Randevu Al
          </Link>
          <MobileMenu links={SECTION_LINKS} bookHref={BOOK_HREF} lookupHref={LOOKUP_HREF} />
        </div>
      </header>

      <main id="icerik">
        {/* Vitrin camı: dükkân adı tabela gibi, solda dönen siyah-beyaz berber direği */}
        <section className="relative overflow-hidden bg-primary text-primary-foreground">
          <div aria-hidden className="barber-pole absolute inset-y-0 left-0 w-3 sm:w-5" />
          <div className="mx-auto grid max-w-5xl gap-10 py-16 pl-10 pr-6 sm:py-24 sm:pl-16 md:grid-cols-[1fr_auto]">
            <div>
            <OpenStatus className="text-primary-foreground/75" />
            <h1 className="mt-6 font-[family-name:var(--font-display)] text-[clamp(3.75rem,15vw,9rem)] font-bold uppercase leading-[0.82] tracking-tight">
              {SHOP.name}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-primary-foreground/75 sm:text-xl">{SHOP.tagline}</p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <BookButton className="h-14 px-8 text-lg" />
              <Link
                href={LOOKUP_HREF}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-md border border-primary-foreground/30 px-6 font-medium text-primary-foreground/75 hover:border-primary-foreground hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
              >
                <Search className="size-4" aria-hidden />
                Randevumu Sorgula / İptal Et
              </Link>
            </div>
            <p className="mt-5 text-sm text-primary-foreground/70">Üyelik gerekmez. Hizmetinizi, ustanızı ve saatinizi seçmeniz yeterli.</p>
            </div>

            {/* Vitrin camının köşesindeki künye: masaüstünde adres ve telefon ilk bakışta görünür */}
            <aside className="hidden self-end border-l border-primary-foreground/20 pl-6 text-sm leading-relaxed text-primary-foreground/75 md:block">
              <address className="not-italic">
                {SHOP.address.street}
                <br />
                {SHOP.address.district}
              </address>
              <a href={`tel:${SHOP.phone}`} className="mt-3 block hover:text-primary-foreground">
                {SHOP.phoneDisplay}
              </a>
              <a
                href={SHOP_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block underline underline-offset-4 hover:text-primary-foreground"
              >
                Haritada aç
              </a>
            </aside>
          </div>
        </section>

        {/* Fiyat listesi: dükkân panosundaki gibi noktalı çizgiyle fiyata bağlanan satırlar */}
        {services.length > 0 && (
          <section id="hizmetler" className="scroll-mt-14">
            {/* Kenar hizası diğer bölümlerle aynı; liste noktalı çizgiler okunur kalsın diye daha dar */}
            <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
              <h2 className={sectionHeading}>Fiyat listesi</h2>
              <p className="mt-3 text-muted-foreground">Bir hizmete dokunun, randevu ekranı o hizmet seçili olarak açılsın.</p>
              <ul className="mt-8 max-w-3xl border-t-2 border-foreground">
                {services.map((service) => (
                  <li key={service.id} className="border-b border-border">
                    <Link
                      href={`${BOOK_HREF}?hizmet=${encodeURIComponent(service.id)}`}
                      aria-label={`${service.name}, ${formatPrice(service.price)}, randevu al`}
                      className="group flex items-end gap-3 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="min-w-0">
                        <span className="block text-lg font-semibold underline-offset-4 group-hover:underline">
                          {service.name}
                        </span>
                        <span className="block text-sm text-muted-foreground">
                          {formatDuration(service.durationMinutes)}
                          {service.description ? `, ${service.description.toLocaleLowerCase("tr-TR")}` : ""}
                        </span>
                      </span>
                      <span aria-hidden className="mb-2 min-w-6 flex-1 border-b-2 border-dotted border-foreground/25" />
                      <span className="font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums">
                        {formatPrice(service.price)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Ustalar */}
        {staff.length > 0 && (
          <section id="ekip" className="scroll-mt-14 bg-muted">
            <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
              <h2 className={sectionHeading}>Ustalarımız</h2>
              <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
                {staff.map((member) => (
                  <li key={member.id} className="flex gap-4">
                    <span
                      aria-hidden
                      className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary font-[family-name:var(--font-display)] text-2xl font-bold text-primary-foreground"
                    >
                      {initials(member.name)}
                    </span>
                    <div>
                      <p className="text-xl font-semibold">{member.name}</p>
                      <p className="text-muted-foreground">{member.title}</p>
                      {member.bio && <p className="mt-2 max-w-sm leading-relaxed">{member.bio}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Hakkımızda + çalışma saatleri */}
        <section id="hakkimizda" className="scroll-mt-14">
          <div className="mx-auto grid max-w-5xl gap-14 px-6 py-16 sm:py-20 md:grid-cols-2">
            <div>
              <h2 className={sectionHeading}>Hakkımızda</h2>
              <p className="mt-5 max-w-prose text-lg leading-relaxed">{SHOP.about}</p>
              <ul className="mt-6 space-y-3">
                {SHOP.highlights.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span aria-hidden className="mt-2.5 size-2 shrink-0 rotate-45 bg-foreground" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div id="saatler" className="scroll-mt-20">
              <h2 className={sectionHeading}>Çalışma saatleri</h2>
              <div className="mt-5">
                <HoursTable />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">Resmî tatillerde saatler değişebilir. Gelmeden önce randevu almanızı öneririz.</p>
            </div>
          </div>
        </section>

        {/* Adres ve iletişim */}
        <section id="iletisim" className="scroll-mt-14 bg-primary text-primary-foreground">
          <div className="mx-auto grid max-w-5xl gap-12 px-6 py-16 sm:py-20 md:grid-cols-2">
            <div>
              <h2 className={sectionHeading}>Adres</h2>
              <address className="mt-5 text-lg not-italic leading-relaxed text-primary-foreground/75">
                {SHOP.address.street}
                <br />
                {SHOP.address.district}
                <br />
                {SHOP.address.city}
              </address>
              <a
                href={SHOP_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-md border border-primary-foreground/30 px-5 font-medium text-primary-foreground/75 hover:border-primary-foreground hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
              >
                <MapPin className="size-4" aria-hidden />
                Haritada aç
              </a>
            </div>

            <div>
              <h2 className={sectionHeading}>İletişim</h2>
              <ul className="mt-5 space-y-1 text-lg">
                <li>
                  <a href={`tel:${SHOP.phone}`} className="flex items-center gap-3 py-2 hover:text-primary-foreground/75">
                    <Phone className="size-5 text-primary-foreground/60" aria-hidden />
                    {SHOP.phoneDisplay}
                  </a>
                </li>
                <li>
                  <a
                    href={`https://wa.me/${SHOP.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 py-2 hover:text-primary-foreground/75"
                  >
                    <MessageCircle className="size-5 text-primary-foreground/60" aria-hidden />
                    WhatsApp ile yazın
                  </a>
                </li>
                <li>
                  <a
                    href={`https://instagram.com/${SHOP.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 py-2 hover:text-primary-foreground/75"
                  >
                    <Camera className="size-5 text-primary-foreground/60" aria-hidden />
                    Instagram: @{SHOP.instagram}
                  </a>
                </li>
              </ul>
              <BookButton className="mt-8 h-12 px-7" />
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-foreground text-sm text-primary-foreground/70">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-8 pb-28 sm:flex-row sm:items-center sm:justify-between md:pb-8">
          <p>
            © {year} {SHOP.name}
          </p>
          <nav aria-label="Alt bağlantılar" className="flex gap-6">
            <Link href={LOOKUP_HREF} className="hover:text-primary-foreground">Randevumu sorgula</Link>
            <Link href="/kvkk" className="hover:text-primary-foreground">KVKK</Link>
            <Link href="/panel" className="hover:text-primary-foreground">Personel girişi</Link>
          </nav>
        </div>
      </footer>

      {/* Mobilde ana eylem her zaman başparmak hizasında */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-primary/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <BookButton className="h-12 w-full text-base" />
      </div>
    </div>
  );
}
