// Writes new daily puzzles from Wikidata pools of well-known things. Run by hand:
//   NODE_USE_ENV_PROXY=1 node scripts/make-days.ts 2026-11-28 14
// Themes rotate day by day. Each day gets 10 pairs of famous items whose values differ by enough
// to be fair (3%) but not so much that the answer is obvious (3x). Same day, same output.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { addDays } from '../src/shared/day.ts'

interface Item { name: string; value: number; emoji: string; fame: number }
interface Theme {
  theme: string
  question: string
  unit: string
  source: string
  /** SPARQL returning ?name ?value ?fame and optionally ?iso (two-letter country code for a flag). */
  query: string
  emoji: string
  scale?: number
  round?: number
}

const LABEL = `?item rdfs:label ?name . FILTER(LANG(?name) = "en")`
const qty = (p: string) => `?item p:${p}/psn:${p}/wikibase:quantityAmount ?v .`
const COUNTRY = `?item wdt:P31 wd:Q3624078 ; wikibase:sitelinks ?links . FILTER NOT EXISTS { ?item wdt:P576 ?end }
  OPTIONAL { ?item wdt:P297 ?iso } OPTIONAL { ?item wdt:P1813 ?short . FILTER(LANG(?short) = "en" && STRLEN(?short) > 3) }`

const THEMES: Theme[] = [
  { theme: 'World populations', question: 'Which has more people?', unit: 'million', scale: 1e-6, round: 1, emoji: '🌍',
    source: 'Wikidata population (P1082), retrieved when this puzzle was made',
    query: `SELECT ?item (COALESCE(SAMPLE(?short), SAMPLE(?label)) AS ?name) (MAX(?v) AS ?value) (SAMPLE(?iso) AS ?iso) (MAX(?links) AS ?fame) WHERE {
      ${COUNTRY} ?item wdt:P1082 ?v . ?item rdfs:label ?label . FILTER(LANG(?label) = "en") FILTER(?links >= 150) } GROUP BY ?item` },
  { theme: 'Mountains', question: 'Which is higher?', unit: 'm', round: 0, emoji: '🏔️',
    source: 'Wikidata elevation (P2044)',
    query: `SELECT ?name (MAX(?v) AS ?value) (MAX(?links) AS ?fame) WHERE { ?item wdt:P31 wd:Q8502 ; wdt:P2044 ?raw ; wikibase:sitelinks ?links .
      FILTER(?raw > 1000) FILTER(?links >= 45) ${qty('P2044')} ${LABEL} } GROUP BY ?name` },
  { theme: 'Famous structures', question: 'Which is taller?', unit: 'm', round: 0, emoji: '🗼',
    source: 'Wikidata height (P2048)',
    query: `SELECT ?name (MAX(?v) AS ?value) (MAX(?links) AS ?fame) WHERE {
      VALUES ?type { wd:Q11303 wd:Q12518 wd:Q1440300 wd:Q11166728 } ?item wdt:P31 ?type ; wikibase:sitelinks ?links . FILTER(?links >= 30)
      ${qty('P2048')} ${LABEL} } GROUP BY ?name` },
  { theme: 'Rivers', question: 'Which is longer?', unit: 'km', scale: 1e-3, round: 0, emoji: '🌊',
    source: 'Wikidata length (P2043)',
    query: `SELECT ?name (MAX(?v) AS ?value) (MAX(?links) AS ?fame) WHERE { ?item wdt:P31 wd:Q4022 ; wikibase:sitelinks ?links . FILTER(?links >= 60)
      ${qty('P2043')} ${LABEL} } GROUP BY ?name` },
  { theme: 'Country sizes', question: 'Which is bigger?', unit: 'km²', scale: 1e-6, round: 0, emoji: '🗺️',
    source: 'Wikidata area (P2046)',
    query: `SELECT ?item (COALESCE(SAMPLE(?short), SAMPLE(?label)) AS ?name) (MAX(?v) AS ?value) (SAMPLE(?iso) AS ?iso) (MAX(?links) AS ?fame) WHERE {
      ${COUNTRY} ?item p:P2046/psn:P2046/wikibase:quantityAmount ?v . ?item rdfs:label ?label . FILTER(LANG(?label) = "en") FILTER(?links >= 150) } GROUP BY ?item` },
  { theme: 'Islands', question: 'Which is bigger?', unit: 'km²', scale: 1e-6, round: 0, emoji: '🏝️',
    source: 'Wikidata area (P2046)',
    query: `SELECT ?name (MAX(?v) AS ?value) (MAX(?links) AS ?fame) WHERE { ?item wdt:P31 wd:Q23442 ; wikibase:sitelinks ?links . FILTER(?links >= 60)
      ${qty('P2046')} ${LABEL} } GROUP BY ?name` },
  { theme: 'Lakes', question: 'Which is bigger?', unit: 'km²', scale: 1e-6, round: 0, emoji: '💧',
    source: 'Wikidata area (P2046)',
    query: `SELECT ?name (MAX(?v) AS ?value) (MAX(?links) AS ?fame) WHERE { ?item wdt:P31 wd:Q23397 ; wikibase:sitelinks ?links . FILTER(?links >= 40)
      ${qty('P2046')} ${LABEL} } GROUP BY ?name` },
]

/** Wikidata rate-limits (429) and times out (5xx) under load: retry with backoff. */
async function sparql(query: string, attempt = 1): Promise<Record<string, { value: string }>[]> {
  const res = await fetch('https://query.wikidata.org/sparql', {
    method: 'POST',
    headers: { accept: 'application/sparql-results+json', 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'highlow-content-builder/1.0 (https://github.com/kidev27/highlow)' },
    body: new URLSearchParams({ query }),
  })
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    await new Promise((r) => setTimeout(r, Number(res.headers.get('retry-after')) * 1000 || 15_000 * attempt))
    return sparql(query, attempt + 1)
  }
  if (!res.ok) throw new Error(`Wikidata ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return ((await res.json()) as { results: { bindings: Record<string, { value: string }>[] } }).results.bindings
}

const flag = (iso: string) => [...iso.toUpperCase()].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('')
const tidy = (s: string) => s.trim().replace(/^\p{Ll}/u, (c) => c.toUpperCase())

async function pool(t: Theme): Promise<Item[]> {
  const seen = new Set<string>()
  return (await sparql(t.query)).flatMap((r) => {
    const name = tidy(r.name?.value ?? '')
    const raw = Number(r.value?.value) * (t.scale ?? 1)
    const value = Number(raw.toFixed(t.round ?? 0))
    if (!name || /^Q\d+$/.test(name) || name.length > 32 || !(value > 0) || seen.has(name)) return []
    if (t.unit === 'year' && (value < 1000 || value > 2026)) return []
    seen.add(name)
    return [{ name, value, emoji: r.iso?.value ? flag(r.iso.value) : t.emoji, fame: Number(r.fame.value) }]
  })
}

/** Small seeded PRNG so a day's pairs are stable across runs. */
function rng(seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 2 ** 32
}

function pairs(items: Item[], day: string, unit: string) {
  const rand = rng(day)
  // Only the 50 best known: players should recognise both cards.
  const famous = [...items].sort((a, b) => b.fame - a.fame).slice(0, 50)
  const used = new Set<string>()
  const out: [Item, Item][] = []
  for (let tries = 0; out.length < 10 && tries < 5000; tries++) {
    const a = famous[Math.floor(rand() * famous.length)]
    const b = famous[Math.floor(rand() * famous.length)]
    if (a === b || used.has(a.name) || used.has(b.name)) continue
    const [lo, hi] = a.value < b.value ? [a.value, b.value] : [b.value, a.value]
    const fair = unit === 'year' ? hi - lo >= 2 && hi - lo <= 40 : hi / lo >= 1.03 && hi / lo <= 3
    if (!fair) continue
    used.add(a.name).add(b.name)
    out.push([a, b])
  }
  if (out.length < 10) throw new Error(`${day}: only ${out.length} fair pairs`)
  return out.map((p) => p.map(({ name, emoji, value }) => ({ name, emoji, value })))
}

const [from, count = '14'] = process.argv.slice(2)
if (!from) throw new Error('usage: node scripts/make-days.ts YYYY-MM-DD [days]')
const pools = new Map<Theme, Item[]>()
for (let i = 0; i < Number(count); i++) {
  const day = addDays(from, i)
  const t = THEMES[i % THEMES.length]
  if (!pools.has(t)) pools.set(t, await pool(t))
  const { theme, question, unit, source } = t
  const file = fileURLToPath(new URL(`../content/highlow/${day}.json`, import.meta.url))
  writeFileSync(file, JSON.stringify({ rounds: [{ theme, question, unit, source, pairs: pairs(pools.get(t)!, day, unit) }] }, null, 2) + '\n')
  console.log(day, theme, `(${pools.get(t)!.length} in pool)`)
}
