import {
  type RackNode,
  computeLevelPositions,
  computePalletsPerShelf,
  useRegistry,
} from '@pascal-app/core'
import { Box, Instances, Instance } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Group } from 'three'
import { useNodeEvents } from '../../../hooks/use-node-events'

// ── Decking sub-component ────────────────────────────────────────
const DeckingSurface = ({
  w,
  d,
  y,
  type,
  thickness,
  color,
}: {
  w: number
  d: number
  y: number
  type: string
  thickness: number
  color: string
}) => {
  if (type === 'none') return null

  if (type === 'wire-mesh') {
    return (
      <Box args={[w * 0.94, thickness, d * 0.94]} position={[0, y, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#888888" wireframe transparent opacity={0.6} />
      </Box>
    )
  }

  if (type === 'steel-panel') {
    return (
      <Box args={[w * 0.96, thickness * 1.5, d * 0.96]} position={[0, y, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#9ca3af" metalness={0.6} roughness={0.3} />
      </Box>
    )
  }

  return (
    <Box args={[w * 0.96, thickness, d * 0.96]} position={[0, y, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={color} />
    </Box>
  )
}

const rod = 0.012
const BracingSegment = ({
  y1,
  y2,
  depth,
  i,
  color,
}: {
  y1: number
  y2: number
  depth: number
  i: number
  color: string
}) => {
  const midY = (y1 + y2) / 2
  const segH = y2 - y1
  const diagLen = Math.sqrt(segH * segH + depth * depth)
  const angle = Math.atan2(depth, segH)

  return (
    <group>
      <Box args={[rod, rod, depth * 0.9]} position={[0, y2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} />
      </Box>
      <Box
        args={[rod, diagLen, rod]}
        position={[0, midY, 0]}
        rotation={[angle * (i % 2 === 0 ? 1 : -1), 0, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={color} />
      </Box>
    </group>
  )
}

export const RackRenderer = ({ node }: { node: RackNode }) => {
  const ref = useRef<Group>(null!)
  useRegistry(node.id, node.type, ref)
  const handlers = useNodeEvents(node, 'rack')

  const {
    unitWidth: W = 2.7,
    unitDepth: D = 1.1,
    unitHeight: H = 6.0,
    uprightWidth: UW = 0.1,
    uprightDepth: UD = 0.05,
    beamHeight: BH = 0.12,
    beamThickness: BT = 0.05,
    config = [1],
    levels: LEV = 3,
    layoutDir = 'v',
    corridorGap: cGap = 5.0,
    bayGap: bGap = 0,
    backToBack = true,
    backToBackGap: b2bGap = 0.2,
    skip = [],
    tunnels = {},
    legColor = '#3366ff',
    beamColor = '#ff8800',
    deckingColor = '#ecc94b',
    bracingColor = '#5588cc',
    palletColor = '#c0a080',
    palletWidth: pW = 0.8,
    palletDepth: pD = 1.2,
    palletHeight: pH = 0.14,
    showPallets = false,
    showPickingItems = false,
    showBracing = true,
    bracingSpacing = 0.6,
    deckingType = 'none',
    deckingThickness = 0.018,
    levelDeckingTypes = [],
    levelShowPallets = [],
    levelTypes = [],
  } = node

  const maxRows = useMemo(() => Math.max(...config, 0), [config])
  const levelYPositions = useMemo(() => computeLevelPositions(node), [node])
  const palletsCount = useMemo(() => computePalletsPerShelf(node), [node])

  const units = useMemo(() => {
    const result: {
      lx: number
      lz: number
      row: number
      col: number
      side: 'f' | 'b'
      emptyLevels: number
    }[] = []

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
  }, [config, maxRows, W, D, backToBack, b2bGap, layoutDir, cGap, skip, tunnels, bGap])

  const rotY = layoutDir === 'v' ? Math.PI / 2 : 0

  return (
    <group ref={ref} position={node.position} rotation={node.rotation} visible={node.visible ?? true} {...handlers}>
      
      {/* ── Instanced Uprights (Dikmeler) ── */}
      <Instances castShadow receiveShadow>
        <boxGeometry args={[UW, H, UD]} />
        <meshStandardMaterial color={legColor} />
        {units.map((unit, idx) => (
          <group key={idx} position={[unit.lx, 0, unit.lz]} rotation={[0, rotY, 0]}>
            <Instance position={[-W / 2 + UW / 2, H / 2, -D / 2 + UD / 2]} />
            <Instance position={[W / 2 - UW / 2, H / 2, -D / 2 + UD / 2]} />
            <Instance position={[-W / 2 + UW / 2, H / 2, D / 2 - UD / 2]} />
            <Instance position={[W / 2 - UW / 2, H / 2, D / 2 - UD / 2]} />
          </group>
        ))}
      </Instances>

      {/* ── Instanced Beams (Kirişler) ── */}
      <Instances castShadow receiveShadow>
        <boxGeometry args={[W - UW * 2, BH, BT]} />
        <meshStandardMaterial color={beamColor} />
        {units.map((unit, idx) => (
          <group key={idx} position={[unit.lx, 0, unit.lz]} rotation={[0, rotY, 0]}>
            {levelYPositions.map((y, l) => {
              if (l + 1 <= unit.emptyLevels) return null
              return (
                <group key={l}>
                  <Instance position={[0, y, -D / 2 + UD + BT / 2]} />
                  <Instance position={[0, y, D / 2 - UD - BT / 2]} />
                </group>
              )
            })}
          </group>
        ))}
      </Instances>

      {/* ── Instanced Pallets ── */}
      {showPallets && (
        <Instances castShadow receiveShadow>
          <boxGeometry args={[pW, pH, pD]} />
          <meshStandardMaterial color={palletColor} />
          {units.map((unit, idx) => (
            <group key={idx} position={[unit.lx, 0, unit.lz]} rotation={[0, rotY, 0]}>
              {levelYPositions.map((y, l) => {
                const type = levelTypes[l] || (levelShowPallets[l] === false ? 'picking' : 'pallet')
                if (type !== 'pallet' || l + 1 <= unit.emptyLevels) return null
                return Array.from({ length: palletsCount }).map((_, pi) => {
                  const palletSpacing = W / palletsCount
                  const pOffset = -W / 2 + palletSpacing / 2 + pi * palletSpacing
                  return <Instance key={pi} position={[pOffset, y + BH / 2 + deckingThickness + pH / 2, 0]} />
                })
              })}
            </group>
          ))}
        </Instances>
      )}

      {/* ── Regular bits (Decking, Bracing, Picking) ── */}
      {units.map((unit, idx) => (
        <group key={idx} position={[unit.lx, 0, unit.lz]} rotation={[0, rotY, 0]}>
          {showBracing && (
            <>
              <group position={[-W / 2 + UW / 2, 0, 0]}>
                <BracingGroup height={H} depth={D - UD} spacing={bracingSpacing} color={bracingColor} />
              </group>
              <group position={[W / 2 - UW / 2, 0, 0]}>
                <BracingGroup height={H} depth={D - UD} spacing={bracingSpacing} color={bracingColor} />
              </group>
            </>
          )}

          {levelYPositions.map((y, l) => {
            if (l + 1 <= unit.emptyLevels) return null
            const type = levelTypes[l] || (levelShowPallets[l] === false ? 'picking' : 'pallet')
            
            return (
              <group key={l}>
                <DeckingSurface
                  w={W - UW * 2}
                  d={D - UD * 2}
                  y={y + BH / 2 + deckingThickness / 2}
                  type={levelDeckingTypes[l] || deckingType}
                  thickness={deckingThickness}
                  color={deckingColor}
                />
                
                {/* Individual Load per pallet (keeping regular for now as they are simple translucent boxes) */}
                {type === 'pallet' && showPallets && Array.from({ length: palletsCount }).map((_, pi) => {
                  const palletSpacing = W / palletsCount
                  const pOffset = -W / 2 + palletSpacing / 2 + pi * palletSpacing
                  const loadH = node.palletLoadHeight
                  return (
                    <Box key={pi} args={[pW * 0.9, loadH, pD * 0.9]} position={[pOffset, y + BH / 2 + deckingThickness + pH + loadH / 2, 0]} castShadow receiveShadow>
                      <meshStandardMaterial color="#8b7355" transparent opacity={0.35} />
                    </Box>
                  )
                })}

                {type === 'picking' && showPickingItems && (
                  <group position={[0, y + BH / 2 + deckingThickness, 0]}>
                    {Array.from({ length: palletsCount * 2 }).map((_, bi) => {
                      const gap = 0.05
                      const availW = W - UW * 2
                      const itemW = (availW - (palletsCount * 2 + 1) * gap) / (palletsCount * 2)
                      const xPos = -availW / 2 + gap + bi * (itemW + gap) + itemW / 2
                      const h = 0.3 + (bi % 3) * 0.1
                      return <Box key={bi} args={[itemW, h, D * 0.7]} position={[xPos, h / 2, 0]} castShadow receiveShadow>
                        <meshStandardMaterial color="#d2b48c" />
                      </Box>
                    })}
                  </group>
                )}
              </group>
            )
          })}
        </group>
      ))}
    </group>
  )
}

const BracingGroup = ({ height, depth, spacing, color }: { height: number, depth: number, spacing: number, color: string }) => {
  const safeSpacing = Math.max(0.1, spacing)
  const count = Math.min(100, Math.max(1, Math.floor(height / safeSpacing)))
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <BracingSegment i={i} key={i} y1={(i * height) / count} y2={((i + 1) * height) / count} depth={depth} color={color} />
      ))}
    </group>
  )
}
