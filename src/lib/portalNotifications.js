import { supabase } from './supabase'

export async function notifyBorrower({ borrower_id, type, title, message }) {
  try {
    await supabase.from('portal_notifications').insert({ borrower_id, type, title, message })
  } catch (e) {
    console.warn('Portal notification failed:', e)
  }
}
