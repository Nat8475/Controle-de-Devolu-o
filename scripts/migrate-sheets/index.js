import { exportSheets } from './export-sheets.js'
import { transform } from './transform.js'
import { importToSupabase } from './import-supabase.js'

console.log('=== Controle de Devoluções — Migration Script ===\n')

try {
  console.log('Step 1: Exporting from Google Sheets...')
  const rawData = await exportSheets()

  console.log('\nStep 2: Transforming data...')
  const rows = transform(rawData)

  if (rows.length === 0) {
    console.log('No rows to import. Check Google Sheets ID and permissions.')
    process.exit(0)
  }

  console.log(`\nStep 3: Importing ${rows.length} rows to Supabase...`)
  const { inserted, errors } = await importToSupabase(rows)

  if (errors > 0) {
    console.log(`\nWarning: Migration completed with ${errors} errors. Check logs above.`)
    process.exit(1)
  } else {
    console.log(`\nSuccess: ${inserted} rows imported.`)
  }
} catch (err) {
  console.error('Migration failed:', err)
  process.exit(1)
}
