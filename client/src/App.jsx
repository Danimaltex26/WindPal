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
import TrainingHome from './pages/training/TrainingHome';
import ModuleList from './pages/training/ModuleList';
import ModuleContent from './pages/training/ModuleContent';
import ExamSelection from './pages/training/ExamSelection';
import ExamEngine from './pages/training/ExamEngine';
import ExamScoreReport from './pages/training/ExamScoreReport';
import ReadinessDashboard from './pages/training/ReadinessDashboard';
import SpacedRepetitionQueue from './pages/training/SpacedRepetitionQueue';
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
          <Route path="training" element={<TrainingHome />} />
          <Route path="training/sr" element={<SpacedRepetitionQueue />} />
          <Route path="training/:certLevel" element={<ModuleList />} />
          <Route path="training/:certLevel/readiness" element={<ReadinessDashboard />} />
          <Route path="training/:certLevel/exam" element={<ExamSelection />} />
          <Route path="training/:certLevel/exam/run" element={<ExamEngine />} />
          <Route path="training/:certLevel/exam/score/:attemptId" element={<ExamScoreReport />} />
          <Route path="training/:certLevel/:moduleId" element={<ModuleContent />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
