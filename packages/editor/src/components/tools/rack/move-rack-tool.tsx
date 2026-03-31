'use client'

import {
  type AnyNodeId,
  RackNode,
  emitter,
  sceneRegistry,
  spatialGridManager,
  useScene,
  type WallEvent,
  type GridEvent,
  type SlabEvent,
} from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { BoxGeometry, EdgesGeometry, type Group } from 'three'
import { LineBasicNodeMaterial } from 'three/webgpu'
import { EDITOR_LAYER } from '../../../lib/constants'
import { sfxEmitter } from '../../../lib/sfx-bus'
import useEditor from '../../../store/use-editor'
import {
  calculateCursorRotation,
  calculateItemRotation,
  isValidWallSideFace,
  snapToHalf,
} from '../item/placement-math'
import { clampToWall, hasWallChildOverlap, wallLocalToWorld } from '../door/door-math'

const edgeMaterial = new LineBasicNodeMaterial({
  color: 0x22_c5_5e,
  linewidth: 3,
  depthTest: false,
  depthWrite: false,
})

export const MoveRackTool: React.FC<{ node: RackNode }> = ({ node: movingRackNode }) => {
  const cursorGroupRef = useRef<Group>(null!)
  const isLibrary = movingRackNode.variant === 'library'

  const exitMoveMode = useCallback(() => {
    useEditor.getState().setMovingNode(null)
  }, [])

  useEffect(() => {
    useScene.temporal.getState().pause()

    const meta =
      typeof movingRackNode.metadata === 'object' && movingRackNode.metadata !== null
        ? (movingRackNode.metadata as Record<string, unknown>)
        : {}
    const isNew = !!meta.isNew

    const original = {
      position: [...movingRackNode.position] as [number, number, number],
      rotation: [...movingRackNode.rotation] as [number, number, number],
      parentId: movingRackNode.parentId,
      metadata: movingRackNode.metadata,
    }

    if (!isNew) {
      useScene.getState().updateNode(movingRackNode.id, {
        metadata: { ...meta, isTransient: true },
      })
    }

    let currentParentId: string | null = movingRackNode.parentId

    const markParentDirty = (parentId: string | null) => {
      if (parentId) useScene.getState().dirtyNodes.add(parentId as AnyNodeId)
    }

    const getLevelId = () => useViewer.getState().selection.levelId
    const getLevelYOffset = () => {
      const id = getLevelId()
      return id ? (sceneRegistry.nodes.get(id as AnyNodeId)?.position.y ?? 0) : 0
    }
    const getSlabElevation = (wallEvent: WallEvent) =>
      spatialGridManager.getSlabElevationForWall(
        wallEvent.node.parentId ?? '',
        wallEvent.node.start,
        wallEvent.node.end,
      )

    const hideCursor = () => {
      if (cursorGroupRef.current) cursorGroupRef.current.visible = false
    }

    const updateCursor = (
      worldPosition: [number, number, number],
      rotationY: number,
      valid: boolean,
    ) => {
      const group = cursorGroupRef.current
      if (!group) return
      group.visible = true
      group.position.set(...worldPosition)
      group.rotation.y = rotationY
      edgeMaterial.color.setHex(valid ? 0x22_c5_5e : 0xef_44_44)
    }

    // --- Wall Handlers (for Library Variant) ---
    const onWallEnter = (event: WallEvent) => {
      if (!isLibrary) return
      if (!isValidWallSideFace(event.normal)) return
      if (event.node.parentId !== getLevelId()) return

      const itemRotation = calculateItemRotation(event.normal)
      const cursorRotation = calculateCursorRotation(event.normal, event.node.start, event.node.end)

      const localX = snapToHalf(event.localPosition[0])
      const { clampedX } = clampToWall(
        event.node,
        localX,
        movingRackNode.unitWidth,
        movingRackNode.unitHeight,
      )

      const prevParentId = currentParentId
      currentParentId = event.node.id

      const rackDepth = movingRackNode.layoutDir === 'v' ? movingRackNode.unitWidth : movingRackNode.unitDepth
      const zOffset = (event.node.thickness || 0.1) / 2 + rackDepth / 2 + (movingRackNode.wallGap || 0)

      const valid = !hasWallChildOverlap(
        event.node.id,
        clampedX,
        movingRackNode.unitHeight / 2,
        movingRackNode.unitWidth,
        movingRackNode.unitHeight,
        movingRackNode.id,
      )

      const rotY = (movingRackNode.layoutDir === 'v' ? Math.PI / 2 : 0)
      updateCursor(
        wallLocalToWorld(
          event.node,
          clampedX,
          0,
          getLevelYOffset(),
          getSlabElevation(event),
          zOffset,
        ),
        cursorRotation + rotY,
        valid,
      )

      useScene.getState().updateNode(movingRackNode.id, {
        position: [clampedX, 0, zOffset],
        rotation: [0, itemRotation, 0],
        parentId: event.node.id,
      })

      if (prevParentId && prevParentId !== event.node.id) markParentDirty(prevParentId)
      markParentDirty(event.node.id)

      event.stopPropagation()
    }

    const onWallMove = (event: WallEvent) => {
      if (!isLibrary) return
      if (!isValidWallSideFace(event.normal)) return
      if (event.node.parentId !== getLevelId()) return

      const itemRotation = calculateItemRotation(event.normal)
      const cursorRotation = calculateCursorRotation(event.normal, event.node.start, event.node.end)

      const localX = snapToHalf(event.localPosition[0])
      const { clampedX } = clampToWall(
        event.node,
        localX,
        movingRackNode.unitWidth,
        movingRackNode.unitHeight,
      )

      const rackDepth = movingRackNode.layoutDir === 'v' ? movingRackNode.unitWidth : movingRackNode.unitDepth
      const zOffset = (event.node.thickness || 0.1) / 2 + rackDepth / 2 + (movingRackNode.wallGap || 0)

      useScene.getState().updateNode(movingRackNode.id, {
        position: [clampedX, 0, zOffset],
        rotation: [0, itemRotation, 0],
        parentId: event.node.id,
      })

      if (currentParentId !== event.node.id) {
        markParentDirty(currentParentId)
        currentParentId = event.node.id
      }
      markParentDirty(event.node.id)

      const valid = !hasWallChildOverlap(
        event.node.id,
        clampedX,
        movingRackNode.unitHeight / 2,
        movingRackNode.unitWidth,
        movingRackNode.unitHeight,
        movingRackNode.id,
      )

      const rotY = (movingRackNode.layoutDir === 'v' ? Math.PI / 2 : 0)
      updateCursor(
        wallLocalToWorld(
          event.node,
          clampedX,
          0,
          getLevelYOffset(),
          getSlabElevation(event),
          zOffset,
        ),
        cursorRotation + rotY,
        valid,
      )
      event.stopPropagation()
    }

    const onWallClick = (event: WallEvent) => {
      if (!isLibrary) return
      if (!isValidWallSideFace(event.normal)) return
      if (event.node.parentId !== getLevelId()) return

      const itemRotation = calculateItemRotation(event.normal)
      const localX = snapToHalf(event.localPosition[0])
      const { clampedX } = clampToWall(
        event.node,
        localX,
        movingRackNode.unitWidth,
        movingRackNode.unitHeight,
      )

      const valid = !hasWallChildOverlap(
        event.node.id,
        clampedX,
        movingRackNode.unitHeight / 2,
        movingRackNode.unitWidth,
        movingRackNode.unitHeight,
        movingRackNode.id,
      )
      if (!valid) return

      const rackDepth = movingRackNode.layoutDir === 'v' ? movingRackNode.unitWidth : movingRackNode.unitDepth
      const zOffset = (event.node.thickness || 0.1) / 2 + rackDepth / 2 + (movingRackNode.wallGap || 0)

      let placedId: string
      if (isNew) {
        useScene.getState().deleteNode(movingRackNode.id)
        useScene.temporal.getState().resume()
        const cloned = structuredClone(movingRackNode) as any
        delete cloned.id
        const node = RackNode.parse({
          ...cloned,
          position: [clampedX, 0, zOffset],
          rotation: [0, itemRotation, 0],
          parentId: event.node.id,
        })
        useScene.getState().createNode(node, event.node.id as AnyNodeId)
        placedId = node.id
      } else {
        useScene.getState().updateNode(movingRackNode.id, {
          position: original.position,
          rotation: original.rotation,
          parentId: original.parentId,
          metadata: original.metadata,
        })
        useScene.temporal.getState().resume()
        useScene.getState().updateNode(movingRackNode.id, {
          position: [clampedX, 0, zOffset],
          rotation: [0, itemRotation, 0],
          parentId: event.node.id,
          metadata: {},
        })
        if (original.parentId && original.parentId !== event.node.id) {
          markParentDirty(original.parentId)
        }
        placedId = movingRackNode.id
      }

      markParentDirty(event.node.id)
      useScene.temporal.getState().pause()
      sfxEmitter.emit('sfx:item-place')
      hideCursor()
      useViewer.getState().setSelection({ selectedIds: [placedId] })
      exitMoveMode()
      event.stopPropagation()
    }

    // --- Floor Handlers (for Standard Variant) ---
    const onGridMove = (event: GridEvent | SlabEvent) => {
      if (isLibrary) return
      const snapX = Math.round(event.position[0] * 10) / 10
      const snapZ = Math.round(event.position[2] * 10) / 10
      
      const prevParentId = currentParentId
      currentParentId = getLevelId()
      
      useScene.getState().updateNode(movingRackNode.id, {
        position: [snapX, event.position[1], snapZ],
        parentId: currentParentId,
      })

      if (prevParentId && prevParentId !== currentParentId) markParentDirty(prevParentId)
      markParentDirty(currentParentId)

      const rotY = (movingRackNode.layoutDir === 'v' ? Math.PI / 2 : 0)
      updateCursor([snapX, event.position[1], snapZ], movingRackNode.rotation[1] + rotY, true)
    }

    const onGridClick = (event: GridEvent | SlabEvent) => {
      if (isLibrary) return
      const snapX = Math.round(event.position[0] * 10) / 10
      const snapZ = Math.round(event.position[2] * 10) / 10
      const levelId = getLevelId()
      if (!levelId) return

      let placedId: string
      if (isNew) {
        useScene.getState().deleteNode(movingRackNode.id)
        useScene.temporal.getState().resume()
        const cloned = structuredClone(movingRackNode) as any
        delete cloned.id
        const node = RackNode.parse({
          ...cloned,
          position: [snapX, event.position[1], snapZ],
          parentId: levelId,
        })
        useScene.getState().createNode(node, levelId as AnyNodeId)
        placedId = node.id
      } else {
        useScene.getState().updateNode(movingRackNode.id, {
          position: original.position,
          parentId: original.parentId,
          metadata: original.metadata,
        })
        useScene.temporal.getState().resume()
        useScene.getState().updateNode(movingRackNode.id, {
          position: [snapX, event.position[1], snapZ],
          parentId: levelId,
          metadata: {},
        })
        if (original.parentId && original.parentId !== levelId) {
          markParentDirty(original.parentId)
        }
        placedId = movingRackNode.id
      }

      markParentDirty(levelId)
      useScene.temporal.getState().pause()
      sfxEmitter.emit('sfx:item-place')
      hideCursor()
      useViewer.getState().setSelection({ selectedIds: [placedId] })
      exitMoveMode()
      if ('stopPropagation' in event) event.stopPropagation()
    }

    const onCancel = () => {
      if (isNew) {
        useScene.getState().deleteNode(movingRackNode.id)
        if (currentParentId) markParentDirty(currentParentId)
      } else {
        useScene.getState().updateNode(movingRackNode.id, {
          position: original.position,
          rotation: original.rotation,
          parentId: original.parentId,
          metadata: original.metadata,
        })
        if (original.parentId) markParentDirty(original.parentId)
      }
      useScene.temporal.getState().resume()
      hideCursor()
      exitMoveMode()
    }

    emitter.on('wall:enter', onWallEnter)
    emitter.on('wall:move', onWallMove)
    emitter.on('wall:click', onWallClick)
    emitter.on('grid:move', onGridMove)
    emitter.on('slab:move', onGridMove)
    emitter.on('grid:click', onGridClick)
    emitter.on('slab:click', onGridClick)
    emitter.on('tool:cancel', onCancel)

    return () => {
      useScene.temporal.getState().resume()
      emitter.off('wall:enter', onWallEnter)
      emitter.off('wall:move', onWallMove)
      emitter.off('wall:click', onWallClick)
      emitter.off('grid:move', onGridMove)
      emitter.off('slab:move', onGridMove)
      emitter.off('grid:click', onGridClick)
      emitter.off('slab:click', onGridClick)
      emitter.off('tool:cancel', onCancel)
    }
  }, [movingRackNode, exitMoveMode, isLibrary])

  const edgesGeo = useMemo(() => {
    const boxGeo = new BoxGeometry(
      movingRackNode.unitWidth,
      movingRackNode.unitHeight,
      movingRackNode.unitDepth,
    )
    // Pivot at bottom center
    boxGeo.translate(0, movingRackNode.unitHeight / 2, 0)
    const geo = new EdgesGeometry(boxGeo)
    boxGeo.dispose()
    return geo
  }, [movingRackNode])

  return (
    <group ref={cursorGroupRef} visible={false}>
      <lineSegments geometry={edgesGeo} layers={EDITOR_LAYER} material={edgeMaterial} />
    </group>
  )
}
