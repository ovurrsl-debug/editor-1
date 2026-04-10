import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useRackManager } from './use-rack-manager'
import useViewer from '../../../store/use-viewer'

const tmpMatrix = new THREE.Matrix4()
const tmpPos = new THREE.Vector3()
const tmpQuat = new THREE.Quaternion()
const tmpScale = new THREE.Vector3()
const tmpColor = new THREE.Color()

// Pre-allocate objects for useFrame to avoid GC pressure
const rackMatrix = new THREE.Matrix4()
const rackEuler = new THREE.Euler()
const unitRot = new THREE.Matrix4()
const unitPos = new THREE.Vector3()
const uprightTmpPos = new THREE.Vector3()
const diagQuat = new THREE.Quaternion()
const diagEuler = new THREE.Euler()

export const GlobalRackRenderer = () => {
  const racks = useRackManager((s) => s.racks)
  
  const uprightsRef = useRef<THREE.InstancedMesh>(null!)
  const beamsRef = useRef<THREE.InstancedMesh>(null!)
  const bracingRef = useRef<THREE.InstancedMesh>(null!)
  const palletsRef = useRef<THREE.InstancedMesh>(null!)

  useEffect(() => {
    const rackList = Object.values(racks)
    if (rackList.length === 0) {
      if (uprightsRef.current) uprightsRef.current.count = 0
      if (beamsRef.current) beamsRef.current.count = 0
      if (bracingRef.current) bracingRef.current.count = 0
      if (palletsRef.current) palletsRef.current.count = 0
    }
  }, [racks])

  useFrame((state) => {
    const camera = state.camera
    const rackList = Object.values(racks)
    if (rackList.length === 0) return

    let uIdx = 0
    let bIdx = 0
    let brIdx = 0
    let pIdx = 0

    const uprightMesh = uprightsRef.current
    const beamMesh = beamsRef.current
    const bracingMesh = bracingRef.current
    const palletMesh = palletsRef.current

    if (!uprightMesh || !beamMesh || !bracingMesh || !palletMesh) return

    for (const rack of rackList) {
      const { node, units, levelYPositions, rotY } = rack
      if (node.visible === false) continue

      const { 
        position: [rx, ry, rz], 
        rotation: [rrx, rry, rrz],
        unitWidth: W = 2.7, 
        unitDepth: D = 1.1, 
        unitHeight: H = 6.0,
        uprightWidth: UW = 0.1,
        uprightDepth: UD = 0.05,
        beamHeight: BH = 0.12,
        beamThickness: BT = 0.05,
        palletWidth: pW = 0.8,
        palletHeight: pH = 0.14,
        palletDepth: pD = 1.2,
        showPallets = false,
        showBracing = true,
        bracingSpacing = 0.6,
      } = node

      const W_val = W ?? 2.7
      const D_val = D ?? 1.1
      const H_val = H ?? 6.0
      const UW_val = UW ?? 0.1
      const UD_val = UD ?? 0.05
      const BH_val = BH ?? 0.12
      const BT_val = BT ?? 0.05
      const pW_val = pW ?? 0.8
      const pH_val = pH ?? 0.14
      const pD_val = pD ?? 1.2

      // Simple Distance-based LOD
      tmpPos.set(rx, ry, rz)
      const dist = camera.position.distanceTo(tmpPos)
      const isFar = dist > 65
      const isUltraFar = dist > 180

      // Matrix calculation
      rackEuler.set(rrx, rry, rrz)
      rackMatrix.makeRotationFromEuler(rackEuler)
      rackMatrix.setPosition(rx, ry, rz)
      unitRot.makeRotationY(rotY)

      for (const unit of units) {
        unitPos.set(unit.lx, 0, unit.lz)
        
        // --- UPRIGHTS (4 and frames) ---
        const uprightXOffsets = [-W_val / 2 + UW_val / 2, W_val / 2 - UW_val / 2]
        const uprightZOffsets = [-D_val / 2 + UD_val / 2, D_val / 2 - UD_val / 2]

        for (const uxOff of uprightXOffsets) {
          for (const uzOff of uprightZOffsets) {
            uprightTmpPos.set(uxOff, H_val / 2, uzOff).applyMatrix4(unitRot).add(unitPos).applyMatrix4(rackMatrix)
            tmpScale.set(UW_val, H_val, UD_val)
            tmpQuat.setFromEuler(rackEuler.set(rrx, rry + rotY, rrz))
            tmpMatrix.compose(uprightTmpPos, tmpQuat, tmpScale)
            
            if (uIdx < 30000) {
              uprightMesh.setMatrixAt(uIdx, tmpMatrix)
              uprightMesh.setColorAt(uIdx, tmpColor.set(node.legColor || '#3366ff'))
              uIdx++
            }
          }

          // --- BRACING (Between front and back uprights of the frame) ---
          if (showBracing && !isFar) {
            const numBraces = Math.ceil(H_val / bracingSpacing)
            for (let i = 0; i <= numBraces; i++) {
              const y = i * bracingSpacing
              if (y > H_val) continue
              
              // 1. Horizontal bracing
              uprightTmpPos.set(uxOff, y, 0).applyMatrix4(unitRot).add(unitPos).applyMatrix4(rackMatrix)
              tmpScale.set(UD_val * 0.5, UD_val * 0.5, D_val - UD_val)
              tmpQuat.setFromEuler(rackEuler.set(rrx, rry + rotY, rrz))
              tmpMatrix.compose(uprightTmpPos, tmpQuat, tmpScale)
              
              if (brIdx < 60000) {
                bracingMesh.setMatrixAt(brIdx, tmpMatrix)
                bracingMesh.setColorAt(brIdx, tmpColor.set(node.bracingColor || '#5588cc'))
                brIdx++
              }

              // 2. Diagonal bracing (zig-zag)
              if (i < numBraces) {
                const nextY = Math.min(y + bracingSpacing, H_val)
                const diagLen = Math.sqrt(Math.pow(D_val - UD_val, 2) + Math.pow(nextY - y, 2))
                const angle = Math.atan2(nextY - y, D_val - UD_val) * (i % 2 === 0 ? 1 : -1)

                uprightTmpPos.set(uxOff, (y + nextY) / 2, 0).applyMatrix4(unitRot).add(unitPos).applyMatrix4(rackMatrix)
                tmpScale.set(UD_val * 0.4, UD_val * 0.4, diagLen)
                
                // Rotate around X (local frame) to aim diagonal
                diagQuat.setFromEuler(diagEuler.set(angle, 0, 0))
                tmpQuat.setFromEuler(rackEuler.set(rrx, rry + rotY, rrz))
                tmpQuat.multiply(diagQuat)
                
                tmpMatrix.compose(uprightTmpPos, tmpQuat, tmpScale)
                
                if (brIdx < 60000) {
                  bracingMesh.setMatrixAt(brIdx, tmpMatrix)
                  bracingMesh.setColorAt(brIdx, tmpColor.set(node.bracingColor || '#5588cc'))
                  brIdx++
                }
              }
            }
          }
        }

        // --- BEAMS ---
        if (!isUltraFar) {
          levelYPositions.forEach((y, l) => {
            if (l + 1 <= unit.emptyLevels) return
            
            const beamZOffsets = [-D_val / 2 + UD_val + BT_val / 2, D_val / 2 - UD_val - BT_val / 2]
            beamZOffsets.forEach((bz) => {
              uprightTmpPos.set(0, y as number, bz as number).applyMatrix4(unitRot).add(unitPos).applyMatrix4(rackMatrix)
              tmpScale.set(W_val - UW_val * 2, BH_val, BT_val)
              tmpQuat.setFromEuler(rackEuler.set(rrx, rry + rotY, rrz))
              tmpMatrix.compose(uprightTmpPos, tmpQuat, tmpScale)
              
              if (bIdx < 40000) {
                beamMesh.setMatrixAt(bIdx, tmpMatrix)
                beamMesh.setColorAt(bIdx, tmpColor.set(node.beamColor || '#ff8800'))
                bIdx++
              }
            })
          })
        }

        // --- PALLETS ---
        if (showPallets && !isFar) {
          const palletsPerShelf = 3 
          levelYPositions.forEach((y, l) => {
             if (l + 1 <= unit.emptyLevels) return
             for(let pi=0; pi < palletsPerShelf; pi++) {
                const palletSpacing = W_val / palletsPerShelf
                const pOffset = -W_val / 2 + palletSpacing / 2 + pi * palletSpacing
                uprightTmpPos.set(pOffset, (y as number) + BH_val / 2 + 0.05, 0).applyMatrix4(unitRot).add(unitPos).applyMatrix4(rackMatrix)
                tmpScale.set(pW_val, pH_val, pD_val)
                tmpQuat.setFromEuler(rackEuler.set(rrx, rry + rotY, rrz))
                tmpMatrix.compose(uprightTmpPos, tmpQuat, tmpScale)
                
                if (pIdx < 60000) {
                  palletMesh.setMatrixAt(pIdx, tmpMatrix)
                  palletMesh.setColorAt(pIdx, tmpColor.set(node.palletColor || '#c0a080'))
                  pIdx++
                }
             }
          })
        }
      }
    }

    uprightMesh.count = uIdx
    beamMesh.count = bIdx
    bracingMesh.count = brIdx
    palletMesh.count = pIdx
    
    uprightMesh.instanceMatrix.needsUpdate = true
    if (uprightMesh.instanceColor) uprightMesh.instanceColor.needsUpdate = true
    beamMesh.instanceMatrix.needsUpdate = true
    if (beamMesh.instanceColor) beamMesh.instanceColor.needsUpdate = true
    bracingMesh.instanceMatrix.needsUpdate = true
    if (bracingMesh.instanceColor) bracingMesh.instanceColor.needsUpdate = true
    palletMesh.instanceMatrix.needsUpdate = true
    if (palletMesh.instanceColor) palletMesh.instanceColor.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={uprightsRef} args={[null as any, null as any, 30000]} frustumCulled={false} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={beamsRef} args={[null as any, null as any, 40000]} frustumCulled={false} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={bracingRef} args={[null as any, null as any, 60000]} frustumCulled={false} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={palletsRef} args={[null as any, null as any, 60000]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial />
      </instancedMesh>
    </group>
  )
}
