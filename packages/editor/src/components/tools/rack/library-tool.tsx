import {
  type AnyNodeId,
  RackNode,
  emitter,
  sceneRegistry,
  spatialGridManager,
  useScene,
  type WallEvent,
} from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useRef } from 'react'
import { BoxGeometry, EdgesGeometry, type Group, type LineSegments } from 'three'
import { LineBasicNodeMaterial } from 'three/webgpu'
import { EDITOR_LAYER } from '../../../lib/constants'
import { sfxEmitter } from '../../../lib/sfx-bus'
import {
  calculateCursorRotation,
  calculateItemRotation,
  getSideFromNormal,
  isValidWallSideFace,
  snapToHalf,
} from '../item/placement-math'
import { clampToWall, hasWallChildOverlap, wallLocalToWorld } from '../door/door-math'

const edgeMaterial = new LineBasicNodeMaterial({
  color: 0xef_44_44,
  linewidth: 3,
  depthTest: false,
  depthWrite: false,
})

export const LibraryTool: React.FC = () => {
  const draftRef = useRef<RackNode | null>(null)
  const cursorGroupRef = useRef<Group>(null!)
  const edgesRef = useRef<LineSegments>(null!)

  useEffect(() => {
    useScene.temporal.getState().pause()

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

    const markWallDirty = (wallId: string) => {
      useScene.getState().dirtyNodes.add(wallId as AnyNodeId)
    }

    const destroyDraft = () => {
      if (!draftRef.current) return
      const wallId = draftRef.current.parentId
      useScene.getState().deleteNode(draftRef.current.id)
      draftRef.current = null
      if (wallId) markWallDirty(wallId)
    }

    const hideCursor = () => {
      if (cursorGroupRef.current) cursorGroupRef.current.visible = false
    }

    const updateCursor = (
      worldPosition: [number, number, number],
      cursorRotationY: number,
      valid: boolean,
    ) => {
      const group = cursorGroupRef.current
      if (!group) return
      group.visible = true
      group.position.set(...worldPosition)
      group.rotation.y = cursorRotationY
      edgeMaterial.color.setHex(valid ? 0x22_c5_5e : 0xef_44_44)
    }

    const onWallEnter = (event: WallEvent) => {
      if (!isValidWallSideFace(event.normal)) return
      const levelId = getLevelId()
      if (!levelId) return
      if (event.node.parentId !== levelId) return

      destroyDraft()

      const itemRotation = calculateItemRotation(event.normal)
      const cursorRotation = calculateCursorRotation(event.normal, event.node.start, event.node.end)

      const localX = snapToHalf(event.localPosition[0])
      const width = 1.0
      const height = 2.1
      // Match rack unit depth to the wall's thickness perfectly for accurate 2D measurement
      const depth = event.node.thickness ?? 0.2

      const { clampedX } = clampToWall(event.node, localX, width, height)
      // Height sits on floor for racks
      const clampedY = 0

      const node = RackNode.parse({
        variant: 'library',
        levels: 1,
        config: [1],
        unitWidth: width,
        unitHeight: height,
        unitDepth: depth,
        deckingType: 'mdf',
        position: [clampedX, clampedY, 0],
        rotation: [0, itemRotation, 0],
        parentId: event.node.id,
        metadata: { isTransient: true },
      })

      useScene.getState().createNode(node, event.node.id as AnyNodeId)
      draftRef.current = node

      const valid = !hasWallChildOverlap(event.node.id, clampedX, height / 2, width, height, node.id)

      updateCursor(
        wallLocalToWorld(
          event.node,
          clampedX,
          clampedY,
          getLevelYOffset(),
          getSlabElevation(event),
        ),
        cursorRotation,
        valid,
      )
      event.stopPropagation()
    }

    const onWallMove = (event: WallEvent) => {
      if (!isValidWallSideFace(event.normal)) return
      if (event.node.parentId !== getLevelId()) return

      const itemRotation = calculateItemRotation(event.normal)
      const cursorRotation = calculateCursorRotation(event.normal, event.node.start, event.node.end)

      const localX = snapToHalf(event.localPosition[0])
      const width = draftRef.current?.unitWidth ?? 1.0
      const height = draftRef.current?.unitHeight ?? 2.1

      const { clampedX } = clampToWall(event.node, localX, width, height)
      const clampedY = 0

      if (draftRef.current) {
        useScene.getState().updateNode(draftRef.current.id, {
          position: [clampedX, clampedY, 0],
          rotation: [0, itemRotation, 0],
          parentId: event.node.id,
        })
      }

      const valid = !hasWallChildOverlap(
        event.node.id,
        clampedX,
        height / 2, // hasWallChildOverlap expects Y at center relative to bounds
        width,
        height,
        draftRef.current?.id,
      )

      updateCursor(
        wallLocalToWorld(
          event.node,
          clampedX,
          clampedY,
          getLevelYOffset(),
          getSlabElevation(event),
        ),
        cursorRotation,
        valid,
      )
      event.stopPropagation()
    }

    const onWallClick = (event: WallEvent) => {
      if (!draftRef.current) return
      if (!isValidWallSideFace(event.normal)) return
      if (event.node.parentId !== getLevelId()) return

      const itemRotation = calculateItemRotation(event.normal)

      const localX = snapToHalf(event.localPosition[0])
      const width = draftRef.current.unitWidth ?? 1.0
      const height = draftRef.current.unitHeight ?? 2.1
      const depth = event.node.thickness ?? 0.2

      const { clampedX } = clampToWall(
        event.node,
        localX,
        width,
        height,
      )
      const clampedY = 0

      const valid = !hasWallChildOverlap(
        event.node.id,
        clampedX,
        height / 2,
        width,
        height,
        draftRef.current.id,
      )
      if (!valid) return

      const draft = draftRef.current
      draftRef.current = null

      useScene.getState().deleteNode(draft.id)
      useScene.temporal.getState().resume()

      const state = useScene.getState()
      const rackCount = Object.values(state.nodes).filter((n) => n.type === 'rack').length
      const name = `Library ${rackCount + 1}`

      const node = RackNode.parse({
        name,
        variant: 'library',
        levels: 1, // Defaulting to 1 per user request
        config: [1], // Defaulting to 1 bay per user request
        unitWidth: width,
        unitHeight: height,
        unitDepth: depth, // Perfectly measuring 2D wall thickness!
        deckingType: 'mdf',
        position: [clampedX, clampedY, 0],
        rotation: [0, itemRotation, 0],
        parentId: event.node.id,
      })

      useScene.getState().createNode(node, event.node.id as AnyNodeId)
      useViewer.getState().setSelection({ selectedIds: [node.id] })
      useScene.temporal.getState().pause()
      sfxEmitter.emit('sfx:item-place')

      event.stopPropagation()
    }

    const onWallLeave = () => {
      destroyDraft()
      hideCursor()
    }

    const onCancel = () => {
      destroyDraft()
      hideCursor()
    }

    emitter.on('wall:enter', onWallEnter)
    emitter.on('wall:move', onWallMove)
    emitter.on('wall:click', onWallClick)
    emitter.on('wall:leave', onWallLeave)
    emitter.on('tool:cancel', onCancel)

    return () => {
      destroyDraft()
      hideCursor()
      useScene.temporal.getState().resume()
      emitter.off('wall:enter', onWallEnter)
      emitter.off('wall:move', onWallMove)
      emitter.off('wall:click', onWallClick)
      emitter.off('wall:leave', onWallLeave)
      emitter.off('tool:cancel', onCancel)
    }
  }, [])

  // Dynamic box geometry that reflects the average library depth (0.2)
  // Shift pivot to bottom center, just like RackTool
  const boxGeo = new BoxGeometry(1.0, 2.1, 0.2)
  boxGeo.translate(0, 2.1 / 2, 0)
  const edgesGeo = new EdgesGeometry(boxGeo)
  boxGeo.dispose()

  return (
    <group ref={cursorGroupRef} visible={false}>
      <lineSegments
        geometry={edgesGeo}
        layers={EDITOR_LAYER}
        material={edgeMaterial}
        ref={edgesRef}
      />
    </group>
  )
}
