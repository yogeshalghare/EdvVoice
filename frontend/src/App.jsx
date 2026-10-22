import { Routes, Route, Navigate } from 'react-router-dom'

import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'

import StudentLayout from './components/StudentLayout'
import Dashboard from './pages/student/Dashboard'
import NewComplaint from './pages/student/NewComplaint'
import MyComplaints from './pages/student/MyComplaints'
import ComplaintDetail from './pages/student/ComplaintDetail'
import Notifications from './pages/student/Notifications'
import Profile from './pages/student/Profile'
import Help from './pages/student/Help'

import AdminLayout from './components/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AllComplaints from './pages/admin/AllComplaints'
import AdminComplaintDetail from './pages/admin/AdminComplaintDetail'
import AdminNotifications from './pages/admin/AdminNotifications'
import AdminProfile from './pages/admin/AdminProfile'

import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      <Route path="/app" element={<ProtectedRoute role="student"><StudentLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="new" element={<NewComplaint />} />
        <Route path="complaints" element={<MyComplaints />} />
        <Route path="complaints/:id" element={<ComplaintDetail />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
        <Route path="help" element={<Help />} />
      </Route>

      <Route path="/admin" element={<ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="complaints" element={<AllComplaints />} />
        <Route path="complaints/:id" element={<AdminComplaintDetail />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="profile" element={<AdminProfile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
