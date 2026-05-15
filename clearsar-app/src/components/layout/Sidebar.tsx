import { PageId } from '../../types'

interface Props {
  current: PageId
  onNavigate: (page: PageId) => void
}

const NAV_ITEMS = [
  {
    section: '// Workspace',
    items: [
      { id: 'landing' as PageId, label: 'Overview', shortcut: 'G', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 12l9-9 9 9M5 10v10h14V10"/></svg>) },
      { id: 'upload' as PageId, label: 'New translation', shortcut: 'N', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14"/></svg>) },
      { id: 'processing' as PageId, label: 'Active runs', shortcut: 'R', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>) },
      { id: 'results' as PageId, label: 'Scene viewer', shortcut: 'V', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="18" height="16" rx="1"/><line x1="12" y1="4" x2="12" y2="20"/></svg>) },
      { id: 'dashboard' as PageId, label: 'Library', shortcut: 'L', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>) },
    ],
  },
  {
    section: '// Research',
    items: [
      { id: 'admin' as PageId, label: 'Evaluation', shortcut: 'E', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 17l5-5 4 4 4-6 5 7"/><path d="M3 20h18"/></svg>) },
    ],
  },
]

export default function Sidebar({ current, onNavigate }: Props) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#ff6a2c" strokeWidth="1.2"/>
          <circle cx="12" cy="12" r="5" stroke="#ff6a2c" strokeWidth="1.2"/>
          <circle cx="12" cy="12" r="1.5" fill="#ff6a2c"/>
          <line x1="2" y1="12" x2="22" y2="12" stroke="#ff6a2c" strokeWidth=".6" strokeDasharray="1 2"/>
          <line x1="12" y1="2" x2="12" y2="22" stroke="#ff6a2c" strokeWidth=".6" strokeDasharray="1 2"/>
        </svg>
        ClearSAR
        <span className="v">v0.4.2</span>
      </div>

      <div className="tenant">
        <span>TENANT</span>
        <b>FAST-NUCES / FYP-26</b>
      </div>

      <nav>
        {NAV_ITEMS.map(group => (
          <div key={group.section}>
            <div className="side-sect">{group.section}</div>
            {group.items.map(item => (
              <div
                key={item.id}
                className={`nv${current === item.id ? ' on' : ''}`}
                onClick={() => onNavigate(item.id)}
              >
                {item.icon}
                {item.label}
                <span className="k">{item.shortcut}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="nv disabled">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
          Docs
          <span className="k">?</span>
        </div>
      </nav>

      <div className="sidebar-user">
        <div className="user-av">AH</div>
        <div className="user-info">
          Arsalan Hassan
          <small>analyst · 22F-3050</small>
        </div>
      </div>
    </aside>
  )
}
