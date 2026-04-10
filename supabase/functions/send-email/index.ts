// Supabase Edge Function: send-email
// Uses nodemailer via npm: import to send through Zoho Workplace SMTP
// Secrets set via: supabase secrets set SMTP_USER=... SMTP_PASS=...

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
// @deno-types="npm:@types/nodemailer"
import nodemailer from 'npm:nodemailer@6.9.9'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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
