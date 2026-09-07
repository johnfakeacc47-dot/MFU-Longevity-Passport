import * as crypto from 'crypto';
import { ValueTransformer } from 'typeorm';

// AES-256-GCM needs a 32-byte key. `Buffer.from(key)` below reads it as utf8,
// so the env value must be exactly 32 characters.
const REQUIRED_KEY_LENGTH = 32;

export class EncryptionTransformer implements ValueTransformer {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: string;

  constructor() {
    const key = process.env.ENCRYPTION_KEY;
    // Previously this silently fell back to `crypto.randomBytes(...)` generated fresh
    // in-process — a NEW random key every server restart. That doesn't just weaken
    // security: every previously-encrypted row (meal.imageUrl, health_log.data) becomes
    // permanently undecryptable the moment the process restarts, and `from()` below
    // swallows the decrypt failure and silently returns the raw ciphertext as if it
    // were real data. Failing loudly at startup is far safer than corrupting data silently.
    if (!key || key.length !== REQUIRED_KEY_LENGTH) {
      throw new Error(
        `ENCRYPTION_KEY must be set to a ${REQUIRED_KEY_LENGTH}-character string (see backend/.env.example — ` +
          `generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex').slice(0,32))"). ` +
          'A missing or wrong-length key used to fall back to a random one generated on every restart, which ' +
          'silently corrupts all previously-encrypted data.',
      );
    }
    this.key = key;
  }

  to(value: any): string | null {
    if (value === null || value === undefined) {
      return value;
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      Buffer.from(this.key),
      iv,
    );

    let encrypted = cipher.update(String(value), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  from(value: string | null): any {
    if (!value) {
      return value;
    }

    try {
      const parts = value.split(':');
      if (parts.length !== 3) {
        // If it's not encrypted, just return the value (for backward compatibility if data exists)
        return value;
      }

      const [ivHex, authTagHex, encryptedHex] = parts;

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        Buffer.from(this.key),
        Buffer.from(ivHex, 'hex'),
      );

      decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      // We assume mostly numbers or strings, attempt to parse if it was a number
      if (!isNaN(Number(decrypted)) && decrypted.trim() !== '') {
        return Number(decrypted);
      }

      return decrypted;
    } catch {
      // A decrypt failure means the ciphertext is corrupt or ENCRYPTION_KEY has
      // been changed. Never hand back the raw ciphertext as if it were plaintext:
      // that silently corrupts reads and can leak encrypted blobs through the API.
      // Fail loud; do not log the value or the underlying error object.
      throw new Error(
        'Failed to decrypt an encrypted column value (ENCRYPTION_KEY changed or data corrupt).',
      );
    }
  }
}
