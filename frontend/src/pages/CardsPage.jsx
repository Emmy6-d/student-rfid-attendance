import { useEffect, useMemo, useState } from 'react'
import { Check, CreditCard, Pause, Play, Radio, RefreshCw, Search } from 'lucide-react'
import { api } from '../api.js'
import CardEnrollmentDialog from '../components/CardEnrollmentDialog.jsx'
import { EmptyState, LoadingState, Notice, PageHeader, StatusPill } from '../components/ui.jsx'

function CardsPage() {
  const [cards, setCards] = useState([])
  const [students, setStudents] = useState([])
  const [studentId, setStudentId] = useState('')
  const [enrollingStudent, setEnrollingStudent] = useState(null)
  const [enrollment, setEnrollment] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true

    async function loadCards() {
      setLoading(true)
      setError('')

      try {
        const [cardRows, studentRows] = await Promise.all([api('/rfid'), api('/students')])
        if (active) {
          setCards(cardRows)
          setStudents(studentRows)
          setHasLoaded(true)
        }
      } catch (requestError) {
        if (active) setError(requestError.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadCards()
    return () => { active = false }
  }, [reload])

  const filteredCards = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return cards

    return cards.filter((card) => [
      card.uid,
      card.students?.student_id,
      card.students?.first_name,
      card.students?.last_name,
      card.students?.class_name,
    ].some((value) => value?.toLowerCase().includes(query)))
  }, [cards, search])

  useEffect(() => {
    if (enrollment?.status === 'completed') setReload((value) => value + 1)
  }, [enrollment?.status])

  async function startCardEnrollment(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    try {
      const request = await api('/rfid/enrollment-requests', {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId }),
      })
      const selectedStudent = students.find((student) => student.id === studentId)
      if (!selectedStudent) throw new Error('Selected student is no longer available')
      setEnrollingStudent(selectedStudent)
      setEnrollment(request)
      setDialogOpen(true)
      setStudentId('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  async function setCardActive(card) {
    setError('')
    setNotice('')

    try {
      await api(`/rfid/${card.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !card.active }),
      })
      setNotice(`Card ${card.active ? 'deactivated' : 'activated'}.`)
      setReload((value) => value + 1)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const activeStudents = students.filter((student) => student.status)

  return (
    <>
      <PageHeader
        eyebrow="Access"
        title="RFID cards"
        description="Scan a card to link it to a student or replace their current card."
      />

      {error && <Notice>{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}

      <section className="assign-layout">
        <form className="panel assign-panel" onSubmit={startCardEnrollment}>
          <div className="assign-heading">
            <span className="assign-icon"><Radio size={20} /></span>
            <div>
              <p className="eyebrow">New assignment</p>
              <h2>Scan a card</h2>
            </div>
          </div>
          <label className="form-field">
            <span>Student <b>*</b></span>
            <select required value={studentId} onChange={(event) => setStudentId(event.target.value)}>
              <option value="">Choose a student</option>
              {activeStudents.map((student) => (
                <option value={student.id} key={student.id}>
                  {student.student_id} · {student.first_name} {student.last_name}
                </option>
              ))}
            </select>
            {!activeStudents.length && <small>Add an active student before assigning a card.</small>}
          </label>
          <button className="button button-primary button-wide" disabled={saving || !activeStudents.length || !studentId}>
            <Radio size={16} /> {saving ? 'Preparing reader…' : 'Open scan dialog'}
          </button>
        </form>

        <aside className="card-info-panel">
          <CreditCard size={22} />
          <strong>{error && !cards.length ? '—' : cards.filter((card) => card.active).length}</strong>
          <span>active cards</span>
          <div className="card-info-rule" />
          <p>A student can have one active card at a time. Assigning a replacement automatically deactivates their previous card.</p>
        </aside>
      </section>

      <section className="panel data-panel cards-table-panel">
        <div className="data-toolbar">
          <div className="record-count"><CreditCard size={17} />
            <span><strong>{error && !cards.length ? '—' : cards.length}</strong> assigned cards</span>
          </div>
          <label className="search-field">
            <Search size={16} aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search UID or student" aria-label="Search cards" />
          </label>
          {loading && hasLoaded && (
            <span className="refresh-indicator" role="status"><RefreshCw className="spin" size={13} /> Updating</span>
          )}
        </div>

        {loading && !hasLoaded ? <LoadingState label="Loading RFID cards" /> : error && !hasLoaded ? (
          <EmptyState
            icon={CreditCard}
            title="RFID cards unavailable"
            description="The card service could not be reached."
            action={<button className="button button-secondary" onClick={() => setReload((value) => value + 1)}>Retry</button>}
          />
        ) : filteredCards.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Card UID</th><th>Assigned student</th><th>Class</th><th>Assigned</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {filteredCards.map((card) => (
                  <tr key={card.id}>
                    <td><span className="mono-cell card-uid">{card.uid}</span></td>
                    <td>
                      <div className="student-cell compact-student-cell">
                        <span className="student-avatar">{card.students?.first_name?.slice(0, 1) || '?'}</span>
                        <span className="student-cell-copy">
                          <strong>{card.students ? `${card.students.first_name} ${card.students.last_name}` : 'Student unavailable'}</strong>
                          <span>{card.students?.student_id || card.student_id}</span>
                        </span>
                      </div>
                    </td>
                    <td>{card.students?.class_name || <span className="muted-cell">—</span>}</td>
                    <td>{card.assigned_at ? new Date(card.assigned_at).toLocaleDateString() : '—'}</td>
                    <td><StatusPill active={card.active} /></td>
                    <td className="table-action-cell">
                      <button
                        className="icon-button"
                        aria-label={`${card.active ? 'Deactivate' : 'Activate'} card ${card.uid}`}
                        title={card.active ? 'Deactivate card' : 'Activate card'}
                        onClick={() => setCardActive(card)}
                      >{card.active ? <Pause size={16} /> : <Play size={16} />}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={CreditCard}
            title={search ? 'No matching cards' : 'No cards assigned'}
            description={search ? 'Try another UID or student name.' : 'Use the assignment form to connect the first card.'}
            action={!search && <span className="empty-action-hint"><Check size={15} />Your reader reports the UID over serial.</span>}
          />
        )}
      </section>

      {dialogOpen && enrollingStudent && enrollment && (
        <CardEnrollmentDialog
          student={enrollingStudent}
          enrollment={enrollment}
          onEnrollmentChange={setEnrollment}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  )
}

export default CardsPage