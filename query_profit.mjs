import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://swwedyfgbqhtavxmbmhv.supabase.co';
const supabaseKey = 'sb_publishable_V0lMalSTF9sgeK3WHG5UIw_qbEXx9Su';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // First, test if we can read capital_flow at all
  const { data: testData, error: testErr, count } = await supabase
    .from('capital_flow')
    .select('*', { count: 'exact', head: true });

  console.log('Test query count:', count, 'Error:', testErr?.message || 'none');

  // If RLS blocks us, try with a broader approach
  if (count === 0 || testErr) {
    console.log('\nRLS may be blocking anon access. Trying all categories...');
    const { data: cats, error: catErr } = await supabase
      .from('capital_flow')
      .select('category')
      .limit(5);
    console.log('Categories sample:', cats, 'Error:', catErr?.message || 'none');
  }

  // Also try the direct query
  const { data, error } = await supabase
    .from('capital_flow')
    .select('id, entry_date, category, amount, notes')
    .like('category', '%Interest%')
    .order('entry_date', { ascending: true })
    .limit(20);

  console.log('\nInterest entries:', data?.length || 0, 'Error:', error?.message || 'none');
  if (data && data.length > 0) {
    data.forEach((r, i) => {
      console.log(`${i+1}. ${r.entry_date} | ${r.category} | ₱${r.amount} | ${r.notes}`);
    });
  }
}

run();
