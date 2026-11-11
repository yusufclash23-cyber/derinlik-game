import type { L10n } from "./config";

export type Lang = "tr" | "en";
const dict = {
  tr: {
    camp: "Kamp", mine: "Maden", equip: "Ekipman", discoveries: "Keşifler", social: "Sosyal",
    subtitle: "Her kazı yeni bir tehlikeyi açığa çıkarır.", start: "Seferi Başlat", sell: "Sat", sellAll: "Hepsini Sat",
    upgrade: "Yükselt", build: "İnşa Et", craft: "Üret", equipBtn: "Kuşan", equipped: "Kuşanıldı", close: "Kapat", back: "Geri",
    oxygen: "Oksijen", health: "Sağlık", energy: "Enerji", pack: "Çanta", depth: "Derinlik", dig: "KAZ", attack: "VUR", dodge: "KAÇ",
    extract: "ÇIKIŞ", settings: "Ayarlar", music: "Müzik", sfx: "Ses Efektleri", quality: "Grafik Kalitesi", language: "Dil",
    coins: "Altın", level: "Seviye", stash: "Depo", missions: "Görevler", daily: "Günlük", weekly: "Haftalık", achievements: "Başarımlar",
    claim: "Ödülü Al", claimed: "Alındı", loading: "Yükleniyor…", offline: "Çevrimdışı", online: "Çevrimiçi", locked: "Kilitli",
    confirm: "Onayla", cancel: "Vazgeç", maxLevel: "Maks. seviye", cost: "Maliyet", free: "Ücretsiz", developer: "Geliştirici",
    expedition: "Sefer", biome: "Bölge", seed: "Tohum", newSeed: "Yeni Harita", resumeHint: "Kaydın otomatik tutulur.",
    victory: "Başarılı Çıkış", defeat: "Seferde Düştün", continue: "Devam", tapToStart: "Başlamak için dokun",
    collection: "Koleksiyon", records: "Kayıtlar", history: "Sefer Geçmişi", share: "Paylaş", download: "İndir",
  },
  en: {
    camp: "Camp", mine: "Mine", equip: "Gear", discoveries: "Discoveries", social: "Social",
    subtitle: "Every dig reveals a new danger.", start: "Start Expedition", sell: "Sell", sellAll: "Sell All",
    upgrade: "Upgrade", build: "Build", craft: "Craft", equipBtn: "Equip", equipped: "Equipped", close: "Close", back: "Back",
    oxygen: "Oxygen", health: "Health", energy: "Energy", pack: "Pack", depth: "Depth", dig: "DIG", attack: "HIT", dodge: "DODGE",
    extract: "EXIT", settings: "Settings", music: "Music", sfx: "Sound FX", quality: "Graphics Quality", language: "Language",
    coins: "Gold", level: "Level", stash: "Stash", missions: "Missions", daily: "Daily", weekly: "Weekly", achievements: "Achievements",
    claim: "Claim", claimed: "Claimed", loading: "Loading…", offline: "Offline", online: "Online", locked: "Locked",
    confirm: "Confirm", cancel: "Cancel", maxLevel: "Max level", cost: "Cost", free: "Free", developer: "Developer",
    expedition: "Expedition", biome: "Region", seed: "Seed", newSeed: "New Map", resumeHint: "Progress is saved automatically.",
    victory: "Successful Extraction", defeat: "You Fell", continue: "Continue", tapToStart: "Tap to start",
    collection: "Collection", records: "Records", history: "Expedition History", share: "Share", download: "Download",
  },
} as const;
export type Key = keyof typeof dict.tr;
export const tr = (lang: Lang, k: Key): string => dict[lang][k] ?? dict.tr[k];
export const pick = (lang: Lang, l: L10n): string => l[lang] ?? l.tr;
