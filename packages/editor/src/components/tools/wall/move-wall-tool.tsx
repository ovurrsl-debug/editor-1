import {
  type AnyNodeId,
  emitter,
  useScene,
  type WallNode,
} from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useCallback, useEffect, useRef } from 'react'
import { sfxEmitter } from '../../../lib/sfx-bus'
import useEditor from '../../../store/use-editor'

export const MoveWallTool: React.FC<{ node: WallNode }> = ({
  node: movingWallNode,
}) => {
  const isInitialMove = useRef(true)
  const offset = useRef<[number, number]>([0, 0])

  const exitMoveMode = useCallback(() => {
    useEditor.getState().setMovingNode(null)
  }, [])

  useEffect(() => {
    useScene.temporal.getState().pause()

    const meta =
      typeof movingWallNode.metadata === 'object' && movingWallNode.metadata !== null
        ? (movingWallNode.metadata as Record<string, unknown>)
        : {}
    const isNew = !!meta.isNew

    const original = {
      start: [...movingWallNode.start] as [number, number],
      end: [...movingWallNode.end] as [number, number],
      parentId: movingWallNode.parentId,
      metadata: movingWallNode.metadata,
    }

    if (!isNew) {
      useScene.getState().updateNode(movingWallNode.id, {
        metadata: { ...meta, isTransient: true },
      })
    }

    const onSceneMove = (event: any) => {
      const position = event.position
      if (!position) return

      const px = position[0]
      const pz = position[2]

      // Calculate new points - we directly set wall start to mouse position
      const dx = movingWallNode.end[0] - movingWallNode.start[0]
      const dz = movingWallNode.end[1] - movingWallNode.start[1]

      const newStart: [number, number] = [px, pz]
      const newEnd: [number, number] = [px + dx, pz + dz]

      useScene.getState().updateNode(movingWallNode.id, {
        start: newStart,
        end: newEnd,
      })

      useScene.getState().markDirty(movingWallNode.id as AnyNodeId)
    }

    const onSceneClick = () => {
      useScene.getState().updateNode(movingWallNode.id, {
        metadata: {},
      })
      useScene.temporal.getState().resume()
      sfxEmitter.emit('sfx:item-place')
      useViewer.getState().setSelection({ selectedIds: [movingWallNode.id] })
      exitMoveMode()
    }

    const onCancel = () => {
      useScene.getState().updateNode(movingWallNode.id, {
        start: original.start,
        end: original.end,
        metadata: original.metadata,
      })
      useScene.temporal.getState().resume()
      exitMoveMode()
    }

    emitter.on('grid:move', onSceneMove)
    emitter.on('grid:click', onSceneClick)
    emitter.on('tool:cancel', onCancel)

    return () => {
      useScene.temporal.getState().resume()
      emitter.off('grid:move', onSceneMove)
      emitter.off('grid:click', onSceneClick)
      emitter.off('tool:cancel', onCancel)
    }
  }, [movingWallNode, exitMoveMode])

  return null
}
