import type { NextConfig } from "next";

const mobile = process.env.BUILD_TARGET === "mobile";

const nextConfig: NextConfig = mobile
  ? // Capacitor APK: statik dışa aktarım (sunucu/API yok, oyun çevrimdışı çalışır)
    { output: "export", images: { unoptimized: true } }
  : {
      // APK içindeki uygulama (https://localhost) ayrı bir sunucudaki API'yi çağırabilsin diye CORS.
      // Kimlik doğrulama çerezle değil Bearer token ile olduğu için "*" güvenlidir.
      async headers() {
        return [
          {
            source: "/api/:path*",
            headers: [
              { key: "Access-Control-Allow-Origin", value: "*" },
              { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
              { key: "Access-Control-Allow-Headers", value: "authorization,content-type" },
            ],
          },
        ];
      },
    };

export default nextConfig;
