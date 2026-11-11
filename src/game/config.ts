/**
 * DERİNLİK — configuration-driven game data.
 * Everything here is plain data (no DOM / React) so it is shared by the client,
 * the server validators and the unit tests.
 */

export type L10n = { tr: string; en: string };
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
export const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#b8b2a7",
  uncommon: "#6fd36f",
  rare: "#4aa3ff",
  epic: "#b565ff",
  legendary: "#ffb938",
  mythic: "#ff4f7a",
};
export const RARITY_NAME: Record<Rarity, L10n> = {
  common: { tr: "Yaygın", en: "Common" },
  uncommon: { tr: "Nadir Olmayan", en: "Uncommon" },
  rare: { tr: "Nadir", en: "Rare" },
  epic: { tr: "Epik", en: "Epic" },
  legendary: { tr: "Efsanevi", en: "Legendary" },
  mythic: { tr: "Mitik", en: "Mythic" },
};
export const rarityIdx = (r: Rarity) => RARITIES.indexOf(r);

/* ------------------------------ Resources ------------------------------ */
export type ResourceId =
  | "stone" | "coal" | "copper" | "iron" | "blueCrystal" | "emerald" | "gold" | "ruby"
  | "volcanicStone" | "diamond" | "ancientMetal" | "relic" | "ancientCrystal" | "heartCrystal"
  | "mythicCore" | "copperIngot" | "ironIngot" | "goldIngot";

export type ResourceKind = "ore" | "crystal" | "gem" | "relic" | "ingot";

export interface ResourceDef {
  id: ResourceId;
  name: L10n;
  rarity: Rarity;
  kind: ResourceKind;
  value: number; // base market value
  weight: number; // backpack units per item
  color: string;
  glow: number; // emissive intensity of the deposit
  toolLevel: number; // required tool level
  durability: number; // deposit durability
  hardness: number; // reduces mining damage
  qty: [number, number];
  mineable: boolean;
  use: L10n; // crafting / upgrade usage
}

const R = (d: ResourceDef) => d;
export const RESOURCES: Record<ResourceId, ResourceDef> = {
  stone: R({ id: "stone", name: { tr: "Taş", en: "Stone" }, rarity: "common", kind: "ore", value: 3, weight: 2, color: "#8a8680", glow: 0, toolLevel: 0, durability: 28, hardness: 1, qty: [2, 4], mineable: true, use: { tr: "Bina inşaatı", en: "Construction" } }),
  coal: R({ id: "coal", name: { tr: "Kömür", en: "Coal" }, rarity: "common", kind: "ore", value: 6, weight: 1, color: "#262626", glow: 0.05, toolLevel: 0, durability: 35, hardness: 1, qty: [2, 4], mineable: true, use: { tr: "Fırın yakıtı, kazma", en: "Furnace fuel, pickaxes" } }),
  copper: R({ id: "copper", name: { tr: "Bakır", en: "Copper" }, rarity: "common", kind: "ore", value: 10, weight: 1, color: "#d9803f", glow: 0.15, toolLevel: 0, durability: 42, hardness: 2, qty: [1, 3], mineable: true, use: { tr: "Ekipman, ocak", en: "Gear, furnace" } }),
  iron: R({ id: "iron", name: { tr: "Demir", en: "Iron" }, rarity: "uncommon", kind: "ore", value: 14, weight: 1.5, color: "#a9b4c2", glow: 0.1, toolLevel: 1, durability: 63, hardness: 3, qty: [1, 3], mineable: true, use: { tr: "Zırh, kazma, külçe", en: "Armor, pickaxes, ingots" } }),
  blueCrystal: R({ id: "blueCrystal", name: { tr: "Mavi Kristal", en: "Blue Crystal" }, rarity: "uncommon", kind: "crystal", value: 30, weight: 1, color: "#46b8ff", glow: 1.4, toolLevel: 2, durability: 84, hardness: 4, qty: [1, 3], mineable: true, use: { tr: "Kristal ekipman", en: "Crystal gear" } }),
  emerald: R({ id: "emerald", name: { tr: "Zümrüt", en: "Emerald" }, rarity: "rare", kind: "gem", value: 60, weight: 1, color: "#2ee08a", glow: 1.2, toolLevel: 2, durability: 112, hardness: 5, qty: [1, 2], mineable: true, use: { tr: "Laboratuvar, eldiven", en: "Lab, gloves" } }),
  gold: R({ id: "gold", name: { tr: "Altın", en: "Gold" }, rarity: "rare", kind: "ore", value: 55, weight: 1.5, color: "#ffc93c", glow: 0.5, toolLevel: 2, durability: 120, hardness: 5, qty: [1, 3], mineable: true, use: { tr: "Altın külçe, yükseltmeler", en: "Gold ingots, upgrades" } }),
  ruby: R({ id: "ruby", name: { tr: "Yakut", en: "Ruby" }, rarity: "epic", kind: "gem", value: 90, weight: 1, color: "#ff3355", glow: 1.3, toolLevel: 3, durability: 154, hardness: 6, qty: [1, 2], mineable: true, use: { tr: "Magma ekipmanı", en: "Magma gear" } }),
  volcanicStone: R({ id: "volcanicStone", name: { tr: "Volkanik Taş", en: "Volcanic Stone" }, rarity: "uncommon", kind: "ore", value: 25, weight: 2, color: "#5a2a22", glow: 0.7, toolLevel: 2, durability: 105, hardness: 4, qty: [2, 3], mineable: true, use: { tr: "Isıya dayanıklı zırh", en: "Heat-proof armor" } }),
  diamond: R({ id: "diamond", name: { tr: "Elmas", en: "Diamond" }, rarity: "epic", kind: "gem", value: 160, weight: 1, color: "#d9f6ff", glow: 1.0, toolLevel: 3, durability: 224, hardness: 8, qty: [1, 2], mineable: true, use: { tr: "Matkap, üst düzey ekipman", en: "Drill, top-tier gear" } }),
  ancientMetal: R({ id: "ancientMetal", name: { tr: "Antik Metal", en: "Ancient Metal" }, rarity: "rare", kind: "ore", value: 120, weight: 2, color: "#c9a56a", glow: 0.6, toolLevel: 3, durability: 210, hardness: 7, qty: [1, 3], mineable: true, use: { tr: "Matkap, antik teknoloji", en: "Drill, ancient tech" } }),
  relic: R({ id: "relic", name: { tr: "Antik Kalıntı", en: "Ancient Relic" }, rarity: "epic", kind: "relic", value: 220, weight: 3, color: "#8affd4", glow: 1.2, toolLevel: 3, durability: 245, hardness: 6, qty: [1, 1], mineable: true, use: { tr: "Karargâh yükseltmeleri", en: "HQ upgrades" } }),
  ancientCrystal: R({ id: "ancientCrystal", name: { tr: "Antik Kristal", en: "Ancient Crystal" }, rarity: "legendary", kind: "crystal", value: 350, weight: 2, color: "#ffb04a", glow: 1.8, toolLevel: 4, durability: 336, hardness: 9, qty: [1, 2], mineable: true, use: { tr: "Efsanevi fener", en: "Legendary lantern" } }),
  heartCrystal: R({ id: "heartCrystal", name: { tr: "Antik Kalp Kristali", en: "Ancient Heart Crystal" }, rarity: "legendary", kind: "crystal", value: 2500, weight: 4, color: "#ff6a3d", glow: 2.4, toolLevel: 4, durability: 630, hardness: 10, qty: [1, 1], mineable: true, use: { tr: "Efsanevi keşif eseri", en: "Legendary artifact" } }),
  mythicCore: R({ id: "mythicCore", name: { tr: "Mitik Çekirdek", en: "Mythic Core" }, rarity: "mythic", kind: "crystal", value: 1500, weight: 4, color: "#ff4fd8", glow: 2.6, toolLevel: 4, durability: 840, hardness: 10, qty: [1, 1], mineable: true, use: { tr: "Mitik eserler", en: "Mythic artifacts" } }),
  copperIngot: R({ id: "copperIngot", name: { tr: "Bakır Külçe", en: "Copper Ingot" }, rarity: "uncommon", kind: "ingot", value: 40, weight: 1, color: "#e6955a", glow: 0, toolLevel: 0, durability: 1, hardness: 0, qty: [1, 1], mineable: false, use: { tr: "Ekipman üretimi", en: "Crafting" } }),
  ironIngot: R({ id: "ironIngot", name: { tr: "Demir Külçe", en: "Iron Ingot" }, rarity: "uncommon", kind: "ingot", value: 55, weight: 1, color: "#c7d0db", glow: 0, toolLevel: 0, durability: 1, hardness: 0, qty: [1, 1], mineable: false, use: { tr: "Çelik ekipman", en: "Steel gear" } }),
  goldIngot: R({ id: "goldIngot", name: { tr: "Altın Külçe", en: "Gold Ingot" }, rarity: "rare", kind: "ingot", value: 190, weight: 1, color: "#ffd75e", glow: 0, toolLevel: 0, durability: 1, hardness: 0, qty: [1, 1], mineable: false, use: { tr: "Üst düzey ekipman", en: "Top-tier gear" } }),
};
export const RESOURCE_IDS = Object.keys(RESOURCES) as ResourceId[];

export interface SmeltRecipe { id: string; out: ResourceId; input: ResourceId; need: number; coal: number }
export const SMELT: SmeltRecipe[] = [
  { id: "copperIngot", out: "copperIngot", input: "copper", need: 3, coal: 1 },
  { id: "ironIngot", out: "ironIngot", input: "iron", need: 3, coal: 1 },
  { id: "goldIngot", out: "goldIngot", input: "gold", need: 3, coal: 2 },
];

/* ------------------------------ Tools ------------------------------ */
export interface ToolDef {
  id: string; name: L10n; level: number; power: number; speed: number; energy: number;
  rarity: Rarity; bonus: L10n; yieldBonus: number; // chance of +1 item on break
  cost: Cost; color: string;
}
export type Cost = { coins: number; res?: Partial<Record<ResourceId, number>> };
export const TOOLS: ToolDef[] = [
  { id: "pick_basic", name: { tr: "Temel Kazma", en: "Basic Pickaxe" }, level: 0, power: 10, speed: 1.6, energy: 2, rarity: "common", bonus: { tr: "Başlangıç aleti", en: "Starter tool" }, yieldBonus: 0, cost: { coins: 0 }, color: "#8b6b45" },
  { id: "pick_iron", name: { tr: "Demir Kazma", en: "Iron Pickaxe" }, level: 1, power: 16, speed: 1.8, energy: 2.2, rarity: "uncommon", bonus: { tr: "Demir damarlarını kırar", en: "Breaks iron veins" }, yieldBonus: 0.05, cost: { coins: 60, res: { copper: 10, coal: 5 } }, color: "#aab4c0" },
  { id: "pick_steel", name: { tr: "Çelik Kazma", en: "Steel Pickaxe" }, level: 2, power: 26, speed: 2.0, energy: 2.5, rarity: "rare", bonus: { tr: "Kristal ve altın kazar", en: "Mines crystal and gold" }, yieldBonus: 0.1, cost: { coins: 450, res: { ironIngot: 8, coal: 12 } }, color: "#6ea0d8" },
  { id: "pick_crystal", name: { tr: "Kristal Kazma", en: "Crystal Pickaxe" }, level: 3, power: 38, speed: 2.2, energy: 2.8, rarity: "epic", bonus: { tr: "+%20 ekstra kaynak şansı", en: "+20% bonus-yield chance" }, yieldBonus: 0.2, cost: { coins: 1800, res: { blueCrystal: 12, emerald: 4, ironIngot: 6 } }, color: "#46d8ff" },
  { id: "drill_adv", name: { tr: "Gelişmiş Matkap", en: "Advanced Drill" }, level: 4, power: 55, speed: 3.2, energy: 3.5, rarity: "legendary", bonus: { tr: "Çok hızlı, enerji açtır", en: "Very fast, energy hungry" }, yieldBonus: 0.25, cost: { coins: 7000, res: { ancientMetal: 10, diamond: 4, goldIngot: 6 } }, color: "#ffb04a" },
];
export const TOOL_BY_ID: Record<string, ToolDef> = Object.fromEntries(TOOLS.map((t) => [t.id, t]));

/* ------------------------------ Equipment ------------------------------ */
export type Slot = "helmet" | "armor" | "backpack" | "gloves" | "boots" | "lantern";
export const SLOTS: Slot[] = ["helmet", "armor", "backpack", "gloves", "boots", "lantern"];
export const SLOT_NAME: Record<Slot, L10n> = {
  helmet: { tr: "Kask", en: "Helmet" }, armor: { tr: "Zırh", en: "Armor" }, backpack: { tr: "Çanta", en: "Backpack" },
  gloves: { tr: "Eldiven", en: "Gloves" }, boots: { tr: "Bot", en: "Boots" }, lantern: { tr: "Fener", en: "Lantern" },
};
export interface StatBlock {
  oxygen?: number; armor?: number; capacity?: number; speed?: number; power?: number;
  miningSpeed?: number; energy?: number; light?: number; heat?: number; hp?: number;
}
export interface GearDef { id: string; slot: Slot; tier: number; name: L10n; rarity: Rarity; stats: StatBlock; cost: Cost }
const G = (id: string, slot: Slot, tier: number, tr: string, en: string, stats: StatBlock, cost: Cost): GearDef => ({
  id, slot, tier, name: { tr, en }, rarity: RARITIES[tier], stats, cost,
});
export const GEAR: GearDef[] = [
  G("helmet0", "helmet", 0, "Eski Baret", "Old Hardhat", {}, { coins: 0 }),
  G("helmet1", "helmet", 1, "Çelik Kask", "Steel Helmet", { oxygen: 40, armor: 2 }, { coins: 150, res: { iron: 10, coal: 5 } }),
  G("helmet2", "helmet", 2, "Kristal Vizörlü Kask", "Crystal Visor Helm", { oxygen: 90, armor: 4, light: 1 }, { coins: 700, res: { ironIngot: 8, blueCrystal: 6 } }),
  G("helmet3", "helmet", 3, "Derin Dalgıç Kaskı", "Deep Diver Helm", { oxygen: 160, armor: 6, heat: 0.1 }, { coins: 3000, res: { goldIngot: 6, diamond: 3 } }),
  G("armor0", "armor", 0, "İş Tulumu", "Work Overalls", {}, { coins: 0 }),
  G("armor1", "armor", 1, "Deri Zırh", "Leather Armor", { armor: 5, hp: 10 }, { coins: 200, res: { iron: 12, copper: 10 } }),
  G("armor2", "armor", 2, "Takviyeli Zırh", "Reinforced Armor", { armor: 10, hp: 25, heat: 0.15 }, { coins: 900, res: { ironIngot: 10, emerald: 4 } }),
  G("armor3", "armor", 3, "Magma Zırhı", "Magma Plate", { armor: 16, hp: 45, heat: 0.4 }, { coins: 3500, res: { volcanicStone: 20, ruby: 4 } }),
  G("backpack0", "backpack", 0, "Küçük Çanta", "Small Pack", {}, { coins: 0 }),
  G("backpack1", "backpack", 1, "Büyük Sırt Çantası", "Large Rucksack", { capacity: 20 }, { coins: 120, res: { copper: 12, stone: 10 } }),
  G("backpack2", "backpack", 2, "Seyyah Çantası", "Wayfarer Pack", { capacity: 50 }, { coins: 600, res: { ironIngot: 6, blueCrystal: 5 } }),
  G("backpack3", "backpack", 3, "Yerçekimsiz Çanta", "Antigrav Pack", { capacity: 90 }, { coins: 2800, res: { ancientMetal: 6, gold: 6 } }),
  G("gloves0", "gloves", 0, "Pamuk Eldiven", "Cotton Gloves", {}, { coins: 0 }),
  G("gloves1", "gloves", 1, "Deri Eldiven", "Leather Gloves", { power: 0.08 }, { coins: 100, res: { copper: 8, coal: 4 } }),
  G("gloves2", "gloves", 2, "Takviyeli Eldiven", "Reinforced Gloves", { power: 0.16, miningSpeed: 0.05 }, { coins: 500, res: { ironIngot: 5, emerald: 3 } }),
  G("gloves3", "gloves", 3, "Titan Eldiven", "Titan Gauntlets", { power: 0.28, miningSpeed: 0.1, energy: 20 }, { coins: 2500, res: { diamond: 3, goldIngot: 4 } }),
  G("boots0", "boots", 0, "Eski Botlar", "Old Boots", {}, { coins: 0 }),
  G("boots1", "boots", 1, "Sağlam Bot", "Sturdy Boots", { speed: 0.06 }, { coins: 100, res: { iron: 8, stone: 10 } }),
  G("boots2", "boots", 2, "Dağcı Botu", "Climber Boots", { speed: 0.12, energy: 10 }, { coins: 500, res: { ironIngot: 5, blueCrystal: 4 } }),
  G("boots3", "boots", 3, "Rüzgâr Botu", "Windrunner Boots", { speed: 0.2, energy: 25 }, { coins: 2400, res: { ruby: 3, ancientMetal: 4 } }),
  G("lantern0", "lantern", 0, "Gaz Feneri", "Gas Lantern", {}, { coins: 0 }),
  G("lantern1", "lantern", 1, "Karbit Lambası", "Carbide Lamp", { light: 3 }, { coins: 90, res: { coal: 12, copper: 6 } }),
  G("lantern2", "lantern", 2, "Kristal Fener", "Crystal Lantern", { light: 6 }, { coins: 550, res: { blueCrystal: 8, ironIngot: 3 } }),
  G("lantern3", "lantern", 3, "Güneş Çekirdeği", "Sun Core", { light: 10 }, { coins: 2600, res: { ancientCrystal: 2, gold: 6 } }),
];
export const GEAR_BY_ID: Record<string, GearDef> = Object.fromEntries(GEAR.map((g) => [g.id, g]));
export const LANTERN_COLORS = ["#ffd9a0", "#ffe9b8", "#9fe0ff", "#fff4d0"];
export const SUIT_COLORS: { id: string; name: L10n; color: string }[] = [
  { id: "orange", name: { tr: "Turuncu", en: "Orange" }, color: "#e8751a" },
  { id: "teal", name: { tr: "Camgöbeği", en: "Teal" }, color: "#1fa59a" },
  { id: "crimson", name: { tr: "Kızıl", en: "Crimson" }, color: "#c2304a" },
  { id: "violet", name: { tr: "Mor", en: "Violet" }, color: "#7a52d6" },
];

/* ------------------------------ Biomes ------------------------------ */
export type CreatureId = "crawler" | "guardian" | "stalker" | "lavaBeast" | "sentinel";
export type PropKind = "beam" | "cart" | "barrel" | "crystal" | "pillar" | "shard" | "rockpile" | "lavarock";
export interface BiomeDef {
  id: string; index: number; name: L10n; minDepth: number; maxDepth: number;
  wall: string; floor: string; fog: string; ambient: string; accent: string;
  resources: { id: ResourceId; w: number }[];
  treasure: ResourceId[]; // hidden room / boss rewards
  creatures: CreatureId[]; boss: string;
  hazards: ("gas" | "lava" | "heat" | "trap" | "water")[];
  danger: number; oxygenDrain: number; props: PropKind[]; desc: L10n;
}
export const BIOMES: BiomeDef[] = [
  { id: "oldMines", index: 0, name: { tr: "Eski Madenler", en: "Old Mines" }, minDepth: 0, maxDepth: 500, wall: "#4a3f35", floor: "#2e2822", fog: "#0b0907", ambient: "#6b5a48", accent: "#ffb45a",
    resources: [{ id: "stone", w: 30 }, { id: "coal", w: 30 }, { id: "copper", w: 26 }, { id: "iron", w: 16 }],
    treasure: ["gold", "emerald"], creatures: ["crawler"], boss: "rustWarden", hazards: ["gas", "water"], danger: 1, oxygenDrain: 1,
    props: ["beam", "cart", "barrel", "rockpile"], desc: { tr: "Terk edilmiş tüneller, çürümüş destek kirişleri.", en: "Abandoned tunnels and rotting supports." } },
  { id: "crystalCaverns", index: 1, name: { tr: "Kristal Mağaralar", en: "Crystal Caverns" }, minDepth: 500, maxDepth: 1500, wall: "#26325a", floor: "#161c33", fog: "#05081a", ambient: "#4a5fb0", accent: "#46b8ff",
    resources: [{ id: "blueCrystal", w: 38 }, { id: "emerald", w: 20 }, { id: "iron", w: 14 }, { id: "copper", w: 10 }, { id: "gold", w: 10 }, { id: "diamond", w: 3 }],
    treasure: ["diamond", "ruby"], creatures: ["crawler", "guardian", "stalker"], boss: "crystalColossus", hazards: ["gas", "water"], danger: 1.5, oxygenDrain: 1.15,
    props: ["crystal", "crystal", "rockpile", "shard"], desc: { tr: "Parlayan kristaller ve geniş odalar.", en: "Glowing crystals and vast chambers." } },
  { id: "lavaPits", index: 2, name: { tr: "Lav Çukurları", en: "Lava Pits" }, minDepth: 1500, maxDepth: 2500, wall: "#3a1a14", floor: "#22100c", fog: "#160603", ambient: "#a04a22", accent: "#ff6a2a",
    resources: [{ id: "gold", w: 30 }, { id: "ruby", w: 18 }, { id: "volcanicStone", w: 36 }, { id: "diamond", w: 6 }],
    treasure: ["diamond", "ancientMetal"], creatures: ["lavaBeast", "crawler"], boss: "magmaTitan", hazards: ["lava", "heat", "gas"], danger: 2, oxygenDrain: 1.3,
    props: ["lavarock", "rockpile", "shard"], desc: { tr: "Lav nehirleri ve kavurucu sıcaklık.", en: "Lava rivers and scorching heat." } },
  { id: "lostCivilization", index: 3, name: { tr: "Kayıp Medeniyet", en: "Lost Civilization" }, minDepth: 2500, maxDepth: 4000, wall: "#3b3a30", floor: "#23221c", fog: "#0a0a07", ambient: "#8a8450", accent: "#8affd4",
    resources: [{ id: "ancientMetal", w: 34 }, { id: "relic", w: 18 }, { id: "ancientCrystal", w: 12 }, { id: "gold", w: 16 }],
    treasure: ["ancientCrystal", "heartCrystal"], creatures: ["sentinel", "stalker"], boss: "primeSentinel", hazards: ["trap", "gas"], danger: 2.6, oxygenDrain: 1.45,
    props: ["pillar", "pillar", "shard", "rockpile"], desc: { tr: "Tuzaklı antik şehirler ve mekanik muhafızlar.", en: "Trapped ancient cities and mechanical guardians." } },
  { id: "endlessAbyss", index: 4, name: { tr: "Sonsuz Uçurum", en: "Endless Abyss" }, minDepth: 4000, maxDepth: 5500, wall: "#1d1030", floor: "#10081c", fog: "#05020c", ambient: "#6a3aa0", accent: "#ff4fd8",
    resources: [{ id: "ancientCrystal", w: 30 }, { id: "mythicCore", w: 8 }, { id: "diamond", w: 25 }, { id: "heartCrystal", w: 3 }],
    treasure: ["mythicCore", "heartCrystal"], creatures: ["stalker", "sentinel", "lavaBeast"], boss: "abyssMaw", hazards: ["gas", "trap", "heat"], danger: 3.4, oxygenDrain: 1.7,
    props: ["shard", "shard", "crystal", "pillar"], desc: { tr: "Bilinmeyen mineraller, ölümcül düşmanlar.", en: "Unknown minerals and deadly enemies." } },
];

/* ------------------------------ Creatures ------------------------------ */
export interface CreatureDef {
  id: string; model: CreatureId; name: L10n; hp: number; damage: number; speed: number;
  detect: number; range: number; windup: number; cooldown: number; radius: number;
  scale: number; tint: string; coins: number; xp: number; boss?: boolean;
  loot: { res: ResourceId; chance: number; qty: [number, number] }[];
}
const C = (c: CreatureDef) => c;
export const CREATURES: Record<string, CreatureDef> = {
  crawler: C({ id: "crawler", model: "crawler", name: { tr: "Mağara Sürüngeni", en: "Cave Crawler" }, hp: 30, damage: 8, speed: 4.6, detect: 11, range: 1.6, windup: 0.25, cooldown: 0.9, radius: 0.6, scale: 1, tint: "#6b4a2e", coins: 6, xp: 4, loot: [{ res: "coal", chance: 0.5, qty: [1, 2] }, { res: "copper", chance: 0.2, qty: [1, 1] }] }),
  guardian: C({ id: "guardian", model: "guardian", name: { tr: "Kristal Muhafız", en: "Crystal Guardian" }, hp: 95, damage: 14, speed: 2.8, detect: 10, range: 2.2, windup: 0.6, cooldown: 1.6, radius: 0.9, scale: 1, tint: "#46b8ff", coins: 25, xp: 15, loot: [{ res: "blueCrystal", chance: 0.8, qty: [1, 2] }, { res: "emerald", chance: 0.2, qty: [1, 1] }] }),
  stalker: C({ id: "stalker", model: "stalker", name: { tr: "Gölge Avcısı", en: "Shadow Stalker" }, hp: 60, damage: 17, speed: 4.2, detect: 13, range: 1.9, windup: 0.4, cooldown: 1.2, radius: 0.6, scale: 1, tint: "#1a1424", coins: 30, xp: 18, loot: [{ res: "diamond", chance: 0.1, qty: [1, 1] }, { res: "blueCrystal", chance: 0.3, qty: [1, 1] }] }),
  lavaBeast: C({ id: "lavaBeast", model: "lavaBeast", name: { tr: "Lav Canavarı", en: "Lava Beast" }, hp: 170, damage: 24, speed: 3.4, detect: 11, range: 2.4, windup: 0.7, cooldown: 1.7, radius: 1.1, scale: 1, tint: "#3a1510", coins: 60, xp: 35, loot: [{ res: "volcanicStone", chance: 0.8, qty: [1, 3] }, { res: "ruby", chance: 0.25, qty: [1, 1] }] }),
  sentinel: C({ id: "sentinel", model: "sentinel", name: { tr: "Antik Nöbetçi", en: "Ancient Sentinel" }, hp: 230, damage: 28, speed: 3.0, detect: 12, range: 2.6, windup: 0.8, cooldown: 1.9, radius: 1.0, scale: 1, tint: "#c9a56a", coins: 90, xp: 50, loot: [{ res: "ancientMetal", chance: 0.8, qty: [1, 2] }, { res: "relic", chance: 0.12, qty: [1, 1] }] }),
  rustWarden: C({ id: "rustWarden", model: "sentinel", name: { tr: "Paslı Muhafız (Patron)", en: "Rust Warden (Boss)" }, hp: 520, damage: 22, speed: 3.2, detect: 22, range: 3.2, windup: 0.7, cooldown: 1.6, radius: 1.8, scale: 2.1, tint: "#a5542a", coins: 250, xp: 150, boss: true, loot: [{ res: "iron", chance: 1, qty: [3, 5] }, { res: "gold", chance: 0.7, qty: [1, 3] }] }),
  crystalColossus: C({ id: "crystalColossus", model: "guardian", name: { tr: "Kristal Devi (Patron)", en: "Crystal Colossus (Boss)" }, hp: 900, damage: 30, speed: 3.0, detect: 22, range: 3.4, windup: 0.7, cooldown: 1.5, radius: 1.9, scale: 2.3, tint: "#46b8ff", coins: 600, xp: 300, boss: true, loot: [{ res: "diamond", chance: 0.8, qty: [1, 2] }, { res: "emerald", chance: 1, qty: [2, 4] }] }),
  magmaTitan: C({ id: "magmaTitan", model: "lavaBeast", name: { tr: "Magma Titanı (Patron)", en: "Magma Titan (Boss)" }, hp: 1500, damage: 40, speed: 3.4, detect: 22, range: 3.6, windup: 0.7, cooldown: 1.4, radius: 2.1, scale: 2.1, tint: "#ff5a1e", coins: 1200, xp: 500, boss: true, loot: [{ res: "ruby", chance: 1, qty: [2, 4] }, { res: "diamond", chance: 0.8, qty: [1, 3] }] }),
  primeSentinel: C({ id: "primeSentinel", model: "sentinel", name: { tr: "Baş Nöbetçi (Patron)", en: "Prime Sentinel (Boss)" }, hp: 2400, damage: 55, speed: 3.4, detect: 24, range: 3.8, windup: 0.6, cooldown: 1.3, radius: 2.2, scale: 2.4, tint: "#8affd4", coins: 2500, xp: 900, boss: true, loot: [{ res: "heartCrystal", chance: 0.35, qty: [1, 1] }, { res: "ancientCrystal", chance: 1, qty: [1, 3] }] }),
  abyssMaw: C({ id: "abyssMaw", model: "stalker", name: { tr: "Uçurum Ağzı (Patron)", en: "Abyss Maw (Boss)" }, hp: 3600, damage: 70, speed: 4.0, detect: 26, range: 4, windup: 0.5, cooldown: 1.2, radius: 2.4, scale: 3, tint: "#ff4fd8", coins: 5000, xp: 1800, boss: true, loot: [{ res: "mythicCore", chance: 0.5, qty: [1, 1] }, { res: "heartCrystal", chance: 0.6, qty: [1, 1] }] }),
};

/* ------------------------------ Camp ------------------------------ */
export type BuildingId = "hq" | "workshop" | "furnace" | "warehouse" | "lab" | "trading" | "elevator" | "medical";
export const BUILDING_IDS: BuildingId[] = ["hq", "workshop", "furnace", "warehouse", "lab", "trading", "elevator", "medical"];
export interface BuildingDef { id: BuildingId; name: L10n; desc: L10n; initial: number; levels: Cost[] }
const K = (coins: number, res?: Cost["res"]): Cost => ({ coins, res });
export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  hq: { id: "hq", name: { tr: "Ana Karargâh", en: "Headquarters" }, desc: { tr: "Kamp seviyesini belirler; diğer binaların seviye sınırını açar.", en: "Sets camp level and caps other buildings." }, initial: 1,
    levels: [K(0), K(600, { copper: 20, iron: 15 }), K(2000, { blueCrystal: 15, emerald: 6 }), K(6000, { ruby: 8, gold: 20 }), K(15000, { ancientMetal: 15, relic: 6 })] },
  workshop: { id: "workshop", name: { tr: "Atölye", en: "Workshop" }, desc: { tr: "Alet ve ekipman üretir. Seviye = üretilebilir kademe.", en: "Crafts tools and gear. Level = craftable tier." }, initial: 1,
    levels: [K(0), K(300, { iron: 20, coal: 15 }), K(1200, { blueCrystal: 10, ironIngot: 10 }), K(5000, { ruby: 6, goldIngot: 8 })] },
  furnace: { id: "furnace", name: { tr: "Eritme Ocağı", en: "Smelting Furnace" }, desc: { tr: "Cevherleri külçeye dönüştürür.", en: "Refines ore into ingots." }, initial: 0,
    levels: [K(150, { stone: 20, copper: 10 }), K(800, { iron: 30, coal: 30 }), K(3000, { blueCrystal: 12, ironIngot: 10 })] },
  warehouse: { id: "warehouse", name: { tr: "Depo", en: "Warehouse" }, desc: { tr: "Her kaynak için depolama sınırını artırır.", en: "Raises per-resource storage cap." }, initial: 1,
    levels: [K(0), K(250, { stone: 30, iron: 10 }), K(1000, { blueCrystal: 8, ironIngot: 6 }), K(4000, { gold: 10, ruby: 4 })] },
  lab: { id: "lab", name: { tr: "Araştırma Laboratuvarı", en: "Research Lab" }, desc: { tr: "Teknolojilerin kilidini açar.", en: "Unlocks technologies." }, initial: 0,
    levels: [K(500, { copper: 20, coal: 20 }), K(1800, { blueCrystal: 12, emerald: 4 }), K(6000, { ruby: 6, diamond: 3 })] },
  trading: { id: "trading", name: { tr: "Ticaret İstasyonu", en: "Trading Station" }, desc: { tr: "Kaynakları satar; seviye başına +%5 fiyat.", en: "Sells resources; +5% price per level." }, initial: 1,
    levels: [K(0), K(400, { copper: 15, iron: 10 }), K(1600, { emerald: 6, gold: 5 }), K(5500, { diamond: 4, ruby: 6 })] },
  elevator: { id: "elevator", name: { tr: "Sefer Asansörü", en: "Expedition Elevator" }, desc: { tr: "Daha derin bölgelere erişim sağlar.", en: "Grants access to deeper regions." }, initial: 1,
    levels: [K(0), K(800, { iron: 25, ironIngot: 5 }), K(3500, { blueCrystal: 20, emerald: 8 }), K(9000, { ruby: 10, gold: 15 }), K(20000, { relic: 8, ancientMetal: 20 })] },
  medical: { id: "medical", name: { tr: "Sağlık İstasyonu", en: "Medical Station" }, desc: { tr: "Maks. sağlığı artırır, sefer malzemesi satar.", en: "Raises max HP, sells supplies." }, initial: 0,
    levels: [K(300, { copper: 15, coal: 10 }), K(1500, { emerald: 5, iron: 20 }), K(5000, { ruby: 5, gold: 10 })] },
};

export interface TechDef { id: string; name: L10n; desc: L10n; lab: number; cost: Cost; requires?: string }
export const TECHS: TechDef[] = [
  { id: "oxy1", name: { tr: "Verimli Solunum I", en: "Efficient Breathing I" }, desc: { tr: "+%10 maksimum oksijen", en: "+10% max oxygen" }, lab: 1, cost: K(150, { copper: 10 }) },
  { id: "energy1", name: { tr: "Enerji Hücresi I", en: "Energy Cell I" }, desc: { tr: "+20 maksimum enerji", en: "+20 max energy" }, lab: 1, cost: K(180, { copper: 12, coal: 10 }) },
  { id: "recover1", name: { tr: "Kayıp Çanta Telsizi I", en: "Lost-Pack Beacon I" }, desc: { tr: "Ölümde kurtarılabilir kayıp +%15", en: "+15% recoverable loot on death" }, lab: 1, cost: K(220, { iron: 12 }) },
  { id: "scan1", name: { tr: "Damar Tarayıcı I", en: "Vein Scanner I" }, desc: { tr: "Radar yakındaki damarları gösterir (25 m)", en: "Radar shows nearby veins (25 m)" }, lab: 1, cost: K(260, { iron: 10, copper: 10 }) },
  { id: "oxy2", name: { tr: "Verimli Solunum II", en: "Efficient Breathing II" }, desc: { tr: "+%10 oksijen daha", en: "+10% more oxygen" }, lab: 2, cost: K(900, { blueCrystal: 8 }), requires: "oxy1" },
  { id: "recover2", name: { tr: "Kayıp Çanta Telsizi II", en: "Lost-Pack Beacon II" }, desc: { tr: "Kurtarılabilir kayıp +%15 daha", en: "+15% more recoverable" }, lab: 2, cost: K(1000, { emerald: 4 }), requires: "recover1" },
  { id: "sell1", name: { tr: "Pazarlık Ustası", en: "Haggler" }, desc: { tr: "+%5 satış fiyatı", en: "+5% sell price" }, lab: 2, cost: K(1100, { gold: 6 }) },
  { id: "hazard1", name: { tr: "Tehlike Yalıtımı", en: "Hazard Insulation" }, desc: { tr: "Çevresel hasar -%25", en: "-25% environmental damage" }, lab: 2, cost: K(1300, { volcanicStone: 8, blueCrystal: 6 }) },
  { id: "scan2", name: { tr: "Damar Tarayıcı II", en: "Vein Scanner II" }, desc: { tr: "Radar menzili 50 m", en: "Radar range 50 m" }, lab: 3, cost: K(3500, { ruby: 4, diamond: 2 }), requires: "scan1" },
];

/* ------------------------------ Missions ------------------------------ */
export interface Reward { coins?: number; xp?: number; res?: Partial<Record<ResourceId, number>>; title?: string }
export interface MissionDef { id: string; kind: "daily" | "weekly" | "ach"; name: L10n; key: string; target: number; reward: Reward }
export const MAX_KEYS = new Set(["depth", "valueBest"]);
const M = (id: string, kind: MissionDef["kind"], tr: string, en: string, key: string, target: number, reward: Reward): MissionDef => ({ id, kind, name: { tr, en }, key, target, reward });
export const MISSIONS: MissionDef[] = [
  M("d_copper", "daily", "20 bakır damarı kaz", "Mine 20 copper deposits", "mine:copper", 20, { coins: 150, xp: 40 }),
  M("d_any", "daily", "30 maden damarı kaz", "Mine 30 deposits", "mine:any", 30, { coins: 120, xp: 30 }),
  M("d_kill", "daily", "8 yaratık yen", "Defeat 8 creatures", "kill:any", 8, { coins: 140, xp: 40 }),
  M("d_extract", "daily", "2 kez yüzeye çık", "Extract twice", "extract", 2, { coins: 100, xp: 30 }),
  M("d_depth", "daily", "250 metre derinliğe in", "Reach 250 m", "depth", 250, { coins: 130, xp: 35 }),
  M("d_hidden", "daily", "1 gizli oda keşfet", "Discover 1 hidden room", "hidden", 1, { coins: 200, xp: 50 }),
  M("w_value", "weekly", "Toplam 3000 değerinde kaynak çıkar", "Extract 3000 total value", "value", 3000, { coins: 800, xp: 200, res: { iron: 10 } }),
  M("w_boss", "weekly", "Bir patron yen", "Defeat a boss", "boss", 1, { coins: 1000, xp: 300 }),
  M("w_hidden", "weekly", "3 gizli oda keşfet", "Discover 3 hidden rooms", "hidden", 3, { coins: 900, xp: 250 }),
  M("w_guardian", "weekly", "Kristal Muhafız yen", "Defeat a Crystal Guardian", "kill:guardian", 1, { coins: 1000, xp: 300 }),
  M("w_depth", "weekly", "500 metreye ulaş", "Reach 500 m", "depth", 500, { coins: 900, xp: 250 }),
  M("a_first", "ach", "İlk Kazı", "First Dig", "mine:any", 1, { coins: 30, xp: 20, title: "Çırak" }),
  M("a_100", "ach", "100 damar kaz", "Mine 100 deposits", "mine:any", 100, { coins: 400, xp: 100, title: "Madenci" }),
  M("a_d500", "ach", "500 m'ye ulaş", "Reach 500 m", "depth", 500, { coins: 600, xp: 150, title: "Kristal Gezgini" }),
  M("a_d1500", "ach", "1500 m'ye ulaş", "Reach 1500 m", "depth", 1500, { coins: 2000, xp: 400, title: "Magma Yürüyücüsü" }),
  M("a_d2500", "ach", "2500 m'ye ulaş", "Reach 2500 m", "depth", 2500, { coins: 5000, xp: 800, title: "Medeniyet Bulucu" }),
  M("a_d4000", "ach", "4000 m'ye ulaş", "Reach 4000 m", "depth", 4000, { coins: 12000, xp: 1500, title: "Uçurum Gezgini" }),
  M("a_boss", "ach", "İlk patronu yen", "Defeat your first boss", "boss", 1, { coins: 500, xp: 200, title: "Muhafız Avcısı" }),
  M("a_value", "ach", "Tek seferde 10.000 değerinde çık", "Extract 10,000 value in one run", "valueBest", 10000, { coins: 3000, xp: 600, title: "Servet Avcısı" }),
  M("a_legend", "ach", "Efsanevi bir eser bul", "Find a legendary artifact", "legendary", 1, { coins: 4000, xp: 800, title: "Efsane Kâşif" }),
  M("a_hidden", "ach", "10 gizli oda keşfet", "Discover 10 hidden rooms", "hidden", 10, { coins: 1500, xp: 300, title: "Sır Bekçisi" }),
  M("a_collect", "ach", "8 farklı kaynak topla", "Collect 8 different resources", "distinct", 8, { coins: 1200, xp: 300, title: "Koleksiyoncu" }),
  M("a_drill", "ach", "Gelişmiş Matkap üret", "Craft the Advanced Drill", "craft:drill_adv", 1, { coins: 2500, xp: 500, title: "Matkap Ustası" }),
];
export const MISSION_BY_ID: Record<string, MissionDef> = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));

/* ------------------------------ Base numbers ------------------------------ */
export const BASE = {
  hp: 100, oxygen: 300, energy: 100, speed: 5.6, capacity: 30, light: 9, attack: 12,
  carryMedkit: 3, carryOxygen: 3, medkitCost: 30, oxygenCost: 25, recoverKeep: 0.25, recoverBase: 0.4,
  startCoins: 40,
};
export const MAX_RUN_SPEED = 9.5; // anti-cheat bound used by server validation (m/s incl. dash)
