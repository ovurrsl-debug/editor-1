import {
  type AnyNodeId,
  ColumnNode,
  emitter,
  useScene,
  type GridEvent,
  type SlabEvent,
} from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useCallback, useEffect } from 'react'
import { sfxEmitter } from '../../../lib/sfx-bus'
import useEditor from '../../../store/use-editor'

export const MoveColumnTool: React.FC<{ node: ColumnNode }> = ({
  node: movingColumnNode,
}) => {
  const exitMoveMode = useCallback(() => {
    useEditor.getState().setMovingNode(null)
  }, [])

  useEffect(() => {
    useScene.temporal.getState().pause()

    const meta =
      typeof movingColumnNode.metadata === 'object' && movingColumnNode.metadata !== null
        ? (movingColumnNode.metadata as Record<string, unknown>)
        : {}
    const isNew = !!meta.isNew

    const original = {
      position: [...movingColumnNode.position] as [number, number, number],
      parentId: movingColumnNode.parentId,
      metadata: movingColumnNode.metadata,
    }

    if (!isNew) {
      useScene.getState().updateNode(movingColumnNode.id, {
        metadata: { ...meta, isTransient: true },
      })
    }

    const onSceneMove = (event: GridEvent | SlabEvent) => {
      const position = event.position
      if (!position) return

      // Snap to 10cm grid
      const snapX = Math.round(position[0] * 10) / 10
      const snapZ = Math.round(position[2] * 10) / 10

      useScene.getState().updateNode(movingColumnNode.id, {
        position: [snapX, position[1], snapZ],
      })

      useScene.getState().markDirty(movingColumnNode.id as AnyNodeId)
    }

    const onSceneClick = () => {
      useScene.getState().updateNode(movingColumnNode.id, {
        metadata: {},
      })
      useScene.temporal.getState().resume()
      sfxEmitter.emit('sfx:item-place')
      useViewer.getState().setSelection({ selectedIds: [movingColumnNode.id] })
      exitMoveMode()
    }

    const onCancel = () => {
      useScene.getState().updateNode(movingColumnNode.id, {
        position: original.position,
        metadata: original.metadata,
      })
      useScene.temporal.getState().resume()
      exitMoveMode()
    }

    emitter.on('grid:move', onSceneMove)
    emitter.on('grid:click', onSceneClick)
    emitter.on('slab:move', onSceneMove)
    emitter.on('slab:click', onSceneClick)
    emitter.on('tool:cancel', onCancel)

    return () => {
      useScene.temporal.getState().resume()
      emitter.off('grid:move', onSceneMove)
      emitter.off('grid:click', onSceneClick)
      emitter.off('slab:move', onSceneMove)
      emitter.off('slab:click', onSceneClick)
      emitter.off('tool:cancel', onCancel)
    }
  }, [movingColumnNode, exitMoveMode])

  return null
}
