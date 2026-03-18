import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Gets or creates a persistent visitor ID stored in localStorage
// Survives tab closes and browser restarts — truly unique per device/browser
function getVisitorId() {
  const key = 'lm_visitor_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem(key, id)
  }
  return id
}

// Tracks a page visit — deduplicated per device per page per day
// - Same device reopening the tab = NOT counted again (localStorage persists)
// - Same device visiting on a new day = counted once for that new day
// - Different device/browser = counted as a new visitor
export function usePageVisit(page) {
  useEffect(() => {
    const visitorId = getVisitorId()
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const visitKey = `lm_visit_${page}_${today}`

    // Already recorded this page today on this device — skip
    if (localStorage.getItem(visitKey)) return
    localStorage.setItem(visitKey, '1')

    supabase.from('page_visits').insert({ page, session_id: visitorId })
      .then(({ error }) => { if (error) console.warn('Visit tracking error:', error) })
  }, [page])
}
