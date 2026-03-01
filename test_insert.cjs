const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ktmrxbovvhdusknzdnzt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0bXJ4Ym92dmhkdXNrbnpkbnp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMzkxNTgsImV4cCI6MjA4NzkxNTE1OH0.Mv5bqKx139Em9JzFsACE0ONqrUwQWpDJExCW_5BcxBI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    console.log('Attempting to insert participant...');
    // We need a valid team_id. From the screenshot, the team ID starts with 'd79c05db...'
    const teamId = 'd79c05db-bd71-4a25-8002-dc1010ea70ca';

    const { data, error } = await supabase
        .from('participants')
        .insert({
            team_id: teamId,
            name: 'Test Participant'
        });

    if (error) {
        console.error('Insert Error:', JSON.stringify(error, null, 2));
    } else {
        console.log('Insert Success:', data);
    }
}

testInsert();
