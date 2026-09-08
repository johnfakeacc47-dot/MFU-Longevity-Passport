import React, { useState } from 'react';
import { FaEye, FaEyeSlash, FaLeaf, FaRocket } from 'react-icons/fa';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { DevLoginModal } from '../components/DevLoginModal';

interface LoginProps {
  onLoginSuccess: () => void;
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
          email: username,
          password: password,
        });
        if (supaError) { setError(supaError.message); return; }
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
          email: username,
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
          setError(supaError.message);
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
        redirectTo: window.location.origin,
      });
      // Always show the same message — don't leak whether the email exists.
      setMessage(t('login.resetSent'));
    } catch {
      setMessage(t('login.resetSent'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Animated background blobs */}
      <div className="login-bg">
        <div className="login-blob login-blob-1" />
        <div className="login-blob login-blob-2" />
        <div className="login-blob login-blob-3" />
      </div>

      <div className="login-card-v2">
        {/* Logo */}
        <div className="login-logo-v2">
          <div className="login-logo-icon">
            <FaLeaf className="login-leaf-icon" />
          </div>
          <div className="login-logo-text">
            <span className="login-brand-name">MFU</span>
            <span className="login-brand-sub">Longevity Passport</span>
          </div>
        </div>

        {/* Headline */}
        <div className="login-headline">
          <h1 className="login-title-v2">
            {isSignUp ? t('login.createTitle') : t('login.welcomeText1')}
          </h1>
          <p className="login-subtitle-v2">
            {isSignUp ? t('login.createSubtitle') : t('login.subtitle')}
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="login-alert login-alert--error" role="alert">
            <span>⚠️</span> {error}
          </div>
        )}
        {message && (
          <div className="login-alert login-alert--success" role="alert">
            <span>✅</span> {message}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleAuth} autoComplete="off" className="login-form-v2">
          <div className="login-field">
            <label htmlFor="email" className="login-label">{t('login.email')}</label>
            <input
              id="email"
              type="email"
              placeholder={t('login.emailPlaceholder')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="new-email"
              required
              className="login-input-v2"
            />
          </div>

          <div className="login-field">
            <label htmlFor="password" className="login-label">{t('login.password')}</label>
            <div className="login-password-wrap">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={t('login.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                className="login-input-v2"
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={`login-submit-btn ${isLoading ? 'login-submit-btn--loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading
              ? t('login.pleaseWait')
              : isSignUp ? t('login.createButton') : t('login.loginButton')}
          </button>
        </form>

        {/* Divider */}
        <div className="login-divider">
          <span className="login-divider-line" />
          <span className="login-divider-text">{t('login.or')}</span>
          <span className="login-divider-line" />
        </div>

        {/* Google Login */}
        <button
          type="button"
          className="login-google-btn"
          onClick={async () => {
            try {
              if (!supabase) { setError(t('login.errOffline')); return; }
              const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                // Keep the path + query (e.g. `/?add=<handle>` invite links) across the round-trip.
                options: { redirectTo: window.location.origin + window.location.pathname + window.location.search },
              });
              if (error) setError(error.message);
            } catch (err: any) {
              setError(err.message || 'Google login failed');
            }
          }}
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="login-google-icon"
          />
          {t('login.google')}
        </button>

        {/* Footer */}
        <div className="login-footer-v2">
          {/* Forgot-password only makes sense when signing in */}
          {!isSignUp && (
            <button
              type="button"
              className="login-forgot-btn"
              onClick={handleForgotPassword}
              disabled={isLoading}
            >
              {t('login.forgotPassword')}
            </button>
          )}

          <p className="login-switch-text">
            {isSignUp ? t('login.haveAccount') : t('login.noAccount')}{' '}
            <button
              type="button"
              className="login-switch-btn"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setMessage('');
                setPassword('');
              }}
            >
              {isSignUp ? t('login.switchToLogin') : t('login.switchToSignup')}
            </button>
          </p>
        </div>

        {/* Developer Quick Access (ONLY visible in Dev/Test environments) */}
        {isDevEnv && (
          <div className="login-dev-section">
            <div className="login-divider" style={{ marginTop: 24, marginBottom: 16 }}>
              <span className="login-divider-line" />
              <span className="login-divider-text">OR</span>
              <span className="login-divider-line" />
            </div>
            <button
              type="button"
              className="login-dev-btn"
              onClick={() => setShowDevModal(true)}
              aria-label="Developer Quick Access"
            >
              <FaRocket className="login-dev-icon" />
              <span>Developer access</span>
            </button>
          </div>
        )}

        {/* Dev Login Modal */}
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
