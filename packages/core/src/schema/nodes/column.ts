import dedent from 'dedent'
import { z } from 'zod'
import { BaseNode, nodeType, objectId } from '../base'

export const ColumnNode = BaseNode.extend({
  id: objectId('column'),
  type: nodeType('column'),
  
  // Base Dimensions of a single column unit (meters)
  width: z.number().default(0.4),      // en
  depth: z.number().default(0.4),      // boy
  height: z.number().default(3.0),     // yükseklik

  // Array Settings (number of columns and the CLEAR spacing between them)
  horizontalCount: z.number().int().min(1).default(1),
  horizontalSpacing: z.number().default(1.0), // clear distance between columns in X
  
  verticalCount: z.number().int().min(1).default(1),
  verticalSpacing: z.number().default(1.0),   // clear distance between columns in Z

  // Visuals
  color: z.string().default('#808080'),
  materialType: z.enum(['metal', 'concrete']).default('concrete'),

  // Transform (start position of the grid's first item)
  position: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  rotation: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
}).describe(
  dedent`
  Column node - represents an array of structural columns.
  - width/depth/height: size of each column unit
  - horizontal/verticalCount: number of units in the grid
  - horizontal/verticalSpacing: the clear gap between faces of adjacent columns
  `,
)

export type ColumnNode = z.infer<typeof ColumnNode>
