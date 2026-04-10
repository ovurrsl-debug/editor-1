import { useRegistry, useScene, type WallNode } from '@pascal-app/core'
import { useLayoutEffect, useMemo, useRef } from 'react'
import type { Mesh } from 'three'
import { useNodeEvents } from '../../../hooks/use-node-events'
import { createMaterial, DEFAULT_WALL_MATERIAL } from '../../../lib/materials'
import { NodeRenderer } from '../node-renderer'

export const WallRenderer = ({ node }: { node: WallNode }) => {
  const ref = useRef<Mesh>(null!)

  useRegistry(node.id, 'wall', ref)

  useLayoutEffect(() => {
    useScene.getState().markDirty(node.id)
  }, [node.id])

  const handlers = useNodeEvents(node, 'wall')

  const material = useMemo(() => {
    const mat = node.material
    if (!mat) return DEFAULT_WALL_MATERIAL
    return createMaterial(mat)
  }, [node.material, node.material?.preset, JSON.stringify(node.material?.properties), node.material?.texture])

  useLayoutEffect(() => {
    useScene.getState().markDirty(node.id)
  }, [node.id, node.material, node.material?.preset, JSON.stringify(node.material?.properties)])

  return (
    <mesh ref={ref} visible={node.visible} material={material}>
      <boxGeometry args={[0, 0, 0]} />
      <mesh name="collision-mesh" visible={false} {...handlers}>
        <boxGeometry args={[0, 0, 0]} />
      </mesh>

      {node.children.map((childId) => (
        <NodeRenderer key={childId} nodeId={childId} />
      ))}
    </mesh>
  )
}
