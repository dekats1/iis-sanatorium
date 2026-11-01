import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './hooks/useAuth';
import AdminBookingsPage from './pages/AdminBookingsPage';
import AdminPage from './pages/AdminPage';
import BookingPage from './pages/BookingPage';
import CustomersPage from './pages/CustomersPage';
import DirectoriesPage from './pages/DirectoriesPage';
import DoctorPage from './pages/DoctorPage';
import LoginPage, { homeFor } from './pages/LoginPage';
import ManagerDashboardPage from './pages/ManagerDashboardPage';
import MyBookingsPage from './pages/MyBookingsPage';
import PricingPage from './pages/PricingPage';
import ProfilePage from './pages/ProfilePage';
import SearchPage from './pages/SearchPage';

function Home() {
  const { session } = useAuth();
  return <Navigate to={session ? homeFor(session.roles) : '/login'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/search" element={<ProtectedRoute roles={['CLIENT', 'BOOKING_ADMIN']}><SearchPage /></ProtectedRoute>} />
            <Route path="/booking" element={<ProtectedRoute roles={['CLIENT', 'BOOKING_ADMIN']}><BookingPage /></ProtectedRoute>} />
            <Route path="/my" element={<ProtectedRoute roles={['CLIENT']}><MyBookingsPage /></ProtectedRoute>} />
            <Route path="/admin-bookings" element={<ProtectedRoute roles={['BOOKING_ADMIN']}><AdminBookingsPage /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute roles={['BOOKING_ADMIN', 'SYSADMIN']}><CustomersPage /></ProtectedRoute>} />
            <Route path="/doctor" element={<ProtectedRoute roles={['DOCTOR']}><DoctorPage /></ProtectedRoute>} />
            <Route path="/manager" element={<ProtectedRoute roles={['MANAGER']}><ManagerDashboardPage /></ProtectedRoute>} />
            <Route path="/pricing" element={<ProtectedRoute roles={['MANAGER']}><PricingPage /></ProtectedRoute>} />
            <Route path="/directories" element={<ProtectedRoute roles={['SYSADMIN']}><DirectoriesPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute roles={['SYSADMIN']}><AdminPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
