# BarberBook — Berber Randevu ve İşletme Yönetim Sistemi

BarberBook, bir berber dükkânının tanıtım sitesini, müşterilerin üye olmadan randevu aldığı akışı ve personelin günlük programını yönettiği paneli tek bir Next.js uygulamasında birleştirir. Projenin odağı, aynı saate gelen eşzamanlı randevu isteklerinin hiçbir koşulda çakışmamasıdır.

## Özellikler

**Tanıtım sitesi**
- Dükkân vitrini: fiyat listesi, ustalar, çalışma saatleri, adres, telefon, WhatsApp ve Instagram
- O anki saate göre "Şu an açığız / kapalıyız" bilgisi
- Fiyat listesinden bir hizmete dokununca randevu ekranı o hizmet seçili açılır
- Mobil uyumlu tasarım, hamburger menü ve ekranın altına sabitlenmiş randevu butonu

**Müşteri randevu akışı** (`/randevu-al`)
- Dört adım: hizmet, berber, tarih ve saat, iletişim bilgileri
- Birden fazla hizmet seçilebilir; süre ve fiyat otomatik toplanır
- Yalnızca seçilen hizmetlerin tümünü veren berberler listelenir
- Uygun saatler berberin vardiyasına, mevcut randevulara ve molalara göre 30 dakikalık aralıklarla hesaplanır
- Randevu sonrası takip kodu ve tek kullanımlık, gizli bir yönetim bağlantısı verilir

**Randevu yönetimi** (`/randevu/[kod]`, `/randevu-sorgula`)
- Yönetim bağlantısıyla randevuyu görüntüleme, başka saate taşıma ve iptal etme
- Randevuya 2 saatten az kaldığında müşteri değişiklik yapamaz
- Takip kodu ve telefon numarasıyla randevu durumunu sorgulama (yalnızca görüntüleme)

**Personel paneli** (`/panel`)
- E-posta ve şifreyle giriş; yönetici tüm personeli, personel yalnızca kendi takvimini görür
- Günlük zaman çizelgesi: bekleyen, tamamlanan ve gelmeyen randevu sayıları, günlük ciro
- Randevuyu "Tamamlandı" veya "Gelmedi" olarak işaretleme
- Daha önce gelmemiş müşteriler için uyarı (telefon numarası açık saklanmaz)
- Mola, izin ve acil durum bloğu ekleme ve kaldırma

## Teknik altyapı

| Katman | Teknoloji |
| --- | --- |
| Uygulama | Next.js (App Router, Server Actions), React 19, TypeScript (strict) |
| Arayüz | Tailwind CSS v4, shadcn/ui, lucide-react |
| Veritabanı | PostgreSQL 16, Prisma ORM |
| Doğrulama | Zod |
| Kimlik doğrulama | Auth.js v5 (Credentials, JWT), bcrypt |
| Önbellek ve hız sınırı | Upstash Redis, @upstash/ratelimit |
| Test | Vitest, GitHub Actions |

## Mimari kararlar

**Çift randevuyu engelleyen üç katman.** Bir saate aynı anda gelen istekler üç ayrı katmanda elenir:
1. **Redis kilidi:** Aynı berber ve saat için 120 saniyelik kilit, yoğun anlarda gereksiz istekleri veritabanına ulaşmadan eler. Redis'e ulaşılamazsa sistem durmaz, sonraki katmanlar korumaya devam eder.
2. **Satır kilidi:** Randevu oluşturma, taşıma ve mola ekleme işlemleri berber satırını `SELECT … FOR UPDATE` ile kilitler; aynı berberin takvimine yazan işlemler sırayla çalışır.
3. **GiST exclusion kısıtı:** PostgreSQL seviyesinde aynı berberin onaylı randevuları zaman aralığı olarak çakışamaz. Uygulama kodu atlansa bile veritabanı çakışmayı reddeder.

**İptal ve taşıma yarışları.** İptal ve taşıma aynı randevu satırını kilitler ve durum güncellemesini `status = 'CONFIRMED'` koşuluyla yapar. Böylece iptal edilmiş bir randevu taşınamaz, aynı randevu iki kez iptal edilemez.

**Zaman.** Tüm saatler veritabanında UTC olarak saklanır; vardiya, gece yarısı ve ızgara kontrolleri `Europe/Istanbul` saatine göre yapılır. Randevu aralığı `SLOT_INTERVAL_MINUTES` adlı tek bir sabitten gelir.

**Güvenlik**
- Yönetim bağlantısındaki token 256 bitlik rastgele bir değerdir; veritabanında yalnızca SHA-256 özeti tutulur ve karşılaştırma sabit sürede yapılır.
- Gelmeyen müşteri sayacı telefon numarasını HMAC ile özetleyerek tutar.
- Randevu, saat sorgusu, iptal/taşıma ve giriş uç noktaları IP bazlı hız sınırıyla korunur.
- İstemciye dönen veriler DTO'lardan geçer; token özeti gibi alanlar dışarı çıkmaz.

**KVKK.** Günlük çalışan bir görev, 90 günü geçmiş randevulardaki kişisel verileri anonimleştirir ve 1 yılı geçmiş gelmeme kayıtlarını siler. Her çalışma denetim günlüğüne yazılır.

## Testler

`tests/concurrency.test.ts` izole bir test veritabanında gerçek PostgreSQL ile çalışan 12 test içerir:

- Aynı saate ve örtüşen saatlere eşzamanlı randevu istekleri
- Eşzamanlı randevu ve mola yarışı
- 30 dakikalık ızgara, milisaniye, gece yarısı ve vardiya taşması kontrolleri
- Uygulama atlanarak doğrudan veritabanına yazıldığında GiST kısıtının devreye girmesi
- Anonimleştirmede telefon alanının benzersizlik kısıtını bozmaması
- Geçersiz token ile taşıma isteği ve eşzamanlı iki iptal
- İptal ile taşımanın birbirini beklediğini doğrulayan kilit testleri (9A, 9B)
- Test veritabanı güvenlik kalkanı (üretim veritabanında çalışmayı reddeder)
- Mola eklemede oturum ve yetki kontrolü

## Proje yapısı

```
prisma/              Şema ve migration'lar (GiST ve CHECK kısıtları dahil)
src/app/             Sayfalar: vitrin, randevu akışı, personel paneli, API route'ları
src/components/      Arayüz bileşenleri (booking, panel, landing, ui)
src/server/actions/  Server Actions: randevu oluşturma, taşıma, iptal, mola, durum
src/server/queries/  Okuma sorguları: uygun saatler, katalog, panel programı
src/lib/             Zaman, kilit, hız sınırı, kimlik doğrulama, biçimlendirme
src/config/shop.ts   Dükkân bilgileri (ad, adres, saatler, iletişim)
tests/               Eşzamanlılık ve güvenlik testleri
scripts/             Yönetici oluşturma ve demo verisi
```

## Çalıştırma

Gereksinimler: Node.js 20.12+, Docker (PostgreSQL için).

```bash
npm install
cp .env.example .env              # AUTH_SECRET, NO_SHOW_PEPPER ve CRON_SECRET değerlerini doldurun
docker compose up -d --wait       # PostgreSQL 16: barber_db ve barber_test_db
npm run db:migrate
npm run db:seed:demo              # isteğe bağlı örnek hizmet ve personel
npm run admin:create -- admin@ornek.com "Ad Soyad"
npm run dev                       # http://localhost:3000
```

Testler için `.env.test` dosyasında test veritabanını tanımlayıp şunları çalıştırın:

```bash
npm run db:migrate:test
npm test
```

## Geliştirme süreci

Projenin yapay zekâ araçlarıyla nasıl geliştirildiği [AI_LOG.md](AI_LOG.md) dosyasında anlatılıyor.
