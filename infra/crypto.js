import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
// Mesmos parâmetros do backend anterior: as senhas já salvas continuam válidas.
const SCRYPT_OPTIONS = { N: 1 << 14, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;

/** Formato: scrypt$<salt hex 32>$<hash hex 128>. */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password, encoded) {
  if (typeof encoded !== "string") return false;
  const [algorithm, saltHex, expectedHex] = encoded.split("$");
  if (
    algorithm !== "scrypt" ||
    !/^[0-9a-f]{32}$/i.test(saltHex) ||
    !/^[0-9a-f]{128}$/i.test(expectedHex)
  ) {
    return false;
  }
  const actual = await scrypt(
    password,
    Buffer.from(saltHex, "hex"),
    KEY_LENGTH,
    SCRYPT_OPTIONS,
  );
  return timingSafeEqual(actual, Buffer.from(expectedHex, "hex"));
}

export function generateToken(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

/** Tokens de sessão e de confirmação: 64 caracteres hexadecimais. */
export function isToken(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
}
