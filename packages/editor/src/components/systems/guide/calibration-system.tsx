/// <reference types="@react-three/fiber" />
'use client'

import { Html } from '@react-three/drei'
import { emitter, type GridEvent, sceneRegistry, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import useEditor from '../../../store/use-editor'

export function CalibrationSystem({ onConfirm, onCancel }: { onConfirm?: (scale: number) => void, onCancel?: () => void } = {}) {
  const isCalibrating = useEditor((s) => s.isCalibrating)
  const setIsCalibrating = useEditor((s) => s.setIsCalibrating)
  const calibrationPoints = useEditor((s) => s.calibrationPoints)
  const setCalibrationPoints = useEditor((s) => s.setCalibrationPoints)
  const selectedReferenceId = useEditor((s) => s.selectedReferenceId)
  const nodes = useScene((s) => s.nodes)
  const updateNode = useScene((s) => s.updateNode)
  const { raycaster, camera, gl } = useThree()
  
  const [hoverPoint, setHoverPoint] = useState<THREE.Vector3 | null>(null)
  
  useEffect(() => {
    if (!isCalibrating) {
      setHoverPoint(null)
      return
    }

    // Auto-show guides when starting calibration
    useViewer.getState().setShowGuides(true)

    const onGridMove = (event: GridEvent) => {
      let p = new THREE.Vector3(event.position[0], event.position[1], event.position[2])
      
      // Shift snap for orthogonal lines
      if (calibrationPoints.length === 1 && event.nativeEvent?.shiftKey) {
        const p1 = new THREE.Vector3(...calibrationPoints[0]!)
        const dx = Math.abs(p.x - p1.x)
        const dz = Math.abs(p.z - p1.z)
        if (dx > dz) p.z = p1.z
        else p.x = p1.x
      }
      
      setHoverPoint(p.clone())
    }

    const onGridClick = (event: GridEvent) => {
      if (useViewer.getState().cameraDragging) return
      if (calibrationPoints.length >= 2) return // Stop after 2 points

      let p = new THREE.Vector3(event.position[0], event.position[1], event.position[2])
      
      // Shift snap for orthogonal lines
      if (calibrationPoints.length === 1 && event.nativeEvent?.shiftKey) {
        const p1 = new THREE.Vector3(...calibrationPoints[0]!)
        const dx = Math.abs(p.x - p1.x)
        const dz = Math.abs(p.z - p1.z)
        if (dx > dz) p.z = p1.z
        else p.x = p1.x
      }

      const newPoints: [number, number, number][] = [...calibrationPoints, [p.x, p.y, p.z] as [number, number, number]]
      setCalibrationPoints(newPoints)
      
      if (newPoints.length === 2) {
        setHoverPoint(null)
      }
    }

    emitter.on('grid:move', onGridMove)
    emitter.on('grid:click', onGridClick)
    
    return () => {
      emitter.off('grid:move', onGridMove)
      emitter.off('grid:click', onGridClick)
    }
  }, [isCalibrating, calibrationPoints, setCalibrationPoints])

  // Points to show in the line
  const linePoints = useMemo(() => {
    if (calibrationPoints.length === 0) return []
    if (calibrationPoints.length === 1 && hoverPoint) {
      return [new THREE.Vector3(...calibrationPoints[0]!), hoverPoint]
    }
    if (calibrationPoints.length >= 2) {
      return [
        new THREE.Vector3(...calibrationPoints[0]!),
        new THREE.Vector3(...calibrationPoints[1]!)
      ]
    }
    return []
  }, [calibrationPoints, hoverPoint])

  return (
    <>
      {/* Show points while selecting */}
      {(calibrationPoints.length > 0 || hoverPoint) && (
        <>
          {calibrationPoints.map((p, i) => (
            <mesh key={i} position={p}>
              <ringGeometry args={[0.015, 0.025, 32]} />
              <meshBasicMaterial color="#ff4400" depthTest={false} transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </>
      )}

      {linePoints.length === 2 && (
        <line>
          <bufferGeometry 
            attach="geometry" 
            onUpdate={(self: any) => self.setFromPoints(linePoints)} 
          />
          <lineBasicMaterial attach="material" color="#ff4400" depthTest={false} transparent opacity={0.8} />
        </line>
      )}
    </>
  )
}

