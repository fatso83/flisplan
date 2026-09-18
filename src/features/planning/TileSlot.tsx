import { useDroppable, useDraggable } from '@dnd-kit/react'
import { useEffect, useRef } from 'react'
import { projectTile, type Tile, type WallOrientation } from '../../domain/tile'

export interface TileSlotProps { tile: Tile; row: 'upper' | 'lower'; position: number; pairIndex: number; orientation: WallOrientation; selected: boolean; mismatchMm?: number; driftMm?: number; onSelect: () => void }

export function TileSlot({ tile, row, position, pairIndex, orientation, selected, mismatchMm, driftMm, onSelect }: TileSlotProps) {
  const address = `${row}:${position}`
  const drag = useDraggable({ id: `drag-${address}`, data: { row, position } })
  const drop = useDroppable({ id: address, data: { row, position } })
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { ref: dropRef } = drop
  const { ref: dragRef, handleRef } = drag
  useEffect(() => { dropRef(wrapperRef.current); return () => dropRef(null) }, [dropRef])
  useEffect(() => { dragRef(buttonRef.current); handleRef(buttonRef.current); return () => { dragRef(null); handleRef(null) } }, [dragRef, handleRef])
  const projection = projectTile(tile, orientation)
  const mismatch = mismatchMm?.toFixed(1) ?? '0.0'
  const drift = driftMm?.toFixed(1) ?? '0.0'
  const rowLabel = row === 'upper' ? 'øvre' : 'nedre'
  return <div ref={wrapperRef} className={`tile-slot pair-tone-${pairIndex % 6}${selected ? ' selected' : ''}`} style={{ '--tile-width': `${projection.alongWallMm}px`, '--tile-depth': `${projection.depthMm}px` } as React.CSSProperties} data-position={position}>
    <button ref={buttonRef} type="button" className="tile-button" onClick={onSelect} aria-pressed={selected} aria-label={`${tile.id}, ${rowLabel} rad, posisjon ${position + 1}. Avvik ${mismatch} mm, drift ${drift} mm`}>
      <span className="tile-id">{tile.id}</span>
    </button>
    <div className="tile-tooltip" role="tooltip">
      <strong>{tile.id}</strong>
      <span>Bredde {tile.inputWidthMm} mm · høyde {tile.inputHeightMm} mm</span>
      <span>Avvik {mismatch} mm · drift {drift} mm</span>
    </div>
  </div>
}
