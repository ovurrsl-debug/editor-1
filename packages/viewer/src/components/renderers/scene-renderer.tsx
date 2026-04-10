'use client'

import { useScene } from '@pascal-app/core'
import { NodeRenderer } from './node-renderer'
import { GlobalRackRenderer } from './rack/global-rack-renderer'

export const SceneRenderer = () => {
  const rootNodes = useScene((state) => state.rootNodeIds)

  return (
    <group name="scene-renderer">
      <GlobalRackRenderer />
      {rootNodes.map((nodeId) => (
        <NodeRenderer key={nodeId} nodeId={nodeId} />
      ))}
    </group>
  )
}
