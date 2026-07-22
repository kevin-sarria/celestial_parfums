import crypto from 'crypto';

/**
 * TOTP estándar (RFC 6238, igual que Google Authenticator/Authy): 6 dígitos,
 * ventana de 30s, HMAC-SHA1. Implementado con el crypto de Node — cero
 * dependencias nuevas. Se usa como segundo candado del respaldo de la base.
 */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Secreto nuevo en base32 (el formato que piden las apps authenticator). */
export const generarSecretoBase32 = (bytes = 20): string => {
  const buf = crypto.randomBytes(bytes);
  let bits = 0;
  let val = 0;
  let out = '';
  for (const b of buf) {
    val = (val << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(val >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
};

const base32Decode = (s: string): Buffer => {
  const limpio = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let val = 0;
  const bytes: number[] = [];
  for (const ch of limpio) {
    val = (val << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((val >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

const hotp = (secret: Buffer, counter: number): string => {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', secret).update(msg).digest();
  const off = h[h.length - 1] & 0xf;
  const code =
    (((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3]) % 1_000_000;
  return String(code).padStart(6, '0');
};

/** Acepta el paso actual y ±1 (tolera relojes ligeramente desfasados). */
export const verificarTotp = (secretB32: string, codigo: string): boolean => {
  const limpio = codigo.replace(/\D/g, '');
  if (limpio.length !== 6) return false;
  const secret = base32Decode(secretB32);
  if (secret.length === 0) return false;
  const paso = Math.floor(Date.now() / 30_000);
  for (const d of [-1, 0, 1]) {
    if (crypto.timingSafeEqual(Buffer.from(hotp(secret, paso + d)), Buffer.from(limpio))) {
      return true;
    }
  }
  return false;
};

/** URL otpauth:// para registrar la cuenta en la app authenticator. */
export const otpauthUrl = (secretB32: string, cuenta: string, emisor: string): string =>
  `otpauth://totp/${encodeURIComponent(emisor)}:${encodeURIComponent(cuenta)}` +
  `?secret=${secretB32}&issuer=${encodeURIComponent(emisor)}&algorithm=SHA1&digits=6&period=30`;
