'use client'

import { type ColumnNode, useRegistry } from '@pascal-app/core'
import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import { useNodeEvents } from '../../../hooks/use-node-events'

export const ColumnRenderer = ({ node }: { node: ColumnNode }) => {
  const ref = useRef<Group>(null!)
  
  // Register the group as the main node representative
  useRegistry(node.id, node.type, ref)
  
  const handlers = useNodeEvents(node, 'column')

  const {
    width = 0.4,
    depth = 0.4,
    height = 3.0,
    horizontalCount = 1,
    horizontalSpacing = 1.0,
    verticalCount = 1,
    verticalSpacing = 1.0,
    color = '#808080',
    materialType = 'concrete',
    position = [0, 0, 0],
    rotation = [0, 0, 0],
  } = node

  const materialProps = useMemo(() => {
    if (materialType === 'metal') {
      return { metalness: 0.8, roughness: 0.2 }
    }
    return { metalness: 0.0, roughness: 0.8 }
  }, [materialType])

  // Generate the offsets for the grid
  const instances = useMemo(() => {
    const items = []
    for (let h = 0; h < horizontalCount; h++) {
      for (let v = 0; v < verticalCount; v++) {
        // Spacing is the CLEAR distance between faces
        const offsetX = h * (width + horizontalSpacing)
        const offsetZ = v * (depth + verticalSpacing)
        items.push({ x: offsetX, z: offsetZ, id: `${h}-${v}` })
      }
    }
    return items
  }, [horizontalCount, verticalCount, horizontalSpacing, verticalSpacing, width, depth])

  return (
    <group
      ref={ref}
      position={position}
      rotation={rotation}
      visible={node.visible ?? true}
    >
      {instances.map((inst) => (
        <mesh
          key={inst.id}
          // Offset each instance based on grid index
          position={[inst.x, height / 2, inst.z]}
          castShadow
          receiveShadow
          {...handlers}
        >
          <boxGeometry args={[width, height, depth]} />
          <meshStandardMaterial color={color} {...materialProps} />
        </mesh>
      ))}
    </group>
  )
}
