import { useEffect, useState } from 'react'
import { CsvImport } from './features/import/CsvImport'
import { ProjectPicker } from './features/projects/ProjectPicker'
import { PlanningBoard } from './features/planning/PlanningBoard'
import { optimizeLayout, type Layout } from './domain/layout'
import { createProject, listProjects, loadProject, saveProject } from './storage/database'
import type { ProjectSettings, ProjectSnapshot } from './domain/project'
import type { Tile, WallOrientation } from './domain/tile'
import './styles.css'

const initialSettings: ProjectSettings = { orientation: 'long-side-along-wall', groutMm: 2, toleranceMm: 2 }

function App() {
  const [tiles, setTiles] = useState<Tile[]>([])
  const [settings, setSettings] = useState<ProjectSettings>(initialSettings)
  const [layout, setLayout] = useState<Layout | null>(null)
  const [projects, setProjects] = useState<ProjectSnapshot[]>([])
  const [current, setCurrent] = useState<ProjectSnapshot | null>(null)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [importResetToken, setImportResetToken] = useState(0)
  useEffect(() => { void listProjects().then(setProjects).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Kunne ikke lese prosjekter')) }, [])
  const valid = tiles.length > 0 && tiles.length % 2 === 0
  const changeOrientation = (orientation: WallOrientation) => { const next = { ...settings, orientation }; setSettings(next); if (valid) setLayout(optimizeLayout(tiles, orientation)) }
  const importTiles = (next: Tile[]) => { setTiles(next); setLayout(null); setCurrent(null); setName(''); setMessage('') }
  const save = async () => { if (!layout || !valid || !name.trim()) return; try { const snapshot = current ? await saveProject({ ...current, name, tiles, settings, layout }) : await createProject({ name, tiles, settings, layout }); setCurrent(snapshot); setName(snapshot.name); setProjects(await listProjects()); setMessage(`Prosjektet «${snapshot.name}» er lagret.`) } catch (error) { setMessage(error instanceof Error ? error.message : 'Kunne ikke lagre prosjektet') } }
  const load = async (id: string) => { if (!id) return; try { const snapshot = await loadProject(id); if (!snapshot) return; setImportResetToken((token) => token + 1); setCurrent(snapshot); setName(snapshot.name); setTiles(snapshot.tiles); setSettings(snapshot.settings); setLayout(snapshot.layout); setMessage(`Lastet «${snapshot.name}».`) } catch (error) { setMessage(error instanceof Error ? error.message : 'Kunne ikke laste prosjektet') } }
  return <main className="app-shell"><header><h1>Flisplan</h1><p>Planlegg en presis, to-raders flisvegg.</p></header>{message && <div role="alert" className="notice">{message}</div>}<div className="layout-grid"><aside><ProjectPicker projects={projects} currentName={current?.name ?? ''} onNew={() => { setImportResetToken((token) => token + 1); setCurrent(null); setName(''); setTiles([]); setLayout(null); setMessage('') }} onSelect={(id) => void load(id)} /><CsvImport onImport={importTiles} resetToken={importResetToken} /><section className="settings" aria-labelledby="settings-heading"><h2 id="settings-heading">Innstillinger</h2><fieldset><legend>Orientering</legend><label><input type="radio" name="orientation" checked={settings.orientation === 'long-side-along-wall'} onChange={() => changeOrientation('long-side-along-wall')} /> Langside langs vegg</label><label><input type="radio" name="orientation" checked={settings.orientation === 'short-side-along-wall'} onChange={() => changeOrientation('short-side-along-wall')} /> Kortside langs vegg</label></fieldset><label>Fuge (mm)<input type="number" min="0" step="0.1" value={settings.groutMm} onChange={(event) => setSettings({ ...settings, groutMm: Number(event.target.value) })} /></label><label>Toleranse (mm)<input type="number" min="0" step="0.1" value={settings.toleranceMm} onChange={(event) => setSettings({ ...settings, toleranceMm: Number(event.target.value) })} /></label></section><section className="actions"><button type="button" disabled={!valid} onClick={() => setLayout(optimizeLayout(tiles, settings.orientation))}>Optimaliser</button><label htmlFor="project-name">Prosjektnavn<input id="project-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Mitt prosjekt" /></label><button type="button" disabled={!layout || !name.trim()} onClick={() => void save()}>Lagre prosjekt</button></section></aside><div>{layout ? <PlanningBoard tiles={tiles} layout={layout} toleranceMm={settings.toleranceMm} groutMm={settings.groutMm} onLayoutChange={setLayout} /> : <div className="empty-state"><h2>Ingen plan ennå</h2><p>Importer en gyldig CSV og velg «Optimaliser».</p></div>}</div></div></main>
}
export default App
