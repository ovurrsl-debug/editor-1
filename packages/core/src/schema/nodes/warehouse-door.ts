import { z } from 'zod'
import { nodeType, objectId } from '../base'
import { DoorNode } from './door'

export const WarehouseDoorType = z.enum([
  'swing',
  'high-speed-pvc',
  'monorail',
  'sectional'
])

export type WarehouseDoorType = z.infer<typeof WarehouseDoorType>

export const WarehouseDoorNode = DoorNode.extend({
  id: objectId('warehouse-door'),
  type: nodeType('warehouse-door'),
  
  warehouseType: WarehouseDoorType.default('swing'),
  
  // Visual properties for various warehouse door types
  hoodHeight: z.number().default(0.4), // For PVC/Sectional hoods
  hoodDepth: z.number().default(0.4),
  trackWidth: z.number().default(0.12), // Side rails
  railThickness: z.number().default(0.05), // For Monorail top rail
  
  insulated: z.boolean().default(true),
  visionPanel: z.boolean().default(true),
  hasPassDoor: z.boolean().default(false),
})

export type WarehouseDoorNode = z.infer<typeof WarehouseDoorNode>
