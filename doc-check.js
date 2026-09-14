import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { docLookup, findRCMatch } from './scrapers/doc.js'
import { nowPST } from './utils.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOG_FILE  = path.join(__dirname, 'data', 'change_log.json')

const LOOKBACK_DAYS  = 14   // only check people released within this window
const DELAY_MS       = 1500 // be polite to the DOC server

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

function parseName(fullName) {
  // Jail format: "LASTNAME, FIRSTNAME MIDDLE" or "LASTNAME, FIRSTNAME"
  const [last, rest] = fullName.split(', ')
  const first = rest ? rest.split(' ')[0] : ''
  return { last: last?.trim() || '', first: first?.trim() || '' }
}

async function run() {
  const log = readJSON(LOG_FILE)

  const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000

  // Released entries within the lookback window that haven't been DOC-checked yet
  const toCheck = log.filter(e =>
    e.status === 'released' &&
    e.releasedAt &&
    new Date(e.releasedAt) >= cutoff &&
    e.docCheckedAt == null
  )

  console.log(`[${nowPST()}] DOC check: ${toCheck.length} entries to check`)

  let rcFound = 0
  let checked = 0

  for (const entry of toCheck) {
    const { last, first } = parseName(entry.name)
    if (!last) continue

    try {
      const rows = await docLookup(last, first)
      const match = findRCMatch(rows)

      entry.docCheckedAt = nowPST()
      if (match) {
        entry.docTransfer = true
        entry.docFacility = match.location
        rcFound++
        console.log(`  RC match: ${entry.name} → ${match.location} (${match.housing})`)
      } else {
        entry.docTransfer = false
      }
      checked++
    } catch (err) {
      console.warn(`  Failed for ${entry.name}: ${err.message}`)
    }

    await sleep(DELAY_MS)
  }

  fs.writeFileSync(LOG_FILE, JSON.stringify(log))
  console.log(`[${nowPST()}] Done. ${checked} checked, ${rcFound} RC matches.`)
}

run().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
