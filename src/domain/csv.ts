import { normalizeTile, type Tile } from './tile'

export type CsvImportErrorCode =
  | 'missing-header'
  | 'invalid-header'
  | 'malformed-quote'
  | 'field-count'
  | 'empty-id'
  | 'duplicate-id'
  | 'invalid-dimension'
  | 'odd-count'
  | 'too-few-tiles'

export interface CsvImportError {
  row: number
  code: CsvImportErrorCode
  message: string
}

export type CsvImportResult = { tiles: Tile[] } | { errors: CsvImportError[] }

interface CsvRecord {
  row: number
  fields: string[]
}

function records(text: string, delimiter: ',' | ';'): { records: CsvRecord[]; errors: CsvImportError[] } {
  const input = text.replace(/^\uFEFF/, '')
  const output: CsvRecord[] = []
  const errors: CsvImportError[] = []
  let fields: string[] = []
  let field = ''
  let quoted = false
  let afterQuote = false
  let row = 1
  let startRow = 1

  const pushField = () => {
    fields.push(field)
    field = ''
  }
  const pushRecord = () => {
    pushField()
    if (fields.some((value) => value.trim() !== '')) output.push({ row: startRow, fields })
    fields = []
    startRow = row
  }

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
          afterQuote = true
        }
      } else {
        field += character
        if (character === '\n') row += 1
      }
      continue
    }
    if (afterQuote) {
      if (character === delimiter) {
        pushField()
        afterQuote = false
      } else if (character === '\r' || character === '\n') {
        afterQuote = false
        if (character === '\r' && input[index + 1] === '\n') index += 1
        pushRecord()
        row += 1
      } else if (character.trim() !== '') {
        errors.push({ row: startRow, code: 'malformed-quote', message: 'Unexpected characters after closing quote' })
        afterQuote = false
        field += character
      }
      continue
    }
    if (character === '"' && field.trim() === '') {
      quoted = true
    } else if (character === '"') {
      errors.push({ row: startRow, code: 'malformed-quote', message: 'Quotes must start a field' })
      field += character
    } else if (character === delimiter) {
      pushField()
    } else if (character === '\r' || character === '\n') {
      if (character === '\r' && input[index + 1] === '\n') index += 1
      pushRecord()
      row += 1
    } else {
      field += character
    }
  }
  if (quoted) errors.push({ row: startRow, code: 'malformed-quote', message: 'Unclosed quoted field' })
  if (fields.length > 0 || field.length > 0) pushRecord()
  return { records: output, errors }
}

function error(row: number, code: CsvImportErrorCode, message: string): CsvImportError {
  return { row, code, message }
}

function hasUnquotedDelimiter(line: string, delimiter: ',' | ';'): boolean {
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') {
      if (quoted && line[index + 1] === '"') index += 1
      else quoted = !quoted
    } else if (!quoted && line[index] === delimiter) {
      return true
    }
  }
  return false
}

export function parseTileCsv(text: string): CsvImportResult {
  const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/).find((line) => line.trim() !== '') ?? ''
  const delimiter: ',' | ';' = hasUnquotedDelimiter(firstLine, ';') ? ';' : ','
  const parsed = records(text, delimiter)
  const errors = [...parsed.errors]
  const header = parsed.records[0]
  const expected = ['id', 'bredde_mm', 'hoyde_mm']

  if (!header) return { errors: [error(1, 'missing-header', 'CSV header is missing')] }
  if (header.fields.length !== 3 || header.fields.map((value) => value.trim().toLowerCase()).some((value, index) => value !== expected[index])) {
    errors.push(error(header.row, 'invalid-header', 'Expected header id,bredde_mm,hoyde_mm'))
  }
  const tiles: Tile[] = []
  const ids = new Set<string>()
  for (const record of parsed.records.slice(1)) {
    if (record.fields.length !== 3) {
      errors.push(error(record.row, 'field-count', 'Each data row must contain exactly three fields'))
      continue
    }
    const [rawId, rawWidth, rawHeight] = record.fields.map((value) => value.trim())
    if (rawId === '') {
      errors.push(error(record.row, 'empty-id', 'Tile id must not be empty'))
      continue
    }
    if (ids.has(rawId)) errors.push(error(record.row, 'duplicate-id', `Duplicate tile id: ${rawId}`))
    ids.add(rawId)
    const parseNumber = (value: string): number => Number(delimiter === ';' ? value.replace(',', '.') : value)
    const width = parseNumber(rawWidth)
    const height = parseNumber(rawHeight)
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      errors.push(error(record.row, 'invalid-dimension', 'Dimensions must be finite and positive'))
      continue
    }
    tiles.push(normalizeTile(rawId, width, height))
  }
  if (tiles.length % 2 === 1 && !errors.some((item) => item.code === 'field-count' || item.code === 'invalid-header')) {
    errors.push(error(0, 'odd-count', 'Tile count must be even'))
  }
  if (tiles.length < 2 && !errors.some((item) => item.code === 'invalid-header' || item.code === 'missing-header')) {
    errors.push(error(0, 'too-few-tiles', 'At least two tiles are required'))
  }
  return errors.length > 0 ? { errors } : { tiles }
}
