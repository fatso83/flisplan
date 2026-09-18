import { DragDropProvider, type DragEndEvent } from '@dnd-kit/react'
import { useMemo, useState } from 'react'
import { swapTiles, type Layout, type SlotAddress } from '../../domain/layout'
import type { Tile } from '../../domain/tile'
import { TileSlot } from './TileSlot'

const fmt = (value: number) => `${value.toFixed(1).replace('.', ',')} mm`
export interface PlanningBoardProps { tiles: Tile[]; layout: Layout; toleranceMm: number; groutMm?: number; onLayoutChange: (layout: Layout) => void }

export function PlanningBoard({ tiles, layout, toleranceMm, groutMm = 2, onLayoutChange }: PlanningBoardProps) {
  const [source, setSource] = useState<SlotAddress | null>(null)
  const [target, setTarget] = useState<SlotAddress | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const byId = useMemo(() => new Map(tiles.map((tile) => [tile.id, tile])), [tiles])
  const tileIdAt = (address: SlotAddress) => { const slot = layout.slots[address.position]; return address.row === 'upper' ? slot.upperTileId : slot.lowerTileId }
  const choose = (address: SlotAddress) => setSource((current) => current ? current : address)
  const swap = (target: SlotAddress) => {
    if (!source) { setSource(target); return }
    if (source.row === target.row && source.position === target.position) return
    const sourceId = tileIdAt(source); const targetId = tileIdAt(target)
    onLayoutChange(swapTiles(layout, source, target, tiles)); setSource(null); setTarget(null); setAnnouncement(`Byttet ${sourceId} med ${targetId} (${source.row} rad ${source.position + 1} og ${target.row} rad ${target.position + 1}).`)
  }
  const onDragEnd = (event: DragEndEvent) => {
    if (event.canceled) return
    // dnd-kit exposes entity data as its open Record type; narrow only the address fields we own.
    const from = event.operation?.source?.data as unknown as SlotAddress | undefined
    const to = event.operation?.target?.data as unknown as SlotAddress | undefined
    if (from && to) swapTilesAndAnnounce(from, to)
  }
  const swapTilesAndAnnounce = (from: SlotAddress, to: SlotAddress) => {
    if (from.row === to.row && from.position === to.position) return
    const sourceId = tileIdAt(from); const targetId = tileIdAt(to)
    onLayoutChange(swapTiles(layout, from, to, tiles)); setSource(null); setTarget(null); setAnnouncement(`Byttet ${sourceId} med ${targetId} (${from.row} rad ${from.position + 1} og ${to.row} rad ${to.position + 1}).`)
  }
  const renderRow = (key: 'upper' | 'lower', label: string) => <div className={`tile-row ${key}`} key={key}>
    <h3>{label}</h3>
    <div className="slots">{layout.slots.map((slot, position) => {
      const id = key === 'upper' ? slot.upperTileId : slot.lowerTileId
      const address = { row: key, position } as SlotAddress
      const tile = byId.get(id)
      return tile ? <TileSlot key={`${key}-${position}-${id}`} tile={tile} row={key} position={position} pairIndex={position} orientation={layout.orientation} mismatchMm={layout.metrics.pairWidthMismatchesMm[position]} driftMm={layout.metrics.cumulativeSeamDriftMm[position]} selected={source?.row === key && source.position === position} onSelect={() => choose(address)} /> : null
    })}</div>
  </div>
  return <section className="planning" aria-labelledby="planning-heading">
    <h2 id="planning-heading">Plan</h2>
    <DragDropProvider onDragEnd={onDragEnd}>
      <div className="board" aria-label="Flisplan med to rader" style={{ '--grout-gap': `${groutMm * 0.35}px` } as React.CSSProperties}>
        {renderRow('upper', 'Øvre rad')}
        <div className="flush-seam" aria-label="Flush fuge">Flush fuge</div>
        {renderRow('lower', 'Nedre rad')}
      </div>
    </DragDropProvider>
    <div className="swap-controls"><p>Valgt: {source ? `${source.row === 'upper' ? 'øvre' : 'nedre'} ${source.position + 1}` : 'ingen'}</p><label htmlFor="swap-target">Bytt med
      <select id="swap-target" disabled={!source} value={target ? `${target.row}:${target.position}` : ''} onChange={(event) => { const [row, position] = event.target.value.split(':'); setTarget(event.target.value ? { row: row as SlotAddress['row'], position: Number(position) } : null) }}><option value="">Velg målfelt…</option>{layout.slots.flatMap((_, position) => ['upper', 'lower'].map((row) => <option key={`${row}:${position}`} value={`${row}:${position}`}>{row === 'upper' ? 'Øvre' : 'Nedre'} {position + 1}</option>))}</select>
    </label><button type="button" disabled={!source || !target} onClick={() => target && swap(target)}>Bytt fliser</button><button type="button" disabled={!source} onClick={() => { setSource(null); setTarget(null) }}>Avbryt valg</button></div>
    <p className="live" aria-live="polite">{announcement || (source ? 'Velg et annet felt for å bytte fliser.' : '')}</p><p className="grout-note">Visuell fuge: {groutMm.toFixed(1)} mm</p>
    <dl className="metrics"><div><dt>Par</dt><dd>{layout.slots.length}</dd></div><div><dt>Maks sømdrift</dt><dd>{fmt(layout.metrics.maximumAbsoluteDriftMm)}</dd></div><div><dt>Sluttdrift</dt><dd>{fmt(layout.metrics.absoluteFinalDriftMm)}</dd></div><div><dt>Advarsler</dt><dd>{layout.metrics.maximumAbsoluteDriftMm > toleranceMm ? 'Over toleranse' : '0'}</dd></div></dl>
  </section>
}
