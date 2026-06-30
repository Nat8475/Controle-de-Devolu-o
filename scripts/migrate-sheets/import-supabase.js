import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const BATCH_SIZE = 500

export async function importToSupabase(rows) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY // service role bypasses RLS
  )

  let inserted = 0
  let errors = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('notas_fiscais')
      .insert(batch)

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message)
      errors += batch.length
    } else {
      inserted += batch.length
      console.log(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} rows)`)
    }
  }

  console.log(`\nMigration complete: ${inserted} inserted, ${errors} failed`)
  return { inserted, errors }
}
