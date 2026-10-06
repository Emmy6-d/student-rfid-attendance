import { useEffect, useMemo, useState } from 'react'
import { Check, Pencil, Plus, Search, UserRoundPlus, UsersRound, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { EmptyState, LoadingState, Notice, PageHeader, StatusPill } from '../components/ui.jsx'

const emptyForm = {
  student_id: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  class_name: '',
  status: true,
}

function StudentsPage() {
  const [students, setStudents] = useState([])
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true

    async function loadStudents() {
      setLoading(true)
      setError('')

      try {
        const [studentRows, cardRows] = await Promise.all([api('/students'), api('/rfid')])
        if (active) {
          setStudents(studentRows)
          setCards(cardRows)
        }
      } catch (requestError) {
        if (active) setError(requestError.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadStudents()
    return () => { active = false }
  }, [reload])

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return students

    return students.filter((student) => [
      student.student_id,
      student.first_name,
      student.last_name,
      student.email,
      student.class_name,
    ].some((value) => value?.toLowerCase().includes(query)))
  }, [search, students])

  const openEdit = (student) => {
    setEditing(student)
    setForm({
      student_id: student.student_id || '',
      first_name: student.first_name || '',
      last_name: student.last_name || '',
      email: student.email || '',
      phone: student.phone || '',
      class_name: student.class_name || '',
      status: student.status,
    })
    setFormError('')
  }

  async function submitStudent(event) {
    event.preventDefault()
    setSaving(true)
    setFormError('')

    try {
      await api(`/students/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          class_name: form.class_name.trim() || null,
          status: form.status,
        }),
      })
      setNotice('Student details updated.')
      setEditing(false)
      setReload((value) => value + 1)
    } catch (requestError) {
      setFormError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const closeForm = () => setEditing(false)

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Student register"
        description="Keep student records and their attendance eligibility up to date."
        action={(
          <Link className="button button-primary" to="/students/register">
            <Plus size={17} /> Add student
          </Link>
        )}
      />

      {error && <Notice>{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}

      <section className="panel data-panel">
        <div className="data-toolbar">
          <div className="record-count"><UsersRound size={17} />
            <span><strong>{error && !students.length ? '—' : students.length}</strong> students</span>
          </div>
          <label className="search-field">
            <Search size={16} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search students"
              aria-label="Search students"
            />
          </label>
        </div>

        {loading ? <LoadingState label="Loading student register" /> : error && !students.length ? (
          <EmptyState
            icon={UsersRound}
            title="Student register unavailable"
            description="The student service could not be reached."
            action={<button className="button button-secondary" onClick={() => setReload((value) => value + 1)}>Retry</button>}
          />
        ) : filteredStudents.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Student ID</th>
                  <th>Class</th>
                  <th>RFID card</th>
                  <th>Status</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const assignedCard = cards.find((card) => card.student_id === student.id && card.active)

                  return (
                    <tr key={student.id}>
                      <td>
                        <div className="student-cell">
                          <span className="student-avatar">
                            {student.first_name?.slice(0, 1)}{student.last_name?.slice(0, 1)}
                          </span>
                          <span className="student-cell-copy">
                            <strong>{student.first_name} {student.last_name}</strong>
                            <span>{student.email || student.phone || 'No contact details'}</span>
                          </span>
                        </div>
                      </td>
                      <td className="mono-cell">{student.student_id}</td>
                      <td>{student.class_name || <span className="muted-cell">Unassigned</span>}</td>
                      <td>{assignedCard
                        ? <span className="mono-cell card-uid">{assignedCard.uid}</span>
                        : <span className="muted-cell">Not linked</span>}</td>
                      <td><StatusPill active={student.status} /></td>
                      <td className="table-action-cell">
                        <button
                          className="icon-button"
                          aria-label={`Edit ${student.first_name} ${student.last_name}`}
                          title="Edit student"
                          onClick={() => openEdit(student)}
                        ><Pencil size={16} /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={UserRoundPlus}
            title={search ? 'No matching students' : 'Your register is empty'}
            description={search ? 'Try a different name, ID, email, or class.' : 'Add your first student to begin taking attendance.'}
            action={!search && <Link className="button button-primary" to="/students/register"><Plus size={16} /> Add student</Link>}
          />
        )}
      </section>

      {editing !== false && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeForm()
        }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="student-form-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Student record</p>
                <h2 id="student-form-title">{editing ? 'Edit student' : 'Add student'}</h2>
              </div>
              <button className="icon-button" onClick={closeForm} aria-label="Close dialog"><X size={19} /></button>
            </div>

            {formError && <Notice>{formError}</Notice>}

            <form className="form-stack" onSubmit={submitStudent}>
              <div className="form-row">
                <label className="form-field">
                  <span>First name <b>*</b></span>
                  <input required maxLength={80} value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} autoFocus />
                </label>
                <label className="form-field">
                  <span>Last name <b>*</b></span>
                  <input required maxLength={80} value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} />
                </label>
              </div>
              <label className="form-field">
                <span>Email</span>
                <input type="email" maxLength={255} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="student@example.com" />
              </label>
              <div className="form-row">
                <label className="form-field">
                  <span>Phone</span>
                  <input type="tel" maxLength={32} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                </label>
                <label className="form-field">
                  <span>Class / year</span>
                  <input maxLength={80} value={form.class_name} onChange={(event) => setForm({ ...form, class_name: event.target.value })} placeholder="e.g. ME Year 2" />
                </label>
              </div>
              <label className="toggle-field">
                <span><strong>Attendance eligible</strong><small>Inactive students cannot check in with a card.</small></span>
                <input type="checkbox" checked={form.status} onChange={(event) => setForm({ ...form, status: event.target.checked })} />
              </label>
              <div className="modal-actions">
                <button type="button" className="button button-secondary" onClick={closeForm}>Cancel</button>
                <button className="button button-primary" disabled={saving}>
                  <Check size={16} /> {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  )
}

export default StudentsPage