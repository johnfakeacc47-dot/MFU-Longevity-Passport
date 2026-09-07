/**
 * Centralised security-critical configuration checks.
 * Imported by app.module.ts (ConfigModule.validate -> production guard),
 * auth.module.ts (JwtModule factory) and jwt.strategy.ts (always-on secret check).
 */

export const MIN_SECRET_LENGTH = 32;
export const REQUIRED_ENCRYPTION_KEY_LENGTH = 32;

// Words that betray a committed placeholder / example secret.
const PLACEHOLDER_SECRET_PATTERN = /change|secret-key|dev|example/i;

/**
 * A secret is acceptable only when it is present, at least MIN_SECRET_LENGTH
 * characters long, and free of an obvious placeholder word. Type guard so callers
 * get `string` narrowing. Used always-on (every environment) by JwtStrategy and
 * the JwtModule factory, and (production only) by assertProductionConfig.
 */
export function isStrongSecret(
  secret: string | undefined | null,
): secret is string {
  return (
    typeof secret === 'string' &&
    secret.length >= MIN_SECRET_LENGTH &&
    !PLACEHOLDER_SECRET_PATTERN.test(secret)
  );
}

/**
 * Throw (listing every problem at once) when NODE_ENV=production and the
 * configuration is unsafe to run with. No-op in every other environment.
 *
 * `env` defaults to process.env; @nestjs/config passes its merged view
 * ({...(.env file), ...process.env}) so this also works before dotenv has
 * written to process.env.
 */
export function assertProductionConfig(
  env: Record<string, string | undefined> = process.env,
): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  const problems: string[] = [];

  if (!env.DATABASE_URL || env.DATABASE_URL.trim().length === 0) {
    problems.push('DATABASE_URL must be set.');
  }

  if (!isStrongSecret(env.JWT_SECRET)) {
    problems.push(
      `JWT_SECRET must be set, at least ${MIN_SECRET_LENGTH} characters, and free of placeholder words (change/secret-key/dev/example).`,
    );
  }

  if (env.DB_SYNCHRONIZE === 'true') {
    problems.push(
      'DB_SYNCHRONIZE must not be "true" in production - TypeORM schema sync can drop or rewrite columns and destroy data.',
    );
  }

  if (
    !env.ENCRYPTION_KEY ||
    env.ENCRYPTION_KEY.length !== REQUIRED_ENCRYPTION_KEY_LENGTH
  ) {
    problems.push(
      `ENCRYPTION_KEY must be exactly ${REQUIRED_ENCRYPTION_KEY_LENGTH} characters.`,
    );
  }

  if (!env.CORS_ORIGIN || env.CORS_ORIGIN.trim().length === 0) {
    problems.push(
      'CORS_ORIGIN must list the deployed frontend origin(s) - the localhost dev fallback is not acceptable in production.',
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to start: insecure production configuration:\n  - ${problems.join('\n  - ')}`,
    );
  }
}
