// Statik (APK) derleme: API/DB kısımlarını geçici olarak kenara alır, `next build` (output: export) çalıştırır, geri koyar.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";

const stash = ".mobile-stash";
const items = ["src/app/api", "src/server", "src/db", "tests"];
const moved = [];

function restore() {
  for (const it of moved.reverse()) renameSync(`${stash}/${it.replaceAll("/", "__")}`, it);
  if (existsSync(stash)) rmSync(stash, { recursive: true, force: true });
}
process.on("SIGINT", () => { restore(); process.exit(130); });

mkdirSync(stash, { recursive: true });
for (const it of items) {
  if (existsSync(it)) { renameSync(it, `${stash}/${it.replaceAll("/", "__")}`); moved.push(it); }
}
let code = 1;
try {
  rmSync("out", { recursive: true, force: true });
  const r = spawnSync("npx", ["next", "build"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, BUILD_TARGET: "mobile", NEXT_PUBLIC_MOBILE: "1" },
  });
  code = r.status ?? 1;
} finally {
  restore();
}
process.exit(code);
