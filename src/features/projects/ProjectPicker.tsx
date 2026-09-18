import type { ProjectSnapshot } from '../../domain/project'

export interface ProjectPickerProps {
  projects: ProjectSnapshot[]
  currentName: string
  onNew: () => void
  onSelect: (id: string) => void
}

export function ProjectPicker({ projects, currentName, onNew, onSelect }: ProjectPickerProps) {
  return <section className="project-picker" aria-labelledby="projects-heading">
    <h2 id="projects-heading">Prosjekter</h2>
    <p>{currentName ? <>Åpent prosjekt: <strong>{currentName}</strong></> : 'Nytt prosjekt'}</p>
    <button type="button" onClick={onNew}>Nytt prosjekt</button>
    {projects.length > 0 && <label htmlFor="project-select">Last prosjekt
      <select id="project-select" value="" onChange={(event) => onSelect(event.target.value)}>
        <option value="" disabled>Velg prosjekt…</option>
        {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select>
    </label>}
  </section>
}
