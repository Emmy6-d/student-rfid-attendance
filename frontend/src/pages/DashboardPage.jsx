import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowRight,
  CreditCard,
  RefreshCw,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, formatTime } from '../api.js'
import { EmptyState, LoadingState, Notice, PageHeader } from '../components/ui.jsx'

const statisticCards = [
  { key: 'active_students', label: 'Active students', icon: UsersRound, tone: 'green' },
  { key: 'present_today', label: 'Present today', icon: UserRoundCheck, tone: 'lime' },
  { key: 'total_rfid_cards', label: 'Active RFID cards', icon: CreditCard, tone: 'coral' },
]

function DashboardPage() {
  const weekday = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    timeZone: 'Africa/Kigali',
  }).format(new Date())
  const [statistics, setStatistics] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      setLoading(true)
      setError('')

      try {
        const [stats, records] = await Promise.all([
          api('/attendance/dashboard/statistics'),
          api('/attendance/today'),
        ])

        if (active) {
          setStatistics(stats)
          setAttendance(records)
        }
      } catch (requestError) {
        if (active) setError(requestError.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDashboard()
    const refreshTimer = window.setInterval(loadDashboard, 5000)

    return () => {
      active = false
      window.clearInterval(refreshTimer)
    }
  }, [reload])

  const attendanceRate = Math.min(statistics?.attendance_percentage || 0, 100)

  return (
    <>
      <PageHeader
        eyebrow={`${weekday} · Rwanda`}
        title="Good morning."
        description="Here is your school's attendance at a glance."
        action={(
          <button className="button button-secondary" onClick={() => setReload((value) => value + 1)}>
            <RefreshCw size={16} />
            Refresh
          </button>
        )}
      />

      {error && <Notice>{error}. Check that the API and Supabase are configured, then retry.</Notice>}

      <section className="stat-grid" aria-label="Attendance statistics">
        {statisticCards.map(({ key, label, icon: Icon, tone }) => (
          <article className="stat-card" key={key}>
            <div className={`stat-icon stat-icon-${tone}`}><Icon size={19} /></div>
            <div className="stat-copy">
              <span>{label}</span>
              <strong>{loading || !statistics ? '—' : statistics[key].toLocaleString()}</strong>
            </div>
            <span className="stat-total">
              {key === 'present_today'
                ? `of ${statistics?.active_students ?? '—'}`
                : key === 'total_rfid_cards'
                  ? 'linked'
                  : 'enrolled'}
            </span>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel attendance-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Live overview</p>
              <h2>Today’s attendance</h2>
            </div>
            <span className="panel-date">CAT · Kigali</span>
          </div>

          {loading && !statistics ? <LoadingState label="Loading attendance" /> : (
            <>
              <div className="attendance-rate-row">
                <div>
                  <strong>{statistics ? attendanceRate.toFixed(1) : '—'}<small>{statistics ? '%' : ''}</small></strong>
                  <span>{statistics ? 'of active students checked in' : 'statistics unavailable'}</span>
                </div>
                <div className="rate-count">
                  <span className="rate-present">{statistics?.present_today ?? '—'} present</span>
                  <span>{statistics?.absent_today ?? '—'} absent</span>
                </div>
              </div>
              <div className="progress-track" aria-label={statistics ? `${attendanceRate}% attendance` : 'Attendance unavailable'}>
                <div className="progress-fill" style={{ width: `${attendanceRate}%` }} />
              </div>
              <div className="progress-legend">
                <span><i className="legend-dot legend-green" />Present</span>
                <span><i className="legend-dot legend-muted" />Not yet checked in</span>
                <span>{statistics?.active_students ?? '—'} active</span>
              </div>
            </>
          )}

          <div className="panel-divider" />
          <div className="panel-heading recent-heading">
            <div>
              <h3>Latest check-ins</h3>
              <p>Most recent RFID scans today</p>
            </div>
            <Link className="text-link" to="/attendance">Full log <ArrowRight size={15} /></Link>
          </div>

          {loading && !attendance.length ? <LoadingState label="Loading scans" /> : attendance.length ? (
            <div className="recent-list">
              {attendance.slice(0, 5).map((record) => (
                <div className="recent-row" key={record.id}>
                  <span className="recent-avatar">{record.student_name?.slice(0, 1) || 'S'}</span>
                  <div className="recent-person">
                    <strong>{record.student_name}</strong>
                    <span>{record.student_id}{record.class_name ? ` · ${record.class_name}` : ''}</span>
                  </div>
                  <span className="recent-time">{formatTime(record.scanned_at)}</span>
                  <span className="checkmark">✓</span>
                </div>
              ))}
            </div>
          ) : error ? (
            <EmptyState
              icon={Activity}
              title="Check-ins unavailable"
              description="The attendance service could not be reached."
              action={<button className="button button-secondary" onClick={() => setReload((value) => value + 1)}><RefreshCw size={15} /> Retry</button>}
            />
          ) : (
            <EmptyState
              icon={Activity}
              title="No check-ins yet"
              description="Attendance scans will appear here as students tap in."
            />
          )}
        </article>

        <aside className="dashboard-side">
          <article className="summary-card">
            <div className="summary-card-top">
              <span className="summary-symbol"><Activity size={20} /></span>
              <span className="summary-label">School roll</span>
            </div>
            <strong className="summary-value">
              {loading || !statistics ? '—' : statistics.total_students.toLocaleString()}
            </strong>
            <span className="summary-caption">registered students</span>
            <div className="summary-bottom">
              <span>{statistics?.active_students ?? '—'} active</span>
              <span>{statistics?.total_students != null
                ? `${statistics.total_students - statistics.active_students} inactive`
                : '— inactive'}</span>
            </div>
          </article>

          <article className="quick-actions panel">
            <p className="eyebrow">Manage</p>
            <h2>Quick actions</h2>
            <Link to="/students" className="quick-action-row">
              <span className="quick-action-icon quick-icon-green"><UsersRound size={17} /></span>
              <span><strong>Add a student</strong><small>Create a student record</small></span>
              <ArrowRight size={16} />
            </Link>
            <Link to="/cards" className="quick-action-row">
              <span className="quick-action-icon quick-icon-coral"><CreditCard size={17} /></span>
              <span><strong>Assign an RFID card</strong><small>Link a card to a student</small></span>
              <ArrowRight size={16} />
            </Link>
          </article>
        </aside>
      </section>
    </>
  )
}

export default DashboardPage