const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read from .env.local manually if needed, but I'll hardcode for this one-off verification
const supabaseUrl = "https://swwedyfgbqhtavxmbmhv.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3d2VkeWZnYnFodGF2eG1ibWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzY2MDEsImV4cCI6MjA4ODY1MjYwMX0.IFVKtSVFmNytOYMD23yFXgEyGyBNVQ31SknoxpGvuio";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fetchLedger() {
  console.log("Fetching ledger entries...");
  const { data, error } = await supabase.from('capital_flow').select('*').order('created_at', { ascending: false });
  
  if (error) {
    console.error("Error fetching ledger:", error);
    return;
  }
  
  console.log("Total entries found:", data.length);
  console.log(JSON.stringify(data, null, 2));
}

fetchLedger();
