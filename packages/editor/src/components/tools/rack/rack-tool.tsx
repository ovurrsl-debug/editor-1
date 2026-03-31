import {
  type AnyNodeId,
  RackNode,
  emitter,
  useScene,
  type GridEvent,
  type SlabEvent
} from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useRef } from 'react'
import { BoxGeometry, EdgesGeometry, type Group, type LineSegments } from 'three'
import { LineBasicNodeMaterial } from 'three/webgpu'
import { EDITOR_LAYER } from '../../../lib/constants'
import { sfxEmitter } from '../../../lib/sfx-bus'

const edgeMaterial = new LineBasicNodeMaterial({
  color: 0x22_c5_5e,
  linewidth: 3,
  depthTest: false,
  depthWrite: false,
})

export const RackTool: React.FC = () => {
  const cursorGroupRef = useRef<Group>(null!)
  const edgesRef = useRef<LineSegments>(null!)
  const currentLevelIdRef = useRef<string | null>(null)

  useEffect(() => {
    // Keep reference updated
    currentLevelIdRef.current = useViewer.getState().selection.levelId

    const hideCursor = () => {
      if (cursorGroupRef.current) cursorGroupRef.current.visible = false
    }

    const updateCursor = (worldPosition: [number, number, number]) => {
      const group = cursorGroupRef.current
      if (!group) return
      group.visible = true
      // Snap to grid or just follow pointer
      const snapX = Math.round(worldPosition[0] * 10) / 10
      const snapZ = Math.round(worldPosition[2] * 10) / 10
      group.position.set(snapX, worldPosition[1], snapZ)
    }

    const onGridMove = (event: GridEvent | SlabEvent) => {
      updateCursor(event.position)
    }

    const onGridClick = (event: GridEvent | SlabEvent) => {
      const levelId = currentLevelIdRef.current
      if (!levelId) return

      const snapX = Math.round(event.position[0] * 10) / 10
      const snapZ = Math.round(event.position[2] * 10) / 10

      // Pause history to bundle potential actions
      useScene.temporal.getState().resume()

      const state = useScene.getState()
      const rackCount = Object.values(state.nodes).filter((n) => n.type === 'rack').length
      const name = `Rack ${rackCount + 1}`

      const node = RackNode.parse({
        name,
        position: [snapX, event.position[1], snapZ],
        rotation: [0, 0, 0],
        parentId: levelId,
      })

      state.createNode(node, levelId as AnyNodeId)
      useViewer.getState().setSelection({ selectedIds: [node.id] })
      
      sfxEmitter.emit('sfx:item-place')
      if ('stopPropagation' in event) {
        event.stopPropagation()
      }
    }

    const onCancel = () => {
      hideCursor()
    }

    emitter.on('grid:move', onGridMove)
    emitter.on('slab:move', onGridMove)
    emitter.on('grid:click', onGridClick)
    emitter.on('slab:click', onGridClick)
    emitter.on('tool:cancel', onCancel)

    return () => {
      hideCursor()
      emitter.off('grid:move', onGridMove)
      emitter.off('slab:move', onGridMove)
      emitter.off('grid:click', onGridClick)
      emitter.off('slab:click', onGridClick)
      emitter.off('tool:cancel', onCancel)
    }
  }, [])

  // Cursor geometry: visual bounds of a standard rack unit
  const boxGeo = new BoxGeometry(2.7, 6.0, 1.1)
  // Shift pivot to bottom center
  boxGeo.translate(0, 3.0, 0)
  const edgesGeo = new EdgesGeometry(boxGeo)
  boxGeo.dispose()

  return (
    <group ref={cursorGroupRef} visible={false} rotation={[0, Math.PI / 2, 0]}>
      <lineSegments
        geometry={edgesGeo}
        layers={EDITOR_LAYER}
        material={edgeMaterial}
        ref={edgesRef}
      />
    </group>
  )
}
