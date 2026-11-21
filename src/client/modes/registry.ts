import type { ClientMode } from '../mode.ts'
import { highlow } from './highlow/index.ts'

// Add a mode: import it and list it here.
export const clientModes: ClientMode[] = [highlow]
