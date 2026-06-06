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

const KEY_MAP: Record<string, PageId> = {
  g: 'landing',
  n: 'upload',
  r: 'processing',
  v: 'results',
  l: 'dashboard',
  e: 'admin',
}

export default function App() {
  const [page, setPage] = useState<PageId>('landing')
  const [toast, setToast] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)

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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
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
            {!isLanding && <TopBar page={page} />}

            {page === 'landing'    && <Landing    onNavigate={navigate} />}
            {page === 'upload'     && <Upload     onNavigate={navigate} onJobCreated={setJobId} />}
            {page === 'processing' && <Processing onNavigate={navigate} onComplete={showToast} jobId={jobId} />}
            {page === 'results'    && <Results    onNavigate={navigate} jobId={jobId} />}
            {page === 'dashboard'  && <Library    onNavigate={navigate} onOpenScene={setJobId} />}
            {page === 'admin'      && <Evaluation />}
          </main>
        </div>
      </div>

      {/* Toast notification */}
      <div className={`toast${toast ? ' on' : ''}`} aria-live="polite">
        ◉ translation completed · scene #8F2A
      </div>
    </>
  )
}
