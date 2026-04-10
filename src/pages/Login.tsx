import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

import { useLanguage } from '../contexts/LanguageContext';

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
  const { t } = useLanguage();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    // Validation
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (!password) {
      setError('Password is required');
      return;
    }

    // Try Supabase Auth First
    if (isSupabaseConfigured()) {
      if (isSignUp) {
        const { data, error: supaError } = await supabase!.auth.signUp({
          email: username,
          password: password,
        });
        if (supaError) {
          setError(supaError.message);
          return;
        }
        if (data && data.user) {
          if (data.user?.identities?.length === 0) {
            setError('An account with this email address already exists.');
            return;
          }

          // Safety-net: create the profiles row from the frontend.
          // Uses upsert so it won't clash if the DB trigger already created it.
          try {
            await supabase!.from('profiles').upsert({
              id: data.user.id,
              email: data.user.email || username,
              name: '',
              role: 'student',
              total_points: 0,
            }, { onConflict: 'id' });
          } catch (profileErr) {
            console.warn('Profile auto-create fallback failed (trigger may handle it):', profileErr);
          }

          setMessage('Signup successful! Check your email, or log in directly if auto-confirmed.');
          setIsSignUp(false); // Switch back to login
          setPassword('');
          return;
        }
      } else {
        const { data, error: supaError } = await supabase!.auth.signInWithPassword({
          email: username,
          password: password
        });
        if (data && data.session && data.user) {
          localStorage.setItem('authToken', data.session.access_token);
          localStorage.setItem('userEmail', data.user.email || username);
          localStorage.setItem('userId', data.user.id);
          localStorage.removeItem('profileData'); // Clear old profile cache
          setUsername('');
          setPassword('');
          onLoginSuccess();
          return;
        }
        if (supaError) {
          setError(supaError.message);
          console.warn('Supabase login failed, falling back to mock...', supaError.message);
        }
      }
    } else {
      setError('System is offline or Supabase is not configured.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="logo-section">
          <div className="logo-squares">
            <div className="square"></div>
            <div className="square"></div>
            <div className="square"></div>
          </div>
          <div className="logo-leaf"></div>
        </div>

        <h1>Longevity Tracker</h1>
        <p className="subtitle">Health Up</p>

        <div className="login-form">
          <p className="welcome-text">
            {t('login.welcomeText1')}
            <br />
            {t('login.welcomeText2')}
          </p>
          <p className="subtext">{t('login.subtitle')}</p>

          {error && <div className="error-message">{error}</div>}
          {message && <div className="success-message" style={{ color: '#1976D2', background: '#E3F2FD', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', textAlign: 'center' }}>{message}</div>}

          <form onSubmit={handleAuth} autoComplete="off">
            <div className="form-group">
              <input
                type="email"
                placeholder={isSignUp ? "Email Address for Sign Up" : "Email Address"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="new-email"
                required
              />
            </div>

            <div className="form-group password-group" style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                style={{ paddingRight: '40px' }}
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#1976D2' }}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <button type="submit" className="login-btn">
              {isSignUp ? "Complete Sign Up" : t('login.loginButton')}
            </button>
          </form>

          <div className="login-footer" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div className="social-login-separator">OR</div>
            
            <button 
              type="button" 
              className="google-btn"
              onClick={async () => {
                try {
                  const { error } = await supabase!.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                      redirectTo: window.location.origin
                    }
                  });
                  if (error) setError(error.message);
                } catch (err: any) {
                  setError(err.message || 'An error occurred during Google login');
                }
              }}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
              Continue with Google
            </button>

            <p className="forgot-password" style={{ margin: '10px 0 0' }}>{t('login.forgotPassword')}</p>
            
            <p style={{ margin: 0, fontSize: '14px', color: '#1976D2' }}>
              {isSignUp ? "Already have an account? " : "Don't have an account? "}
              <button 
                type="button" 
                onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage(''); setPassword(''); }}
                style={{ background: 'none', border: 'none', color: '#1976D2', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: '14px', textDecoration: 'underline' }}
              >
                {isSignUp ? "Login" : "Sign Up"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

