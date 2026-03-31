import { type AnyNodeId, type RackNode, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import useEditor from './../../../../../store/use-editor'
import { InlineRenameInput } from './inline-rename-input'
import { focusTreeNode, handleTreeSelection, TreeNodeWrapper } from './tree-node'
import { TreeNodeActions } from './tree-node-actions'

interface RackTreeNodeProps {
  node: RackNode
  depth: number
  isLast?: boolean
}

export function RackTreeNode({ node, depth, isLast }: RackTreeNodeProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const selectedIds = useViewer((state) => state.selection.selectedIds)
  const isSelected = selectedIds.includes(node.id)
  const hoveredId = useViewer((state) => state.hoveredId)
  const isHovered = hoveredId === node.id
  const setSelection = useViewer((state) => state.setSelection)
  const setHoveredId = useViewer((state) => state.setHoveredId)

  useEffect(() => {
    if (selectedIds.length === 0) return
    const nodes = useScene.getState().nodes
    let isDescendant = false
    for (const id of selectedIds) {
      let current = nodes[id as AnyNodeId]
      while (current?.parentId) {
        if (current.parentId === node.id) {
          isDescendant = true
          break
        }
        current = nodes[current.parentId as AnyNodeId]
      }
      if (isDescendant) break
    }
    if (isDescendant) {
      setExpanded(true)
    }
  }, [selectedIds, node.id])

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const handled = handleTreeSelection(e, node.id, selectedIds, setSelection)
    if (!handled && useEditor.getState().phase === 'furnish') {
      useEditor.getState().setPhase('structure')
    }
  }

  const handleDoubleClick = () => {
    focusTreeNode(node.id)
  }

  const handleMouseEnter = () => {
    setHoveredId(node.id)
  }

  const handleMouseLeave = () => {
    setHoveredId(null)
  }

  const defaultName = node.name || 'Rack'
  // RackNode currently does not have children in its schema.
  const hasChildren = false

  return (
    <TreeNodeWrapper
      actions={<TreeNodeActions node={node} />}
      depth={depth}
      expanded={expanded}
      hasChildren={hasChildren}
      icon={
        <Image alt="" className="object-contain" height={14} src="/icons/rack.png" width={14} />
      }
      isHovered={isHovered}
      isLast={isLast}
      isSelected={isSelected}
      isVisible={node.visible !== false}
      label={
        <InlineRenameInput
          defaultName={defaultName}
          isEditing={isEditing}
          node={node}
          onStartEditing={() => setIsEditing(true)}
          onStopEditing={() => setIsEditing(false)}
        />
      }
      nodeId={node.id}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onToggle={() => setExpanded(!expanded)}
    />
  )
}
