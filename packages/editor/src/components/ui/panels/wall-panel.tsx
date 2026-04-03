'use client'

import { type AnyNode, type AnyNodeId, type MaterialSchema, useScene, type WallNode, WallNode as WallSchema } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { Copy, Move, Trash2 } from 'lucide-react'
import { useCallback } from 'react'
import { sfxEmitter } from '../../../lib/sfx-bus'
import useEditor from '../../../store/use-editor'
import { ActionButton, ActionGroup } from '../controls/action-button'
import { MaterialPicker } from '../controls/material-picker'
import { PanelSection } from '../controls/panel-section'
import { SliderControl } from '../controls/slider-control'
import { PanelWrapper } from './panel-wrapper'

export function WallPanel() {
  const selectedIds = useViewer((s) => s.selection.selectedIds)
  const setSelection = useViewer((s) => s.setSelection)
  const nodes = useScene((s) => s.nodes)
  const updateNode = useScene((s) => s.updateNode)
  const deleteNode = useScene((s) => s.deleteNode)
  const createNode = useScene((s) => s.createNode)
  const setMovingNode = useEditor((s) => s.setMovingNode)

  const selectedId = selectedIds[0]
  const node = selectedId ? (nodes[selectedId as AnyNode['id']] as WallNode | undefined) : undefined

  const handleUpdate = useCallback(
    (updates: Partial<WallNode>) => {
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
    // Pause temporal history for the clone operation
    useScene.temporal.getState().pause()
    const cloned = structuredClone(node)
    delete (cloned as any).id
    // Shift the duplicate slightly so it's not exactly on top if not moved
    const dx = cloned.end[0] - cloned.start[0]
    const dz = cloned.end[1] - cloned.start[1]
    const duplicate = WallSchema.parse({
      ...cloned,
      name: `${node.name || 'Wall'} (Copy)`,
    })
    createNode(duplicate, node.parentId as AnyNodeId)
    setMovingNode(duplicate)
    setSelection({ selectedIds: [] })
    useScene.temporal.getState().resume()
  }, [node, createNode, setMovingNode, setSelection])

  const handleUpdateLength = useCallback((newLength: number) => {
    if (!node || newLength <= 0) return

    const dx = node.end[0] - node.start[0]
    const dz = node.end[1] - node.start[1]
    const currentLength = Math.sqrt(dx * dx + dz * dz)

    if (currentLength === 0) return

    const dirX = dx / currentLength
    const dirZ = dz / currentLength

    const newEnd: [number, number] = [
      node.start[0] + dirX * newLength,
      node.start[1] + dirZ * newLength
    ]

    handleUpdate({ end: newEnd })
  }, [node, handleUpdate])

  const handleMaterialChange = useCallback((material: MaterialSchema) => {
    handleUpdate({ material })
  }, [handleUpdate])

  const handleClose = useCallback(() => {
    setSelection({ selectedIds: [] })
  }, [setSelection])

  if (!node || node.type !== 'wall' || selectedIds.length !== 1) return null

  const dx = node.end[0] - node.start[0]
  const dz = node.end[1] - node.start[1]
  const length = Math.sqrt(dx * dx + dz * dz)

  const height = node.height ?? 2.5
  const thickness = node.thickness ?? 0.1

  return (
    <PanelWrapper
      icon="/icons/wall.png"
      onClose={handleClose}
      title={node.name || 'Wall'}
      width={280}
    >
      <PanelSection title="Dimensions">
        <SliderControl
          label="Length"
          max={200000}
          min={10}
          onChange={(v) => handleUpdateLength(v / 1000)}
          precision={3}
          step={0.001}
          unit="mm"
          value={length * 1000}
        />
        <SliderControl
          label="Height"
          max={60000}
          min={10}
          onChange={(v) => handleUpdate({ height: Math.max(0.01, v / 1000) })}
          precision={1}
          step={1}
          unit="mm"
          value={height * 1000}
        />
        <SliderControl
          label="Thickness"
          max={5000}
          min={1}
          onChange={(v) => handleUpdate({ thickness: Math.max(0.001, v / 1000) })}
          precision={2}
          step={0.1}
          unit="mm"
          value={thickness * 1000}
        />
      </PanelSection>

      <PanelSection title="Material">
        <MaterialPicker
          onChange={handleMaterialChange}
          value={node.material}
        />
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
