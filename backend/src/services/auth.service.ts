import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import {
  findUserByEmail,
  findUserByEmailAny,
  findUserByToken,
  createUser,
  createGoogleUser,
  activateUser,
  claimFichaUser,
} from '../repositories/auth.repository';
import type { LoginDTO, RegisterDTO } from '../types/auth.type';
import { vincularReferido } from '../repositories/referido.repository';
import { transporter } from '../config/mailer';
import logger from '../config/logger';

/**
 * Obtiene un secreto obligatorio de firma de tokens.
 * En producción falla en el arranque si no está configurado (evita usar
 * claves débiles por defecto de forma silenciosa). En desarrollo avisa y usa
 * un valor solo-dev para no bloquear a quien clona el repo sin .env.
 */
function requireSecret(name: 'JWT_SECRET' | 'REFRESH_SECRET'): string {
  const value = process.env[name];
  if (value && value.trim()) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} no está configurada: es obligatoria en producción`);
  }
  logger.warn(`${name} no configurada; usando un valor SOLO para desarrollo (inseguro)`);
  return `dev_only_${name.toLowerCase()}`;
}

const JWT_SECRET = requireSecret('JWT_SECRET');
const REFRESH_SECRET = requireSecret('REFRESH_SECRET');
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';

// Cliente reutilizable que valida los ID tokens contra el Client ID de la app.
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
const CLIENTE_ROL_ID = 2;

export const ACCESS_TOKEN_MAX_AGE = 8 * 60 * 60 * 1000; // 8h
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7d

function generateTokens(payload: { id: number; email: string; rol_id: number }) {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
  const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

export const loginService = async (dto: LoginDTO) => {
  const user = await findUserByEmail(dto.email);
  if (!user) throw new Error('Credenciales inválidas o cuenta no activada');

  const valid = await bcrypt.compare(dto.password, user.password);
  if (!valid) throw new Error('Credenciales inválidas o cuenta no activada');

  const tokenPayload = { id: user.id, email: user.email, rol_id: user.rol_id };
  const { accessToken, refreshToken } = generateTokens(tokenPayload);

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, nombre: user.nombre, apellido: user.apellido, email: user.email, rol_id: user.rol_id },
  };
};

/**
 * Inicia sesión (o registra) con una cuenta de Google.
 * Verifica criptográficamente el ID token contra Google y el Client ID de la app,
 * luego reutiliza el usuario existente o crea una cuenta ya activada.
 */
export const googleAuthService = async (credential: string) => {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('El inicio de sesión con Google no está configurado');
  }
  if (!credential || typeof credential !== 'string') {
    throw new Error('Token de Google no recibido');
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new Error('No se pudo verificar la cuenta de Google');
  }

  if (!payload?.email || !payload.email_verified) {
    throw new Error('La cuenta de Google no tiene un correo verificado');
  }

  const email = payload.email.toLowerCase();
  let user = await findUserByEmailAny(email);

  if (user?.sin_cuenta) {
    // Ficha creada por el admin con este correo: la persona la reclama con
    // Google y hereda todo su historial de ventas y créditos.
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    await claimFichaUser(user.id, { hashedPassword, activo: true });
    user = { ...user, activo: true, sin_cuenta: false };
  } else if (user) {
    // Cuenta creada por registro normal pero aún sin activar: Google la valida.
    if (!user.activo) {
      await activateUser(user.id);
      user = { ...user, activo: true };
    }
  } else {
    // Contraseña aleatoria: la cuenta solo se usa vía Google, no por contraseña.
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    const nombre = (payload.given_name ?? payload.name ?? 'Usuario').slice(0, 100);
    const apellido = (payload.family_name ?? '').slice(0, 100);
    user = await createGoogleUser({ nombre, apellido, email, hashedPassword, rol_id: CLIENTE_ROL_ID });
  }

  const { accessToken, refreshToken } = generateTokens({
    id: user.id,
    email: user.email,
    rol_id: user.rol_id,
  });

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, nombre: user.nombre, apellido: user.apellido, email: user.email, rol_id: user.rol_id },
  };
};

export const refreshService = (refreshToken: string) => {
  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET) as { id: number; email: string; rol_id: number };
    const { accessToken, refreshToken: newRefresh } = generateTokens({
      id: payload.id,
      email: payload.email,
      rol_id: payload.rol_id,
    });
    return { accessToken, refreshToken: newRefresh };
  } catch {
    throw new Error('Refresh token inválido o expirado');
  }
};

const doRegister = async (dto: RegisterDTO) => {
  if (!dto.nombre?.trim() || !dto.apellido?.trim()) {
    throw new Error('Nombre y apellido son obligatorios');
  }
  if (!dto.email?.trim() || !dto.password?.trim()) {
    throw new Error('Correo y contraseña son obligatorios');
  }
  if (dto.password.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres');
  }

  const exists = await findUserByEmailAny(dto.email);
  if (exists && !exists.sin_cuenta) throw new Error('El email ya está registrado');

  const hashedPassword = await bcrypt.hash(dto.password, 10);
  const verification_token = crypto.randomBytes(32).toString('hex');
  const token_expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  let id: number;
  if (exists) {
    // Ficha del admin con este correo: la persona la reclama al registrarse y
    // hereda su historial; igual debe verificar el correo para activarla.
    await claimFichaUser(exists.id, { hashedPassword, activo: false, verification_token, token_expiry });
    id = exists.id;
  } else {
    ({ id } = await createUser({ ...dto, hashedPassword, verification_token, token_expiry }));
  }

  const verifyUrl = `${FRONTEND_URL}/verify?token=${verification_token}`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM ?? 'Celestial Parfums <noreply@celestialparfums.com>',
    to: dto.email,
    subject: 'Activa tu cuenta – Celestial Parfums',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="color:#8b5cf6;margin-bottom:8px">Celestial Parfums</h2>
        <p>Hola <strong>${dto.nombre}</strong>, gracias por registrarte.</p>
        <p>Haz clic en el botón para activar tu cuenta:</p>
        <a href="${verifyUrl}"
           style="display:inline-block;padding:12px 28px;background:#8b5cf6;color:#fff;
                  border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
          Activar cuenta
        </a>
        <p style="color:#888;font-size:13px;margin-top:24px">
          Este enlace expira en 24 horas. Si no creaste esta cuenta, ignora este correo.
        </p>
      </div>
    `,
  });

  return { id };
};

export const registerAdminService = async (dto: RegisterDTO) => {
  return doRegister(dto);
};

export const registerClientService = async (dto: Omit<RegisterDTO, 'rol_id'>, ref?: string) => {
  const result = await doRegister({ ...dto, rol_id: 2 });
  // Programa de referidos: vincula al nuevo cliente con quien lo invitó (si aplica).
  if (ref) await vincularReferido(result.id, ref).catch(() => {});
  return result;
};

export const verifyEmailService = async (token: string) => {
  const user = await findUserByToken(token);
  if (!user) throw new Error('Token inválido o ya utilizado');

  if (!user.token_expiry || new Date() > new Date(user.token_expiry)) {
    throw new Error('El enlace de verificación ha expirado');
  }

  await activateUser(user.id);
  return { email: user.email };
};
