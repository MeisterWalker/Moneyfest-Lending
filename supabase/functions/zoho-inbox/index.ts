// Supabase Edge Function: zoho-inbox
// Fetches emails from Zoho Mail API using OAuth2 refresh token
// Secrets: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ACCOUNT_ID

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getAccessToken(): Promise<string> {
  const clientId     = Deno.env.get('ZOHO_CLIENT_ID') ?? ''
  const clientSecret = Deno.env.get('ZOHO_CLIENT_SECRET') ?? ''
  const refreshToken = Deno.env.get('ZOHO_REFRESH_TOKEN') ?? ''

  const res = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`)
  return data.access_token
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const accountId  = Deno.env.get('ZOHO_ACCOUNT_ID') ?? ''
    const url        = new URL(req.url)
    const action     = url.searchParams.get('action') ?? 'list'
    const messageId  = url.searchParams.get('messageId') ?? ''
    const folderId   = url.searchParams.get('folderId') ?? ''
    const start      = url.searchParams.get('start') ?? '0'
    const limit      = url.searchParams.get('limit') ?? '20'

    const token = await getAccessToken()
    const headers = { Authorization: `Zoho-oauthtoken ${token}` }

    // ── Action: list messages ──────────────────────────────
    if (action === 'list') {
      const folderParam = folderId ? `&folderId=${folderId}` : ''
      const res = await fetch(
        `https://mail.zoho.com/api/accounts/${accountId}/messages/view?start=${start}&limit=${limit}&sortorder=false${folderParam}`,
        { headers }
      )
      const data = await res.json()
      return new Response(JSON.stringify(data), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Action: get single message (requires folderId) ─────
    if (action === 'message' && messageId && folderId) {
      const res = await fetch(
        `https://mail.zoho.com/api/accounts/${accountId}/folders/${folderId}/messages/${messageId}/content`,
        { headers }
      )
      const data = await res.json()
      return new Response(JSON.stringify(data), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Action: list folders ───────────────────────────────
    if (action === 'folders') {
      const res = await fetch(
        `https://mail.zoho.com/api/accounts/${accountId}/folders`,
        { headers }
      )
      const data = await res.json()
      return new Response(JSON.stringify(data), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Action: unread count ───────────────────────────────
    if (action === 'unread') {
      const res = await fetch(
        `https://mail.zoho.com/api/accounts/${accountId}/messages/view?start=0&limit=1&status=unread`,
        { headers }
      )
      const data = await res.json()
      const count = data?.data?.length !== undefined ? (data.data as unknown[]).length : 0
      // Zoho returns total in a different field — use totalCount if present
      const total = data?.totalCount ?? count
      return new Response(JSON.stringify({ unread: total }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
