import * as crypto from 'crypto';
import { ValueTransformer } from 'typeorm';

export class EncryptionTransformer implements ValueTransformer {
  private readonly algorithm = 'aes-256-gcm';
  // Use a 32-byte key for AES-256, in production this should be in .env
  private readonly key = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);

  to(value: any): string | null {
    if (value === null || value === undefined) {
      return value;
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(this.key), iv);
    
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
        Buffer.from(ivHex, 'hex')
      );
      
      decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
      
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // We assume mostly numbers or strings, attempt to parse if it was a number
      if (!isNaN(Number(decrypted)) && decrypted.trim() !== '') {
        return Number(decrypted);
      }
      
      return decrypted;
    } catch (error) {
      console.error('Decryption failed', error);
      return value; // Return original on failure
    }
  }
}
