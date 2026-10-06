import { useEffect, useState } from 'react'
import { Activity, Download, RefreshCw } from 'lucide-react'
import { api, formatDate, formatTime, localDateInKigali } from '../api.js'
import { EmptyState, LoadingState, Notice, PageHeader } from '../components/ui.jsx'

function AttendancePage() {
  const [date, setDate] = useState(localDateInKigali())
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true

    async function loadAttendance() {
      setLoading(true)
      setError('')

      try {
        const query = new URLSearchParams({ attendance_date: date, limit: '500' })
        const result = await api(`/attendance?${query}`)
        if (active) setRecords(result)
      } catch (requestError) {
        if (active) setError(requestError.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadAttendance()
    return () => { active = false }
  }, [date, reload])

  function exportCsv() {
    const columns = ['Student ID', 'Student name', 'Class', 'Card UID', 'Date', 'Time', 'Device', 'Status']
    const values = records.map((record) => [
      record.student_id,
      record.student_name,
      record.class_name || '',
      record.rfid_uid,
      record.attendance_date,
      formatTime(record.scanned_at),
      record.device_id || '',
      record.status,
    ])
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const csv = [columns, ...values].map((row) => row.map(escape).join(',')).join('\r\n')
    const download = document.createElement('a')
    download.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    download.download = `attendance-${date}.csv`
    download.click()
    URL.revokeObjectURL(download.href)
  }

  return (
    <>
      <PageHeader
        eyebrow="Records"
        title="Attendance log"
        description="Review RFID check-ins by date and export the register."
        action={(
          <button className="button button-secondary" onClick={exportCsv} disabled={!records.length}>
            <Download size={16} /> Export CSV
          </button>
        )}
      />

      {error && <Notice>{error}</Notice>}

      <section className="panel data-panel">
        <div className="data-toolbar attendance-toolbar">
          <div className="record-count"><Activity size={17} />
            <span><strong>{loading || error ? '—' : records.length}</strong> check-ins</span>
          </div>
          <div className="toolbar-controls">
            <label className="date-field">
              <span>Attendance date</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <button className="icon-button" onClick={() => setReload((value) => value + 1)} aria-label="Refresh attendance" title="Refresh">
              <RefreshCw size={17} />
            </button>
          </div>
        </div>

        {loading ? <LoadingState label="Loading attendance records" /> : error ? (
          <EmptyState
            icon={Activity}
            title="Attendance log unavailable"
            description="The attendance service could not be reached."
            action={<button className="button button-secondary" onClick={() => setReload((value) => value + 1)}>Retry</button>}
          />
        ) : records.length ? (
          <div className="table-scroll">
            <table className="data-table attendance-table">
              <thead>
                <tr><th>Student</th><th>Student ID</th><th>Class</th><th>Card UID</th><th>Check-in</th><th>Device</th><th>Status</th></tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div className="student-cell">
                        <span className="student-avatar">{record.student_name?.slice(0, 1) || '?'}</span>
                        <span className="student-cell-copy"><strong>{record.student_name}</strong><span>{formatDate(record.scanned_at)}</span></span>
                      </div>
                    </td>
                    <td className="mono-cell">{record.student_id}</td>
                    <td>{record.class_name || <span className="muted-cell">—</span>}</td>
                    <td><span className="mono-cell card-uid">{record.rfid_uid}</span></td>
                    <td className="time-cell">{formatTime(record.scanned_at)}</td>
                    <td>{record.device_id || <span className="muted-cell">—</span>}</td>
                    <td><span className="status-pill status-active"><span className="status-dot" />{record.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Activity}
            title="No check-ins for this date"
            description="Try another date, or check that your RFID reader is connected to the API."
          />
        )}
      </section>
    </>
  )
}

export default AttendancePage