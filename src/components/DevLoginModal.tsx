import React, { useState, useEffect, useRef } from 'react';
import { FaRocket, FaTimes, FaCheck, FaExclamationTriangle } from 'react-icons/fa';

interface DevLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const DevLoginModal: React.FC<DevLoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
      setIsLoading(false);
      setIsShaking(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setError('');
    setIsLoading(true);

    // Simulate short transition for realistic loading feel
    setTimeout(() => {
      const validPin =
        import.meta.env.VITE_DEV_LOGIN_PIN ||
        import.meta.env.DEV_ACCESS_PIN ||
        '3333';

      if (pin.trim() === String(validPin).trim()) {
        // Create dev user session in local storage (bypass Supabase completely)
        const devUser = {
          id: 'dev-user',
          name: 'Developer',
          email: 'dev@mfu.local',
          role: 'admin',
          total_points: 999,
          is_score_public: true,
        };

        localStorage.setItem('authToken', 'dev-mock-token');
        localStorage.setItem('userId', devUser.id);
        localStorage.setItem('userEmail', devUser.email);
        localStorage.setItem('profileData', JSON.stringify(devUser));

        setIsLoading(false);
        onSuccess();
      } else {
        setIsLoading(false);
        setError('Invalid PIN');
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 600);
        setPin('');
        inputRef.current?.focus();
      }
    }, 400);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="modal-overlay dev-modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div
        className={`modal-card dev-modal-card ${isShaking ? 'dev-modal-shake' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header-v2 dev-modal-header">
          <div className="dev-modal-title-wrap">
            <div className="dev-modal-icon-wrap">
              <FaRocket className="dev-modal-icon" />
            </div>
            <div>
              <h3 className="modal-title">Developer Access</h3>
              <p className="dev-modal-subtitle">Enter 4-digit access PIN</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="dev-modal-body">
          {error && (
            <div className="dev-modal-error" role="alert">
              <FaExclamationTriangle />
              <span>{error}</span>
            </div>
          )}

          <div className="dev-pin-input-container">
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setPin(val);
                if (error) setError('');
              }}
              className="dev-pin-input"
              disabled={isLoading}
            />
          </div>

          <div className="dev-modal-actions">
            <button
              type="button"
              className="modal-btn modal-btn--cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`modal-btn dev-btn-access ${isLoading ? 'dev-btn-loading' : ''}`}
              disabled={isLoading || pin.length !== 4}
            >
              {isLoading ? (
                <>
                  <span className="dev-spinner" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <FaCheck />
                  <span>Access Mode</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
