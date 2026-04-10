import {
  type RackNode,
  computeLevelPositions,
  useRegistry,
} from '@pascal-app/core'
import { useEffect, useMemo, useRef } from 'react'
import type { Group } from 'three'
import { useNodeEvents } from '../../../hooks/use-node-events'
import { useRackManager } from './use-rack-manager'

export const RackRenderer = ({ node }: { node: RackNode }) => {
  const ref = useRef<Group>(null!)
  useRegistry(node.id, node.type, ref)
  const handlers = useNodeEvents(node, 'rack')
  const registerRack = useRackManager((s) => s.registerRack)
  const unregisterRack = useRackManager((s) => s.unregisterRack)

  const {
    unitWidth: W = 2.7,
    unitDepth: D = 1.1,
    config = [1],
    layoutDir = 'v',
    corridorGap: cGap = 5.0,
    bayGap: bGap = 0,
    backToBack = true,
    backToBackGap: b2bGap = 0.2,
    skip = [],
    tunnels = {},
  } = node

  const levelYPositions = useMemo(() => computeLevelPositions(node), [node])

  const units = useMemo(() => {
    const result: {
      lx: number
      lz: number
      row: number
      col: number
      side: 'f' | 'b'
      emptyLevels: number
    }[] = []

    const maxRows = Math.max(...config, 0)
    const totalRowDepth = backToBack ? 2 * D + b2bGap : D

    config.forEach((rowCount, rowIndex) => {
      const rowOffset = (maxRows - rowCount) * (W + bGap)
      const sideCount = backToBack ? 2 : 1
      const rowStride = totalRowDepth + cGap

      for (let side = 0; side < sideCount; side++) {
        for (let r = 0; r < rowCount; r++) {
          const baseKey = `${rowIndex}-${r}`
          const sideChar = side === 0 ? 'f' : 'b'
          const sideKey = `${baseKey}-${sideChar}`
          if (skip.includes(baseKey) || skip.includes(sideKey)) continue
          const emptyLevels = tunnels[sideKey] ?? tunnels[baseKey] ?? 0
          
          let lx: number
          let lz: number
          const localDepthOff = side * (D + b2bGap)
          
          if (layoutDir === 'v') {
            lx = rowIndex * rowStride + localDepthOff
            lz = rowOffset + r * (W + bGap)
          } else {
            lx = rowOffset + r * (W + bGap)
            lz = rowIndex * rowStride + localDepthOff
          }
          result.push({ lx, lz, row: rowIndex, col: r, side: sideChar as 'f' | 'b', emptyLevels })
        }
      }
    })
    return result
  }, [config, W, D, backToBack, b2bGap, layoutDir, cGap, skip, tunnels, bGap])

  const rotY = layoutDir === 'v' ? Math.PI / 2 : 0

  // Register with global manager for batched rendering
  useEffect(() => {
    registerRack(node.id, {
      id: node.id,
      node,
      units,
      levelYPositions,
      rotY
    })
    return () => unregisterRack(node.id)
  }, [node, units, levelYPositions, rotY, registerRack, unregisterRack])

  return (
    <group 
      ref={ref} 
      position={node.position} 
      rotation={node.rotation} 
      visible={node.visible ?? true} 
      {...handlers} 
    >
      {/* Hitbox for selection - spans the entire rack configuration */}
      <mesh visible={false}>
        <boxGeometry args={[Math.max(...node.config) * node.unitWidth, node.unitHeight, node.unitDepth * (node.backToBack ? 2 : 1)]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  )
}

