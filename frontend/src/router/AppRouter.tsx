import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthContext } from '../application/context/useAuthContext';
import PerfumeSpinner from '../components/PerfumeSpinner';

const HomePage = lazy(() => import('../pages/HomePage'));
const PerfumesPage = lazy(() => import('../pages/PerfumesPage'));
const PerfumeDetailPage = lazy(() => import('../pages/PerfumeDetailPage'));
const CombosPage = lazy(() => import('../pages/CombosPage'));
const ComboDetailPage = lazy(() => import('../pages/ComboDetailPage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const RegisterPage = lazy(() => import('../pages/RegisterPage'));
const VerifyPage = lazy(() => import('../pages/VerifyPage'));
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));

export default function AppRouter() {
  const { isAdmin } = useAuthContext();

  return (
    <Suspense fallback={<PerfumeSpinner />}>
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
    </Suspense>
  );
}
