import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import VerifyPage from '../pages/VerifyPage';
import HomePage from '../pages/HomePage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import PerfumesPage from '../pages/PerfumesPage';
import CombosPage from '../pages/CombosPage';
import PerfumeDetailPage from '../pages/PerfumeDetailPage';
import ComboDetailPage from '../pages/ComboDetailPage';
import { useAuthContext } from '../application/context/useAuthContext';

export default function AppRouter() {
  const { isAdmin } = useAuthContext();

  return (
    <Routes>
      <Route path="/" element={<HomePage isAdmin={isAdmin} />} />
      <Route path="/perfumes" element={<PerfumesPage />} />
      <Route path="/perfume/:slug" element={<PerfumeDetailPage />} />
      <Route path="/combos" element={<CombosPage />} />
      <Route path="/combo/:slug" element={<ComboDetailPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify" element={<VerifyPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      {isAdmin && <Route path="/catalog" element={<HomePage adminPreview />} />}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
