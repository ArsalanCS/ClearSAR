import { PageId } from '../../types'

const PAGE_META: Record<PageId, { section: string; name: string }> = {
  landing:    { section: 'Workspace', name: 'Overview' },
  upload:     { section: 'Workspace', name: 'New translation' },
  processing: { section: 'Workspace', name: 'Active runs' },
  results:    { section: 'Workspace', name: 'Scene viewer' },
  dashboard:  { section: 'Workspace', name: 'Library' },
  admin:      { section: 'Research',  name: 'Model evaluation' },
}

interface Props {
  page: PageId
}

export default function TopBar({ page }: Props) {
  const meta = PAGE_META[page]

  return (
    <div className="topbar">
      <div className="crumbs">
        <em>{meta.section}</em> / <b>{meta.name}</b>
      </div>
      <div className="topbar-spacer" />
      <div className="topbar-search">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7"/>
          <path d="M21 21l-5-5"/>
        </svg>
        <span>Search scenes, AOI, captions…</span>
        <span className="kbd">⌘K</span>
      </div>
    </div>
  )
}
