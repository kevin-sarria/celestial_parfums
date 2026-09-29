import { Suspense } from 'react';
import { lazyPagina } from '../utils/lazyPagina';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthContext } from '../application/context/useAuthContext';
import PerfumeSpinner from '../components/PerfumeSpinner';

const HomePage = lazyPagina(() => import('../pages/HomePage'));
const PerfumesPage = lazyPagina(() => import('../pages/PerfumesPage'));
const AccesoriosPage = lazyPagina(() => import('../pages/AccesoriosPage'));
const PerfumeDetailPage = lazyPagina(() => import('../pages/PerfumeDetailPage'));
const CombosPage = lazyPagina(() => import('../pages/CombosPage'));
const ComboDetailPage = lazyPagina(() => import('../pages/ComboDetailPage'));
const ContactPage = lazyPagina(() => import('../pages/ContactPage'));
const MiCreditoPage = lazyPagina(() => import('../pages/MiCreditoPage'));
const MisRecompensasPage = lazyPagina(() => import('../pages/MisRecompensasPage'));
const MisComprasPage = lazyPagina(() => import('../pages/MisComprasPage'));
const MisFavoritosPage = lazyPagina(() => import('../pages/MisFavoritosPage'));
const PerfumeIdealPage = lazyPagina(() => import('../pages/PerfumeIdealPage'));
const LegalPage = lazyPagina(() => import('../pages/LegalPage'));
const SobreNosotrosPage = lazyPagina(() => import('../pages/SobreNosotrosPage'));
const BlogPage = lazyPagina(() => import('../pages/BlogPage'));
const BlogPostPage = lazyPagina(() => import('../pages/BlogPostPage'));
const InvitaPage = lazyPagina(() => import('../pages/InvitaPage'));
const LoginPage = lazyPagina(() => import('../pages/LoginPage'));
const RegisterPage = lazyPagina(() => import('../pages/RegisterPage'));
const VerifyPage = lazyPagina(() => import('../pages/VerifyPage'));
const DashboardPage = lazyPagina(() => import('../pages/dashboard/DashboardPage'));

export default function AppRouter() {
  const { isAdmin } = useAuthContext();

  return (
    <Suspense fallback={<PerfumeSpinner />}>
      <Routes>
        <Route path="/" element={<HomePage isAdmin={isAdmin} />} />
        <Route path="/perfumes" element={<PerfumesPage />} />
        <Route path="/accesorios" element={<AccesoriosPage />} />
        <Route path="/perfume/:slug" element={<PerfumeDetailPage />} />
        <Route path="/combos" element={<CombosPage />} />
        <Route path="/combo/:slug" element={<ComboDetailPage />} />
        <Route path="/contactame" element={<ContactPage />} />
        <Route path="/mi-credito" element={<MiCreditoPage />} />
        <Route path="/mis-recompensas" element={<MisRecompensasPage />} />
        <Route path="/mis-compras" element={<MisComprasPage />} />
        <Route path="/mis-favoritos" element={<MisFavoritosPage />} />
        <Route path="/perfume-ideal" element={<PerfumeIdealPage />} />
        <Route path="/legal" element={<LegalPage />} />
        <Route path="/nosotros" element={<SobreNosotrosPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/invita" element={<InvitaPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        {/* La pestaña activa viaja en la URL: recargar o volver atrás conserva
            el sitio donde estabas (/dashboard redirige a la primera pestaña). */}
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dashboard/:tab" element={<DashboardPage />} />
        {isAdmin && <Route path="/catalog" element={<HomePage adminPreview />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
