# DERİNLİK → APK

## En kolay yol (GitHub ile, bilgisayara bir şey kurmadan)
1. GitHub'da yeni bir repo aç, bu klasörün içeriğini yükle (`.github` klasörü dahil).
2. Repo → **Actions** → **Android APK** → **Run workflow**.
3. ~5-10 dk sonra bitince run sayfasının altındaki **Artifacts → derinlik-apk** dosyasını indir, zip'ten `app-debug.apk` çıkar, telefona at ve kur
   (telefonda "bilinmeyen kaynaklardan yüklemeye izin ver" gerekir).

## Online özellikler (liderlik, arkadaş, parti, bulut kayıt)
APK varsayılan olarak **çevrimdışı** çalışır (kayıt telefonda). Online özellikler için sunucuyu (Node + PostgreSQL) HTTPS ile
deploy et, sonra repo → Settings → Secrets and variables → Actions → **Variables** → `API_BASE = https://sunucu-adresin` ekle ve workflow'u tekrar çalıştır.

## Kendi bilgisayarında
```
npm install
npm run build:mobile
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug      # APK: android/app/build/outputs/apk/debug/
```
(JDK 17 + Android SDK gerekir.)
