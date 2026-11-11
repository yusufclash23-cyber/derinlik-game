"use client";
import dynamic from "next/dynamic";

// The game is WebGL + localStorage + WebAudio: client-only.
const GameApp = dynamic(() => import("../ui/GameApp"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 flex items-center justify-center bg-[#0a0c18] text-amber-200">DERİNLİK yükleniyor…</div>,
});

export default function GameLoader() {
  return <GameApp />;
}
