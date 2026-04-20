import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  findUserByEmail,
  findUserByEmailAny,
  findUserByToken,
  createUser,
  activateUser,
} from '../repositories/auth.repository';
import type { LoginDTO, RegisterDTO } from '../types/auth.type';
import { transporter } from '../config/mailer';

const JWT_SECRET = process.env.JWT_SECRET ?? 'celestial_secret_key';
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

export const loginService = async (dto: LoginDTO) => {
  const user = await findUserByEmail(dto.email);
  if (!user) throw new Error('Credenciales inválidas o cuenta no activada');

  const valid = await bcrypt.compare(dto.password, user.password);
  if (!valid) throw new Error('Credenciales inválidas o cuenta no activada');

  const token = jwt.sign(
    { id: user.id, email: user.email, rol_id: user.rol_id },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  return { token, user: { id: user.id, nombre: user.nombre, apellido: user.apellido, email: user.email, rol_id: user.rol_id } };
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
  if (exists) throw new Error('El email ya está registrado');

  const hashedPassword = await bcrypt.hash(dto.password, 10);
  const verification_token = crypto.randomBytes(32).toString('hex');
  const token_expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const { id } = await createUser({ ...dto, hashedPassword, verification_token, token_expiry });

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

export const registerClientService = async (dto: Omit<RegisterDTO, 'rol_id'>) => {
  return doRegister({ ...dto, rol_id: 2 });
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
