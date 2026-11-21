import { render } from 'preact'
import { App } from './app.tsx'
import { applySettings } from './core/settings.ts'
import './theme.css'

applySettings()
render(<App />, document.getElementById('app')!)
