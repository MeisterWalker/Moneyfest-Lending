import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

async function run() {
  console.log('Testing access to tables via ANON key...');
  const { data: cf, error: cfErr } = await supabase.from('capital_flow').select('*').limit(1);
  if (cfErr) console.error('capital_flow access error:', cfErr.message);
  else console.log('capital_flow accessible:', !!cf);

  const { data: loans, error: loansErr } = await supabase.from('loans').select('*').limit(1);
  if (loansErr) console.error('loans access error:', loansErr.message);
  else console.log('loans accessible:', !!loans);
}
run();
