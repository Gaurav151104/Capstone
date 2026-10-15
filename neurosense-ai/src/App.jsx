import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';

// Pages
import Landing from './pages/Landing/Landing';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import Dashboard from './pages/Dashboard/Dashboard';
import GamesIndex from './pages/Games/Games';
import MemoryGame from './pages/Games/MemoryGame';
import ImageRecallGame from './pages/Games/ImageRecallGame';
import WordRecall from './pages/Games/WordRecall';
import ReactionTimeGame from './pages/Games/ReactionTimeGame';
import Progress from './pages/Progress/Progress';
import RiskAssessment from './pages/Risk/RiskAssessment';
import Recommendations from './pages/Therapy/Recommendations';
import Profile from './pages/Profile/Profile';
import CognitiveInterview from './pages/Interview/CognitiveInterview';
import VoiceRecallGame from './pages/Games/VoiceRecallGame';

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const AuthLayout = ({ children }) => {
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-200">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected Routes */}
      <Route
        path="/dashboard/*"
        element={
          <ProtectedRoute>
            <AuthLayout>
              <Routes>
                <Route index element={<Dashboard />} />
                <Route path="games" element={<GamesIndex />} />
                <Route path="games/memory" element={<MemoryGame />} />
                <Route path="games/image-recall" element={<ImageRecallGame />} />
                <Route path="games/recall" element={<WordRecall />} />
                <Route path="games/reaction-time" element={<ReactionTimeGame />} />
                <Route path="games/voice" element={<VoiceRecallGame />} />
                <Route path="speech" element={<VoiceRecallGame />} />
                
                <Route path="interview" element={<CognitiveInterview />} />
                <Route path="progress" element={<Progress />} />
                <Route path="insights" element={<Progress />} />
                <Route path="risk" element={<RiskAssessment />} />
                <Route path="therapy" element={<Recommendations />} />
                <Route path="profile" element={<Profile />} />
              </Routes>
            </AuthLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
