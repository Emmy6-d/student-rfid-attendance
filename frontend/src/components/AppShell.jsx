import {
  Activity,
  CreditCard,
  Fingerprint,
  LayoutDashboard,
  UsersRound,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

const navigation = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/students', label: 'Students', icon: UsersRound },
  { to: '/cards', label: 'RFID cards', icon: CreditCard },
  { to: '/attendance', label: 'Attendance', icon: Activity },
]

const headings = {
  '/': 'Overview',
  '/students': 'Students',
  '/students/register': 'Register student',
  '/cards': 'RFID cards',
  '/attendance': 'Attendance log',
}

function AppShell() {
  const location = useLocation()
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Africa/Kigali',
  }).format(new Date())

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <NavLink to="/" className="brand-lockup" aria-label="Classmark home">
          <span className="brand-mark"><Fingerprint size={25} /></span>
          <span className="brand-name">classmark<span>.</span></span>
        </NavLink>

        <div className="sidebar-label">Workspace</div>
        <nav className="side-navigation" aria-label="Main navigation">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}
            >
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="device-indicator"><span /> RFID system</span>
          <p>Student attendance<br />management</p>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-title">
            <span className="topbar-kicker">School administration</span>
            <span className="topbar-current">{headings[location.pathname] || 'Classmark'}</span>
          </div>
          <div className="topbar-date">
            <span className="live-dot" />
            <span>{date}</span>
            <span className="timezone-label">CAT</span>
          </div>
        </header>

        <main className="content-area">
          <Outlet />
        </main>

        <nav className="mobile-navigation" aria-label="Main navigation">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `mobile-nav-link${isActive ? ' mobile-nav-active' : ''}`}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

export default AppShell