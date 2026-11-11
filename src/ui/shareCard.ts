import { RARITY_COLOR, RARITY_NAME, RESOURCES, BIOMES, type ResourceId } from "../game/config";
import type { Lang } from "../game/i18n";

export interface CardInfo { player: string; res: ResourceId; depth: number; biome: number; status: "first" | "recorded" | "pending" | "rejected"; at: number; lang: Lang }

/** Renders a 1080×1350 social-media discovery card with Canvas 2D (no external assets). */
export async function makeDiscoveryCard(c: CardInfo): Promise<Blob> {
  const W = 1080, H = 1350;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const x = cv.getContext("2d") as CanvasRenderingContext2D;
  const def = RESOURCES[c.res];
  const col = def.color, rc = RARITY_COLOR[def.rarity];
  const bg = x.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#07080f"); bg.addColorStop(1, "#150d18");
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W / 2, 560, 20, W / 2, 560, 620);
  glow.addColorStop(0, col + "cc"); glow.addColorStop(0.5, col + "33"); glow.addColorStop(1, "transparent");
  x.fillStyle = glow; x.fillRect(0, 0, W, H);
  // light rays
  x.save(); x.translate(W / 2, 560);
  for (let i = 0; i < 18; i++) { x.rotate((Math.PI * 2) / 18); x.fillStyle = col + "18"; x.beginPath(); x.moveTo(0, 0); x.lineTo(-40, -700); x.lineTo(40, -700); x.fill(); }
  x.restore();
  // crystal
  x.save(); x.translate(W / 2, 600);
  const facets: [number, number, number, number, number][] = [[0, -260, -120, 40, 0.9], [0, -260, 120, 40, 0.6], [-120, 40, 0, 220, 0.5], [120, 40, 0, 220, 0.8], [-120, 40, 120, 40, 0.35]];
  x.shadowColor = col; x.shadowBlur = 60;
  for (const [ax, ay, bx, by, a] of facets) {
    x.fillStyle = col; x.globalAlpha = a;
    x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.lineTo(0, 40); x.closePath(); x.fill();
  }
  x.restore(); x.globalAlpha = 1; x.shadowBlur = 0;
  x.textAlign = "center";
  const T = c.lang === "tr";
  const head = c.status === "first" ? (T ? "İLK KEŞİF!" : "FIRST DISCOVERY!") : c.status === "recorded" ? (T ? "KEŞİF KAYDI" : "DISCOVERY RECORD") : (T ? "YENİ KEŞİF" : "NEW DISCOVERY");
  x.fillStyle = "#ffd36a"; x.font = "900 96px system-ui, sans-serif"; x.fillText(head, W / 2, 190);
  x.fillStyle = rc; x.font = "700 40px system-ui, sans-serif"; x.fillText(RARITY_NAME[def.rarity][c.lang].toUpperCase(), W / 2, 250);
  x.fillStyle = "#fff"; x.font = "900 84px system-ui, sans-serif"; x.fillText(def.name[c.lang], W / 2, 960);
  x.font = "600 46px system-ui, sans-serif"; x.fillStyle = "#e8dcc8";
  x.fillText(`${T ? "Kâşif" : "Explorer"}: ${c.player}`, W / 2, 1040);
  x.fillText(`${T ? "Derinlik" : "Depth"}: ${c.depth.toLocaleString(T ? "tr-TR" : "en-US")} ${T ? "metre" : "meters"}`, W / 2, 1100);
  x.fillStyle = "#9fb0d8"; x.font = "500 34px system-ui, sans-serif";
  x.fillText(`${BIOMES[c.biome].name[c.lang]} · ${new Date(c.at).toLocaleDateString(T ? "tr-TR" : "en-US")}`, W / 2, 1160);
  x.fillStyle = c.status === "first" ? "#6fff9a" : "#8a93b0"; x.font = "600 28px system-ui, sans-serif";
  x.fillText(c.status === "first" ? (T ? "✔ Sunucu tarafından doğrulandı" : "✔ Verified by server") : c.status === "recorded" ? (T ? "Sunucuda kayıtlı" : "Recorded on server") : (T ? "Sunucu doğrulaması bekleniyor" : "Awaiting server verification"), W / 2, 1210);
  x.fillStyle = "#ffb45a"; x.font = "900 54px system-ui, sans-serif"; x.fillText("DERİNLİK", W / 2, 1290);
  x.fillStyle = "#7a7f96"; x.font = "500 24px system-ui, sans-serif"; x.fillText("Yusuf SERTKAYA", W / 2, 1325);
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/png"));
}

export async function shareOrDownload(blob: Blob, text: string, name = "derinlik-kesif.png"): Promise<"shared" | "downloaded"> {
  const file = new File([blob], name, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], text, title: "DERİNLİK" }); return "shared"; } catch { /* user cancelled -> fall through to download */ }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "downloaded";
}
