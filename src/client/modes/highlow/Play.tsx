import { useEffect, useRef, useState } from 'preact/hooks'
import type { RoundSummary } from '../../../shared/mode.ts'
import { formatValue, meta, type Answered, type Card, type HighLowView } from '../../../shared/modes/highlow.ts'
import { get, post } from '../../core/api.ts'
import { Share as ShareIcon } from '../../core/icons.tsx'
import { share, shareText } from '../../core/share.ts'
import { Sheet } from '../../core/Sheet.tsx'
import { load, save } from '../../core/storage.ts'
import { recordResult, stats } from '../../core/streaks.ts'
import { TopBar } from '../../core/TopBar.tsx'
import { Rules } from './Rules.tsx'

interface RoundState { prompt: string | null; view: HighLowView | null; summary: RoundSummary | null }
interface Day { day: string; number: number; rounds: (RoundState & { slot: number })[] }

const SEEN_RULES = `highlow:seen-rules`

export function Play({ day }: { day: string }) {
  const [data, setData] = useState<Day | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** True while showing the values of the pair just answered, before moving on. */
  const [revealing, setRevealing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(() => !load(SEEN_RULES, false))
  const closeRules = () => (save(SEEN_RULES, true), setRulesOpen(false))

  const fetchDay = () => {
    setError(null)
    get<Day>(`${meta.id}/${day}`).then(setData, (e: Error) => setError(e.message))
  }
  useEffect(fetchDay, [day])

  const round = data?.rounds[0]
  const update = (r: RoundState) => setData((d) => d && { ...d, rounds: [{ slot: 0, ...r }] })
  const send = async (path: string, body?: object) => {
    setBusy(true)
    setError(null)
    try {
      update(await post<RoundState>(`${meta.id}/${day}/0/${path}`, body))
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }
  const pick = async (side: 0 | 1) => {
    if (busy || !round?.view) return
    if (await send('event', { type: 'pick', pair: round.view.answered.length, side })) setRevealing(true)
  }

  const v = round?.view
  let screen: preact.JSX.Element
  if (!data || !round) screen = <Status error={error} onRetry={fetchDay} />
  else if (!v) screen = <Intro number={data.number} busy={busy} error={error} onStart={() => void send('start')} />
  else if (revealing) screen = <Reveal view={v} onNext={() => setRevealing(false)} />
  else if (v.current) screen = <Ask view={v} cards={v.current} busy={busy} error={error} onPick={pick} />
  else screen = <Results day={data} view={v} summary={round.summary!} />

  return (
    <div class="app">
      <TopBar center={v && <Progress view={v} />} onHelp={() => setRulesOpen(true)} />
      {screen}
      <Sheet open={rulesOpen} title="How to play" onClose={closeRules}>
        <Rules />
        <button class="button primary big" onClick={closeRules}>Got it</button>
      </Sheet>
    </div>
  )
}

function Status({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <main class="scroll center">
      <p class="note">{error ?? 'Loading today’s puzzle…'}</p>
      {error && <button class="button primary" onClick={onRetry}>Try again</button>}
    </main>
  )
}

function Progress({ view }: { view: HighLowView }) {
  return (
    <ol class="progress" aria-label={`${view.answered.length} of ${view.total} answered`}>
      {Array.from({ length: view.total }, (_, i) => {
        const a = view.answered[i]
        return <li key={i} class={`step ${a ? (a.correct ? 'right' : 'wrong') : i === view.answered.length ? 'current' : ''}`} />
      })}
    </ol>
  )
}

function Intro(props: { number: number; busy: boolean; error: string | null; onStart: () => void }) {
  return (
    <>
      <main class="scroll center intro">
        <p class="eyebrow">Daily #{props.number}</p>
        <h1 class="logo">
          HIGH<span class="up">▲</span>
          <br />
          LOW<span class="down">▼</span>
        </h1>
        <p class="lead">Ten pairs. Tap the one that’s higher. Today’s theme appears when you start.</p>
        {props.error && <p class="note" role="alert">{props.error}</p>}
      </main>
      <footer class="controls">
        <button class="button primary big" disabled={props.busy} onClick={props.onStart}>
          {props.busy ? 'Starting…' : 'Play'}
        </button>
      </footer>
    </>
  )
}

function CardFace({ card, value, unit }: { card: Card; value?: number; unit: string }) {
  return (
    <>
      <span class="emoji" aria-hidden="true">{card.emoji}</span>
      <span class="name">{card.name}</span>
      {card.note && <span class="sub">{card.note}</span>}
      {value !== undefined && <span class="value">{formatValue(value, unit)}</span>}
    </>
  )
}

function Ask(props: { view: HighLowView; cards: [Card, Card]; busy: boolean; error: string | null; onPick: (side: 0 | 1) => void }) {
  const { view, cards } = props
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => first.current?.focus(), [view.answered.length])
  return (
    <main class="play">
      <p class="eyebrow">
        {view.theme} ∙ {view.answered.length + 1} of {view.total}
      </p>
      <h1 class="question">{view.question}</h1>
      {props.error && <p class="note" role="alert">{props.error}</p>}
      <div class="cards">
        {cards.map((c, i) => (
          <button
            key={c.name}
            ref={i === 0 ? first : undefined}
            class="card"
            disabled={props.busy}
            onClick={() => props.onPick(i as 0 | 1)}
          >
            <CardFace card={c} unit={view.unit} />
          </button>
        ))}
        <span class="vs" aria-hidden="true">VS</span>
      </div>
    </main>
  )
}

function Reveal({ view, onNext }: { view: HighLowView; onNext: () => void }) {
  const last = view.answered.at(-1)!
  const next = useRef<HTMLButtonElement>(null)
  useEffect(() => next.current?.focus(), [])
  const higher = last.cards[0].value > last.cards[1].value ? 0 : 1
  return (
    <>
      <main class="play">
        <p class="eyebrow">
          {view.theme} ∙ {view.answered.length} of {view.total}
        </p>
        <p class={`feedback ${last.correct ? 'right' : 'wrong'}`} role="status">
          {last.correct ? '✓ Correct' : '✗ Not quite'}
        </p>
        <div class="cards">
          {last.cards.map((c, i) => (
            <div key={c.name} class={`card revealed ${i === higher ? 'higher' : 'lower'} ${i === last.pick ? 'picked' : ''}`}>
              <CardFace card={c} value={c.value} unit={view.unit} />
              {i === last.pick && <span class="tag">Your pick</span>}
            </div>
          ))}
          <span class="vs" aria-hidden="true">VS</span>
        </div>
      </main>
      <footer class="controls">
        <button ref={next} class="button primary big" onClick={onNext}>
          {view.current ? 'Next ▸' : 'See results'}
        </button>
      </footer>
    </>
  )
}

function untilMidnight() {
  const now = new Date()
  const ms = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime()
  return `${Math.floor(ms / 3_600_000)}h ${String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, '0')}m`
}

function Line({ a, unit }: { a: Answered; unit: string }) {
  const [x, y] = a.cards
  return (
    <li class={a.correct ? 'right' : 'wrong'}>
      <span>
        {x.name} <small>{formatValue(x.value, unit)}</small> vs {y.name} <small>{formatValue(y.value, unit)}</small>
      </span>
      <b aria-label={a.correct ? 'correct' : 'wrong'}>{a.correct ? '✓' : '✗'}</b>
    </li>
  )
}

function Results({ day, view, summary }: { day: Day; view: HighLowView; summary: RoundSummary }) {
  const [st] = useState(() => stats(recordResult(meta.id, day.day, summary.score), day.day))
  const [shared, setShared] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(untilMidnight)
  useEffect(() => {
    const id = setInterval(() => setCountdown(untilMidnight()), 30_000)
    return () => clearInterval(id)
  }, [])

  const text = shareText(meta, day.number, [summary], location.origin)
  const onShare = async () => {
    const r = await share(text)
    setShared(r === 'copied' ? 'Copied. Paste it anywhere.' : r === 'failed' ? 'Could not share. Copy the text below.' : null)
  }

  return (
    <>
      <main class="scroll results">
        <p class="eyebrow">
          Daily #{day.number} ∙ {view.theme}
        </p>
        <p class="score">
          {summary.score}
          <small>/{view.total}</small>
        </p>
        <p class="grid" aria-hidden="true">{summary.glyph}</p>
        <dl class="stats">
          <div><dt>Played</dt><dd>{st.played}</dd></div>
          <div><dt>Streak</dt><dd>{st.streak}</dd></div>
          <div><dt>Best streak</dt><dd>{st.bestStreak}</dd></div>
          <div><dt>Best score</dt><dd>{st.bestDay}</dd></div>
        </dl>
        <ol class="lines" aria-label="All pairs">
          {view.answered.map((a, i) => <Line key={i} a={a} unit={view.unit} />)}
        </ol>
        <p class="hint">Source: {view.source}</p>
        <p class="countdown">
          Next puzzle in <strong>{countdown}</strong>
        </p>
        {shared && <p class="note" role="status">{shared}</p>}
      </main>
      <footer class="controls">
        <button class="button primary big" onClick={onShare}>
          <ShareIcon /> Share result
        </button>
      </footer>
    </>
  )
}
