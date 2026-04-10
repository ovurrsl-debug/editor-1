'use client'

import { ColumnNode, emitter, type GridEvent, useScene, type SlabEvent } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useRef } from 'react'
import { type Group, type Mesh } from 'three'
import { EDITOR_LAYER } from '../../../lib/constants'
import { sfxEmitter } from '../../../lib/sfx-bus'
import { CursorSphere } from '../shared/cursor-sphere'

export const ColumnTool: React.FC = () => {
  const cursorRef = useRef<Group>(null)
  const previewRef = useRef<Mesh>(null!)

  useEffect(() => {
    const onGridMove = (event: GridEvent | SlabEvent) => {
      if (!cursorRef.current || !previewRef.current) return

      const pos = event.position
      // Snap to 10cm grid
      const snapX = Math.round(pos[0] * 10) / 10
      const snapZ = Math.round(pos[2] * 10) / 10
      
      cursorRef.current.position.set(snapX, pos[1], snapZ)
      
      // Update preview position (centered vertically so base is at grid)
      const height = 3.0 // default height
      previewRef.current.position.set(snapX, pos[1] + height / 2, snapZ)
      previewRef.current.visible = true
    }

    const onGridClick = (event: GridEvent | SlabEvent) => {
      const levelId = useViewer.getState().selection.levelId
      if (!levelId) return

      const pos = event.position
      const snapX = Math.round(pos[0] * 10) / 10
      const snapZ = Math.round(pos[2] * 10) / 10

      const state = useScene.getState()
      const columnCount = Object.values(state.nodes).filter((n) => n.type === 'column').length

      const node = ColumnNode.parse({
        name: `Column ${columnCount + 1}`,
        position: [snapX, pos[1], snapZ],
        width: 0.4,
        depth: 0.4,
        height: 3.0,
        parentId: levelId,
      })

      state.createNode(node, levelId)
      sfxEmitter.emit('sfx:item-place')
    }

    const onCancel = () => {
      if (previewRef.current) previewRef.current.visible = false
    }

    emitter.on('grid:move', onGridMove)
    emitter.on('grid:click', onGridClick)
    emitter.on('slab:move', onGridMove)
    emitter.on('slab:click', onGridClick)
    emitter.on('tool:cancel', onCancel)

    return () => {
      emitter.off('grid:move', onGridMove)
      emitter.off('grid:click', onGridClick)
      emitter.off('slab:move', onGridMove)
      emitter.off('slab:click', onGridClick)
      emitter.off('tool:cancel', onCancel)
    }
  }, [])

  return (
    <group>
      <CursorSphere ref={cursorRef} />
      <mesh layers={EDITOR_LAYER} ref={previewRef} visible={false}>
        <boxGeometry args={[0.4, 3.0, 0.4]} />
        <meshBasicMaterial
          color="#38bdf8"
          opacity={0.5}
          transparent
          depthTest={false}
        />
      </mesh>
    </group>
  )
}
