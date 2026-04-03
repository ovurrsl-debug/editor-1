'use client'

import { type AnyNode, type GuideNode, type ScanNode, useScene } from '@pascal-app/core'
import { Box, Image as ImageIcon } from 'lucide-react'
import { useCallback, useState } from 'react'
import * as THREE from 'three'
import useEditor from '../../../store/use-editor'
import { ActionButton, ActionGroup } from '../controls/action-button'
import { MetricControl } from '../controls/metric-control'
import { PanelSection } from '../controls/panel-section'
import { SliderControl } from '../controls/slider-control'
import { PanelWrapper } from './panel-wrapper'

type ReferenceNode = ScanNode | GuideNode

export function ReferencePanel() {
  const selectedReferenceId = useEditor((s) => s.selectedReferenceId)
  const setSelectedReferenceId = useEditor((s) => s.setSelectedReferenceId)
  const isCalibrating = useEditor((s) => s.isCalibrating)
  const setIsCalibrating = useEditor((s) => s.setIsCalibrating)
  const calibrationPoints = useEditor((s) => s.calibrationPoints)
  const setCalibrationPoints = useEditor((s) => s.setCalibrationPoints)

  const [distanceInput, setDistanceInput] = useState('5000')

  const nodes = useScene((s) => s.nodes)
  const updateNode = useScene((s) => s.updateNode)

  const node = selectedReferenceId
    ? (nodes[selectedReferenceId as AnyNode['id']] as ReferenceNode | undefined)
    : undefined

  const handleUpdate = useCallback(
    (updates: Partial<ReferenceNode>) => {
      if (!selectedReferenceId) return
      updateNode(selectedReferenceId as AnyNode['id'], updates)
    },
    [selectedReferenceId, updateNode],
  )

  const handleClose = useCallback(() => {
    setSelectedReferenceId(null)
  }, [setSelectedReferenceId])

  if (!node || (node.type !== 'scan' && node.type !== 'guide')) return null

  const isScan = node.type === 'scan'

  return (
    <PanelWrapper
      icon={isScan ? undefined : undefined}
      onClose={handleClose}
      title={node.name || (isScan ? '3D Scan' : 'Guide Image')}
      width={300}
    >
      <PanelSection title="Scale & Opacity">
        <SliderControl
          label={
            <>
              XYZ<sub className="ml-[1px] text-[11px] opacity-70">scale</sub>
            </>
          }
          max={1000}
          min={0.01}
          onChange={(value) => {
            if (value > 0) {
              handleUpdate({ scale: value })
            }
          }}
          precision={2}
          step={0.1}
          value={Math.round(node.scale * 100) / 100}
        />

        <SliderControl
          label="Opacity"
          max={100}
          min={0}
          onChange={(v) => handleUpdate({ opacity: v })}
          precision={0}
          step={1}
          unit="%"
          value={node.opacity}
        />
      </PanelSection>

      <PanelSection title="Manual Scale">
        <div className="px-1 py-1 space-y-4">
          <ActionButton 
            label={isCalibrating ? "Stop Calibration" : "Start Calibration"} 
            onClick={() => {
              setIsCalibrating(!isCalibrating)
              if (isCalibrating) setCalibrationPoints([])
            }}
          />

          {isCalibrating && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
              {calibrationPoints.length < 2 ? (
                <p className="text-[11px] text-muted-foreground leading-relaxed italic bg-black/20 p-3 rounded-lg border border-white/5">
                  Click two points on the floorplan to define a known distance.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="bg-primary/5 p-3 rounded-xl border border-primary/20 space-y-1">
                    <div className="text-[10px] uppercase font-bold text-primary/60">Drawn Distance</div>
                    <div className="text-sm font-mono font-bold">
                      {(
                        new THREE.Vector3(...calibrationPoints[0]!).distanceTo(
                          new THREE.Vector3(...calibrationPoints[1]!)
                        )
                      ).toFixed(4)} <span className="text-[10px] opacity-50">units</span>
                    </div>
                  </div>

                  <MetricControl
                    label="Real Length"
                    value={parseFloat(distanceInput)}
                    onChange={(val) => setDistanceInput(val.toString())}
                    unit="mm"
                    precision={2}
                  />

                  <div className="flex gap-2">
                    <ActionButton 
                      label="Reset" 
                      onClick={() => setCalibrationPoints([])} 
                    />
                    <ActionButton 
                      label="Apply Scale" 
                      disabled={!distanceInput || parseFloat(distanceInput) <= 0}
                      onClick={() => {
                        const p1 = new THREE.Vector3(...calibrationPoints[0]!)
                        const p2 = new THREE.Vector3(...calibrationPoints[1]!)
                        const pixelDist = p1.distanceTo(p2)
                        const realDist = parseFloat(distanceInput) / 1000 // to meters
                        
                        const currentScale = node.scale || 1
                        const newScale = (realDist / pixelDist) * currentScale
                        handleUpdate({ scale: newScale })
                        
                        setCalibrationPoints([])
                        setIsCalibrating(false)
                      }} 
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </PanelSection>
    </PanelWrapper>
  )
}
