#!/usr/bin/env bash
# =============================================================================
# EL DESPLIEGUE, paso a paso. Lo llama /usr/local/bin/celestial-desplegar
# después del `git pull`, con el commit que había ANTES como primer argumento.
#
# Es el runbook de docs/deploy-migraciones.md hecho script, en su orden
# obligatorio: respaldo → migrate deploy → build y restart del backend →
# build del frontend. Saltarse uno ya costó una semana (2026-08-29).
#
# Si algo falla, se detiene ahí mismo y GitHub marca el despliegue en rojo.
# El respaldo del paso 1 queda en $RESPALDOS para volver atrás a mano.
# =============================================================================
set -Eeuo pipefail

REPO=/var/www/celestial-parfums
RESPALDOS=/root/respaldos-deploy
LOG=/var/log/celestial-deploy.log
ANTES="${1:-}"
AHORA=$(git -C "$REPO" rev-parse HEAD)

exec > >(tee -a "$LOG") 2>&1
paso() { echo; echo "== $(date '+%F %T') · $*"; }
trap 'echo; echo "✗ El despliegue FALLÓ en la línea $LINENO. Producción quedó en el paso anterior; mira $LOG."' ERR

paso "Desplegando ${ANTES:0:7} → ${AHORA:0:7}"
if [[ "$ANTES" == "$AHORA" ]]; then
  echo "No hay nada nuevo en main. Se compila igual por si el anterior quedó a medias."
fi

# ¿Cambió este archivo entre lo desplegado y lo nuevo? (decide si hace falta npm ci)
cambio() { [[ -z "$ANTES" ]] || ! git -C "$REPO" diff --quiet "$ANTES" "$AHORA" -- "$1"; }

# ── 1. Respaldo de la base, ANTES de tocar nada ─────────────────────────────
paso "Respaldo de la base"
mkdir -p "$RESPALDOS" && chmod 700 "$RESPALDOS"
DATABASE_URL=$(grep -E '^DATABASE_URL=' "$REPO/backend/.env" | head -1 | cut -d= -f2- | tr -d '"'"'")
# La contraseña va en un archivo temporal y no en la línea de comandos: ahí la
# vería cualquiera con `ps`. Se borra al salir, pase lo que pase.
CRED=$(mktemp) && chmod 600 "$CRED"
trap 'rm -f "$CRED"' EXIT
BASE=$(DATABASE_URL="$DATABASE_URL" CRED="$CRED" node -e '
  const u = new URL(process.env.DATABASE_URL);
  require("fs").writeFileSync(process.env.CRED, [
    "[client]",
    "user=" + decodeURIComponent(u.username),
    "password=" + decodeURIComponent(u.password),
    "host=" + (u.hostname || "localhost"),
    "port=" + (u.port || 3306),
  ].join("\n") + "\n");
  process.stdout.write(u.pathname.slice(1));
')
ARCHIVO="$RESPALDOS/$BASE-$(date +%F-%H%M%S)-${AHORA:0:7}.sql.gz"
# mariadb-dump, NUNCA instalar mysql-client: apt desinstala MariaDB (2026-07-21)
DUMP=$(command -v mariadb-dump || command -v mysqldump)
"$DUMP" --defaults-extra-file="$CRED" --single-transaction --routines --triggers "$BASE" | gzip > "$ARCHIVO"
TAMANO=$(stat -c %s "$ARCHIVO")
# Un respaldo de 20 bytes es un respaldo vacío: mejor no desplegar
if (( TAMANO < 50000 )); then
  echo "✗ El respaldo pesa $TAMANO bytes: salió vacío. No se despliega." >&2
  exit 1
fi
echo "✓ $ARCHIVO ($((TAMANO / 1024)) KB)"
# Se guardan los 20 más recientes
ls -1t "$RESPALDOS"/*.sql.gz | tail -n +21 | xargs -r rm -f

# ── 2. Backend: dependencias, migraciones, build, reinicio ──────────────────
cd "$REPO/backend"
if cambio backend/package-lock.json; then
  paso "Backend: npm ci (cambiaron las dependencias)"
  npm ci --no-audit --no-fund
fi

paso "Migraciones: prisma migrate deploy (NUNCA migrate dev)"
npx prisma migrate deploy

paso "Backend: build"
npm run build

paso "Backend: pm2 restart"
pm2 restart celestial-backend --update-env

# Sin `|| true`, un .env sin PORT (el de producción no lo tiene) hace que grep
# devuelva 1 y `pipefail` tumbe el despliegue después del restart (2026-10-02).
PUERTO=$(grep -E '^PORT=' .env | head -1 | cut -d= -f2- | tr -d '"'"' " || true)
PUERTO=${PUERTO:-4000}
paso "Backend: ¿responde?"
for i in $(seq 1 20); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PUERTO/api/parfums?page=1&limit=1"; then
    echo "✓ El backend responde en el puerto $PUERTO"; break
  fi
  if (( i == 20 )); then echo "✗ El backend no responde tras 40 s. Revisa: pm2 logs celestial-backend" >&2; exit 1; fi
  sleep 2
done

# ── 3. Frontend: build en una carpeta aparte y cambio de golpe ──────────────
# Se compila en dist-nuevo y solo al terminar reemplaza a dist. Antes se
# compilaba encima de dist: mientras tanto la tienda quedaba sin archivos, y si
# el build moría por memoria (ya pasó, sin avisar) quedaba rota.
cd "$REPO/frontend"
if cambio frontend/package-lock.json; then
  paso "Frontend: npm ci (cambiaron las dependencias)"
  npm ci --no-audit --no-fund
fi

paso "Frontend: build"
rm -rf dist-nuevo
npx tsc -b
npx vite build --outDir dist-nuevo --emptyOutDir
[[ -s dist-nuevo/index.html ]] || { echo "✗ El build del frontend no produjo index.html" >&2; exit 1; }
rm -rf dist-viejo
[[ -d dist ]] && mv dist dist-viejo
mv dist-nuevo dist
rm -rf dist-viejo
echo "✓ Frontend nuevo en su sitio"

paso "✓ Desplegado ${AHORA:0:7}"
