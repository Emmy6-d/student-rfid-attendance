import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from '../components/AppShell.jsx'
import AttendancePage from '../pages/AttendancePage.jsx'
import CardsPage from '../pages/CardsPage.jsx'
import DashboardPage from '../pages/DashboardPage.jsx'
import RegisterStudentPage from '../pages/RegisterStudentPage.jsx'
import StudentsPage from '../pages/StudentsPage.jsx'

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="students/register" element={<RegisterStudentPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="cards" element={<CardsPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default AppRoutes