import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Generates or retrieves a session ID that persists for the browser tab session
// This prevents page refreshes from inflating the count
function getSessionId() {
  const key = 'lm_session_id'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    sessionStorage.setItem(key, id)
  }
  return id
}

// Tracks a page visit — deduplicated per session per page
// Won't double-count if the same person refreshes or navigates back
export function usePageVisit(page) {
  useEffect(() => {
    const sessionId = getSessionId()
    const visitKey = `lm_visited_${page}`

    // Only record once per session per page
    if (sessionStorage.getItem(visitKey)) return
    sessionStorage.setItem(visitKey, '1')

    supabase.from('page_visits').insert({ page, session_id: sessionId })
      .then(({ error }) => { if (error) console.warn('Visit tracking error:', error) })
  }, [page])
}
