import { useState } from 'react'

const WT_WARRANT    = /^(BENCH WARRANT|FAIL TO APPEAR|FAIL TO COMPLY|FAIL TO POST)$/i
const WT_NEW_ARREST = /^PROBABLE CAUSE$/i
const WT_HOLD       = /^(TTW|TRANS ORDER|DETAINER|DV|BAIL BOND SURRENDER)$/i

function deriveDetentionType(charges) {
  if (!charges?.length) return null
  if (charges.some(c => /COMMITTED TO CUSTODY/i.test(c.sentenceInfo))) return 'Sentenced'
  let warrant = false, newArrest = false, hold = false
  for (const c of charges) {
    const wt = c.warrantType || (c.releaseDate && !/^\d/.test(c.releaseDate) ? c.releaseDate : null)
    if (!wt) continue
    if (WT_NEW_ARREST.test(wt)) newArrest = true
    else if (WT_WARRANT.test(wt)) warrant = true
    else if (WT_HOLD.test(wt)) hold = true
  }
  if (!warrant && !newArrest && !hold) return null
  const parts = []
  if (newArrest) parts.push('New Arrest')
  if (warrant) parts.push('Warrant')
  if (hold) parts.push('Hold')
  return parts.join(' + ')
}

function detentionTypeBadgeClass(dt) {
  if (!dt) return ''
  if (dt === 'Sentenced') return 'badge-dt-sentenced'
  if (dt === 'New Arrest') return 'badge-dt-new-arrest'
  if (dt === 'Warrant') return 'badge-dt-warrant'
  if (dt === 'Hold') return 'badge-dt-hold'
  return 'badge-dt-mixed'
}

function formatTimeServed(firstSeen, releasedAt) {
  if (!firstSeen || !releasedAt) return null
  const start = new Date(firstSeen)
  const end = new Date(releasedAt)
  if (isNaN(start) || isNaN(end) || end <= start) return null
  const totalMins = Math.floor((end - start) / 60000)
  const days = Math.floor(totalMins / 1440)
  const hours = Math.floor((totalMins % 1440) / 60)
  const mins = totalMins % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export default function BookingCard({ entry }) {
  const [open, setOpen] = useState(false)
  const isReleased = entry.status === 'released'
  const detType = deriveDetentionType(entry.charges)

  // Extract demographic fields — detail page returns kvPairs merged into entry
  const age      = entry.age      || entry['Age']      || null
  const sex      = entry.sex      || entry['Sex']      || entry['Gender'] || null
  const race     = entry.race     || entry['Race']     || null
  const height   = entry.height   || entry['Height']   || null
  const weight   = entry.weight   || entry['Weight']   || null

  return (
    <div className={`card ${isReleased ? 'card-released' : 'card-custody'}`}>
      <div className="card-header" onClick={() => setOpen(!open)}>
        <div className="card-left">
          <div className="card-name">
            {entry.name}
            {isReleased && formatTimeServed(entry.firstSeen, entry.releasedAt) && (
              <span className="time-served">{formatTimeServed(entry.firstSeen, entry.releasedAt)}</span>
            )}
          </div>
          <div className="card-meta">
            Booking #{entry.bookingNumber}
            {entry.bookingDate && <> &nbsp;·&nbsp; Booked: {entry.bookingDate}</>}
            {entry.facility && <> &nbsp;·&nbsp; {entry.facility}</>}
          </div>
        </div>
        <div className="card-right">
          {entry.docTransfer && (
            <span className="badge badge-prison" title={entry.docFacility || 'Transferred to DOC'}>→ Prison</span>
          )}
          {detType && (
            <span className={`badge ${detentionTypeBadgeClass(detType)}`}>{detType}</span>
          )}
          <span className={`badge ${isReleased ? 'badge-released' : 'badge-custody'}`}>
            {isReleased ? 'Released' : 'In Custody'}
          </span>
          <span className="card-toggle">{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div className="card-body">
          {isReleased && entry.releasedAt && (
            <div className="card-release-row">
              Released: {entry.releasedAt}
              {formatTimeServed(entry.firstSeen, entry.releasedAt) && (
                <span className="time-served-label">Time served: {formatTimeServed(entry.firstSeen, entry.releasedAt)}</span>
              )}
            </div>
          )}
          {entry.docTransfer && entry.docFacility && (
            <div className="card-doc-row">Transferred to: {entry.docFacility}</div>
          )}

          {(age || sex || race || height || weight) && (
            <div className="card-description">
              {age    && <div className="desc-row"><span>Age</span><span>{age}</span></div>}
              {sex    && <div className="desc-row"><span>Sex</span><span>{sex}</span></div>}
              {race   && <div className="desc-row"><span>Race</span><span>{race}</span></div>}
              {height && <div className="desc-row"><span>Height</span><span>{height}</span></div>}
              {weight && <div className="desc-row"><span>Weight</span><span>{weight}</span></div>}
            </div>
          )}

          {entry.charges && entry.charges.length > 0 && (
            <div className="card-charges">
              <div className="charges-title">Charges ({entry.charges.length})</div>
              {entry.charges.map((c, i) => (
                <div key={i} className="charge-row">
                  <div className="charge-violation">
                    {c.charge || c.violation || c['charge description'] || c['offense'] || JSON.stringify(c)}
                    {c.counts && c.counts !== '1' && <span style={{ opacity: 0.55 }}> ×{c.counts}</span>}
                  </div>
                  {(() => {
                    const wt = c.warrantType || (c.releaseDate && !/^\d/.test(c.releaseDate) ? c.releaseDate : null)
                    return wt ? <div className="charge-warrant">Hold: {wt}</div> : null
                  })()}
                  {c.bail != null && (
                    <div className="charge-bail">Bail: ${Number(c.bail).toLocaleString()}</div>
                  )}
                  {c.sentenceInfo && (
                    <div className="charge-sentence">Sentence: {c.sentenceInfo}</div>
                  )}
                  {c.sentenceDate && (
                    <div className="charge-sentence">Sentenced: {c.sentenceDate}</div>
                  )}
                  {c.chargingAgency && (
                    <div className="charge-agency">Agency: {c.chargingAgency}</div>
                  )}
                  {c.jurisdiction && (
                    <div className="charge-court">Court: {c.jurisdiction}</div>
                  )}
                  {c.causeNumber && (
                    <div className="charge-court">Case: {c.causeNumber}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
