import {
  type RackNode,
  computeLevelPositions,
  computePalletsPerShelf,
  useRegistry,
} from '@pascal-app/core'
import { Box } from '@react-three/drei'
import { useMemo, useRef } from 'react'
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

  // Wire-mesh: daha ince, yarı şeffaf
  if (type === 'wire-mesh') {
    return (
      <Box args={[w * 0.94, thickness, d * 0.94]} position={[0, y, 0]}>
        <meshStandardMaterial color="#888888" wireframe transparent opacity={0.6} />
      </Box>
    )
  }

  // Steel-panel: daha kalın, metalik
  if (type === 'steel-panel') {
    return (
      <Box args={[w * 0.96, thickness * 1.5, d * 0.96]} position={[0, y, 0]}>
        <meshStandardMaterial color="#9ca3af" metalness={0.6} roughness={0.3} />
      </Box>
    )
  }

  // mdf: ahşap görünüm
  return (
    <Box args={[w * 0.96, thickness, d * 0.96]} position={[0, y, 0]}>
      <meshStandardMaterial color={color} />
    </Box>
  )
}

// ── Bracing sub-component (çapraz bağlantılar) ──────────────────
/**
 * UprightBracing - Z ekseni (Derinlik) boyunca çapraz bağlantı çizer.
 */
const UprightBracing = ({
  height,
  depth,
  spacing,
  width,
  color,
}: {
  height: number
  depth: number
  spacing: number
  width: number
  color: string
}) => {
  const safeSpacing = Math.max(0.1, spacing)
  const count = Math.min(100, Math.max(1, Math.floor(height / safeSpacing)))
  const rod = 0.012 // çapraz çubuk kalınlığı

  return (
    <group>
      {Array.from({ length: count }).map((_, i) => {
        const y1 = (i * height) / count
        const y2 = ((i + 1) * height) / count
        const midY = (y1 + y2) / 2
        const segH = y2 - y1
        const diagLen = Math.sqrt(segH * segH + depth * depth)
        const angle = Math.atan2(depth, segH)

        return (
          <group key={`br-${i}`}>
            {/* Yatay bağlantı - Z ekseni boyunca */}
            <Box args={[rod, rod, depth * 0.9]} position={[0, y2, 0]}>
              <meshStandardMaterial color={color} />
            </Box>
            {/* Çapraz — Z-Y düzleminde */}
            <Box
              args={[rod, diagLen, rod]}
              position={[0, midY, 0]}
              rotation={[angle * (i % 2 === 0 ? 1 : -1), 0, 0]}
            >
              <meshStandardMaterial color={color} />
            </Box>
          </group>
        )
      })}
    </group>
  )
}

/**
 * RackRenderer — Procedurally draws a full pallet-racking block.
 */
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

  // Pre-compute unit positions
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
      const rowOffset = (maxRows - rowCount) * (W + 0.005)
      const sideCount = backToBack ? 2 : 1

      // Pozisyon hesabı: rowIndex * (Toplam_Raf_Derinliği + Koridor_Aralığı)
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
          
          // side * (D + b2bGap) -> Bu, o sıranın kendi içindeki derinlik ofseti.
          const localDepthOff = side * (D + b2bGap)
          
          if (layoutDir === 'v') {
            // Dikey (Vertical): Sıralar X aksında, Bayler Z aksında.
            lx = rowIndex * rowStride + localDepthOff
            lz = rowOffset + r * (W + 0.005)
          } else {
            // Yatay (Horizontal): Sıralar Z aksında, Bayler X aksında.
            lx = rowOffset + r * (W + 0.005)
            lz = rowIndex * rowStride + localDepthOff
          }

          result.push({ lx, lz, row: rowIndex, col: r, side: sideChar as 'f' | 'b', emptyLevels })
        }
      }
    })
    return result
  }, [config, maxRows, W, D, backToBack, b2bGap, layoutDir, cGap, skip, tunnels])

  // Ünitenin kendi içindeki yönü. 
  // Tool cursor (2.7, 6.0, 1.1) ile uyumlu: W=X, H=Y, D=Z.
  // Eğer layoutDir 'v' ise, bayler Z aksında dizildiği için üniteleri 90 derece döndürmeliyiz.
  const rotY = layoutDir === 'v' ? Math.PI / 2 : 0

  return (
    <group ref={ref} position={node.position} rotation={node.rotation} visible={node.visible ?? true} {...handlers}>
      {units.map((unit, idx) => (
        <group key={idx} position={[unit.lx, 0, unit.lz]} rotation={[0, rotY, 0]}>

          {/* ── 4 Vertical Uprights (Dikmeler) ──── */}
          {[
            [-W / 2 + UW / 2, -D / 2 + UD / 2], // Ön Sol
            [W / 2 - UW / 2, -D / 2 + UD / 2],  // Ön Sağ
            [-W / 2 + UW / 2, D / 2 - UD / 2],  // Arka Sol
            [W / 2 - UW / 2, D / 2 - UD / 2],   // Arka Sağ
          ].map((offsets, pi) => (
            <Box key={`u${pi}`} args={[UW, H, UD]} position={[offsets[0]!, H / 2, offsets[1]!]}>
              <meshStandardMaterial color={legColor} />
            </Box>
          ))}

          {/* ── Bracing (Çapraz Bağlantılar) ────── */}
          {showBracing && (
            <>
              {/* Sol çerçeve (Frame) */}
              <group position={[-W / 2 + UW / 2, 0, 0]}>
                <UprightBracing
                  height={H}
                  depth={D - UD}
                  spacing={bracingSpacing}
                  width={UD}
                  color={bracingColor}
                />
              </group>
              {/* Sağ çerçeve (Frame) */}
              <group position={[W / 2 - UW / 2, 0, 0]}>
                <UprightBracing
                  height={H}
                  depth={D - UD}
                  spacing={bracingSpacing}
                  width={UD}
                  color={bracingColor}
                />
              </group>
            </>
          )}

          {/* ── Beam Levels (Kiriş Katları) ─────── */}
          {levelYPositions.map((y, l) => {
            const levelNum = l + 1
            if (levelNum <= unit.emptyLevels) return null

            return (
              <group key={`lv${l}`}>
                {/* Ön Kiriş (Front beam) - X aksı boyunca */}
                <Box
                  args={[W - UW * 2, BH, BT]}
                  position={[0, y, -D / 2 + UD + BT / 2]}
                >
                  <meshStandardMaterial color={beamColor} />
                </Box>
                {/* Arka Kiriş (Back beam) - X aksı boyunca */}
                <Box
                  args={[W - UW * 2, BH, BT]}
                  position={[0, y, D / 2 - UD - BT / 2]}
                >
                  <meshStandardMaterial color={beamColor} />
                </Box>

                {/* ── Decking (Zemin Tablaması) ─── */}
                <DeckingSurface
                  w={W - UW * 2}
                  d={D - UD * 2}
                  y={y + BH / 2 + deckingThickness / 2}
                  type={levelDeckingTypes[l] || deckingType}
                  thickness={deckingThickness}
                  color={deckingColor}
                />

                {/* ── Pallets ──────────────────── */}
                {(() => {
                  const type = levelTypes[l] || (levelShowPallets[l] === false ? 'picking' : 'pallet')
                  return type === 'pallet' && showPallets
                })() &&
                  Array.from({ length: palletsCount }).map((_, pi) => {
                    const palletSpacing = W / palletsCount
                    const pOffset = -W / 2 + palletSpacing / 2 + pi * palletSpacing
                    const palletBaseY = y + BH / 2 + deckingThickness

                    return (
                      <group key={`plt${pi}`}>
                        {/* Palet kendisi - Uzun kenarı Z aksında */}
                        <Box
                          args={[pW, pH, pD]}
                          position={[pOffset, palletBaseY + pH / 2, 0]}
                        >
                          <meshStandardMaterial color={palletColor} />
                        </Box>
                        {/* Palet üzerindeki yük (şeffaf kutu) */}
                        <Box
                          args={[pW * 0.9, node.palletLoadHeight, pD * 0.9]}
                          position={[pOffset, palletBaseY + pH + node.palletLoadHeight / 2, 0]}
                        >
                          <meshStandardMaterial
                            color="#8b7355"
                            transparent
                            opacity={0.35}
                          />
                        </Box>
                      </group>
                    )
                  })}

                {/* ── Picking Items (Boxes/Products) ──────────── */}
                {(() => {
                  const type = levelTypes[l] || (levelShowPallets[l] === false ? 'picking' : 'pallet')
                  return type === 'picking' && showPickingItems
                })() && (
                  <group position={[0, y + BH / 2 + deckingThickness, 0]}>
                    {Array.from({ length: palletsCount * 2 }).map((_, bi) => {
                      const gap = 0.05
                      const availW = W - UW * 2
                      const itemW = (availW - (palletsCount * 2 + 1) * gap) / (palletsCount * 2)
                      const xPos = -availW / 2 + gap + bi * (itemW + gap) + itemW / 2
                      const h = 0.3 + (bi % 3) * 0.1 // vary height slightly
                      return (
                        <Box key={bi} args={[itemW, h, D * 0.7]} position={[xPos, h / 2, 0]}>
                          <meshStandardMaterial color="#d2b48c" roughness={0.8} />
                        </Box>
                      )
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
