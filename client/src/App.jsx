import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import TabLayout from './components/TabLayout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import InspectPage from './pages/InspectPage';
import TroubleshootPage from './pages/TroubleshootPage';
import ReferencePage from './pages/ReferencePage';
import HistoryPage from './pages/HistoryPage';
import LearnPage from './pages/LearnPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <TabLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/inspect" replace />} />
          <Route path="inspect" element={<InspectPage />} />
          <Route path="troubleshoot" element={<TroubleshootPage />} />
          <Route path="reference" element={<ReferencePage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="learn" element={<LearnPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
