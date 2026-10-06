import { useEffect, useState } from 'react'
import { CheckCircle2, LoaderCircle, Radio, X } from 'lucide-react'
import { api } from '../api.js'
import { Notice } from './ui.jsx'

function CardEnrollmentDialog({ student, enrollment, onEnrollmentChange, onClose }) {
  const [current, setCurrent] = useState(enrollment)
  const [pollError, setPollError] = useState('')
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    setCurrent(enrollment)
  }, [enrollment?.id])

  useEffect(() => {
    if (!enrollment?.id || current?.status !== 'pending') return undefined

    let disposed = false
    let requestInFlight = false

    async function refreshRequest() {
      if (requestInFlight) return
      requestInFlight = true

      try {
        const result = await api(`/rfid/enrollment-requests/${enrollment.id}`)
        if (!disposed) {
          setCurrent(result)
          onEnrollmentChange(result)
          setPollError('')
        }
      } catch (requestError) {
        if (!disposed) setPollError(requestError.message)
      } finally {
        requestInFlight = false
      }
    }

    refreshRequest()
    const timer = window.setInterval(refreshRequest, 1000)

    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [current?.status, enrollment?.id, onEnrollmentChange])

  async function closeDialog() {
    if (closing) return

    if (current?.status === 'pending') {
      setClosing(true)
      try {
        await api(`/rfid/enrollment-requests/${current.id}/cancel`, { method: 'POST' })
        const cancelled = { ...current, status: 'cancelled' }
        setCurrent(cancelled)
        onEnrollmentChange(cancelled)
        onClose()
      } catch (requestError) {
        setPollError(requestError.message)
      } finally {
        setClosing(false)
      }
      return
    }

    onClose()
  }

  const complete = current?.status === 'completed'

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDialog()
      }}
    >
      <section className="modal card-enrollment-dialog" role="dialog" aria-modal="true" aria-labelledby="card-enrollment-title">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Card enrollment</p>
            <h2 id="card-enrollment-title">{complete ? 'Card assigned' : 'Scan a card'}</h2>
          </div>
          <button className="icon-button" onClick={closeDialog} disabled={closing} aria-label="Close and stop scanning">
            <X size={19} />
          </button>
        </div>

        <div className={`scan-dialog-student${complete ? ' scan-dialog-student-complete' : ''}`}>
          <span className="student-avatar">{student.first_name?.slice(0, 1)}{student.last_name?.slice(0, 1)}</span>
          <span className="student-cell-copy">
            <strong>{student.first_name} {student.last_name}</strong>
            <span>Student ID · {student.student_id}</span>
          </span>
          {complete && <CheckCircle2 className="scan-complete-icon" size={20} aria-hidden="true" />}
        </div>

        <div className={`scan-uid-display${current?.last_error ? ' scan-uid-rejected' : ''}`} aria-live="polite">
          <span>{complete ? 'Assigned card UID' : 'Most recent scanned UID'}</span>
          <code>{complete ? current.card_uid : current?.last_scanned_uid || 'Waiting for card scan'}</code>
        </div>

        {complete ? (
          <div className="scan-dialog-feedback scan-dialog-success" role="status">
            <CheckCircle2 size={19} />
            <span>{current.last_error ? 'Card linked successfully.' : 'This card is now linked to this student.'}</span>
          </div>
        ) : (
          <div className="scan-dialog-feedback" role="status">
            {current?.last_scanned_uid && !current.last_error
              ? <LoaderCircle className="spin" size={17} />
              : <Radio size={18} />}
            <span>
              {current?.last_error
                ? 'That UID could not be assigned. Scan a different card.'
                : current?.last_scanned_uid
                  ? 'Checking that this UID is not assigned to another student…'
                  : 'Reader is ready. Tap the card once.'}
            </span>
          </div>
        )}

        {current?.last_error && <Notice>{current.last_error}</Notice>}
        {pollError && <Notice>{pollError}</Notice>}

        <div className="modal-actions">
          {complete ? (
            <button className="button button-primary" onClick={onClose}><CheckCircle2 size={16} /> Done</button>
          ) : (
            <button className="button button-secondary" onClick={closeDialog} disabled={closing}>
              <X size={15} /> {closing ? 'Stopping scan…' : 'Cancel scan'}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

export default CardEnrollmentDialog