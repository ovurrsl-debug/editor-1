'use client'

import { type AnyNode, type AnyNodeId, ColumnNode, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { Copy, Move, Trash2 } from 'lucide-react'
import { useCallback } from 'react'
import { sfxEmitter } from '../../../lib/sfx-bus'
import useEditor from '../../../store/use-editor'
import { ActionButton, ActionGroup } from '../controls/action-button'
import { PanelSection } from '../controls/panel-section'
import { SliderControl } from '../controls/slider-control'
import { PanelWrapper } from './panel-wrapper'
import { cn } from '../../../lib/utils'

export function ColumnPanel() {
  const selectedIds = useViewer((s) => s.selection.selectedIds)
  const setSelection = useViewer((s) => s.setSelection)
  const nodes = useScene((s) => s.nodes)
  const updateNode = useScene((s) => s.updateNode)
  const deleteNode = useScene((s) => s.deleteNode)
  const createNode = useScene((s) => s.createNode)
  const setMovingNode = useEditor((s) => s.setMovingNode)

  const selectedId = selectedIds[0]
  const node = selectedId ? (nodes[selectedId as AnyNode['id']] as ColumnNode | undefined) : undefined

  const handleUpdate = useCallback(
    (updates: Partial<ColumnNode>) => {
      if (!selectedId) return
      updateNode(selectedId as AnyNode['id'], updates)
      useScene.getState().dirtyNodes.add(selectedId as AnyNodeId)
    },
    [selectedId, updateNode],
  )

  const handleMove = useCallback(() => {
    if (!node) return
    sfxEmitter.emit('sfx:item-pick')
    setMovingNode(node)
    setSelection({ selectedIds: [] })
  }, [node, setMovingNode, setSelection])

  const handleDelete = useCallback(() => {
    if (!selectedId) return
    sfxEmitter.emit('sfx:item-delete')
    deleteNode(selectedId as AnyNode['id'])
    setSelection({ selectedIds: [] })
  }, [selectedId, deleteNode, setSelection])

  const handleDuplicate = useCallback(() => {
    if (!node) return
    sfxEmitter.emit('sfx:item-pick')
    useScene.temporal.getState().pause()
    const cloned = structuredClone(node)
    delete (cloned as any).id
    const duplicate = ColumnNode.parse({
      ...cloned,
      name: `${node.name || 'Column'} (Copy)`,
      position: [node.position[0] + 0.5, node.position[1], node.position[2] + 0.5],
    })
    createNode(duplicate, node.parentId as AnyNodeId)
    setMovingNode(duplicate)
    setSelection({ selectedIds: [] })
    useScene.temporal.getState().resume()
  }, [node, createNode, setMovingNode, setSelection])

  const handleClose = useCallback(() => {
    setSelection({ selectedIds: [] })
  }, [setSelection])

  if (!node || node.type !== 'column' || selectedIds.length !== 1) return null

  return (
    <PanelWrapper
      icon="/icons/column.png"
      onClose={handleClose}
      title={node.name || 'Column'}
      width={280}
    >
      <PanelSection title="Unit Dimensions">
        <SliderControl
          label="Width (En)"
          max={5000}
          min={10}
          onChange={(v) => handleUpdate({ width: v / 1000 })}
          precision={0}
          step={10}
          unit="mm"
          value={(node.width ?? 0.4) * 1000}
        />
        <SliderControl
          label="Depth (Boy)"
          max={5000}
          min={10}
          onChange={(v) => handleUpdate({ depth: v / 1000 })}
          precision={0}
          step={10}
          unit="mm"
          value={(node.depth ?? 0.4) * 1000}
        />
        <SliderControl
          label="Height (Yükseklik)"
          max={20000}
          min={100}
          onChange={(v) => handleUpdate({ height: v / 1000 })}
          precision={0}
          step={100}
          unit="mm"
          value={(node.height ?? 3.0) * 1000}
        />
      </PanelSection>

      <PanelSection title="Array (Dizilim) Settings">
        <div className="space-y-4">
          <div>
            <SliderControl
              label="Horizontal Count (Adet)"
              max={50}
              min={1}
              onChange={(v) => handleUpdate({ horizontalCount: Math.round(v) })}
              precision={0}
              step={1}
              value={node.horizontalCount ?? 1}
            />
            {(node.horizontalCount ?? 1) > 1 && (
              <SliderControl
                label="Horizontal Gap (Net Boşluk)"
                max={100000}
                min={0}
                onChange={(v) => handleUpdate({ horizontalSpacing: v / 1000 })}
                precision={0}
                step={50}
                unit="mm"
                value={(node.horizontalSpacing ?? 1.0) * 1000}
              />
            )}
          </div>

          <div className="pt-2 border-t border-white/5">
            <SliderControl
              label="Vertical Count (Adet)"
              max={50}
              min={1}
              onChange={(v) => handleUpdate({ verticalCount: Math.round(v) })}
              precision={0}
              step={1}
              value={node.verticalCount ?? 1}
            />
            {(node.verticalCount ?? 1) > 1 && (
              <SliderControl
                label="Vertical Gap (Net Boşluk)"
                max={100000}
                min={0}
                onChange={(v) => handleUpdate({ verticalSpacing: v / 1000 })}
                precision={0}
                step={50}
                unit="mm"
                value={(node.verticalSpacing ?? 1.0) * 1000}
              />
            )}
          </div>
        </div>
      </PanelSection>

      <PanelSection title="Material & Color">
        <div className="flex flex-col gap-3 px-2 py-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Type</span>
            <div className="flex rounded-md bg-white/5 p-0.5">
              {(['concrete', 'metal'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => handleUpdate({ materialType: type })}
                  className={cn(
                    "px-3 py-1 text-[10px] font-medium transition-all rounded",
                    node.materialType === type 
                      ? "bg-white/10 text-white shadow-sm" 
                      : "text-muted-foreground hover:text-white"
                  )}
                >
                  {type === 'concrete' ? 'Beton' : 'Metal'}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Color</span>
            <input 
              type="color" 
              value={node.color ?? '#808080'}
              onChange={(e) => handleUpdate({ color: e.target.value })}
              className="h-6 w-10 cursor-pointer rounded bg-transparent border-none"
            />
          </div>
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
