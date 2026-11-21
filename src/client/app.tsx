import { useEffect, useState } from 'preact/hooks'
import { dayNumber, localDayKey } from '../shared/day.ts'
import { Privacy } from './core/Privacy.tsx'
import { Sheet } from './core/Sheet.tsx'
import { getHistory, stats } from './core/streaks.ts'
import { TopBar } from './core/TopBar.tsx'
import type { ClientMode } from './mode.ts'
import { clientModes } from './modes/registry.ts'

const route = () => location.hash.replace(/^#\/?/, '')

export function App() {
  const [path, setPath] = useState(route)
  useEffect(() => {
    const on = () => setPath(route())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])

  const mode = clientModes.find((m) => m.meta.id === path)
  return mode ? <mode.Play day={localDayKey()} /> : <Home />
}

function Home() {
  const today = localDayKey()
  const [rules, setRules] = useState<ClientMode | null>(null)
  const [privacy, setPrivacy] = useState(false)
  const date = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div class="app">
      <TopBar brand={false} />
      <main class="scroll center home">
        <h1 class="logo">
          HIGH<span class="up">▲</span>
          <br />
          LOW<span class="down">▼</span>
        </h1>
        <p class="eyebrow">
          Daily #{dayNumber(today)} ∙ {date}
        </p>
        {clientModes.map((m) => {
          const history = getHistory(m.meta.id)
          const { streak } = stats(history, today)
          return (
            <section key={m.meta.id} class="mode" aria-label={m.meta.title}>
              <p class="lead">{m.meta.tagline}</p>
              <a class="button primary big" href={`#/${m.meta.id}`}>
                {today in history ? 'See today’s result' : 'Play'}
              </a>
              <p class="hint">
                {streak > 0 && <>🔥 {streak}-day streak ∙ </>}
                {m.Rules && (
                  <button class="link" onClick={() => setRules(m)}>
                    How to play
                  </button>
                )}
              </p>
            </section>
          )
        })}
        <button class="link small" onClick={() => setPrivacy(true)}>
          Privacy
        </button>
      </main>
      {rules?.Rules && (
        <Sheet open title="How to play" onClose={() => setRules(null)}>
          <rules.Rules />
        </Sheet>
      )}
      <Sheet open={privacy} title="Privacy" onClose={() => setPrivacy(false)}>
        <Privacy />
      </Sheet>
    </div>
  )
}
