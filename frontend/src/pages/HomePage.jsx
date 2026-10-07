import { useEffect, useState } from 'react'
import { api } from '../api.js'

function requestDashboardStatistics() {
  return api('/attendance/dashboard/statistics')
}

function HomePage() {
  const [statistics, setStatistics] = useState({
    total_students: 0,
    active_students: 0,
    total_rfid_cards: 0,
    present_today: 0,
    absent_today: 0,
    attendance_percentage: 0,
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    requestDashboardStatistics()
      .then(setStatistics)
      .catch((error) => {
        console.error('Dashboard error:', error)
        setError(
          'Unable to load dashboard statistics. Check that the backend is running and configured.'
        )
      })
      .finally(() => setLoading(false))
  }, [])

  const refreshDashboardStatistics = () => {
    setLoading(true)
    setError('')
    requestDashboardStatistics()
      .then(setStatistics)
      .catch((error) => {
        console.error('Dashboard error:', error)
        setError(
          'Unable to load dashboard statistics. Check that the backend is running and configured.'
        )
      })
      .finally(() => setLoading(false))
  }

  const statisticsCards = [
    {
      title: 'Total Students',
      value: statistics.total_students,
      description: 'Registered students',
    },
    {
      title: 'Active Students',
      value: statistics.active_students,
      description: 'Currently active',
    },
    {
      title: 'RFID Cards',
      value: statistics.total_rfid_cards,
      description: 'Active RFID cards',
    },
    {
      title: 'Present Today',
      value: statistics.present_today,
      description: 'Attendance recorded',
    },
    {
      title: 'Absent Today',
      value: statistics.absent_today,
      description: 'Not yet recorded',
    },
    {
      title: 'Attendance Rate',
      value: `${statistics.attendance_percentage}%`,
      description: 'Today',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">
          Dashboard
        </h1>

        <p className="mt-2 text-gray-600">
          Student RFID Attendance Management System
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p className="font-semibold">
            Connection Error
          </p>

          <p className="mt-1 text-sm">
            {error}
          </p>

          <button
            onClick={refreshDashboardStatistics}
            className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        
        {statisticsCards.map((card) => (
          <div
            key={card.title}
            className="rounded-xl bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              
              <div>
                <p className="text-sm font-medium text-gray-500">
                  {card.title}
                </p>

                <p className="mt-2 text-3xl font-bold text-gray-800">
                  {loading ? '...' : card.value}
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  {card.description}
                </p>
              </div>

            </div>
          </div>
        ))}

      </div>

      {/* Attendance Overview */}
      <div className="mt-8 rounded-xl bg-white p-6 shadow-sm">
        
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              Today's Attendance
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Current attendance overview
            </p>
          </div>

          <button
            onClick={refreshDashboardStatistics}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>

        {/* Attendance Progress */}
        <div className="mt-6">
          
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-gray-600">
              Attendance Progress
            </span>

            <span className="font-semibold text-gray-800">
              {loading
                ? '...'
                : `${statistics.attendance_percentage}%`}
            </span>
          </div>

          <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-500"
              style={{
                width: `${Math.min(
                  statistics.attendance_percentage,
                  100
                )}%`,
              }}
            />
          </div>

        </div>

        {/* Present / Absent */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          
          <div className="rounded-lg bg-green-50 p-4">
            <p className="text-sm text-green-700">
              Present
            </p>

            <p className="mt-1 text-2xl font-bold text-green-800">
              {loading ? '...' : statistics.present_today}
            </p>
          </div>

          <div className="rounded-lg bg-red-50 p-4">
            <p className="text-sm text-red-700">
              Absent
            </p>

            <p className="mt-1 text-2xl font-bold text-red-800">
              {loading ? '...' : statistics.absent_today}
            </p>
          </div>

        </div>

      </div>

    </div>
  )
}

export default HomePage