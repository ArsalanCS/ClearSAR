import { useRef, useCallback, useEffect, useState } from 'react'

interface Props {
  idleAnimate?: boolean
}

export default function CompareSlider({ idleAnimate = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const [pct, setPct] = useState(50)
  const tRef = useRef(0)
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const setPctClamped = useCallback((p: number) => {
    setPct(Math.max(2, Math.min(98, p)))
  }, [])

  const pctFromEvent = useCallback((e: MouseEvent | TouchEvent) => {
    if (!containerRef.current) return 50
    const r = containerRef.current.getBoundingClientRect()
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - r.left
    return (x / r.width) * 100
  }, [])

  const startIdle = useCallback(() => {
    if (!idleAnimate) return
    if (idleTimerRef.current) clearInterval(idleTimerRef.current)
    idleTimerRef.current = setInterval(() => {
      if (draggingRef.current) return
      tRef.current += 0.02
      setPctClamped(50 + Math.sin(tRef.current) * 18)
    }, 60)
  }, [idleAnimate, setPctClamped])

  useEffect(() => {
    startIdle()
    return () => {
      if (idleTimerRef.current) clearInterval(idleTimerRef.current)
    }
  }, [startIdle])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    draggingRef.current = true
    if (idleTimerRef.current) clearInterval(idleTimerRef.current)
    setPctClamped(pctFromEvent(e.nativeEvent))
  }, [pctFromEvent, setPctClamped])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    draggingRef.current = true
    if (idleTimerRef.current) clearInterval(idleTimerRef.current)
    setPctClamped(pctFromEvent(e.nativeEvent))
  }, [pctFromEvent, setPctClamped])

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (draggingRef.current) setPctClamped(pctFromEvent(e)) }
    const onTouchMove = (e: TouchEvent) => { if (draggingRef.current) setPctClamped(pctFromEvent(e)) }
    const onUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false
        startIdle()
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchend', onUp)
    }
  }, [pctFromEvent, setPctClamped, startIdle])

  return (
    <div
      ref={containerRef}
      className="compare"
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onMouseEnter={() => { if (idleTimerRef.current) clearInterval(idleTimerRef.current) }}
      onMouseLeave={startIdle}
    >
      <div className="layer sar" />
      <div className="layer opt" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }} />
      <svg className="cross" viewBox="0 0 70 70">
        <circle cx="35" cy="35" r="26"/>
        <circle cx="35" cy="35" r="14"/>
        <line x1="0" y1="35" x2="70" y2="35"/>
        <line x1="35" y1="0" x2="35" y2="70"/>
        <circle cx="35" cy="35" r="2" fill="#ff6a2c" stroke="none"/>
      </svg>
      <div className="handle" style={{ left: `${pct}%` }} />
    </div>
  )
}
