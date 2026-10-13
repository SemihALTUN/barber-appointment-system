// src/config/shop.ts — İşletme bilgileri.
// ÖNEMLİ: Aşağıdaki ad, adres, telefon ve hesaplar örnektir; yayına almadan önce gerçek bilgilerle değiştirin.
import type { DayHours } from "@/lib/shop-hours";

export interface ShopConfig {
  name: string;
  tagline: string;
  about: string;
  highlights: readonly string[];
  address: { street: string; district: string; city: string };
  phone: string; // tel: bağlantısı için E.164
  phoneDisplay: string;
  whatsapp: string; // wa.me için ülke koduyla, + olmadan
  instagram: string; // @ olmadan kullanıcı adı
  hours: readonly DayHours[];
}

export const SHOP: ShopConfig = {
  name: "Moda Berber",
  tagline: "Saç kesimi, sakal ve ustura tıraşı. Kadıköy Moda'da, randevulu ve beklemesiz.",
  about:
    "2012'den beri aynı köşede, aynı koltuklarda çalışıyoruz. Klasik kesimi de yeni modelleri de bilen ustalarımızla her müşteriye kendi saatini ayırıyoruz.",
  highlights: [
    "Sıcak havlu ve ustura ile klasik tıraş",
    "Her müşteriye yeni, tek kullanımlık jilet",
    "Randevulu çalışırız, sırada beklemezsiniz",
  ],
  address: { street: "Moda Caddesi No: 00", district: "Caferağa Mah., Kadıköy", city: "İstanbul" },
  phone: "+902160000000",
  phoneDisplay: "0216 000 00 00",
  whatsapp: "905000000000",
  instagram: "modaberber",
  hours: [
    { day: 1, open: "09:00", close: "21:00" },
    { day: 2, open: "09:00", close: "21:00" },
    { day: 3, open: "09:00", close: "21:00" },
    { day: 4, open: "09:00", close: "21:00" },
    { day: 5, open: "09:00", close: "21:00" },
    { day: 6, open: "09:00", close: "21:00" },
    { day: 0, open: "11:00", close: "21:00" },
  ],
};

export const SHOP_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${SHOP.name}, ${SHOP.address.street}, ${SHOP.address.district}, ${SHOP.address.city}`
)}`;
