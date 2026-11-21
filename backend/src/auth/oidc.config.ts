/**
 * OIDC is "configured" only when every setting that passport-openidconnect's
 * Strategy constructor needs is present and non-empty. That constructor throws a
 * synchronous TypeError ("OpenIDConnectStrategy requires an issuer option", and
 * the same for authorizationURL / tokenURL / clientID) - verified in
 * node_modules/passport-openidconnect/lib/strategy.js lines 30-34 - which would
 * crash the entire Nest bootstrap (health API included) if OidcStrategy were
 * registered unconditionally. AuthModule uses this to decide whether to register
 * OidcStrategy + the /auth/login and /auth/callback routes at all.
 *
 * NOTE: evaluated at module-load time (before Nest's ConfigModule runs), so
 * main.ts and the seed scripts must `import 'dotenv/config'` as their first
 * import for a local .env to be visible here.
 */
const REQUIRED_OIDC_KEYS = [
  'OIDC_ISSUER',
  'OIDC_AUTH_URL',
  'OIDC_TOKEN_URL',
  'OIDC_USERINFO_URL',
  'OIDC_CLIENT_ID',
  'OIDC_CLIENT_SECRET',
] as const;

export function isOidcConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return REQUIRED_OIDC_KEYS.every((key) => {
    const value = env[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}
