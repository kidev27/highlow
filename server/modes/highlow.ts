import {
  meta, PAIRS,
  type Card, type HighLowEvent, type HighLowView, type Revealed,
} from '../../src/shared/modes/highlow.ts'
import type { ServerMode } from '../mode.ts'

interface Puzzle {
  theme: string
  question: string
  unit: string
  source: string
  pairs: [Revealed, Revealed][]
}

interface State {
  picks: (0 | 1)[]
  correct: boolean[]
}

const text = (v: unknown, what: string) => {
  if (typeof v !== 'string' || !v.trim()) throw new Error(`missing ${what}`)
  return v
}

/**
 * Content format: { theme, question, unit, source, pairs: [[card, card] x 10] },
 * card = { name, emoji, note?, value }. Validated at boot, so bad content stops the server.
 */
function parse(raw: unknown): Puzzle {
  const r = raw as Record<string, unknown>
  const theme = text(r?.theme, 'theme')
  const pairs = r.pairs
  if (!Array.isArray(pairs) || pairs.length !== PAIRS) throw new Error(`"${theme}": needs exactly ${PAIRS} pairs`)
  pairs.forEach((pair, i) => {
    if (!Array.isArray(pair) || pair.length !== 2) throw new Error(`"${theme}" pair ${i + 1}: needs two cards`)
    for (const c of pair) {
      text(c?.name, `name in pair ${i + 1}`)
      text(c?.emoji, `emoji for "${c.name}"`)
      if (!Number.isFinite(c.value)) throw new Error(`"${theme}": "${c.name}" needs a numeric value`)
    }
    if (pair[0].value === pair[1].value) throw new Error(`"${theme}" pair ${i + 1}: values tie`)
  })
  return {
    theme,
    question: text(r.question, `question for "${theme}"`),
    unit: text(r.unit, `unit for "${theme}"`),
    source: text(r.source, `source for "${theme}"`),
    pairs: pairs as Puzzle['pairs'],
  }
}

const hide = ({ name, emoji, note }: Revealed): Card => ({ name, emoji, note })

function apply(s: State, e: HighLowEvent, p: Puzzle): State {
  // Only the next unanswered pair can be picked, so a double tap or a stale request is a no-op.
  if (e.pair !== s.picks.length || e.pair >= p.pairs.length) return s
  const [a, b] = p.pairs[e.pair]
  const correct = e.side === 0 ? a.value > b.value : b.value > a.value
  return { picks: [...s.picks, e.side], correct: [...s.correct, correct] }
}

export const highlow: ServerMode<Puzzle, State, HighLowEvent, HighLowView> = {
  meta,
  eventSchema: {
    type: 'object',
    required: ['type', 'pair', 'side'],
    additionalProperties: false,
    properties: {
      type: { const: 'pick' },
      pair: { type: 'integer', minimum: 0, maximum: PAIRS - 1 },
      side: { enum: [0, 1] },
    },
  },
  parse,
  prompt: (p) => p.theme,
  start: () => ({ picks: [], correct: [] }),
  apply,
  view: (s, _now, p) => {
    const next = p.pairs[s.picks.length]
    return {
      theme: p.theme,
      question: p.question,
      unit: p.unit,
      source: p.source,
      total: p.pairs.length,
      current: next ? [hide(next[0]), hide(next[1])] : null,
      answered: s.picks.map((pick, i) => ({ cards: p.pairs[i], pick, correct: s.correct[i] })),
    }
  },
  summary: (s) => {
    if (s.picks.length < PAIRS) return null
    const squares = s.correct.map((c) => (c ? '🟩' : '🟥'))
    return {
      score: s.correct.filter(Boolean).length,
      outcome: 'finished',
      glyph: `${squares.slice(0, 5).join('')}\n${squares.slice(5).join('')}`,
    }
  },
}
