// Supabase Edge Function: send-email
// Uses nodemailer via npm: import to send through Zoho Workplace SMTP
// Secrets set via: supabase secrets set SMTP_USER=... SMTP_PASS=... EMAIL_FUNCTION_SECRET=...

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
// @deno-types="npm:@types/nodemailer"
import nodemailer from 'npm:nodemailer@6.9.9'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-function-secret',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── SEC-04 FIX: Verify caller identity ────────────────────────────
    // The function accepts calls from two trusted sources:
    // 1. Server-side (cron job / service role) — uses the service_role key in Authorization header
    // 2. Client-side (React app) — must pass a shared secret via x-function-secret header
    //
    // The shared secret is set via: supabase secrets set EMAIL_FUNCTION_SECRET=<random-string>
    // and stored in the React app as: REACT_APP_EMAIL_FUNCTION_SECRET=<same-string>

    const authHeader = req.headers.get('authorization') || ''
    const functionSecret = req.headers.get('x-function-secret') || ''
    const expectedSecret = Deno.env.get('EMAIL_FUNCTION_SECRET') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const isServiceRole = serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`
    const isValidSecret = expectedSecret && functionSecret === expectedSecret

    if (!isServiceRole && !isValidSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized: invalid or missing credentials' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    // ── End SEC-04 FIX ────────────────────────────────────────────────

    const { to, subject, html } = await req.json()

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, html' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // SMTP credentials stored as Supabase secrets
    const smtpUser = Deno.env.get('SMTP_USER') ?? ''
    const smtpPass = Deno.env.get('SMTP_PASS') ?? ''

    if (!smtpUser || !smtpPass) {
      return new Response(JSON.stringify({ error: 'SMTP credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Zoho Workplace SMTP — support@moneyfestlending.loan
    const transporter = nodemailer.createTransport({
      host: 'smtp.zoho.com',
      port: 587,
      secure: false,     // TLS via STARTTLS
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false }
    })

    const info = await transporter.sendMail({
      from: `"Moneyfest Lending" <${smtpUser}>`,
      to,
      subject,
      html,
    })

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
