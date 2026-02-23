import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AddTransaction from './pages/AddTransaction';
import Settings from './pages/Settings';
import TeamSetup from './pages/TeamSetup';
import Repayment from './pages/Repayment';
import AdminDashboard from './pages/AdminDashboard';
import Layout from './components/Layout';

// Enhanced Protected Route to check for both User and Team
const ProtectedRoute = ({ children }) => {
  const { currentUser, currentTeam, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">載入中...</div>;

  // 1. Not logged in -> Login
  if (!currentUser) return <Navigate to="/login" replace />;

  // 2. Logged in, but hasn't selected/created a team yet -> Setup Flow
  if (!currentTeam) return <Navigate to="/setup" replace />;

  // 3. Logged in & has a team -> Allow access to Dashboard/App
  return children;
};

// Component to capture invite from URL and store in localStorage
const InviteHandler = () => {
  const [searchParams] = useSearchParams();
  const invite = searchParams.get('invite');

  useEffect(() => {
    if (invite) {
      localStorage.setItem('pendingInvite', invite);
    }
  }, [invite]);

  return null;
};

import PWAPrompt from './components/PWAPrompt';

function AppRoutes() {
  const { currentUser, currentTeam, loading } = useAuth();

  if (loading) return null; // Or a global spinner

  return (
    <>
      <InviteHandler />
      <PWAPrompt />
      <Routes>
        <Route path="/login" element={
          currentUser && !window.location.search.includes('invite')
            ? <Navigate to="/dashboard" replace />
            : <Login />
        } />

        {/* Setup route for users to create or join teams */}
        <Route path="/setup" element={
          currentUser ? <TeamSetup /> : <Navigate to="/login" replace />
        } />

        {/* Super Admin Route */}
        <Route path="/admin" element={
          currentUser ? <AdminDashboard /> : <Navigate to="/login" replace />
        } />

        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/add" element={<AddTransaction />} />
          <Route path="/repayment" element={<Repayment />} />
          <Route path="/settings" element={<Settings />} /> {/* Renamed route */}
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
