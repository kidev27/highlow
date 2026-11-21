import { meta } from '../../../shared/modes/highlow.ts'
import type { ClientMode } from '../../mode.ts'
import { Play } from './Play.tsx'
import { Rules } from './Rules.tsx'

export const highlow: ClientMode = { meta, Play, Rules }
