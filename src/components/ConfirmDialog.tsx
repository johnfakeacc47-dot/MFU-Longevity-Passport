import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes } from 'react-icons/fa';
import { useLanguage } from '../contexts/LanguageContext';
import '../styles/ConfirmDialog.css';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Body text (or any node). */
  message?: React.ReactNode;
  /** Large decorative icon above the title. */
  icon?: React.ReactNode;
  /** Label for the primary button. Defaults to common.confirm. */
  confirmLabel?: string;
  /**
   * Label for the secondary (cancel) button. Omit it to get a single-button
   * "notice" dialog — the replacement for a native alert().
   */
  cancelLabel?: string;
  /** Primary action. For a notice dialog this is also the dismiss action. */
  onConfirm: () => void;
  /** Dismiss: Escape, backdrop click, the X button and the cancel button. */
  onClose: () => void;
  variant?: 'default' | 'danger';
  /** Disables both buttons and shows a busy label on the primary one. */
  pending?: boolean;
  pendingLabel?: string;
  /** Inline error shown above the buttons (e.g. a failed network call). */
  error?: string | null;
}

/**
 * Small app-styled replacement for window.confirm()/alert(). Portals to
 * <body> so no page container's transform/overflow can trap it, closes on
 * Escape/backdrop/X, and traps initial focus on the primary button.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  icon,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
  variant = 'default',
  pending = false,
  pendingLabel,
  error,
}) => {
  const { t } = useLanguage();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    // Move focus into the dialog so keyboard/screen-reader users land on it.
    const frame = requestAnimationFrame(() => confirmRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      cancelAnimationFrame(frame);
    };
  }, [open, pending, onClose]);

  if (!open) return null;

  const isNotice = cancelLabel === undefined;

  return createPortal(
    <div
      className="confirm-dialog-backdrop"
      onClick={() => { if (!pending) onClose(); }}
    >
      <div
        className={`confirm-dialog confirm-dialog--${variant}`}
        role={isNotice ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="confirm-dialog-close"
          onClick={onClose}
          disabled={pending}
          aria-label={t('common.close')}
        >
          <FaTimes aria-hidden="true" />
        </button>

        {icon && <div className="confirm-dialog-icon" aria-hidden="true">{icon}</div>}
        <h3 id={titleId} className="confirm-dialog-title">{title}</h3>
        {message && <div className="confirm-dialog-message">{message}</div>}

        {error && (
          <p className="confirm-dialog-error" role="alert">{error}</p>
        )}

        <div className="confirm-dialog-actions">
          {!isNotice && (
            <button
              type="button"
              className="confirm-dialog-btn confirm-dialog-btn--secondary"
              onClick={onClose}
              disabled={pending}
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            className="confirm-dialog-btn confirm-dialog-btn--primary"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? (pendingLabel ?? t('common.loading')) : (confirmLabel ?? t('common.confirm'))}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
