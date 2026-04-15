import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Supabase credentials for DB updates
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { proof_id, file_url, expected_amount } = await req.json()
    if (!proof_id || !file_url || expected_amount == null) {
      throw new Error("Missing parameters")
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Update status to 'Under AI Review' immediately
    await supabase.from('payment_proofs').update({ status: 'Under AI Review' }).eq('id', proof_id)

    // Download the image
    const imageRes = await fetch(file_url)
    if (!imageRes.ok) throw new Error("Failed to download image")
    const arrayBuffer = await imageRes.arrayBuffer()
    const base64Image = arrayBufferToBase64(arrayBuffer)
    const contentType = imageRes.headers.get('content-type') || 'image/jpeg'

    // Call Groq Vision Model
    const prompt = `You are an automated financial auditor. Extract the total payment amount from this bank/GCash receipt. 
The expected amount is ${expected_amount}. 
Return ONLY a valid JSON object in this format:
{
  "amount": number,
  "reference_number": "string",
  "confidence": "high" | "medium" | "low",
  "is_valid": boolean
}
Make sure amount is a number without commas.`

    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.2-11b-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${contentType};base64,${base64Image}` } }
            ]
          }
        ],
        temperature: 0,
        response_format: { type: "json_object" }
      })
    })

    const groqData = await groqRes.json()
    if (!groqRes.ok) throw new Error(groqData.error?.message || 'Vision API Error')

    const replyContent = groqData.choices?.[0]?.message?.content || "{}"
    let parsed
    try {
      // Sometimes models wrap json in markdown
      const cleanJson = replyContent.replace(/```json/g, '').replace(/```/g, '').trim()
      parsed = JSON.parse(cleanJson)
    } catch(e) {
      throw new Error("Failed to parse JSON from AI: " + replyContent)
    }

    // Verification Logic
    const extractedAmount = parseFloat(parsed.amount || '0')
    const diff = Math.abs(extractedAmount - expected_amount)
    
    let aiStatus = 'Pending' // fallback
    let adminNote = ''

    // If within 5 pesos to account for varied bank transfer fees
    if (parsed.is_valid && parsed.confidence === 'high' && diff <= 5) {
      aiStatus = 'AI Verified'
      adminNote = `[AI Verified] Detected Amount: ₱${extractedAmount}. Ref: ${parsed.reference_number || 'N/A'}`
    } else {
      aiStatus = 'Pending Admin'
      adminNote = `[Needs Review] AI detected ₱${extractedAmount} (Expected ₱${expected_amount}). Ref: ${parsed.reference_number || 'N/A'}`
    }

    // Merge notes if existing
    const { data: currentProof } = await supabase.from('payment_proofs').select('notes').eq('id', proof_id).single()
    const newNotes = currentProof?.notes ? currentProof.notes + ' | ' + adminNote : adminNote

    const { error: updateErr } = await supabase.from('payment_proofs').update({
      status: aiStatus,
      notes: newNotes
    }).eq('id', proof_id)
    
    if (updateErr) throw updateErr

    return new Response(JSON.stringify({ success: true, ai_status: aiStatus, extracted: parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error("AI Verify Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
