/** A valid puzzle: pair i is "A{i}" (value i) vs "B{i}" (value i + 0.5), so B is always higher. */
export function testPuzzle(theme = 'Test theme') {
  return {
    theme,
    question: 'Which is higher?',
    unit: 'units',
    source: 'Made up for tests',
    pairs: Array.from({ length: 10 }, (_, i) => [
      { name: `A${i}`, emoji: '🅰️', value: i },
      { name: `B${i}`, emoji: '🅱️', note: 'Bee', value: i + 0.5 },
    ]),
  }
}
