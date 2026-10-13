# AI_LOG — Bu projede yapay zekâyı nasıl kullandım

Bu proje, birden fazla yapay zekâ modelini farklı görevlerde kullandığım bir iş akışıyla geliştirildi. Bu dosyada hangi aracı ne için kullandığımı, kararların nasıl verildiğini ve benim rolümün ne olduğunu anlatıyorum.

## İş akışının özeti

```
Fikir ──► Gemini: şartname yazar
              │
              ▼
          ChatGPT: hakem olarak puanlar ve eksikleri bulur
              │
              ├── puan < 90 ──► Gemini şartnameyi düzeltir (döngü tekrar)
              │
              ▼ puan ≥ 90
          Claude: şartnameye göre kodu adım adım yazar
              │
              ▼
          Ben: her adımı onaylarım, projeyi kurar, çalıştırır ve eksikleri bildiririm
```

## 1. Şartname: Gemini

Proje fikrini Gemini'ye (Spark modu) verip bir mimari şartname yazdırdım. Şartname; veritabanı şemasını, eşzamanlı randevu isteklerinin nasıl ele alınacağını, hata kodlarını, KVKK kurallarını ve test senaryolarını içeriyordu. Bu belge zamanla `berber_randevu_sistemi_mimari_v1.2.pdf` hâline geldi.

## 2. Hakemlik: ChatGPT

Gemini'nin yazdığı şartnameyi ChatGPT'ye bir hakem gibi değerlendirttim. ChatGPT belgeyi puanladı ve zayıf noktaları listeledi. Bu geri bildirimi Gemini'ye taşıyıp şartnameyi düzelttirdim ve iki model arasında bu döngüyü tekrarladım.

Kendime bir eşik koydum: şartname 90 puanın üzerine çıkmadan koda geçmedim. Amacım, kod yazılmaya başlamadan önce mimari hataları belge üzerinde yakalamaktı; belgede bir satırı düzeltmek, yazılmış kodu baştan değiştirmekten çok daha ucuz.

## 3. Kodlama: Claude

90 puanı geçen şartnameyi (V1.2) Claude'a verdim ve kodu ona yazdırdım. Projenin iskeletini ben kurdum; kod Claude'dan geldi. Kodlamayı tek seferde değil, katman katman ve her adımda onay vererek ilerlettim:

1. Veritabanı şeması, GiST migration'ı, Prisma bağlantısı, Redis kilidi ve Zod şemaları
2. Server Actions: randevu oluşturma, taşıma ve iptal
3. Mola ekleme, kimlik doğrulama iskeleti ve eşzamanlılık test paketi
4. Misafir randevu akışı ve randevu yönetim sayfası
5. Personel paneli, durum butonları, mola yönetimi ve hız sınırı
6. Tek komutla kurulum script'i (`setup.mjs`)
7. Dükkânın tanıtım sitesi ve randevu sorgulama sayfası

Her adımda Claude'dan şartnameden saptığı yerleri gerekçesiyle ayrıca yazmasını istedim ve bu sapmaları tek tek onayladım.

### Claude'un şartnamede yakaladığı sorunlar

Hakem sürecinden geçmiş olmasına rağmen şartnamede kod yazılırken ortaya çıkan hatalar vardı. Claude bunları kodlamaya geçmeden önce bildirdi:

- **Tanımsız değişken:** Test 9B'de `rescheduleResolved` değişkeni tanımlanmadan kullanılıyordu; strict modda test çalışmadan çökerdi.
- **Eksik modül:** Testler şartnamede hiç tanımlanmamış `add-time-block` modülünü kullanıyordu.
- **Test ortamında oturum hatası:** `auth()` test ortamında hata fırlatıyordu; bu yüzden üç test yanlış sebeple düşerdi.
- **Gizli verinin istemciye sızması:** Randevu dönüşü token özetini istemciye gönderiyordu. Ayrıca `Decimal` tipindeki fiyatlar Server Action sınırından geçemiyordu.
- **Eskiyen test tarihleri:** Testlerdeki sabit tarihler birkaç gün içinde geçmişte kalıp testleri bozacaktı; bunlar her çalıştırmada ileriye kayan tarihlerle değiştirildi.
- **Geçmişe randevu:** Randevu oluştururken geçmiş saat kontrol edilmiyordu; yalnızca taşımada kontrol vardı.
- **Gece yarısı saati:** Saat dilimi yardımcısı bazı Node sürümlerinde gece yarısını "24" olarak okuyabiliyordu.

## 4. Benim rolüm: kurmak, denemek, düzeltmek

Kodun doğru ve kullanılabilir olmasından sonuçta ben sorumluyum. Bu yüzden her parti kodu kendi ortamımda kurdum, uygulamayı kullanıcı gözüyle denedim ve gördüğüm eksikleri Claude'a geri bildirdim:

| Fark ettiğim sorun | Yapılan düzeltme |
| --- | --- |
| Tanıtım sitesi, randevu ekranlarının siyah-beyaz renklerinden farklı bir paletle tasarlanmıştı | Vitrin, randevu ekranlarıyla aynı tema renklerine bağlandı |
| Randevu sayfalarından ana sayfaya dönüş yolu yoktu | Randevu sayfalarına ortak bir üst çubuk, onay ekranına ana sayfa butonu eklendi |
| Ekran küçülünce üst menüdeki bağlantılar kayboluyordu | Mobil için hamburger menü eklendi |
| Randevular 15 dakika aralıklıydı; bir berber hizmeti 15 dakikada bitmez | Aralık 30 dakikaya çıkarıldı ve tek bir sabite bağlandı; testler ve demo verisi buna göre güncellendi |

Claude'a da kendi çalıştıramadığı adımları açıkça söylemesini istedim. Kodun bir kısmı Claude'un çalışma ortamında npm paketlerine erişilemediği için orada derlenemedi. Claude o adımlarda yalnızca sözdizimi kontrolü, kısmi tip kontrolü, yardımcı fonksiyon testleri ve tarayıcı önizlemesi yapabildiğini her seferinde belirtti. Asıl derleme ve test adımları (`npm run typecheck`, `npm run build`, `npm test`) bu yüzden yerel ortamda ve GitHub Actions'ta çalıştırılıyor.

## Bu süreçten çıkardıklarım

- **Modelleri ayrı rollerde kullanmak işe yarıyor.** Belgeyi yazan model kendi hatasını görmekte zorlanıyor; ikinci bir modelin hakemlik yapması şartnamenin kalitesini belirgin şekilde artırdı.
- **Puan eşiği koda geçmeden önce net bir kalite kapısı oluşturdu.** Yine de hakemden geçmiş bir belgede bile kod yazılırken hatalar çıktı; şartname tek başına yeterli değil.
- **Küçük adımlar ve adım adım onay**, hataları yakalamayı ve her kararın gerekçesini görmeyi kolaylaştırdı.
- **Testlerin geçmesi kullanılabilirlik anlamına gelmiyor.** Ana sayfaya dönüş, mobil menü ve randevu aralığı gibi sorunları hiçbir test yakalamadı; bunlar uygulamayı kendim kullanınca ortaya çıktı.
- **Yapay zekânın neyi doğrulayıp neyi doğrulayamadığını bilmek önemli.** "Çalışıyor" demek yerine neyin gerçekten çalıştırıldığını sormak, hangi adımları kendim doğrulamam gerektiğini netleştirdi.
