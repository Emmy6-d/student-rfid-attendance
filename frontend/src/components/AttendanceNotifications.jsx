import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Bell, CheckCircle2, Clock3, X } from 'lucide-react'
import { api, formatTime } from '../api.js'

function isRejected(event) {
  return !['attendance_recorded', 'already_recorded'].includes(event.status)
}

function AttendanceNotifications() {
  const [events, setEvents] = useState([])
  const [toasts, setToasts] = useState([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const seenIds = useRef(new Set())

  useEffect(() => {
    let disposed = false
    let timer = null
    let requestInFlight = false
    let cursor = null
    let retryDelay = 4000

    async function poll(initial = false) {
      if (disposed || requestInFlight) return
      requestInFlight = true

      try {
        const since = cursor
          ? new Date(Date.parse(cursor) - 3000).toISOString()
          : null
        const query = new URLSearchParams({ limit: initial ? '20' : '100' })
        if (!initial && since) query.set('since', since)

        const result = await api(`/attendance/events?${query}`)
        if (disposed) return

        const ordered = [...result].sort((left, right) => (
          Date.parse(left.created_at) - Date.parse(right.created_at)
        ))

        if (initial) {
          ordered.forEach((event) => seenIds.current.add(event.id))
          setEvents(ordered.reverse())
          cursor = new Date(Date.now() - 10000).toISOString()
        } else {
          const fresh = ordered.filter((event) => !seenIds.current.has(event.id))
          fresh.forEach((event) => seenIds.current.add(event.id))

          if (fresh.length) {
            setEvents((current) => {
              const combined = [...fresh.reverse(), ...current]
              return [...new Map(combined.map((event) => [event.id, event])).values()].slice(0, 30)
            })
            setToasts((current) => [...fresh, ...current].slice(0, 4))
            setUnread((count) => count + fresh.length)
            fresh.forEach((event) => {
              window.setTimeout(() => {
                if (!disposed) setToasts((current) => current.filter((item) => item.id !== event.id))
              }, 9000)
            })
          }

          if (ordered.length) cursor = ordered[ordered.length - 1].created_at
        }

        retryDelay = 4000
      } catch {
        retryDelay = Math.min(retryDelay * 2, 30000)
      } finally {
        requestInFlight = false
        if (!disposed) timer = window.setTimeout(() => poll(false), retryDelay)
      }
    }

    poll(true)
    return () => {
      disposed = true
      window.clearTimeout(timer)
    }
  }, [])

  function toggleHistory() {
    setOpen((visible) => !visible)
    setUnread(0)
  }

  return (
    <div className="attendance-notifications">
      <button
        className={`notification-bell${unread ? ' notification-bell-unread' : ''}`}
        onClick={toggleHistory}
        aria-label={unread ? `Attendance notifications, ${unread} unread` : 'Attendance notifications'}
        aria-expanded={open}
        title="Attendance notifications"
      >
        <Bell size={17} />
        {unread > 0 && <span className="notification-count">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <section className="notification-popover" aria-label="Recent attendance activity">
          <div className="notification-popover-heading">
            <div><span className="eyebrow">Live activity</span><h2>Attendance scans</h2></div>
            <button className="icon-button" onClick={() => setOpen(false)} aria-label="Close notifications"><X size={17} /></button>
          </div>
          {events.length ? (
            <div className="notification-list">
              {events.slice(0, 12).map((event) => (
                <article className="notification-event" key={event.id}>
                  <span className={`notification-event-icon${isRejected(event) ? ' notification-event-rejected' : ''}`}>
                    {isRejected(event) ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                  </span>
                  <div className="notification-event-copy">
                    <strong>{event.message}</strong>
                    <span>{event.student_id ? `ID ${event.student_id} · ` : ''}{event.uid || 'No UID'}</span>
                  </div>
                  <time dateTime={event.created_at}>{formatTime(event.created_at)}</time>
                </article>
              ))}
            </div>
          ) : (
            <div className="notification-empty"><Clock3 size={19} /><span>No attendance scans yet</span></div>
          )}
        </section>
      )}

      <div className="attendance-toast-stack" aria-live="polite" aria-relevant="additions">
        {toasts.map((event) => (
          <article className={`attendance-toast${isRejected(event) ? ' attendance-toast-rejected' : ''}`} key={event.id}>
            {isRejected(event) ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <div><strong>{event.message}</strong><span>{event.uid || 'No UID'} · {formatTime(event.created_at)}</span></div>
            <button
              className="icon-button"
              onClick={() => setToasts((current) => current.filter((item) => item.id !== event.id))}
              aria-label="Dismiss attendance notification"
            ><X size={15} /></button>
          </article>
        ))}
      </div>
    </div>
  )
}

export default AttendanceNotifications