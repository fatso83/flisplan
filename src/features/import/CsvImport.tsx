import { useEffect, useRef, useState } from 'react'
import { parseTileCsv, type CsvImportError } from '../../domain/csv'
import type { Tile } from '../../domain/tile'

export interface CsvImportProps { onImport: (tiles: Tile[]) => void; resetToken?: number }

export function CsvImport({ onImport, resetToken = 0 }: CsvImportProps) {
  const [errors, setErrors] = useState<CsvImportError[]>([])
  const [count, setCount] = useState(0)
  const [fileName, setFileName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { setErrors([]); setCount(0); setFileName(''); if (inputRef.current) inputRef.current.value = '' }, [resetToken])

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const result = parseTileCsv(await file.text())
    if ('errors' in result) { setErrors(result.errors); setCount(0); onImport([]); return }
    setErrors([]); setCount(result.tiles.length); onImport(result.tiles)
  }

  return <section className="import-panel" aria-labelledby="import-heading">
    <h2 id="import-heading">Importer fliser</h2>
    <label htmlFor="csv-file">CSV-fil</label>
    <input ref={inputRef} id="csv-file" type="file" accept=".csv,text/csv" onChange={handleFile} />
    {fileName && <span className="file-name">{fileName}</span>}
    <p className="hint">Forventede kolonner: <code>id,bredde_mm,hoyde_mm</code></p>
    {errors.length > 0 && <div role="alert" className="error-list">
      <strong>Importen kunne ikke brukes</strong>
      <ul>{errors.map((error, index) => <li key={`${error.row}-${error.code}-${index}`}>Rad {error.row || '—'}: {error.message}</li>)}</ul>
    </div>}
    {count > 0 && <p role="status" className="import-summary">{count} fliser · {count / 2} par</p>}
  </section>
}
