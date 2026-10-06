import { useEffect, useRef } from 'react'
import { PageId } from '../../types'

const PAGE_META: Record<PageId, { section: string; name: string }> = {
  landing:    { section: 'Workspace', name: 'Overview' },
  upload:     { section: 'Workspace', name: 'New translation' },
  processing: { section: 'Workspace', name: 'Active runs' },
  results:    { section: 'Workspace', name: 'Scene viewer' },
  dashboard:  { section: 'Workspace', name: 'Library' },
  admin:      { section: 'Research',  name: 'Model evaluation' },
  docs:       { section: 'Research',  name: 'Docs & reports' },
}

interface Props {
  page: PageId
  query: string
  onQuery: (q: string) => void
}

export default function TopBar({ page, query, onQuery }: Props) {
  const meta = PAGE_META[page]
  const inputRef = useRef<HTMLInputElement>(null)

  // ⌘K / Ctrl+K focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="topbar">
      <div className="crumbs">
        <em>{meta.section}</em> / <b>{meta.name}</b>
      </div>
      <div className="topbar-spacer" />
      <label className="topbar-search">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7"/>
          <path d="M21 21l-5-5"/>
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => onQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') { onQuery(''); inputRef.current?.blur() } }}
          placeholder="Search scenes, reports…"
          aria-label="Search scenes and reports"
        />
        <span className="kbd">⌘K</span>
      </label>
    </div>
  )
}
