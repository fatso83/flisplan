import { describe, expect, it } from 'vitest'
import { parseTileCsv } from '../csv'

describe('tile CSV import', () => {
  it('parses comma-delimited decimal-point CSV', () => {
    const result = parseTileCsv('id,bredde_mm,hoyde_mm\na,61.5,30\nb,31,60')
    expect(result).toEqual({ tiles: [
      { id: 'a', inputWidthMm: 61.5, inputHeightMm: 30, longMm: 61.5, shortMm: 30 },
      { id: 'b', inputWidthMm: 31, inputHeightMm: 60, longMm: 60, shortMm: 31 },
    ] })
  })

  it('parses semicolon-delimited decimal-comma CSV', () => {
    const result = parseTileCsv('id;bredde_mm;hoyde_mm\na;61,5;30\nb;31;60')
    expect(result).toHaveProperty('tiles')
    if ('tiles' in result) expect(result.tiles[0].inputWidthMm).toBe(61.5)
  })

  it('supports BOM, blank lines, quoted cells, and escaped quotes', () => {
    const result = parseTileCsv('\ufeffID, BREDDE_MM, HOYDE_MM\n\n"tile ""one""",61,30\nsecond,31,60\n')
    expect(result).toHaveProperty('tiles')
    if ('tiles' in result) expect(result.tiles[0].id).toBe('tile "one"')
  })

  it('keeps comma delimiter when quoted CSV fields contain semicolons', () => {
    const result = parseTileCsv('"id;header",bredde_mm,hoyde_mm\n"tile;one",61,30\nsecond,31,60')
    expect(result).toHaveProperty('errors')
    if ('errors' in result) expect(result.errors.map((item) => item.code)).not.toContain('field-count')
  })

  it.each([
    ['wrong header', 'name,bredde_mm,hoyde_mm\na,61,30'],
    ['missing header', 'a,61,30\nb,31,60'],
  ])('rejects %s', (_name, input) => {
    const result = parseTileCsv(input)
    expect(result).toHaveProperty('errors')
  })

  it('reports duplicate ids and malformed dimensions', () => {
    const result = parseTileCsv('id,bredde_mm,hoyde_mm\na,61,30\na,0,-2')
    expect(result).toHaveProperty('errors')
    if ('errors' in result) expect(result.errors.map((error) => error.code)).toEqual(expect.arrayContaining(['duplicate-id', 'invalid-dimension']))
  })

  it('rejects wrong field counts and comma decimal commas deterministically', () => {
    const result = parseTileCsv('id,bredde_mm,hoyde_mm\na,61,5,30\nb,31,60')
    expect(result).toHaveProperty('errors')
    if ('errors' in result) expect(result.errors[0].code).toBe('field-count')
  })

  it('rejects odd tile counts', () => {
    const result = parseTileCsv('id,bredde_mm,hoyde_mm\na,61,30\nb,31,60\nc,40,40')
    expect(result).toHaveProperty('errors')
    if ('errors' in result) expect(result.errors[0].code).toBe('odd-count')
  })

  it('is all-or-nothing when any row has an error', () => {
    const result = parseTileCsv('id,bredde_mm,hoyde_mm\na,61,30\nb,not-a-number,60')
    expect(result).toHaveProperty('errors')
    expect(result).not.toHaveProperty('tiles')
  })

  it('parses CRLF and quoted semicolon-delimited fields', () => {
    const result = parseTileCsv('id;bredde_mm;hoyde_mm\r\n"tile;one";61;30\r\nsecond;31;60\r\n')
    expect(result).toHaveProperty('tiles')
    if ('tiles' in result) expect(result.tiles[0].id).toBe('tile;one')
  })

  it.each([
    ['unclosed quote', 'id,bredde_mm,hoyde_mm\n"tile,61,30\nsecond,31,60'],
    ['characters after closing quote', 'id,bredde_mm,hoyde_mm\n"tile"oops,61,30\nsecond,31,60'],
    ['malformed embedded quote', 'id,bredde_mm,hoyde_mm\nab"cd,61,30\nsecond,31,60'],
  ])('rejects %s', (_name, input) => {
    const result = parseTileCsv(input)
    expect(result).toHaveProperty('errors')
    if ('errors' in result) expect(result.errors.map((item) => item.code)).toContain('malformed-quote')
  })

  it('rejects an empty id', () => {
    const result = parseTileCsv('id,bredde_mm,hoyde_mm\n,61,30\nsecond,31,60')
    expect(result).toHaveProperty('errors')
    if ('errors' in result) expect(result.errors[0].code).toBe('empty-id')
  })

  it('rejects fewer than two tiles', () => {
    const result = parseTileCsv('id,bredde_mm,hoyde_mm\na,61,30')
    expect(result).toHaveProperty('errors')
    if ('errors' in result) expect(result.errors.map((item) => item.code)).toContain('too-few-tiles')
  })
})
