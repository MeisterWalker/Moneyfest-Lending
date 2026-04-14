// ── Template Engine ──────────────────────────────────────────────────────────
// Fetches email templates from Supabase email_templates table.
// Falls back to '__DEFAULT__' sentinel — emailService.js uses its hardcoded
// HTML when html_body === '__DEFAULT__', so emails never silently fail.

import { supabase } from './supabase'

// Cache to avoid refetching on every email send
const templateCache = {}

/**
 * Fetch a template by type. Returns { subject, html_body } or null.
 * Uses in-memory cache per session.
 */
export async function getEmailTemplate(type) {
  if (templateCache[type]) return templateCache[type]

  const { data, error } = await supabase
    .from('email_templates')
    .select('subject, html_body')
    .eq('type', type)
    .single()

  if (error || !data) return null

  templateCache[type] = data
  return data
}

/**
 * Replace {{key}} placeholders in a template string with values.
 * Example: fillTemplate('Hello {{name}}', { name: 'John' }) => 'Hello John'
 */
export function fillTemplate(template, variables = {}) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`
  )
}

/**
 * Get a template's subject with placeholders filled.
 * Returns null if template not found (caller should use hardcoded fallback).
 */
export async function getFilledSubject(type, variables = {}) {
  const template = await getEmailTemplate(type)
  if (!template) return null
  return fillTemplate(template.subject, variables)
}

/** Clear the cache (useful after admin edits a template in Settings) */
export function clearTemplateCache() {
  Object.keys(templateCache).forEach(k => delete templateCache[k])
}
