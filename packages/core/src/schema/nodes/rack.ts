import dedent from 'dedent'
import { z } from 'zod'
import { BaseNode, nodeType, objectId } from '../base'

// ── Sub-schemas ──────────────────────────────────────────────────

// Pallet slot state: 0 = empty, 1 = occupied
const PalletSlot = z.number().int().min(0).max(1).default(0)

// Per-shelf override
const ShelfOverride = z.object({
  key: z.string(),
  emptyLevels: z.number().int().min(0).default(0),
  pallets: z.array(z.array(PalletSlot)).optional(),
})

export type ShelfOverride = z.infer<typeof ShelfOverride>

// ── Decking type ─────────────────────────────────────────────────
// Controls how the shelf surface is rendered
const DeckingType = z.enum([
  'none',         // Sadece kiriş — doğrudan palet oturtma
  'mdf',          // MDF/Sunta — kutu/parça ürünler için
  'wire-mesh',    // Tel ızgara — ağır/dökülme riskli ürünler
  'steel-panel',  // Çelik panel — ağır yükler
]).default('none')

export type DeckingType = z.infer<typeof DeckingType>

const LevelType = z.enum(['pallet', 'picking', 'empty']).default('pallet')
export type LevelType = z.infer<typeof LevelType>

// ═══════════════════════════════════════════════════════════════════
// RACK NODE  —  Fully parametric pallet racking system
// ═══════════════════════════════════════════════════════════════════

export const RackNode = BaseNode.extend({
  id: objectId('rack'),
  type: nodeType('rack'),
  position: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  rotation: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  variant: z.enum(['standard', 'library']).default('standard'),

  // ┌──────────────────────────────────────────────────────────────┐
  // │  1. TEMEL GEOMETRİ & DÜZEN  (Layout & Dimensions)           │
  // └──────────────────────────────────────────────────────────────┘

  // Ana birim ölçüleri (metre)
  unitWidth: z.number().default(2.7),     // Bir bölmenin genişliği (X ekseni)
  unitDepth: z.number().default(1.1),     // Bir bölmenin derinliği (Z ekseni)
  unitHeight: z.number().default(6.0),    // Toplam yükseklik (Y ekseni)

  // Hücre / bölme (bay) sayısı & düzeni
  config: z.array(z.number().int().min(0)).default([1]),
  // Her giriş = o sıradaki bay sayısı. [10, 10, 8] = 3 sıra

  // Kat sayısı & yükseklikleri
  levels: z.number().int().min(1).max(20).default(1),
  levelHeights: z.array(z.number()).default([]),
  // Boş bırakılırsa eşit dağılım yapılır.
  // Doldurulursa her kat bağımsız yükseklik alır (metre).
  // Örnek: [1.8, 1.5, 1.2] → alt kat 1.8m, orta 1.5m, üst 1.2m
  // Dizinin uzunluğu levels'e eşit olmalı (kısa kalırsa son değer tekrar eder).

  // Yön & koridor
  layoutDir: z.enum(['v', 'h']).default('v'),
  corridorGap: z.number().default(5.0),      // Sıralar arası koridor boşluğu (m)

  // Sırt sırta (back-to-back)
  backToBack: z.boolean().default(false),
  backToBackGap: z.number().default(0.2),    // İki sırt-sırta raf arası boşluk (m)
  wallGap: z.number().default(0),             // Duvar ile raf arası mesafe (metre)

  // ┌──────────────────────────────────────────────────────────────┐
  // │  2. PALET & TOLERANS MANTIĞI                                │
  // └──────────────────────────────────────────────────────────────┘

  // Standart palet boyutları (metre)
  palletWidth: z.number().default(0.8),       // Tek paletin kısa kenarı
  palletDepth: z.number().default(1.2),       // Tek paletin uzun kenarı
  palletHeight: z.number().default(0.14),     // Palet yüksekliği
  palletLoadHeight: z.number().default(1.0),  // Palet ÜZERİNDEKİ yükün yüksekliği

  // Otomatik hesaplama: yan yana kaç palet sığar
  // 0 = otomatik hesapla (unitWidth ve clearance'lara göre), >0 = elle belirt
  palletsPerShelf: z.number().int().min(0).max(10).default(0),

  // Tolerans / boşluk payları (clearance) — metre
  clearancePalletToPallet: z.number().default(0.075),   // Paletler arası yatay boşluk
  clearancePalletToUpright: z.number().default(0.075),   // Palet ile dikme arası boşluk
  clearanceTopToBeam: z.number().default(0.10),          // Yük üstü ile üst kiriş arası dikey boşluk

  showPallets: z.boolean().default(false),
  showPickingItems: z.boolean().default(false),

  // ┌──────────────────────────────────────────────────────────────┐
  // │  3. YAPISAL BİLEŞEN DETAYLARI                               │
  // └──────────────────────────────────────────────────────────────┘

  // Dikmeler (Uprights / Frames)
  uprightWidth: z.number().default(0.1),        // Dikme profil genişliği (ön-arka boyutu)
  uprightDepth: z.number().default(0.05),        // Dikme profil derinliği (yan boyutu)
  showBracing: z.boolean().default(true),        // Çapraz/yatay bağlantıları göster
  bracingSpacing: z.number().default(0.6),       // Bağlantı çapraz sıklığı (metre aralık)

  // Traversler (Beams)
  beamHeight: z.number().default(0.12),          // Kiriş profil yüksekliği
  beamThickness: z.number().default(0.05),       // Kiriş et kalınlığı (derinliği)
  // Not: Yük kapasitesi arttıkça beamHeight görsel olarak kalınlaşmalıdır

  // Zemin / tablama (Decking)
  deckingType: DeckingType,
  deckingThickness: z.number().default(0.018),   // Tablama kalınlığı (MDF: ~18mm, Tel: ~6mm)
  levelDeckingTypes: z.array(DeckingType).default([]), // Per-level decking override
  levelShowPallets: z.array(z.boolean()).default([]), // Per-level pallet visibility override
  levelTypes: z.array(LevelType).default([]), // Per-level usage type override

  // ┌──────────────────────────────────────────────────────────────┐
  // │  4. ATLAMA & TÜNEL KONFİGÜRASYONU                          │
  // └──────────────────────────────────────────────────────────────┘

  skip: z.array(z.string()).default([]),
  tunnels: z.record(z.string(), z.number().int().min(0)).default({}),
  shelfOverrides: z.array(ShelfOverride).default([]),

  // ┌──────────────────────────────────────────────────────────────┐
  // │  5. GÖRSEL / RENKLER                                        │
  // └──────────────────────────────────────────────────────────────┘

  legColor: z.string().default('#3366ff'),
  beamColor: z.string().default('#ff8800'),
  deckingColor: z.string().default('#ecc94b'),
  palletColor: z.string().default('#c0a080'),
  bracingColor: z.string().default('#5588cc'),

}).describe(
  dedent`
  Warehouse Rack node — a fully parametric pallet racking system.

  1. Temel Geometri: unitWidth/Depth/Height, config array, levels, levelHeights
  2. Palet & Tolerans: standart palet boyutları, auto-fit hesabı, clearance payları
  3. Yapısal Detay: dikme profili, çaprazlar, kiriş profil yüksekliği, zemin tipi
  4. Atlama & Tünel: skip keys, tunnels, shelfOverrides
  5. Renkler: direk, kiriş, zemin, palet, çapraz renkleri
  `
)

export type RackNode = z.infer<typeof RackNode>

/**
 * Bir rafa yan yana kaç palet sığacağını hesaplar.
 * Kullanıcı palletsPerShelf > 0 verdiyse onu döndürür.
 * Yoksa toleranslara göre otomatik hesaplar.
 */
export function computePalletsPerShelf(rack: RackNode): number {
  const pps = rack.palletsPerShelf ?? 0
  if (pps > 0) return pps

  const unitW = rack.unitWidth ?? 2.7
  const clearUpright = rack.clearancePalletToUpright ?? 0.075
  const palletW = rack.palletWidth ?? 0.8
  const clearPallet = rack.clearancePalletToPallet ?? 0.075

  const availableWidth = unitW - 2 * clearUpright
  const slotWidth = palletW + clearPallet
  if (slotWidth <= 0) return 1
  const count = Math.floor((availableWidth + clearPallet) / slotWidth)
  return Math.max(1, count)
}

/**
 * Her katın metre cinsinden yüksekliğini döndürür (toplamda levels adet).
 * levelHeights doluysa onu kullanır (kısa ise son değeri tekrarlar).
 * Boşsa eşit dağılım yapar.
 */
export function computeLevelPositions(rack: RackNode): number[] {
  const levels = rack.levels ?? 3
  const unitHeight = rack.unitHeight ?? 6.0
  const levelHeights = rack.levelHeights ?? []
  const beamHeight = rack.beamHeight ?? 0.12

  // Eşit dağılım
  if (!levelHeights || levelHeights.length === 0) {
    const spacing = unitHeight / (levels + 0.5)
    return Array.from({ length: levels }, (_, i) => (i + 1) * spacing)
  }

  // Özel yükseklikler — kümülatif toplam
  const positions: number[] = []
  let cumulative = 0
  for (let i = 0; i < levels; i++) {
    const h = levelHeights[Math.min(i, levelHeights.length - 1)]!
    cumulative += h + beamHeight
    positions.push(cumulative)
  }
  return positions
}
