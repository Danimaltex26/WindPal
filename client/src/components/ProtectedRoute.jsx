import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedRoute({ children }) {
  var auth = useAuth();
  if (auth.loading) return <LoadingSpinner message="Loading..." />;
  if (!auth.user) return <Navigate to="/login" replace />;
  return children;
}
