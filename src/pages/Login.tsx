import React, { useState } from 'react';
import { AlertTriangle, CircleCheck, Activity, Leaf, Smile, Moon, Mail, Lock, Eye, EyeOff, Shield, Rocket } from 'lucide-react';
import { IconChip, ICON_PROPS } from '../components/v2';
import { BrandLogo } from '../components/BrandLogo';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { DevLoginModal } from '../components/DevLoginModal';

interface LoginProps {
  onLoginSuccess: () => void;
}

// Supabase returns raw English API error text (e.g. "email rate limit
// exceeded", "Invalid login credentials") — shown verbatim before, this
// leaked English into the Thai UI (QA-001) and made a routine, expected
// failure like a signup rate limit read as "email auth is broken" (QA-006).
// Map the known cases to a translated, actionable message; anything
// unrecognized still gets a translated generic message, never raw English.
function friendlyAuthError(message: string, t: (key: string) => string): string {
  const m = (message || '').toLowerCase();
  if (m.includes('rate limit')) return t('login.errRateLimited');
  if (m.includes('invalid login credentials')) return t('login.errInvalidCredentials');
  if (m.includes('email not confirmed')) return t('login.errNotConfirmed');
  if (m.includes('already registered') || m.includes('already exists')) return t('login.errEmailExists');
  return t('login.errGeneric');
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDevModal, setShowDevModal] = useState(false);
  const { t } = useLanguage();
  useSEO(`${t('login.welcome')} · MFU Longevity Passport`, t('login.subtitle'));

  // Dev Quick Login is available ONLY in a local `vite` dev build.
  // import.meta.env.DEV is a hard compile-time boolean (false in every production
  // build regardless of env vars), so a stray VITE_ENABLE_* var set in a prod
  // deploy can no longer reveal the dev-admin login.
  const isDevEnv = import.meta.env.DEV === true;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    if (!username.trim()) { setError(t('login.errEmailRequired')); setIsLoading(false); return; }
    if (!password)        { setError(t('login.errPasswordRequired')); setIsLoading(false); return; }

    try {
      if (!isSupabaseConfigured()) {
        setError(t('login.errOffline'));
        return;
      }

      if (isSignUp) {
        const { data, error: supaError } = await supabase!.auth.signUp({
          email: username.trim(),
          password: password,
          // Without this the confirmation link always opened the Site URL (the
          // Vercel app), even for people who signed up on longevity.mfu.ac.th.
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (supaError) { setError(friendlyAuthError(supaError.message, t)); return; }
        if (data?.user) {
          if (data.user?.identities?.length === 0) {
            setError(t('login.errEmailExists'));
            return;
          }
          try {
            await supabase!.from('profiles').upsert({
              id: data.user.id,
              email: data.user.email || username,
              name: '',
            }, { onConflict: 'id' });
          } catch (profileErr) {
            console.warn('Profile auto-create fallback failed:', profileErr);
          }
          setMessage(t('login.accountCreated'));
          setIsSignUp(false);
          setPassword('');
        }
      } else {
        const { data, error: supaError } = await supabase!.auth.signInWithPassword({
          email: username.trim(),
          password: password,
        });
        if (data?.session && data?.user) {
          localStorage.setItem('authToken', data.session.access_token);
          localStorage.setItem('userEmail', data.user.email || username);
          localStorage.setItem('userId', data.user.id);
          localStorage.removeItem('profileData');
          setUsername('');
          setPassword('');
          onLoginSuccess();
          return;
        }
        if (supaError) {
          setError(friendlyAuthError(supaError.message, t));
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setMessage('');
    if (!username.trim()) { setError(t('login.resetNeedEmail')); return; }
    if (!isSupabaseConfigured()) { setError(t('login.errOffline')); return; }
    setIsLoading(true);
    try {
      await supabase!.auth.resetPasswordForEmail(username.trim(), {
        // Trailing slash so it matches the `https://<host>/**` Redirect URL
        // entries in Supabase Auth; an unmatched redirect silently falls back
        // to the Site URL (the Vercel app) — wrong for the MFU-hosted site.
        redirectTo: `${window.location.origin}/`,
      });
      // Always show the same message — don't leak whether the email exists.
      setMessage(t('login.resetSent'));
    } catch {
      setMessage(t('login.resetSent'));
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setMessage('');
    setPassword('');
  };

  const handleGoogle = async () => {
    try {
      if (!supabase) { setError(t('login.errOffline')); return; }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        // Keep the path + query (e.g. `/?add=<handle>` invite links) across the round-trip.
        options: { redirectTo: window.location.origin + window.location.pathname + window.location.search },
      });
      if (error) setError(friendlyAuthError(error.message, t));
    } catch (err: any) {
      setError(friendlyAuthError(err?.message || '', t));
    }
  };

  return (
    <div className="v2-page v2-page--nonav v2-login">
      <div className="v2-login-inner">
        <div className="v2-login-top" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <span className="v2-logo"><BrandLogo size={30} decorative /></span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h1>MFU Longevity Passport</h1>
            <p className="v2-muted" style={{ fontSize: 16 }}>
              {isSignUp ? t('login.createSubtitle') : t('login.subtitle')}
            </p>
          </div>
          <div className="v2-pillars" aria-hidden="true">
            <IconChip pillar="act"><Activity size={22} {...ICON_PROPS} /></IconChip>
            <IconChip pillar="food"><Leaf size={22} {...ICON_PROPS} /></IconChip>
            <IconChip pillar="mind"><Smile size={22} {...ICON_PROPS} /></IconChip>
            <IconChip pillar="sleep"><Moon size={22} {...ICON_PROPS} /></IconChip>
          </div>
        </div>

        {error && (
          <div className="v2-alert v2-alert--error" role="alert">
            <AlertTriangle size={18} {...ICON_PROPS} /> <span>{error}</span>
          </div>
        )}
        {message && (
          <div className="v2-alert v2-alert--ok" role="alert">
            <CircleCheck size={18} {...ICON_PROPS} /> <span>{message}</span>
          </div>
        )}

        {/* autocomplete hints let password managers fill sign-in and offer to
            save a new password on sign-up. */}
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="v2-field">
            <label htmlFor="email" className="v2-label">{t('login.email')}</label>
            <div className="v2-input-wrap">
              <Mail className="v2-input-icon" size={20} {...ICON_PROPS} />
              <input
                id="email"
                type="email"
                className="v2-input v2-input--icon"
                placeholder={t('login.emailPlaceholder')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete={isSignUp ? 'email' : 'username'}
                required
              />
            </div>
          </div>

          <div className="v2-field">
            <label htmlFor="password" className="v2-label">{t('login.password')}</label>
            <div className="v2-input-wrap">
              <Lock className="v2-input-icon" size={20} {...ICON_PROPS} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="v2-input v2-input--icon"
                placeholder={t('login.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                required
                style={{ paddingRight: 52 }}
              />
              <button
                type="button"
                className="v2-iconbtn v2-input-end"
                style={{ border: 0, background: 'transparent' }}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={20} {...ICON_PROPS} /> : <Eye size={20} {...ICON_PROPS} />}
              </button>
            </div>
          </div>

          {/* Forgot-password only makes sense when signing in */}
          {!isSignUp && (
            <div className="v2-link-row">
              <button type="button" className="v2-link" onClick={handleForgotPassword} disabled={isLoading}>
                {t('login.forgotPassword')}
              </button>
            </div>
          )}

          <button type="submit" className="v2-btn v2-btn--primary" disabled={isLoading} style={{ marginTop: 4 }}>
            {isLoading ? t('login.pleaseWait') : isSignUp ? t('login.createButton') : t('login.loginButton')}
          </button>
          <button type="button" className="v2-btn v2-btn--ghost" onClick={switchMode}>
            {isSignUp ? t('login.switchToLogin') : t('v2.login.createAccount')}
          </button>
        </form>

        <button type="button" className="v2-btn v2-btn--ghost" onClick={handleGoogle}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" width={20} height={20} />
          {t('login.google')}
        </button>

        {/* Developer Quick Access (ONLY visible in Dev/Test environments) */}
        {isDevEnv && (
          <button type="button" className="v2-btn v2-btn--ghost" onClick={() => setShowDevModal(true)} aria-label="Developer Quick Access">
            <Rocket size={18} {...ICON_PROPS} /> Developer access
          </button>
        )}

        <div className="v2-note v2-login-foot">
          <Shield size={20} {...ICON_PROPS} />
          <span>{t('v2.login.privacy')}</span>
        </div>

        <DevLoginModal
          isOpen={showDevModal}
          onClose={() => setShowDevModal(false)}
          onSuccess={() => {
            setShowDevModal(false);
            onLoginSuccess();
          }}
        />
      </div>
    </div>
  );
};
