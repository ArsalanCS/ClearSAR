import { useState, useEffect, useCallback } from 'react'
import { PageId } from './types'
import ScanLine from './components/layout/ScanLine'
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'
import Landing from './pages/Landing'
import Upload from './pages/Upload'
import Processing from './pages/Processing'
import Results from './pages/Results'
import Library from './pages/Library'
import Evaluation from './pages/Evaluation'
import Docs from './pages/Docs'

const KEY_MAP: Record<string, PageId> = {
  g: 'landing',
  n: 'upload',
  r: 'processing',
  v: 'results',
  l: 'dashboard',
  e: 'admin',
  d: 'docs',
}

export default function App() {
  const [page, setPage] = useState<PageId>('landing')
  const [toast, setToast] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const navigate = useCallback((to: PageId) => {
    setPage(to)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  const showToast = useCallback(() => {
    setToast(true)
    setTimeout(() => setToast(false), 2000)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
          || e.target instanceof HTMLSelectElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const dest = KEY_MAP[e.key]
      if (dest) navigate(dest)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])

  const isLanding = page === 'landing'

  return (
    <>
      <ScanLine />

      <div className="app-shell">
        <div className={`shell${isLanding ? ' landing-mode' : ''}`}>
          <Sidebar current={page} onNavigate={navigate} />

          <main className="main-content">
            {!isLanding && (
              <TopBar
                page={page}
                query={query}
                onQuery={q => {
                  setQuery(q)
                  // search filters the library and reports; jump to the library from elsewhere
                  if (q && page !== 'dashboard' && page !== 'docs') navigate('dashboard')
                }}
              />
            )}

            {page === 'landing'    && <Landing    onNavigate={navigate} />}
            {page === 'upload'     && <Upload     onNavigate={navigate} onJobCreated={setJobId} />}
            {page === 'processing' && <Processing onNavigate={navigate} onComplete={showToast} jobId={jobId} />}
            {page === 'results'    && <Results    onNavigate={navigate} jobId={jobId} />}
            {page === 'dashboard'  && <Library    onNavigate={navigate} onOpenScene={setJobId} query={query} />}
            {page === 'admin'      && <Evaluation onNavigate={navigate} />}
            {page === 'docs'       && <Docs       onNavigate={navigate} onOpenScene={setJobId} query={query} />}
          </main>
        </div>
      </div>

      {/* Toast notification */}
      <div className={`toast${toast ? ' on' : ''}`} aria-live="polite">
        ◉ translation completed{jobId && ` · scene #${jobId.slice(0, 4).toUpperCase()}`}
      </div>
    </>
  )
}
