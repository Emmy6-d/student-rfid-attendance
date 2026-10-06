import { useState } from 'react'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  Radio,
  RotateCcw,
  UserRoundPlus,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import CardEnrollmentDialog from '../components/CardEnrollmentDialog.jsx'
import { Notice, PageHeader, StatusPill } from '../components/ui.jsx'

const emptyForm = {
  student_id: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  class_name: '',
}

function RegisterStudentPage() {
  const [form, setForm] = useState(emptyForm)
  const [student, setStudent] = useState(null)
  const [enrollment, setEnrollment] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [enrollmentError, setEnrollmentError] = useState('')

  async function startEnrollment(studentRecord) {
    setEnrollmentError('')
    try {
      const request = await api('/rfid/enrollment-requests', {
        method: 'POST',
        body: JSON.stringify({ student_id: studentRecord.id }),
      })
      setEnrollment(request)
      setDialogOpen(true)
    } catch (requestError) {
      setEnrollmentError(requestError.message)
    }
  }

  async function registerStudent(event) {
    event.preventDefault()
    setSaving(true)
    setFormError('')

    try {
      const newStudent = await api('/students', {
        method: 'POST',
        body: JSON.stringify({
          student_id: form.student_id.trim(),
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          class_name: form.class_name.trim() || null,
          status: true,
        }),
      })

      setStudent(newStudent)
      await startEnrollment(newStudent)
    } catch (requestError) {
      setFormError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  function registerAnother() {
    setForm(emptyForm)
    setStudent(null)
    setEnrollment(null)
    setDialogOpen(false)
    setFormError('')
    setEnrollmentError('')
  }

  const fullName = student ? `${student.first_name} ${student.last_name}` : ''
  const completed = enrollment?.status === 'completed'
  const cancelled = enrollment?.status === 'cancelled'

  return (
    <>
      <PageHeader
        eyebrow="Student registration"
        title={completed ? 'Student registered.' : 'Register a student'}
        description={completed
          ? 'Student details and RFID card are saved and linked.'
          : 'Save the student, then scan their card at the reader to finish.'}
        action={(
          <Link className="button button-secondary" to="/students">
            <ArrowLeft size={16} /> Student register
          </Link>
        )}
      />

      <div className="registration-layout">
        <section className="panel registration-form-panel">
          <div className="registration-section-heading">
            <span className={`registration-step ${student ? 'registration-step-done' : ''}`}>
              {student ? <Check size={15} /> : '01'}
            </span>
            <div>
              <p className="eyebrow">Step one</p>
              <h2>Student details</h2>
            </div>
          </div>

          {student ? (
            <div className="registered-student">
              <div className="registered-student-avatar">{student.first_name.slice(0, 1)}{student.last_name.slice(0, 1)}</div>
              <div className="registered-student-copy">
                <strong>{fullName}</strong>
                <span>{student.class_name || 'Class not specified'}</span>
              </div>
              <StatusPill active={student.status} />
              <dl className="registered-student-meta">
                <div><dt>Student ID</dt><dd>{student.student_id}</dd></div>
                <div><dt>Email</dt><dd>{student.email || 'Not provided'}</dd></div>
                <div><dt>Phone</dt><dd>{student.phone || 'Not provided'}</dd></div>
              </dl>
            </div>
          ) : (
            <>
              {formError && <Notice>{formError}</Notice>}
              <form className="form-stack register-form" onSubmit={registerStudent}>
                <label className="form-field">
                  <span>Student ID <b>*</b></span>
                  <input required maxLength={40} value={form.student_id} onChange={(event) => setForm({ ...form, student_id: event.target.value })} placeholder="e.g. STU-2026-014" />
                </label>
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
                <button className="button button-primary register-submit" disabled={saving}>
                  <UserRoundPlus size={16} /> {saving ? 'Saving student…' : 'Save student and start card scan'}
                </button>
              </form>
            </>
          )}
        </section>

        <section className={`panel enrollment-panel${completed ? ' enrollment-complete' : ''}`}>
          <div className="registration-section-heading">
            <span className={`registration-step ${completed ? 'registration-step-done' : ''}`}>
              {completed ? <Check size={15} /> : '02'}
            </span>
            <div>
              <p className="eyebrow">Step two</p>
              <h2>Scan RFID card</h2>
            </div>
          </div>

          {!student ? (
            <div className="enrollment-idle">
              <span className="enrollment-illustration"><CreditCard size={25} /></span>
              <p>Student details are saved first. The reader will then be ready to capture a card for this student.</p>
            </div>
          ) : completed ? (
            <div className="enrollment-result" role="status">
              <span className="result-check"><CheckCircle2 size={25} /></span>
              <p className="eyebrow">Card assigned</p>
              <h3>{enrollment.student_name || fullName}</h3>
              <span className="result-student-id">Student ID · {enrollment.student_id || student.student_id}</span>
              <div className="assigned-uid"><CreditCard size={17} /><span>{enrollment.card_uid}</span></div>
              <p className="result-caption">This card is now linked to the student and ready for attendance scans.</p>
              <button className="button button-secondary" onClick={registerAnother}><UserRoundPlus size={15} /> Register another student</button>
            </div>
          ) : enrollment?.status === 'pending' ? (
            <div className="enrollment-waiting" role="status">
              <span className="reader-pulse"><Radio size={27} /></span>
              <StatusPill active>Reader ready</StatusPill>
              <h3>Scan a card for {student.first_name}</h3>
              <p>Tap the RFID card on the connected reader. The UID will be stored and linked to {fullName} automatically.</p>
              <div className="enrollment-student-chip">
                <span>{student.first_name.slice(0, 1)}{student.last_name.slice(0, 1)}</span>
                <strong>{fullName}</strong>
                <code>{student.student_id}</code>
              </div>
              {enrollment.last_error && (
                <Notice>{enrollment.last_error}. Scan a different card to continue.</Notice>
              )}
              <button className="button button-secondary" onClick={() => setDialogOpen(true)}><Radio size={15} /> Show scan dialog</button>
            </div>
          ) : cancelled ? (
            <div className="enrollment-idle">
              <span className="enrollment-illustration"><X size={25} /></span>
              <p>Card scan cancelled. The student remains saved and can be linked to a card later.</p>
              <button className="button button-primary" onClick={() => startEnrollment(student)}><RotateCcw size={15} /> Start card scan</button>
            </div>
          ) : student ? (
            <div className="enrollment-idle">
              <span className="enrollment-illustration"><CreditCard size={25} /></span>
              {enrollmentError && <Notice>{enrollmentError}</Notice>}
              <p>The student is saved. Start card enrollment when the reader is powered on.</p>
              <button className="button button-primary" onClick={() => startEnrollment(student)}><Radio size={15} /> Start card scan</button>
            </div>
          ) : null}
        </section>
      </div>

      {enrollment?.status === 'pending' && !dialogOpen && (
        <div className="enrollment-footer"><LoaderCircle className="spin" size={15} /> Waiting for the reader to assign a card to {fullName}</div>
      )}

      {dialogOpen && student && enrollment && (
        <CardEnrollmentDialog
          student={student}
          enrollment={enrollment}
          onEnrollmentChange={setEnrollment}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  )
}

export default RegisterStudentPage