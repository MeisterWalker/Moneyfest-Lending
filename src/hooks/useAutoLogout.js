import { useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'

const EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']

export function useAutoLogout(timeoutMinutes = 30) {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const timerRef = useRef(null)
  const warningRef = useRef(null)
  const WARNING_BEFORE_MS = 60 * 1000

  const resetTimer = useCallback(() => {
    if (!user) return
    clearTimeout(timerRef.current)
    clearTimeout(warningRef.current)
    const timeoutMs = timeoutMinutes * 60 * 1000

    warningRef.current = setTimeout(() => {
      toast('You will be logged out in 1 minute due to inactivity.', 'warning')
    }, timeoutMs - WARNING_BEFORE_MS)

    timerRef.current = setTimeout(async () => {
      toast('Session expired due to inactivity. Please sign in again.', 'error')
      await signOut()
    }, timeoutMs)
  }, [user, signOut, toast, timeoutMinutes])

  useEffect(() => {
    if (!user) return
    resetTimer()
    EVENTS.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    return () => {
      clearTimeout(timerRef.current)
      clearTimeout(warningRef.current)
      EVENTS.forEach(e => window.removeEventListener(e, resetTimer))
    }
  }, [user, resetTimer])
}
