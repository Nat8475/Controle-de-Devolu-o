import { google } from 'googleapis'
import 'dotenv/config'

const RANGES = {
  britania: 'Britania!A2:T',
  unilever: 'Unilever!A2:T',
  variados: 'Fornecedores Variados!A2:T',
}

export async function exportSheets() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID

  const results = {}
  for (const [aba, range] of Object.entries(RANGES)) {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })
    results[aba] = res.data.values ?? []
    console.log(`Exported ${results[aba].length} rows from ${aba}`)
  }

  return results
}
