// HIGH▲LOW▼: ten pairs a day, pick the card with the higher value. Mistakes don't end the game.
import type { ModeMeta } from '../mode.ts'

export const PAIRS = 10

export const meta: ModeMeta = {
  id: 'highlow',
  title: 'HIGH▲LOW▼',
  tagline: 'Ten pairs a day. Pick which one is higher.',
  roundsPerDay: 1,
  scoreUnit: '/10',
}

export interface Card {
  name: string
  emoji: string
  /** Short context under the name, e.g. "Country". */
  note?: string
}

export interface Revealed extends Card {
  value: number
}

export type HighLowEvent = { type: 'pick'; pair: number; side: 0 | 1 }

export interface Answered {
  cards: [Revealed, Revealed]
  pick: 0 | 1
  correct: boolean
}

/** What the player sees. Values appear only for pairs already answered. */
export interface HighLowView {
  theme: string
  question: string
  /** "year" shows plain years; anything else is printed after the number, e.g. "million", "km". */
  unit: string
  source: string
  total: number
  current: [Card, Card] | null
  answered: Answered[]
}

export const formatValue = (value: number, unit: string) =>
  unit === 'year' ? String(value) : `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${unit}`
