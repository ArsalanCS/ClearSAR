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
      <div className="topbar-status">
        <span className="dot" />
        <span>GPU · A100 · 78%</span>
      </div>
      <button className="iconbtn" title="Notifications">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M15 17h5l-1.4-1.4A7 7 0 1 0 5 11"/>
          <circle cx="19" cy="5" r="3" fill="#ff6a2c" stroke="none"/>
        </svg>
      </button>
      <button className="iconbtn" title="Settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19 12l2 1-1 2-2-1M5 12l-2 1 1 2 2-1M12 5l1-2 2 1-1 2M12 19l1 2 2-1-1-2"/>
        </svg>
      </button>
    </div>
  )
}
