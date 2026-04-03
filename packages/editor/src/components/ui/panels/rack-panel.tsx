'use client'

import { type AnyNode, type AnyNodeId, type RackNode, computePalletsPerShelf, useScene, emitter, RackNode as RackNodeSchema } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { BookMarked, Copy, Move, Trash2 } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { usePresetsAdapter } from '../../../contexts/presets-context'
import { sfxEmitter } from '../../../lib/sfx-bus'
import useEditor from '../../../store/use-editor'
import { cn } from '../../../lib/utils'
import { ActionButton, ActionGroup } from '../controls/action-button'
import { PanelSection } from '../controls/panel-section'
import { SegmentedControl } from '../controls/segmented-control'
import { SliderControl } from '../controls/slider-control'
import { ToggleControl } from '../controls/toggle-control'
import { PanelWrapper } from './panel-wrapper'
import { PresetsPopover } from './presets/presets-popover'

// ── Helpers ──────────────────────────────────────────────────────


const ColorPicker = ({
  label,
  value,
  onChange,
}: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="flex items-center justify-between px-2 py-1">
    <span className="text-muted-foreground text-sm">{label}</span>
    <input
      type="color"
      className="h-6 w-10 cursor-pointer rounded border border-border"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
)

const InfoRow = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between px-2 py-0.5">
    <span className="text-muted-foreground text-xs">{label}</span>
    <span className="font-mono text-foreground text-xs">{value}</span>
  </div>
)

const TextInput = ({
  label,
  hint,
  value,
  onChange,
}: { label: string; hint?: string; value: string; onChange: (v: string) => void }) => (
  <div className="flex flex-col gap-1 px-2 py-1.5">
    <span className="text-muted-foreground text-xs">{label}</span>
    {hint && <span className="text-muted-foreground/60 text-[10px]">{hint}</span>}
    <input
      className="w-full rounded border border-border bg-background px-2 py-0.5 font-mono text-xs text-foreground"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
)

// ═══════════════════════════════════════════════════════════════════
export function RackPanel() {
  const selectedIds = useViewer((s) => s.selection.selectedIds)
  const setSelection = useViewer((s) => s.setSelection)
  const nodes = useScene((s) => s.nodes)
  const updateNode = useScene((s) => s.updateNode)
  const deleteNode = useScene((s) => s.deleteNode)
  const setMovingNode = useEditor((s) => s.setMovingNode)

  const adapter = usePresetsAdapter()

  const selectedId = selectedIds[0]
  const node = selectedId ? (nodes[selectedId as AnyNode['id']] as RackNode | undefined) : undefined

  const handleUpdate = useCallback(
    (updates: Partial<RackNode>) => {
      if (!selectedId || !node) return

      let finalUpdates = { ...updates }

      // "Yapışma" (library) modunda pozisyon senkronizasyonu
      if (node.variant === 'library' && node.parentId) {
        const needsSync =
          'wallGap' in updates ||
          'layoutDir' in updates ||
          'unitWidth' in updates ||
          'unitDepth' in updates

        if (needsSync) {
          const parentWall = nodes[node.parentId as AnyNode['id']] as any
          if (parentWall && parentWall.type === 'wall') {
            const T = parentWall.thickness || 0.1
            const W = updates.unitWidth ?? node.unitWidth
            const D = updates.unitDepth ?? node.unitDepth
            const dir = updates.layoutDir ?? node.layoutDir
            const gap = updates.wallGap ?? node.wallGap

            const rackDepth = dir === 'v' ? W : D
            const zOffset = T / 2 + rackDepth / 2 + gap

            const currentPos = updates.position ?? node.position
            finalUpdates.position = [currentPos[0], currentPos[1], zOffset]
          }
        }
      }

      updateNode(selectedId as AnyNode['id'], finalUpdates)
      useScene.getState().dirtyNodes.add(selectedId as AnyNodeId)
    },
    [selectedId, node, nodes, updateNode],
  )

  const handleClose = useCallback(() => {
    setSelection({ selectedIds: [] })
  }, [setSelection])

  const handleMove = useCallback(() => {
    if (!node) return
    sfxEmitter.emit('sfx:item-pick')
    setMovingNode(node)
    setSelection({ selectedIds: [] })
  }, [node, setMovingNode, setSelection])

  const handleDelete = useCallback(() => {
    if (!(selectedId && node)) return
    sfxEmitter.emit('sfx:item-delete')
    deleteNode(selectedId as AnyNode['id'])
    if (node.parentId) useScene.getState().dirtyNodes.add(node.parentId as AnyNodeId)
    setSelection({ selectedIds: [] })
  }, [selectedId, node, deleteNode, setSelection])

  const handleDuplicate = useCallback(() => {
    if (!node?.parentId) return
    sfxEmitter.emit('sfx:item-pick')
    useScene.temporal.getState().pause()
    const cloned = structuredClone(node) as any
    delete cloned.id
    cloned.metadata = { ...cloned.metadata, isNew: true }
    const duplicate = RackNodeSchema.parse(cloned)
    useScene.getState().createNode(duplicate, node.parentId as AnyNodeId)
    setMovingNode(duplicate)
    setSelection({ selectedIds: [] })
  }, [node, setMovingNode, setSelection])

  const getRackPresetData = useCallback(() => {
    if (!node) return null
    return {
      unitWidth: node.unitWidth,
      unitDepth: node.unitDepth,
      unitHeight: node.unitHeight,
      levels: node.levels,
      levelHeights: node.levelHeights,
      config: node.config,
      layoutDir: node.layoutDir,
      corridorGap: node.corridorGap,
      backToBack: node.backToBack,
      backToBackGap: node.backToBackGap,
      palletWidth: node.palletWidth,
      palletDepth: node.palletDepth,
      palletHeight: node.palletHeight,
      palletLoadHeight: node.palletLoadHeight,
      palletsPerShelf: node.palletsPerShelf,
      bayGap: node.bayGap,
      clearancePalletToPallet: node.clearancePalletToPallet,
      clearancePalletToUpright: node.clearancePalletToUpright,
      clearanceTopToBeam: node.clearanceTopToBeam,
      showPallets: node.showPallets,
      showPickingItems: node.showPickingItems,
      uprightWidth: node.uprightWidth,
      uprightDepth: node.uprightDepth,
      showBracing: node.showBracing,
      bracingSpacing: node.bracingSpacing,
      beamHeight: node.beamHeight,
      beamThickness: node.beamThickness,
      deckingType: node.deckingType,
      deckingThickness: node.deckingThickness,
      legColor: node.legColor,
      beamColor: node.beamColor,
      deckingColor: node.deckingColor,
      palletColor: node.palletColor,
      bracingColor: node.bracingColor,
      levelDeckingTypes: node.levelDeckingTypes,
      levelShowPallets: node.levelShowPallets,
      levelTypes: node.levelTypes,
      wallGap: node.wallGap,
      variant: node.variant,
      position: node.position,
      rotation: node.rotation,
    }
  }, [node])

  const handleSavePreset = useCallback(
    async (name: string) => {
      const data = getRackPresetData()
      if (!(data && selectedId)) return
      const presetId = await adapter.savePreset('rack', name, data)
      if (presetId) emitter.emit('preset:generate-thumbnail', { presetId, nodeId: selectedId })
    },
    [getRackPresetData, selectedId, adapter],
  )

  const handleOverwritePreset = useCallback(
    async (id: string) => {
      const data = getRackPresetData()
      if (!(data && selectedId)) return
      await adapter.overwritePreset('rack', id, data)
      emitter.emit('preset:generate-thumbnail', { presetId: id, nodeId: selectedId })
    },
    [getRackPresetData, selectedId, adapter],
  )

  const handleApplyPreset = useCallback(
    (data: Record<string, unknown>) => {
      handleUpdate(data as Partial<RackNode>)
    },
    [handleUpdate],
  )

  const palletsCount = useMemo(() => (node ? computePalletsPerShelf(node) : 0), [node])

  if (!node || node.type !== 'rack' || selectedIds.length !== 1) return null

  // Defaults for old rack nodes that were created before schema fields existed
  const d = {
    unitWidth: node.unitWidth ?? 2.7,
    unitDepth: node.unitDepth ?? 1.1,
    unitHeight: node.unitHeight ?? 6.0,
    levels: node.levels ?? 3,
    levelHeights: node.levelHeights ?? [],
    config: node.config ?? [1],
    layoutDir: node.layoutDir ?? 'v',
    corridorGap: node.corridorGap ?? 5.0,
    bayGap: node.bayGap ?? 0,
    backToBack: node.backToBack ?? true,
    backToBackGap: node.backToBackGap ?? 0.2,
    palletWidth: node.palletWidth ?? 0.8,
    palletDepth: node.palletDepth ?? 1.2,
    palletHeight: node.palletHeight ?? 0.14,
    palletLoadHeight: node.palletLoadHeight ?? 1.0,
    palletsPerShelf: node.palletsPerShelf ?? 0,
    clearancePalletToPallet: node.clearancePalletToPallet ?? 0.075,
    clearancePalletToUpright: node.clearancePalletToUpright ?? 0.075,
    clearanceTopToBeam: node.clearanceTopToBeam ?? 0.10,
    showPallets: node.showPallets ?? false,
    showPickingItems: node.showPickingItems ?? false,
    uprightWidth: node.uprightWidth ?? 0.1,
    uprightDepth: node.uprightDepth ?? 0.05,
    showBracing: node.showBracing ?? true,
    bracingSpacing: node.bracingSpacing ?? 0.6,
    beamHeight: node.beamHeight ?? 0.12,
    beamThickness: node.beamThickness ?? 0.05,
    deckingType: node.deckingType ?? 'none',
    deckingThickness: node.deckingThickness ?? 0.018,
    skip: node.skip ?? [],
    tunnels: node.tunnels ?? {},
    legColor: node.legColor ?? '#3366ff',
    beamColor: node.beamColor ?? '#ff8800',
    deckingColor: node.deckingColor ?? '#ecc94b',
    palletColor: node.palletColor ?? '#c0a080',
    bracingColor: node.bracingColor ?? '#5588cc',
    levelDeckingTypes: node.levelDeckingTypes ?? [],
    levelShowPallets: node.levelShowPallets ?? [],
    levelTypes: node.levelTypes ?? [],
    wallGap: node.wallGap ?? 0,
    variant: node.variant ?? 'standard',
    position: node.position ?? [0, 0, 0],
    rotation: node.rotation ?? [0, 0, 0],
  } as const

  const totalBays = d.config.reduce((a: number, b: number) => a + b, 0) * (d.backToBack ? 2 : 1)

  const palletLevelsCount = Array.from({ length: d.levels }).filter((_, i) => {
    const type = d.levelTypes[i] || (d.levelShowPallets[i] === false ? 'picking' : 'pallet')
    return type === 'pallet'
  }).length

  return (
    <PanelWrapper
      icon="/icons/rack.png"
      onClose={handleClose}
      title={node.name || 'Depo Rafı'}
      width={300}
    >
      {/* Presets strip */}
      <div className="border-border/30 border-b px-3 pt-2.5 pb-1.5">
        <PresetsPopover
          isAuthenticated={adapter.isAuthenticated}
          onApply={handleApplyPreset}
          onDelete={(id) => adapter.deletePreset(id)}
          onFetchPresets={(tab) => adapter.fetchPresets('rack', tab)}
          onOverwrite={handleOverwritePreset}
          onRename={(id, name) => adapter.renamePreset(id, name)}
          onSave={handleSavePreset}
          onToggleCommunity={adapter.togglePresetCommunity}
          tabs={adapter.tabs}
          type="rack"
        >
          <button className="flex w-full items-center gap-2 rounded-lg border border-border/50 bg-[#2C2C2E] px-3 py-2 font-medium text-muted-foreground text-xs transition-colors hover:bg-[#3e3e3e] hover:text-foreground">
            <BookMarked className="h-3.5 w-3.5 shrink-0" />
            <span>Presets</span>
          </button>
        </PresetsPopover>
      </div>

      {/* ═══ VARYANT SEÇİMİ ══════════════════════════════════════ */}
      <PanelSection title="Raf Tipi">
        <div className="flex flex-col gap-1.5 px-1 py-1">
          <span className="font-medium text-[10px] text-muted-foreground/80 uppercase tracking-wider">
            Varyant
          </span>
          <SegmentedControl
            onChange={(v) => handleUpdate({ variant: v as any })}
            options={[
              { label: 'Serbest', value: 'standard' },
              { label: 'Yapışma', value: 'library' },
            ]}
            value={node.variant || 'standard'}
          />
        </div>
      </PanelSection>

      {/* ═══ 1. TEMEL GEOMETRİ & DÜZEN ═══════════════════════════ */}
      <PanelSection title="1. Birim Boyutları">
        <SliderControl
          label="Genişlik (W)"
          max={600} min={50} step={1} unit="cm"
          value={d.unitWidth * 100}
          onChange={(v) => handleUpdate({ unitWidth: v / 100 })}
        />
        <SliderControl
          label="Derinlik (D)"
          max={300} min={30} step={1} unit="cm"
          value={d.unitDepth * 100}
          onChange={(v) => handleUpdate({ unitDepth: v / 100 })}
        />
        <SliderControl
          label="Yükseklik (H)"
          max={1500} min={100} step={1} unit="cm"
          value={d.unitHeight * 100}
          onChange={(v) => {
            const newUnitH = v / 100
            const beamH = d.beamHeight
            
            // If we have manual level heights, ensure they don't exceed the new total
            if (d.levelHeights.length > 0) {
              let cumulative = 0
              const newHeights = d.levelHeights.map((h) => {
                const available = newUnitH - cumulative - beamH
                const clampedH = Math.min(h, Math.max(0.1, available))
                cumulative += clampedH + beamH
                return clampedH
              })
              handleUpdate({ unitHeight: newUnitH, levelHeights: newHeights })
            } else {
              handleUpdate({ unitHeight: newUnitH })
            }
          }}
        />
      </PanelSection>

      <PanelSection title="Kat Yapısı">
        <SliderControl
          label="Kat Sayısı"
          max={20} min={1} step={1}
          value={d.levels}
          onChange={(v) => handleUpdate({ levels: Math.round(v) })}
        />
        <div className="mt-2 space-y-3">
          {Array.from({ length: d.levels }).map((_, i) => {
            const levelIdx = d.levels - 1 - i // Reverse order for UI: Top to Bottom
            return (
              <div key={levelIdx} className="flex flex-col gap-1 rounded bg-muted/30 p-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-muted-foreground text-xs">{levelIdx + 1}. Kat Ayarları</span>
                </div>

                {/* Kat Tipi Seçimi */}
                <div className="flex flex-col gap-1.5 py-1">
                  <span className="font-medium text-[10px] text-muted-foreground/80 uppercase tracking-wider">
                    Kat Tipi
                  </span>
                  <SegmentedControl
                    onChange={(type) => {
                      const newTypes = [...d.levelTypes]
                      while (newTypes.length < d.levels) {
                        newTypes.push(d.levelShowPallets[newTypes.length] === false ? 'picking' : 'pallet')
                      }
                      newTypes[levelIdx] = type as any
                      
                      let newDecking = d.levelDeckingTypes.length > 0 ? [...d.levelDeckingTypes] : []
                      if (type === 'picking' && (newDecking[levelIdx] === 'none' || !newDecking[levelIdx])) {
                        while (newDecking.length < d.levels) newDecking.push(d.deckingType)
                        newDecking[levelIdx] = 'mdf'
                      }
                      
                      handleUpdate({ 
                        levelTypes: newTypes,
                        levelDeckingTypes: newDecking.length > 0 ? newDecking : undefined 
                      })
                    }}
                    options={[
                      { label: 'Palet', value: 'pallet' },
                      { label: 'Toplama', value: 'picking' },
                      { label: 'Atıl', value: 'empty' },
                    ]}
                    value={d.levelTypes[levelIdx] || (d.levelShowPallets[levelIdx] === false ? 'picking' : 'pallet')}
                  />
                </div>

                {/* Zemin Seçimi */}
                <div className="flex flex-col gap-1.5 py-1">
                  <span className="font-medium text-[10px] text-muted-foreground/80 uppercase tracking-wider">
                    Zemin Tipi
                  </span>
                  <SegmentedControl
                    onChange={(val) => {
                      const newTypes = [...d.levelDeckingTypes]
                      while (newTypes.length < d.levels) newTypes.push(d.deckingType)
                      newTypes[levelIdx] = val as any
                      handleUpdate({ levelDeckingTypes: newTypes })
                    }}
                    options={[
                      { label: 'Yok', value: 'none' },
                      { label: 'MDF', value: 'mdf' },
                      { label: 'Izgara', value: 'wire-mesh' },
                      { label: 'Çelik', value: 'steel-panel' },
                    ]}
                    value={d.levelDeckingTypes[levelIdx] || d.deckingType}
                  />
                </div>

                {/* Bağımsız Yükseklik (İsteğe bağlı) */}
                <SliderControl
                  label="Yükseklik (Alttaki kattan)"
                  max={400} min={10} step={5} unit="cm"
                  value={(d.levelHeights[levelIdx] ?? d.unitHeight / d.levels) * 100}
                  onChange={(v) => {
                    const newH = v / 100
                    const oldHeights = [...d.levelHeights]
                    const beamH = d.beamHeight
                    
                    // Fill default heights if empty
                    while (oldHeights.length < d.levels) {
                      oldHeights.push(d.unitHeight / (d.levels + 0.5) - beamH)
                    }

                    const currentH = oldHeights[levelIdx]
                    if (currentH === undefined) return
                    
                    const diff = newH - currentH
                    const nextIdx = levelIdx + 1
                    
                    if (nextIdx < d.levels) {
                      // NEIGHBOR ADJUSTMENT: Change next level height inversely
                      // This keeps the position of level i+2 and above unchanged.
                      const nextOldH = oldHeights[nextIdx]!
                      const nextNewH = Math.max(0.1, nextOldH - diff)
                      const actualDiff = nextOldH - nextNewH
                      
                      oldHeights[levelIdx] = currentH + actualDiff
                      oldHeights[nextIdx] = nextNewH
                    } else {
                      // LAST LEVEL: Clamp against unitHeight
                      const otherSum = oldHeights.reduce((acc, h, idx) => {
                        if (idx === levelIdx) return acc
                        return acc + h + beamH
                      }, 0)
                      
                      const maxAllowed = d.unitHeight - otherSum - beamH
                      oldHeights[levelIdx] = Math.min(newH, Math.max(0.1, maxAllowed))
                    }
                    
                    handleUpdate({ levelHeights: oldHeights })
                  }}
                />
              </div>
            )
          })}
        </div>
      </PanelSection>

      <PanelSection title="Yerleşim">
        <div className="flex flex-col gap-2">
          <SliderControl
            label="Sıra Sayısı"
            max={30} min={1} step={1}
            value={d.config.length}
            onChange={(v) => {
              const newLen = Math.round(v)
              const oldConfig = [...d.config]
              if (newLen > oldConfig.length) {
                // Add new rows, default to last row's value or 1
                const lastVal = oldConfig[oldConfig.length - 1] || 1
                while (oldConfig.length < newLen) {
                  oldConfig.push(lastVal)
                }
              } else {
                // Shrink
                oldConfig.length = newLen
              }
              handleUpdate({ config: oldConfig })
            }}
          />
          
          <div className="mt-1 space-y-1.5 border-t border-border/30 pt-2 pl-3">
            <span className="font-medium text-[9px] text-muted-foreground/60 uppercase tracking-tight">
              Bay Sayıları (Her Sıra İçin)
            </span>
            <div className="max-h-[200px] overflow-y-auto pr-1 space-y-0.5 custom-scrollbar">
              {d.config.map((count, i) => (
                <SliderControl
                  key={i}
                  label={`${i + 1}. Sıra`}
                  max={50} min={1} step={1}
                  value={count}
                  onChange={(v) => {
                    const newConfig = [...d.config]
                    newConfig[i] = Math.round(v)
                    handleUpdate({ config: newConfig })
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 py-1">
          <span className="font-medium text-[10px] text-muted-foreground/80 uppercase tracking-wider">
            Yön
          </span>
          <SegmentedControl
            onChange={(dir) => handleUpdate({ layoutDir: dir as any })}
            options={[
              { label: 'Dikey', value: 'v' },
              { label: 'Yatay', value: 'h' },
            ]}
            value={d.layoutDir}
          />
        </div>
        <SliderControl
          label="Bay Aralığı"
          max={200} min={0} step={1} unit="cm"
          value={d.bayGap * 100}
          onChange={(v) => handleUpdate({ bayGap: v / 100 })}
        />
        <SliderControl
          label="Koridor Aralığı"
          max={1000} min={0} step={5} unit="cm"
          value={d.corridorGap * 100}
          onChange={(v) => handleUpdate({ corridorGap: v / 100 })}
        />
      </PanelSection>
      <PanelSection title="Sırt Sırta">
        <ToggleControl
          label="Sırt Sırta"
          checked={d.backToBack}
          onChange={(v) => handleUpdate({ backToBack: v })}
        />
        {d.backToBack && (
          <div className="mt-1 flex flex-col gap-1">
            <SliderControl
              label="Boşluk"
              max={100} min={0} step={1} unit="cm"
              value={d.backToBackGap * 100}
              onChange={(v) => handleUpdate({ backToBackGap: v / 100 })}
            />
          </div>
        )}
      </PanelSection>

      {/* ═══ 2. PALET & TOLERANS ══════════════════════════════════ */}
      <PanelSection title="2. Palet & Tolerans">
        <SliderControl
          label="Palet Genişliği"
          max={150} min={30} step={1} unit="cm"
          value={d.palletWidth * 100}
          onChange={(v) => handleUpdate({ palletWidth: v / 100 })}
        />
        <SliderControl
          label="Palet Derinliği"
          max={180} min={50} step={1} unit="cm"
          value={d.palletDepth * 100}
          onChange={(v) => handleUpdate({ palletDepth: v / 100 })}
        />
        <SliderControl
          label="Palet Yüksekliği"
          max={30} min={5} step={1} unit="cm"
          value={d.palletHeight * 100}
          onChange={(v) => handleUpdate({ palletHeight: v / 100 })}
        />
        <SliderControl
          label="Yük Yüksekliği"
          max={250} min={10} step={5} unit="cm"
          value={d.palletLoadHeight * 100}
          onChange={(v) => handleUpdate({ palletLoadHeight: v / 100 })}
        />

        <div className="mt-1 border-border/50 border-t pt-1">
          <SliderControl
            label="Palet ↔ Palet Boşluk"
            max={30} min={0} step={0.5} unit="cm"
            precision={1}
            value={d.clearancePalletToPallet * 100}
            onChange={(v) => handleUpdate({ clearancePalletToPallet: v / 100 })}
          />
          <SliderControl
            label="Palet ↔ Dikme Boşluk"
            max={30} min={0} step={0.5} unit="cm"
            precision={1}
            value={d.clearancePalletToUpright * 100}
            onChange={(v) => handleUpdate({ clearancePalletToUpright: v / 100 })}
          />
          <SliderControl
            label="Yük Üstü ↔ Kiriş Boşluk"
            max={30} min={0} step={1} unit="cm"
            value={d.clearanceTopToBeam * 100}
            onChange={(v) => handleUpdate({ clearanceTopToBeam: v / 100 })}
          />
        </div>

        <div className="mt-1 border-border/50 border-t pt-1">
          <SliderControl
            label="Palet / Kat (0=oto)"
            max={10} min={0} step={1}
            value={d.palletsPerShelf}
            onChange={(v) => handleUpdate({ palletsPerShelf: Math.round(v) })}
          />
          <InfoRow label="Hesaplanan Palet / Kat" value={palletsCount} />
          <ToggleControl
            label="Paletleri Göster"
            checked={d.showPallets}
            onChange={(v) => handleUpdate({ showPallets: v })}
          />
          <ToggleControl
            label="Koli / Ürün Göster"
            checked={d.showPickingItems}
            onChange={(v) => handleUpdate({ showPickingItems: v })}
          />
        </div>
      </PanelSection>

      {/* ═══ YERLEŞİM & KONUM ═══════════════════════════════════ */}
      <PanelSection title="Yerleşim ve Konum">
        <div className="space-y-1 px-1">
          {d.variant === 'library' && (
            <SliderControl
              label="Duvar Aralığı"
              max={100} min={0} step={1} unit="cm"
              value={d.wallGap * 100}
              onChange={(v) => handleUpdate({ wallGap: v / 100 })}
            />
          )}

          <SliderControl
            label={d.variant === 'library' ? "Duvar Boyu (X)" : "X Konumu"}
            max={200} min={-200} step={0.1} unit="m"
            value={d.position[0]}
            onChange={(v) => handleUpdate({ position: [v, d.position[1], d.position[2]] })}
          />

          {d.variant !== 'library' && (
            <SliderControl
              label="Z Konumu"
              max={200} min={-200} step={0.1} unit="m"
              value={d.position[2]}
              onChange={(v) => handleUpdate({ position: [d.position[0], d.position[1], v] })}
            />
          )}

          <SliderControl
            label="Yükseklik (Y)"
            max={20} min={0} step={0.1} unit="m"
            value={d.position[1]}
            onChange={(v) => handleUpdate({ position: [d.position[0], v, d.position[2]] })}
          />

          <SliderControl
            label="Yön"
            max={360} min={0} step={1} unit="°"
            value={Math.round((d.rotation[1] * 180) / Math.PI) % 360}
            onChange={(v) => handleUpdate({ rotation: [0, (v * Math.PI) / 180, 0] })}
          />
        </div>
      </PanelSection>

      {/* ═══ 3. YAPISAL BİLEŞEN DETAYLARI ════════════════════════ */}
      <PanelSection title="3. Dikmeler (Uprights)">
        <SliderControl
          label="Profil Genişliği"
          max={25} min={3} step={0.1} unit="cm"
          precision={1}
          value={d.uprightWidth * 100}
          onChange={(v) => handleUpdate({ uprightWidth: v / 100 })}
        />
        <SliderControl
          label="Profil Derinliği"
          max={15} min={2} step={0.1} unit="cm"
          precision={1}
          value={d.uprightDepth * 100}
          onChange={(v) => handleUpdate({ uprightDepth: v / 100 })}
        />
        <ToggleControl
          label="Çapraz Bağlantılar"
          checked={d.showBracing}
          onChange={(v) => handleUpdate({ showBracing: v })}
        />
        {d.showBracing && (
          <div className="mt-1 flex flex-col gap-1">
            <SliderControl
              label="Çapraz Aralığı"
              max={200} min={20} step={1} unit="cm"
              value={d.bracingSpacing * 100}
              onChange={(v) => handleUpdate({ bracingSpacing: v / 100 })}
            />
          </div>
        )}
      </PanelSection>

      <PanelSection title="Traversler (Beams)">
        <SliderControl
          label="Profil Yüksekliği"
          max={30} min={4} step={0.1} unit="cm"
          precision={1}
          value={d.beamHeight * 100}
          onChange={(v) => handleUpdate({ beamHeight: v / 100 })}
        />
        <SliderControl
          label="Et Kalınlığı"
          max={15} min={2} step={0.1} unit="cm"
          precision={1}
          value={d.beamThickness * 100}
          onChange={(v) => handleUpdate({ beamThickness: v / 100 })}
        />
      </PanelSection>

      <PanelSection title="Zemin / Tablama">
        <div className="flex flex-col gap-1.5 py-1">
          <span className="font-medium text-[10px] text-muted-foreground/80 uppercase tracking-wider">
            Zemin Tipi
          </span>
          <SegmentedControl
            onChange={(val) => handleUpdate({ deckingType: val as any })}
            options={[
              { label: 'Yok', value: 'none' },
              { label: 'MDF', value: 'mdf' },
              { label: 'Izgara', value: 'wire-mesh' },
              { label: 'Çelik', value: 'steel-panel' },
            ]}
            value={d.deckingType}
          />
        </div>
        {d.deckingType !== 'none' && (
          <div className="mt-1 flex flex-col gap-1">
            <SliderControl
              label="Tablama Kalınlığı"
              max={5} min={0.3} step={0.1} unit="cm"
              precision={1}
              value={d.deckingThickness * 100}
              onChange={(v) => handleUpdate({ deckingThickness: v / 100 })}
            />
          </div>
        )}
      </PanelSection>


      {/* ═══ 4. ATLAMA & TÜNEL ════════════════════════════════════ */}
      <PanelSection title="4. Atlama & Tünel">
        <div className="space-y-4 px-1 py-1">
          {/* ATLAMA (SKIPS) */}
          <div className="space-y-2">
            <span className="font-medium text-[10px] text-muted-foreground/80 uppercase tracking-wider">
              Atlanan Bayler
            </span>
            <div className="space-y-1">
              {d.skip.map((s, idx) => {
                const parts = s.split('-')
                const rowIndex = parseInt(parts[0] || '0', 10)
                const bayIndex = parseInt(parts[1] || '0', 10)
                const side = parts[2] || 'both'

                // UI shows 1-based, internal is 0-based
                const rowDisplay = rowIndex + 1
                const bayDisplay = bayIndex + 1

                const updateSkip = (newRowDisp: number, newBayDisp: number, newSide: string) => {
                  const rIdx = Math.max(0, newRowDisp - 1)
                  const bIdx = Math.max(0, newBayDisp - 1)
                  const newSkip = [...d.skip]
                  
                  if (newSide === 'both' || !d.backToBack) {
                    newSkip[idx] = `${rIdx}-${bIdx}`
                  } else {
                    newSkip[idx] = `${rIdx}-${bIdx}-${newSide}`
                  }
                  
                  handleUpdate({ skip: newSkip })
                }

                const maxBaysInRow = d.config[rowIndex] || 1

                return (
                  <div key={idx} className="flex items-center gap-1 bg-[#2C2C2E] p-1 rounded border border-border/30">
                    <div className="flex-1 space-y-0.5">
                      {d.config.length > 1 && (
                        <SliderControl
                          label={`Sıra (1-${d.config.length})`}
                          min={1}
                          max={d.config.length}
                          value={rowDisplay}
                          onChange={(v) => updateSkip(v, bayDisplay, side)}
                        />
                      )}
                      <SliderControl
                        label={`Bay (1-${maxBaysInRow})`}
                        min={1}
                        max={maxBaysInRow}
                        value={bayDisplay}
                        onChange={(v) => updateSkip(rowDisplay, v, side)}
                      />
                    </div>
                    {d.backToBack && (
                      <div className="flex gap-0.5 bg-black/20 p-0.5 rounded">
                        {(['f', 'b', 'both'] as const).map((s) => (
                          <button
                            key={s}
                            className={cn(
                              "text-[8px] px-1.5 py-0.5 rounded transition-all",
                              side === s 
                                ? "bg-[#3e3e3e] text-primary shadow-sm" 
                                : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => updateSkip(rowDisplay, bayDisplay, s)}
                          >
                            {s === 'f' ? 'Ön' : s === 'b' ? 'Ark' : 'Hepsi'}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      className="p-1 hover:text-red-400 text-muted-foreground transition-colors"
                      onClick={() => handleUpdate({ skip: d.skip.filter((_, i) => i !== idx) })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
              <ActionButton
                label="+ Atlama Ekle"
                onClick={() => handleUpdate({ skip: [...d.skip, "0-0"] })}
              />
            </div>
          </div>

          <div className="border-border/30 border-t pt-3 space-y-2">
            <span className="font-medium text-[10px] text-muted-foreground/80 uppercase tracking-wider">
              Tüneller
            </span>
            <div className="space-y-2">
              {Object.entries(d.tunnels).map(([key, height], idx) => {
                const parts = key.split('-')
                const rowIndex = parseInt(parts[0] || '0', 10)
                const bayIndex = parseInt(parts[1] || '0', 10)
                const side = parts[2] || 'both'

                // UI shows 1-based, internal is 0-based
                const rowDisplay = rowIndex + 1
                const bayDisplay = bayIndex + 1

                const updateTunnel = (newRowDisp: number, newBayDisp: number, newSide: string, newH: number) => {
                  const rIdx = Math.max(0, newRowDisp - 1)
                  const bIdx = Math.max(0, newBayDisp - 1)
                  const newTunnels = { ...d.tunnels }
                  delete newTunnels[key]
                  
                  let newKey: string
                  if (newSide === 'both' || !d.backToBack) {
                    newKey = `${rIdx}-${bIdx}`
                  } else {
                    newKey = `${rIdx}-${bIdx}-${newSide}`
                  }
                  
                  newTunnels[newKey] = newH
                  handleUpdate({ tunnels: newTunnels })
                }

                const maxBaysInRow = d.config[rowIndex] || 1

                return (
                  <div key={key} className="bg-[#2C2C2E] p-2 rounded border border-border/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-0.5 pr-2">
                        {d.config.length > 1 && (
                          <SliderControl
                            label={`Sıra (1-${d.config.length})`}
                            min={1}
                            max={d.config.length}
                            value={rowDisplay}
                            onChange={(v) => updateTunnel(v, bayDisplay, side, height)}
                          />
                        )}
                        <SliderControl
                          label={`Bay (1-${maxBaysInRow})`}
                          min={1}
                          max={maxBaysInRow}
                          value={bayDisplay}
                          onChange={(v) => updateTunnel(rowDisplay, v, side, height)}
                        />
                      </div>
                      {d.backToBack && (
                        <div className="flex gap-0.5 bg-black/20 p-0.5 rounded ml-1">
                          {(['f', 'b', 'both'] as const).map((s) => (
                            <button
                              key={s}
                              className={cn(
                                "text-[8px] px-1.5 py-0.5 rounded transition-all",
                                side === s 
                                  ? "bg-[#3e3e3e] text-primary shadow-sm" 
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                              onClick={() => updateTunnel(rowDisplay, bayDisplay, s, height)}
                            >
                              {s === 'f' ? 'Ön' : s === 'b' ? 'Ark' : 'Hepsi'}
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        className="hover:text-red-400 text-muted-foreground transition-colors ml-1"
                        onClick={() => {
                          const newTunnels = { ...d.tunnels }
                          delete newTunnels[key]
                          handleUpdate({ tunnels: newTunnels })
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <SliderControl
                      label="Yükseklik"
                      max={d.levels - 1} min={1} step={1} unit=" kat"
                      value={height}
                      onChange={(v) => updateTunnel(rowDisplay, bayDisplay, side, v)}
                    />
                  </div>
                )
              })}
              <ActionButton
                label="+ Tünel Ekle"
                onClick={() => handleUpdate({ tunnels: { ...d.tunnels, "0-0": 1 } })}
              />
            </div>
          </div>
        </div>
      </PanelSection>

      {/* ═══ 5. RENKLER ═══════════════════════════════════════════ */}
      <PanelSection title="5. Renkler">
        <ColorPicker label="Dikmeler" value={d.legColor} onChange={(v) => handleUpdate({ legColor: v })} />
        <ColorPicker label="Kirişler" value={d.beamColor} onChange={(v) => handleUpdate({ beamColor: v })} />
        <ColorPicker label="Tablama" value={d.deckingColor} onChange={(v) => handleUpdate({ deckingColor: v })} />
        <ColorPicker label="Paletler" value={d.palletColor} onChange={(v) => handleUpdate({ palletColor: v })} />
        <ColorPicker label="Çaprazlar" value={d.bracingColor} onChange={(v) => handleUpdate({ bracingColor: v })} />
      </PanelSection>

      {/* ═══ BİLGİ ════════════════════════════════════════════════ */}
      <PanelSection title="Özet Bilgi">
        <div className="flex flex-col gap-0.5 px-2 py-1">
          <InfoRow label="Toplam Bay" value={totalBays} />
          <InfoRow label="Toplam Raf Katı" value={totalBays * d.levels} />
          <InfoRow label="Palet Rafı Katı" value={totalBays * palletLevelsCount} />
          <InfoRow label="Palet / Kat" value={palletsCount} />
          <InfoRow label="Palet Kapasitesi" value={totalBays * palletLevelsCount * palletsCount} />
        </div>
      </PanelSection>

      <PanelSection title="Actions">
        <ActionGroup>
          <ActionButton icon={<Move className="h-3.5 w-3.5" />} label="Move" onClick={handleMove} />
          <ActionButton
            icon={<Copy className="h-3.5 w-3.5" />}
            label="Duplicate"
            onClick={handleDuplicate}
          />
          <ActionButton
            className="hover:bg-red-500/20"
            icon={<Trash2 className="h-3.5 w-3.5 text-red-400" />}
            label="Delete"
            onClick={handleDelete}
          />
        </ActionGroup>
      </PanelSection>
    </PanelWrapper>
  )
}

