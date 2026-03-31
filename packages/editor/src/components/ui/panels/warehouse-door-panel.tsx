'use client'

import { type AnyNode, type AnyNodeId, WarehouseDoorNode, WarehouseDoorType, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { Copy, FlipHorizontal2, Move, Trash2 } from 'lucide-react'
import { useCallback } from 'react'
import { sfxEmitter } from '../../../lib/sfx-bus'
import useEditor from '../../../store/use-editor'
import { ActionButton, ActionGroup } from '../controls/action-button'
import { PanelSection } from '../controls/panel-section'
import { SegmentedControl } from '../controls/segmented-control'
import { SliderControl } from '../controls/slider-control'
import { ToggleControl } from '../controls/toggle-control'
import { PanelWrapper } from './panel-wrapper'

export function WarehouseDoorPanel() {
  const selectedIds = useViewer((s) => s.selection.selectedIds)
  const setSelection = useViewer((s) => s.setSelection)
  const nodes = useScene((s) => s.nodes)
  const updateNode = useScene((s) => s.updateNode)
  const deleteNode = useScene((s) => s.deleteNode)
  const setMovingNode = useEditor((s) => s.setMovingNode)

  const selectedId = selectedIds[0]
  const node = selectedId ? (nodes[selectedId as AnyNode['id']] as WarehouseDoorNode | undefined) : undefined

  const handleUpdate = useCallback(
    (updates: Partial<WarehouseDoorNode>) => {
      if (!selectedId) return
      updateNode(selectedId as AnyNode['id'], updates)
      useScene.getState().dirtyNodes.add(selectedId as AnyNodeId)
    },
    [selectedId, updateNode],
  )

  const handleClose = useCallback(() => {
    setSelection({ selectedIds: [] })
  }, [setSelection])

  const handleFlip = useCallback(() => {
    if (!node) return
    handleUpdate({
      side: node.side === 'front' ? 'back' : 'front',
      rotation: [node.rotation[0], node.rotation[1] + Math.PI, node.rotation[2]],
    })
  }, [node, handleUpdate])

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

  if (!node || node.type !== 'warehouse-door' || selectedIds.length !== 1) return null

  return (
    <PanelWrapper
      icon="/icons/door.png"
      onClose={handleClose}
      title={node.name || 'Warehouse Door'}
      width={320}
    >
      <PanelSection title="Warehouse Door Type">
        <div className="flex flex-col gap-2 px-1 pb-1">
          <SegmentedControl
            onChange={(v) => handleUpdate({ warehouseType: v as WarehouseDoorType })}
            options={[
              { label: 'Swing', value: 'swing' },
              { label: 'PVC', value: 'high-speed-pvc' },
              { label: 'Monoral', value: 'monorail' },
              { label: 'Section', value: 'sectional' },
            ]}
            value={node.warehouseType}
          />
        </div>
      </PanelSection>

      <PanelSection title="Dimensions">
        <SliderControl
          label="Width"
          max={6}
          min={1}
          onChange={(v) => handleUpdate({ width: v })}
          precision={2}
          step={0.1}
          unit="m"
          value={node.width}
        />
        <SliderControl
          label="Height"
          max={6}
          min={2}
          onChange={(v) =>
            handleUpdate({ height: v, position: [node.position[0], v / 2, node.position[2]] })
          }
          precision={2}
          step={0.1}
          unit="m"
          value={node.height}
        />
        <SliderControl
          label="Frame Depth"
          max={0.5}
          min={0.05}
          onChange={(v) => handleUpdate({ frameDepth: v })}
          precision={2}
          step={0.01}
          unit="m"
          value={node.frameDepth ?? 0.07}
        />
      </PanelSection>

      <PanelSection title="Visuals">
        {node.warehouseType !== 'swing' && (
          <>
            <SliderControl
              label="Hood Height"
              max={1}
              min={0.1}
              onChange={(v) => handleUpdate({ hoodHeight: v })}
              precision={2}
              step={0.05}
              unit="m"
              value={node.hoodHeight ?? 0.4}
            />
             <SliderControl
              label="Hood Depth"
              max={1}
              min={0.1}
              onChange={(v) => handleUpdate({ hoodDepth: v })}
              precision={2}
              step={0.05}
              unit="m"
              value={node.hoodDepth ?? 0.4}
            />
          </>
        )}
        {node.warehouseType === 'high-speed-pvc' && (
          <SliderControl
            label="Track Width"
            max={0.4}
            min={0.05}
            onChange={(v) => handleUpdate({ trackWidth: v })}
            precision={2}
            step={0.01}
            unit="m"
            value={node.trackWidth ?? 0.12}
          />
        )}
        {node.warehouseType === 'monorail' && (
          <SliderControl
            label="Rail Thick."
            max={0.2}
            min={0.02}
            onChange={(v) => handleUpdate({ railThickness: v })}
            precision={2}
            step={0.01}
            unit="m"
            value={node.railThickness ?? 0.05}
          />
        )}
      </PanelSection>

      <PanelSection title="Properties">
        <ToggleControl
          checked={node.insulated}
          label="Insulated"
          onChange={(v) => handleUpdate({ insulated: v })}
        />
        <ToggleControl
          checked={node.visionPanel}
          label="Vision Panel"
          onChange={(v) => handleUpdate({ visionPanel: v })}
        />
        {(node.warehouseType === 'monorail' || node.warehouseType === 'sectional') && (
          <ToggleControl
            checked={node.hasPassDoor ?? false}
            label="Personel Kapısı"
            onChange={(v) => handleUpdate({ hasPassDoor: v } as any)}
          />
        )}
      </PanelSection>

      <PanelSection title="Actions">
        <ActionGroup>
          <ActionButton icon={<Move className="h-3.5 w-3.5" />} label="Move" onClick={handleMove} />
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
