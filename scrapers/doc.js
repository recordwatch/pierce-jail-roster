const BASE_URL = 'https://doc.wa.gov/records/incarcerated-data-search/incarcerated-search'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function parseRows(html) {
  const rows = []
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/)
  if (!tbodyMatch) return rows
  const tbody = tbodyMatch[1]
  const trMatches = [...tbody.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
  for (const trMatch of trMatches) {
    const cells = [...trMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
    if (cells.length < 4) continue
    rows.push({
      docNumber: stripTags(cells[0][1]),
      name:      stripTags(cells[1][1]),
      age:       stripTags(cells[2][1]),
      location:  stripTags(cells[3][1]),
      housing:   cells[4] ? stripTags(cells[4][1]) : '',
    })
  }
  return rows
}

// Returns all DOC rows matching the given last name (+ optional first name filter)
export async function docLookup(lastName, firstName) {
  const url = new URL(BASE_URL)
  url.searchParams.set('field_doc_number_value', '')
  url.searchParams.set('field_first_name_value', '')
  url.searchParams.set('field_last_name_value', lastName)

  const res = await fetch(url.toString(), { headers: HEADERS })
  if (!res.ok) throw new Error(`DOC fetch failed: ${res.status}`)
  const html = await res.text()
  const rows = parseRows(html)

  if (!firstName) return rows

  // Filter to rows where DOC name's first part matches our first name
  const firstUpper = firstName.toUpperCase()
  return rows.filter(r => {
    // DOC name format: "LASTNAME, FIRSTNAME M" — extract part after ", "
    const parts = r.name.split(', ')
    if (parts.length < 2) return false
    const docFirst = parts[1].split(' ')[0].toUpperCase()
    return docFirst === firstUpper || firstUpper.startsWith(docFirst) || docFirst.startsWith(firstUpper)
  })
}

// Returns the matching row if the person appears to be at a Receiving Center, null otherwise
export function findRCMatch(rows) {
  return rows.find(r => {
    const housing = r.housing.toUpperCase()
    const location = r.location.toUpperCase()
    // Housing assignment starts with "RC" (e.g. RC-A1234) = Receiving Center unit
    // or location explicitly mentions Receiving
    return housing.startsWith('RC') || location.includes('RECEIVING')
  }) || null
}
