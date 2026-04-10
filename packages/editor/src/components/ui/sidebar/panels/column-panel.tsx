import { type AnyNode, type AnyNodeId, ColumnNode, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { Settings2 } from 'lucide-react'
import { PanelSection } from '../shared/panel-section'
import { BasePropertyPanel } from './base-property-panel'
import { InputBox } from './shared/input-box'
import { SelectBox } from './shared/select-box'

const materialOptions = [
  { value: 'concrete', label: 'Concrete' },
  { value: 'metal', label: 'Metal' },
]

export function ColumnPanel() {
  const selectedIds = useViewer((state) => state.selection.selectedIds)
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null
  const nodes = useScene((state) => state.nodes)
  const updateNode = useScene((state) => state.updateNode)

  const node = selectedId ? (nodes[selectedId as AnyNode['id']] as ColumnNode | undefined) : undefined

  const handleChange =
    (updates: Partial<ColumnNode>) => {
      if (node) updateNode(node.id, updates)
    }

  const handleDelete = () => {
    if (node) {
      useViewer.getState().setSelection({ selectedIds: [] })
      useScene.getState().deleteNode(node.id)
    }
  }

  const handleDuplicate = () => {
    if (node && node.parentId) {
      const duplicate = ColumnNode.parse({
        ...node,
        name: `${node.name || 'Column'} (Copy)`,
        start: [node.start[0] + 0.5, node.start[1] + 0.5],
        end: [node.end[0] + 0.5, node.end[1] + 0.5],
      })
      delete (duplicate as any).id
      useScene.getState().createNode(duplicate, node.parentId as AnyNodeId)
      useViewer.getState().setSelection({ selectedIds: [duplicate.id] })
    }
  }

  if (!node) return null

  return (
    <BasePropertyPanel
      icon={Settings2}
      onDelete={handleDelete}
      onDuplicate={handleDuplicate}
      title={node.name || 'Column'}
    >
      <PanelSection title="Dimensions">
        <InputBox
          label="Thickness (m)"
          min={0.1}
          onChange={(val) => handleChange({ thickness: val })}
          step={0.1}
          value={node.thickness}
        />
        <InputBox
          label="Height (m)"
          min={0.5}
          onChange={(val) => handleChange({ height: val })}
          step={0.1}
          value={node.height}
        />
      </PanelSection>

      <PanelSection title="Appearance">
        <SelectBox
          label="Material"
          onChange={(val) => handleChange({ materialType: val as any })}
          options={materialOptions}
          value={node.materialType!}
        />
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Color</span>
          <div className="flex items-center gap-2">
            <input
              className="h-6 w-12 cursor-pointer bg-transparent"
              onChange={(e) => handleChange({ color: e.target.value })}
              type="color"
              value={node.color}
            />
          </div>
        </div>
      </PanelSection>
    </BasePropertyPanel>
  )
}
