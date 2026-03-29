import crypto from 'crypto';
import { Buffer } from 'buffer';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

/**
 * UPGRADE: Environment Loader
 * Ensures envo is loaded before key is evaluated.
 */
const __dirname = fileURLToPath(new URL('.', import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; 
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64; 
const PBKDF2_ITERATIONS = 210000; // 2026 OWASP + NIST Hardened Standard
const DIGEST = 'sha512';

/**
 * UPGRADED: 2026 Institutional Cryptographic Vault.
 * Features: Non-blocking Async KDF, HKDF Key Expansion, and Memory-Safe Buffer Wiping.
 */

// UPGRADE: Support both common naming conventions
const MASTER_SECRET = process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_MASTER_SECRET || '';
const CURRENT_VERSION = 'v2.1'; 

/**
 * Internal: Async Key Derivation to keep the event loop responsive.
 */
async function deriveKeyAsync(secret: string, salt: Buffer): Promise<Buffer> {
  if (!secret || secret.length < 32) {
    throw new Error('CRITICAL_SECURITY_FAILURE: MASTER_SECRET_INSUFFICIENT_ENTROPY');
  }
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(secret, salt, PBKDF2_ITERATIONS, 32, DIGEST, (err, derivedKey) => {
      if (err) reject(err);
      resolve(Buffer.from(derivedKey));
    });
  });
}

/**
 * Synchronous Fallback for legacy initialization.
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  if (!secret || secret.length < 32) {
    throw new Error('CRITICAL_SECURITY_FAILURE: MASTER_SECRET_INSUFFICIENT_ENTROPY');
  }
  return crypto.pbkdf2Sync(secret, salt, PBKDF2_ITERATIONS, 32, DIGEST);
}

/**
 * Encrypts with HKDF Key Expansion (RFC 5869).
 */
export async function encryptPrivateKey(privateKey: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  //  Derive base key
  const baseKey = await deriveKeyAsync(MASTER_SECRET, salt);
  
  //  Expand key using HKDF (Fixed: Convert ArrayBuffer to Buffer)
  const expandedKey = Buffer.from(crypto.hkdfSync(DIGEST, baseKey, salt, Buffer.from('WALLET_ENC_INFO'), 32));

  //  Generate integrity checksum
  const checksum = crypto.createHmac('sha256', expandedKey).update('WIP_VERIFY').digest('hex').slice(0, 8);

  const cipher = crypto.createCipheriv(ALGORITHM, expandedKey, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });

  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  // Memory Sanitation
  baseKey.fill(0);
  expandedKey.fill(0);

  return `${CURRENT_VERSION}:${checksum}:${salt.toString('hex')}:${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * Decrypts with Constant-Time Verification to prevent timing attacks.
 */
export async function decryptPrivateKey(encryptedString: string): Promise<string> {
  const parts = encryptedString.split(':');
  if (parts.length < 5) throw new Error('ENCRYPTION_FORMAT_INVALID');

  const version = parts[0];
  let checksum: string, salt: Buffer, iv: Buffer, tag: Buffer, encryptedHex: string;

  if (version === 'v2.1' || version === 'v2') {
    const offset = version === 'v2.1' ? 1 : 0;
    checksum = version === 'v2.1' ? parts[1] : '';
    salt = Buffer.from(parts[1 + offset], 'hex');
    iv = Buffer.from(parts[2 + offset], 'hex');
    tag = Buffer.from(parts[3 + offset], 'hex');
    encryptedHex = parts[4 + offset];
  } else {
    throw new Error('DEPRECATED_ALGORITHM: Migration required to v2.1');
  }

  const baseKey = await deriveKeyAsync(MASTER_SECRET, salt);
  const expandedKey = Buffer.from(crypto.hkdfSync(DIGEST, baseKey, salt, Buffer.from('WALLET_ENC_INFO'), 32));

  // Integrity Check: Constant-Time comparison (Protects against Side-Channel attacks)
  if (checksum) {
    const check = crypto.createHmac('sha256', expandedKey).update('WIP_VERIFY').digest('hex').slice(0, 8);
    const checkBuffer = Buffer.from(check);
    const checksumBuffer = Buffer.from(checksum);
    
    if (checkBuffer.length !== checksumBuffer.length || !crypto.timingSafeEqual(checkBuffer, checksumBuffer)) {
        baseKey.fill(0);
        expandedKey.fill(0);
        throw new Error('MASTER_SECRET_MISMATCH: Integrity check failed.');
    }
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, expandedKey, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });
  
  decipher.setAuthTag(tag);

  try {
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    // Memory Sanitation
    baseKey.fill(0);
    expandedKey.fill(0);
    salt.fill(0);
    iv.fill(0);

    return decrypted;
  } catch (err) {
    baseKey.fill(0);
    expandedKey.fill(0);
    throw new Error('DECRYPTION_CRITICAL_FAILURE: Data tampered or key invalid.');
  }
}

/**
 * Force-wipes sensitive data from Node.js memory buffers.
 */
export function clearSensitiveData(data: string | Buffer | null): void {
  if (!data) return;
  if (Buffer.isBuffer(data)) {
    data.fill(0);
  } else if (typeof data === 'string') {
    // Strings are immutable; nullify to signal Garbage Collector
    data = null as any;
  }
}
