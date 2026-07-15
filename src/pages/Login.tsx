import React, { useState } from 'react';
import { FaEye, FaEyeSlash, FaLeaf, FaRocket } from 'react-icons/fa';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
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

  // Check if we are in a development/testing environment
  const isDevEnv =
    import.meta.env.DEV ||
    import.meta.env.MODE !== 'production' ||
    import.meta.env.VITE_ENABLE_DEV_LOGIN === 'true' ||
    import.meta.env.VITE_ENABLE_DEV_ACCESS === 'true';

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    if (!username.trim()) { setError('Email is required'); setIsLoading(false); return; }
    if (!password)        { setError('Password is required'); setIsLoading(false); return; }

    try {
      if (!isSupabaseConfigured()) {
        setError('System is offline or Supabase is not configured.');
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
            setError('An account with this email already exists.');
            return;
          }
          try {
            await supabase!.from('profiles').upsert({
              id: data.user.id,
              email: data.user.email || username,
              name: '',
              role: 'student',
              total_points: 0,
            }, { onConflict: 'id' });
          } catch (profileErr) {
            console.warn('Profile auto-create fallback failed:', profileErr);
          }
          setMessage('Account created! Check your email, or log in if auto-confirmed.');
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
            {isSignUp ? 'Create Account' : t('login.welcomeText1')}
          </h1>
          <p className="login-subtitle-v2">
            {isSignUp
              ? 'Start your longevity journey'
              : t('login.subtitle')}
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
            <label htmlFor="email" className="login-label">Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="new-email"
              required
              className="login-input-v2"
            />
          </div>

          <div className="login-field">
            <label htmlFor="password" className="login-label">Password</label>
            <div className="login-password-wrap">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Your password"
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
              ? 'Please wait...'
              : isSignUp ? 'Create Account' : t('login.loginButton')}
          </button>
        </form>

        {/* Divider */}
        <div className="login-divider">
          <span className="login-divider-line" />
          <span className="login-divider-text">or</span>
          <span className="login-divider-line" />
        </div>

        {/* Google Login */}
        <button
          type="button"
          className="login-google-btn"
          onClick={async () => {
            try {
              if (!supabase) { setError('Supabase not configured'); return; }
              const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin },
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
          Continue with Google
        </button>

        {/* Footer */}
        <div className="login-footer-v2">
          <button
            type="button"
            className="login-forgot-btn"
          >
            {t('login.forgotPassword')}
          </button>

          <p className="login-switch-text">
            {isSignUp ? "Already have an account? " : "Don't have an account? "}
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
              {isSignUp ? 'Log in' : 'Sign up'}
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
              <span>เข้าใช้งานสำหรับ Developer</span>
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

