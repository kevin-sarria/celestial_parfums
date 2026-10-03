import { useEffect, useState } from 'react';
import { HandCoins, Heart, Share2, ShoppingBag, Sparkles, Star } from 'lucide-react';
import CatalogHeader from '../components/CatalogHeader';
import { TarjetaCuenta } from '../components/cuenta/TarjetaCuenta';
import { SellosMini } from '../components/cuenta/SellosMini';
import { formatPrice } from '@/lib/format';
import { http } from '../infrastructure/api/http';
import { urls } from '../infrastructure/api/urls';
import { useAuthContext } from '../application/context/useAuthContext';
import { useListas } from '../application/context/ListasContext';
import { fraseDeSellos, useMiTarjeta } from '../application/hooks/useMiTarjeta';
import { usePortalCredito } from '../application/hooks/usePortalCredito';
import { useIrALogin } from '../application/hooks/useIrALogin';
import { useSeo } from '../application/hooks/useSeo';

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * MI CUENTA: todo lo que se le abre al cliente al iniciar sesión, en una
 * pantalla (2026-10-02).
 *
 * Antes eran cinco páginas sueltas metidas en el menú ☰, y nada en la tienda
 * decía que existían: el cliente entraba y no sentía que hubiera entrado a
 * ningún lado (dueño). Aquí cada tarjeta dice cómo va —los sellos, cuántas
 * compras, cuántos favoritos— para que se vea lo que ya tiene, no solo el
 * nombre de la sección.
 *
 * Cada dato llega por su lado y la tarjeta se pinta igual si alguno falla:
 * esta es una pantalla de puertas, y una puerta no se esconde porque no se
 * pudo contar lo que hay detrás.
 */
export default function MiCuentaPage() {
  useSeo('Mi cuenta');
  const irALogin = useIrALogin();
  const { user } = useAuthContext();
  const { favoritos } = useListas();
  const { data: tarjeta } = useMiTarjeta();
  const { data: credito } = usePortalCredito();
  const [compras, setCompras] = useState<number | null>(null);

  useEffect(() => { if (!user) irALogin(true); }, [user, irALogin]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await http.get<{ data: unknown[] }>(urls.resenas.misCompras);
        if (res.ok) setCompras(res.cuerpo?.data.length ?? 0);
      } catch { /* la tarjeta se queda sin el número, pero la puerta sigue */ }
    })();
  }, [user]);

  if (!user) return null;
  const frase = fraseDeSellos(tarjeta);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <CatalogHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-10 md:px-8 animate-fade-up">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">Mi cuenta</p>
        <h1 className="mt-2 font-display text-4xl font-light tracking-tight text-ink">Hola, {user.nombre}</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">Esto es lo que tienes en Celestial Parfums.</p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {credito?.tiene_credito_activo && (
            <TarjetaCuenta to="/mi-credito" icono={HandCoins} titulo="Mi crédito" destacada>
              Saldo pendiente: <strong className="font-semibold text-foreground">{formatPrice(credito.deuda_total ?? 0)}</strong>
            </TarjetaCuenta>
          )}

          <TarjetaCuenta to="/mis-recompensas" icono={Star} titulo="Mis recompensas" destacada={!!tarjeta?.premio_listo}>
            {tarjeta?.activo && !tarjeta.premio_listo && (
              <SellosMini sellos={tarjeta.sellos} objetivo={tarjeta.objetivo} className="mb-1.5 mt-0.5" />
            )}
            {frase ?? 'Tu tarjeta de sellos: cada compra suma.'}
          </TarjetaCuenta>

          <TarjetaCuenta to="/mis-compras" icono={ShoppingBag} titulo="Mis compras">
            {compras == null ? 'Lo que has comprado, y tus reseñas.'
              : compras === 0 ? 'Aún no tienes compras. Cuando compres, aquí dejas tu reseña.'
              : `${plural(compras, 'perfume comprado', 'perfumes comprados')} · déjales tu reseña`}
          </TarjetaCuenta>

          <TarjetaCuenta to="/mis-favoritos" icono={Heart} titulo="Mis favoritos">
            {favoritos.size === 0
              ? 'Toca el ♡ de un perfume para guardarlo aquí.'
              : plural(favoritos.size, 'perfume guardado', 'perfumes guardados')}
          </TarjetaCuenta>

          <TarjetaCuenta to="/perfume-ideal" icono={Sparkles} titulo="Tu perfume ideal">
            Responde unas preguntas y te recomendamos los que van contigo.
          </TarjetaCuenta>

          <TarjetaCuenta to="/invita" icono={Share2} titulo="Invita y gana">
            Comparte tu enlace: cuando tu amigo haga su primera compra, ¡ganas!
          </TarjetaCuenta>
        </div>
      </main>
    </div>
  );
}
