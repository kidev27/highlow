import type { ModeMeta, RoundSummary } from '../../shared/mode.ts'

/** Spoiler-free result: title, one glyph line per round, total, link. */
export function shareText(meta: ModeMeta, number: number, rounds: RoundSummary[], url: string) {
  const total = rounds.reduce((n, r) => n + r.score, 0)
  return [`${meta.title} #${number}`, ...rounds.map((r) => r.glyph), `${total}${meta.scoreUnit}`, url].join('\n')
}

/** Native share sheet on touch devices, clipboard elsewhere. */
export async function share(text: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
