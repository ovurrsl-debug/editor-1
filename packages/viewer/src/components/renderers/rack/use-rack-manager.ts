import { create } from 'zustand'
import type { RackNode } from '@pascal-app/core'

export interface RackInstanceData {
  id: string
  node: RackNode
  units: {
    lx: number
    lz: number
    row: number
    col: number
    side: 'f' | 'b'
    emptyLevels: number
  }[]
  levelYPositions: number[]
  rotY: number
}

interface RackManagerState {
  racks: Record<string, RackInstanceData>
  registerRack: (id: string, data: RackInstanceData) => void
  unregisterRack: (id: string) => void
}

export const useRackManager = create<RackManagerState>((set) => ({
  racks: {},
  registerRack: (id, data) => set((s) => ({ racks: { ...s.racks, [id]: data } })),
  unregisterRack: (id) => set((s) => {
    const newRacks = { ...s.racks }
    delete newRacks[id]
    return { racks: newRacks }
  }),
}))
