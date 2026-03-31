import { type WarehouseDoorNode, useRegistry } from '@pascal-app/core'
import { useRef } from 'react'
import type { Mesh } from 'three'
import { useNodeEvents } from '../../../hooks/use-node-events'

export const WarehouseDoorRenderer = ({ node }: { node: WarehouseDoorNode }) => {
  const ref = useRef<Mesh>(null!)

  useRegistry(node.id, 'warehouse-door', ref)
  const handlers = useNodeEvents(node, 'warehouse-door')
  const isTransient = !!(node.metadata as Record<string, unknown> | null)?.isTransient

  // For now, we use the same box geometry placeholder
  // DoorSystem will replace it with the procedurally generated door mesh
  return (
    <mesh
      castShadow
      position={[node.position[0], node.position[1], node.position[2] + 0.05]} // Offset slightly to avoid Z-fighting with wall
      receiveShadow
      ref={ref}
      rotation={node.rotation}
      visible={node.visible}
      {...(isTransient ? {} : handlers)}
    >
      <boxGeometry args={[0, 0, 0]} />
      <meshStandardMaterial 
        color={
          node.warehouseType === 'high-speed-pvc' ? '#2563eb' : 
          node.warehouseType === 'sectional' ? '#4b5563' : 
          '#d1d5db'
        } 
      />
    </mesh>
  )
}
