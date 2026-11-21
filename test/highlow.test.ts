import { describe, expect, it } from 'vitest'
import { highlow as m } from '../server/modes/highlow.ts'
import { formatValue } from '../src/shared/modes/highlow.ts'
import { testPuzzle } from './helpers.ts'

const p = m.parse(testPuzzle())
const pick = (pair: number, side: 0 | 1) => ({ type: 'pick' as const, pair, side })
const play = (sides: (0 | 1)[]) => sides.reduce((s, side, i) => m.apply(s, pick(i, side), p, 0), m.start(p, 0))

describe('parse', () => {
  it('rejects bad content', () => {
    expect(() => m.parse({ ...testPuzzle(), pairs: testPuzzle().pairs.slice(1) })).toThrow(/exactly 10 pairs/)
    const tie = testPuzzle()
    tie.pairs[3][1].value = tie.pairs[3][0].value
    expect(() => m.parse(tie)).toThrow(/pair 4: values tie/)
    const noValue = testPuzzle() as { pairs: { value: unknown }[][] }
    noValue.pairs[0][0].value = '5'
    expect(() => m.parse(noValue)).toThrow(/numeric value/)
    expect(() => m.parse({ ...testPuzzle(), source: '' })).toThrow(/source/)
  })
})

describe('round', () => {
  it('shows the first pair without values', () => {
    const v = m.view(m.start(p, 0), 0, p)
    expect(v.current).toEqual([{ name: 'A0', emoji: '🅰️' }, { name: 'B0', emoji: '🅱️', note: 'Bee' }])
    expect(v.answered).toEqual([])
    expect(JSON.stringify(v)).not.toContain('value')
  })

  it('scores a pick, reveals that pair only, and moves on', () => {
    const s = play([1])
    const v = m.view(s, 0, p)
    expect(v.answered).toEqual([{ cards: p.pairs[0], pick: 1, correct: true }])
    expect(v.current?.[0].name).toBe('A1')
    expect(JSON.stringify(v.current)).not.toContain('value')
  })

  it('marks a wrong pick and keeps going', () => {
    expect(m.view(play([0, 1]), 0, p).answered.map((a) => a.correct)).toEqual([false, true])
  })

  it('ignores a pick for any pair but the next one', () => {
    const s = play([1])
    expect(m.apply(s, pick(0, 0), p, 0)).toBe(s) // double tap on the pair just answered
    expect(m.apply(s, pick(5, 0), p, 0)).toBe(s) // skipping ahead
  })

  it('finishes after ten picks with a two-row glyph', () => {
    const s = play([1, 1, 0, 1, 1, 1, 1, 1, 0, 1])
    expect(m.view(s, 0, p).current).toBeNull()
    expect(m.summary(s)).toEqual({ score: 8, outcome: 'finished', glyph: '🟩🟩🟥🟩🟩\n🟩🟩🟩🟥🟩' })
    expect(m.apply(s, pick(10, 0), p, 0)).toBe(s)
    expect(m.summary(play([1, 1, 1]))).toBeNull()
  })
})

it('formats values', () => {
  expect(formatValue(232.7, 'million')).toBe('232.7 million')
  expect(formatValue(8849, 'm')).toBe('8,849 m')
  expect(formatValue(1997, 'year')).toBe('1997')
})
