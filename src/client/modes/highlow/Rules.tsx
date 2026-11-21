import { PAIRS } from '../../../shared/modes/highlow.ts'

export function Rules() {
  return (
    <div class="rules">
      <ol class="rule-list">
        <li>Every day there is one theme, like populations or mountain heights.</li>
        <li>You get {PAIRS} pairs. Tap the one with the higher number.</li>
        <li>The real numbers are shown after each pick. A wrong pick doesn’t end the game.</li>
        <li>Score out of {PAIRS}, share your result, and come back tomorrow for a new theme.</li>
      </ol>
      <p class="hint">One puzzle a day, the same for everyone.</p>
    </div>
  )
}
