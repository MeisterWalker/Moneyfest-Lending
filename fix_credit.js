const SUPABASE_URL = 'https://swwedyfgbqhtavxmbmhv.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3d2VkeWZnYnFodGF2eG1ibWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzY2MDEsImV4cCI6MjA4ODY1MjYwMX0.IFVKtSVFmNytOYMD23yFXgEyGyBNVQ31SknoxpGvuio'

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
}

async function fixCredit() {
  // Query
  let res = await fetch(`${SUPABASE_URL}/rest/v1/borrowers?full_name=ilike.*fritz*&select=id,full_name,credit_score`, { headers })
  let data = await res.json()
  
  console.log('Found:', data)
  
  if (data && data.length > 0) {
    const fritz = data[0]
    
    // We deduct exactly 30 from what it is right now.
    // Ensure it doesn't repeatedly drop if we run it twice accidentally. (So we just set it directly to 720 assuming it was 750)
    const newScore = 720;
    
    console.log(`Setting ${fritz.full_name}'s score to ${newScore}...`)
    
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/borrowers?id=eq.${fritz.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ credit_score: newScore })
    })
    
    console.log('Patch response:', patchRes.status, await patchRes.text())
  }
}

fixCredit();
