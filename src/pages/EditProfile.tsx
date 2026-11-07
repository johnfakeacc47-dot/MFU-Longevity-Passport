import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';
import { isSupabaseConfigured, getCurrentUserProfile, updateCurrentUserProfile } from '../services/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { safeParse } from '../utils/safeStorage';
import { BottomNav } from '../components/BottomNav';
import { BackButton } from '../components/BackButton';

type PageType = 'login' | 'home' | 'eating' | 'dashboard' | 'team' | 'profile' | 'edit-profile'

interface EditProfileProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

const ACTIVITY_OPTIONS = [
  { value: 'sedentary',   labelKey: 'profile.actSedentary' },
  { value: 'light',       labelKey: 'profile.actLight' },
  { value: 'moderate',    labelKey: 'profile.actModerate' },
  { value: 'active',      labelKey: 'profile.actActive' },
  { value: 'very_active', labelKey: 'profile.actVeryActive' },
];

// Plausible human ranges; anything outside is almost certainly a typo
// (e.g. height typed in metres, weight in grams).
const HEIGHT_MIN = 50;
const HEIGHT_MAX = 250;
const WEIGHT_MIN = 20;
const WEIGHT_MAX = 300;

type FieldErrors = { fullName?: string; heightCm?: string; weightKg?: string };
type Status = { type: 'success' | 'error'; text: string } | null;

const fieldErrorStyle: React.CSSProperties = { color: '#EF4444', fontSize: 12, marginTop: 6, display: 'block' };
const hintStyle: React.CSSProperties = { color: 'var(--text-secondary)', fontSize: 12, marginTop: 6, display: 'block' };

export const EditProfile: React.FC<EditProfileProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const { t } = useLanguage();
  useSEO(`${t('editProfile.title')} · MFU Longevity Passport`, 'Update your personal information.');
  const [fullName, setFullName]         = useState('');
  const [email, setEmail]               = useState('');
  const [birthDate, setBirthDate]       = useState('');
  const [gender, setGender]             = useState('');
  const [heightCm, setHeightCm]         = useState('');
  const [weightKg, setWeightKg]         = useState('');
  const [activityLevel, setActivityLevel] = useState('moderate');
  const [loading, setLoading]           = useState(false);
  const [fetching, setFetching]         = useState(true);
  const [loadError, setLoadError]       = useState(false);
  const [status, setStatus]             = useState<Status>(null);
  const [fieldErrors, setFieldErrors]   = useState<FieldErrors>({});
  const navTimer = useRef<number | null>(null);

  const fetchProfile = useCallback(async () => {
    setFetching(true);
    setLoadError(false);
    try {
      if (isSupabaseConfigured()) {
        const dbProfile = await getCurrentUserProfile();
        if (dbProfile) {
          setFullName(dbProfile.name || '');
          setEmail(dbProfile.email || '');
          setBirthDate(dbProfile.birth_date || '');
          setGender(dbProfile.gender || '');
          setHeightCm(dbProfile.height_cm ? String(dbProfile.height_cm) : '');
          setWeightKg(dbProfile.weight_kg ? String(dbProfile.weight_kg) : '');
          setActivityLevel(dbProfile.activity_level || 'moderate');

          localStorage.setItem('profileData', JSON.stringify({
            fullName: dbProfile.name,
            email: dbProfile.email,
            birthDate: dbProfile.birth_date,
            gender: dbProfile.gender,
            heightCm: dbProfile.height_cm,
            weightKg: dbProfile.weight_kg,
            activityLevel: dbProfile.activity_level || 'moderate',
            goal: dbProfile.goal || 'maintain',
          }));
          return;
        }
        const userEmail = localStorage.getItem('userEmail');
        setEmail(userEmail || '');
        return;
      }

      // Fallback localStorage
      const stored = localStorage.getItem('profileData');
      if (stored) {
        const data = safeParse<any>(stored, {});
        setFullName(data.fullName ?? '');
        setEmail(data.email ?? '');
        setBirthDate(data.birthDate ?? '');
        setGender(data.gender ?? '');
        setHeightCm(data.heightCm != null ? String(data.heightCm) : '');
        setWeightKg(data.weightKg != null ? String(data.weightKg) : '');
        setActivityLevel(data.activityLevel ?? 'moderate');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      setLoadError(true);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  useEffect(() => () => {
    if (navTimer.current) window.clearTimeout(navTimer.current);
  }, []);

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!fullName.trim()) errors.fullName = t('editProfile.errNameRequired');
    if (heightCm.trim() !== '') {
      const h = Number(heightCm);
      if (!Number.isFinite(h) || h < HEIGHT_MIN || h > HEIGHT_MAX) errors.heightCm = t('editProfile.errHeightRange');
    }
    if (weightKg.trim() !== '') {
      const w = Number(weightKg);
      if (!Number.isFinite(w) || w < WEIGHT_MIN || w > WEIGHT_MAX) errors.weightKg = t('editProfile.errWeightRange');
    }
    return errors;
  };

  const handleSave = async () => {
    setStatus(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setStatus({ type: 'error', text: t('editProfile.fixErrors') });
      return;
    }

    // Email is intentionally not editable here: changing it in `profiles`
    // would desync it from the auth login email. It is sent back unchanged.
    const payload = { fullName: fullName.trim(), email, birthDate, gender, heightCm, weightKg, activityLevel };
    try {
      setLoading(true);
      if (isSupabaseConfigured()) {
        await updateCurrentUserProfile(payload);
      }
      localStorage.setItem('profileData', JSON.stringify(payload));
      window.dispatchEvent(new Event('profileUpdated'));
      setStatus({ type: 'success', text: t('editProfile.saved') });
      // Let the confirmation be seen before returning to the profile page.
      navTimer.current = window.setTimeout(() => onNavigate('profile'), 1200);
    } catch (error) {
      console.error('Failed to save profile:', error);
      setStatus({ type: 'error', text: t('editProfile.saveError') });
    } finally {
      setLoading(false);
    }
  };

  const clearFieldError = (key: keyof FieldErrors) => {
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  return (
    <div className="edit-profile-container">
      <header className="edit-profile-header">
        <BackButton onClick={() => onNavigate('profile')} ariaLabel={t('common.back')} />
        <h1 className="header-title">{t('editProfile.title')}</h1>
        <div className="header-spacer" />
      </header>

      <div className="edit-profile-content page-content">
        {loadError ? (
          <div className="form-section" role="alert" style={{ textAlign: 'center', padding: '32px 16px' }}>
            <FaExclamationTriangle style={{ color: '#F59E0B', fontSize: 32, marginBottom: 12 }} aria-hidden="true" />
            <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>{t('editProfile.loadError')}</p>
            <button type="button" className="primary-save-btn" onClick={() => void fetchProfile()} disabled={fetching}>
              {fetching ? t('common.loading') : t('editProfile.retry')}
            </button>
          </div>
        ) : (
          <>
            <div className="form-section">
              <label className="form-label" htmlFor="ep-full-name">{t('editProfile.fullName')}</label>
              <input
                id="ep-full-name"
                className="form-input"
                type="text"
                autoComplete="name"
                placeholder={t('editProfile.fullNamePlaceholder')}
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); clearFieldError('fullName'); }}
                aria-invalid={!!fieldErrors.fullName}
                aria-describedby={fieldErrors.fullName ? 'ep-full-name-err' : undefined}
                disabled={fetching}
              />
              {fieldErrors.fullName && <span id="ep-full-name-err" style={fieldErrorStyle}>{fieldErrors.fullName}</span>}
            </div>

            <div className="form-section">
              <label className="form-label" htmlFor="ep-email">{t('editProfile.email')}</label>
              <input
                id="ep-email"
                className="form-input"
                type="email"
                autoComplete="email"
                placeholder={t('editProfile.emailPlaceholder')}
                value={email}
                readOnly
                aria-describedby="ep-email-hint"
                style={{ opacity: 0.7, cursor: 'not-allowed' }}
              />
              <span id="ep-email-hint" style={hintStyle}>{t('editProfile.emailReadOnlyHint')}</span>
            </div>

            <div className="form-row">
              <div className="form-section">
                <label className="form-label" htmlFor="ep-birth-date">{t('editProfile.birthDate')}</label>
                <input
                  id="ep-birth-date"
                  className="form-input"
                  type="date"
                  autoComplete="bday"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  disabled={fetching}
                />
              </div>
              <div className="form-section">
                <label className="form-label" htmlFor="ep-gender">{t('editProfile.gender')}</label>
                <select
                  id="ep-gender"
                  className="form-input"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  disabled={fetching}
                >
                  <option value="">{t('editProfile.select')}</option>
                  <option value="male">{t('editProfile.male')}</option>
                  <option value="female">{t('editProfile.female')}</option>
                  <option value="other">{t('editProfile.other')}</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-section">
                <label className="form-label" htmlFor="ep-height">{t('editProfile.height')}</label>
                <input
                  id="ep-height"
                  className="form-input"
                  type="number"
                  inputMode="decimal"
                  min={HEIGHT_MIN}
                  max={HEIGHT_MAX}
                  placeholder={t('editProfile.heightPlaceholder')}
                  value={heightCm}
                  onChange={(e) => { setHeightCm(e.target.value); clearFieldError('heightCm'); }}
                  aria-invalid={!!fieldErrors.heightCm}
                  aria-describedby={fieldErrors.heightCm ? 'ep-height-err' : undefined}
                  disabled={fetching}
                />
                {fieldErrors.heightCm && <span id="ep-height-err" style={fieldErrorStyle}>{fieldErrors.heightCm}</span>}
              </div>
              <div className="form-section">
                <label className="form-label" htmlFor="ep-weight">{t('editProfile.weight')}</label>
                <input
                  id="ep-weight"
                  className="form-input"
                  type="number"
                  inputMode="decimal"
                  min={WEIGHT_MIN}
                  max={WEIGHT_MAX}
                  placeholder={t('editProfile.weightPlaceholder')}
                  value={weightKg}
                  onChange={(e) => { setWeightKg(e.target.value); clearFieldError('weightKg'); }}
                  aria-invalid={!!fieldErrors.weightKg}
                  aria-describedby={fieldErrors.weightKg ? 'ep-weight-err' : undefined}
                  disabled={fetching}
                />
                {fieldErrors.weightKg && <span id="ep-weight-err" style={fieldErrorStyle}>{fieldErrors.weightKg}</span>}
              </div>
            </div>

            <div className="form-section">
              <label className="form-label" htmlFor="ep-activity">{t('profile.activityLevel')}</label>
              <select
                id="ep-activity"
                className="form-input"
                value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value)}
                disabled={fetching}
              >
                {ACTIVITY_OPTIONS.map(({ value, labelKey }) => (
                  <option key={value} value={value}>{t(labelKey)}</option>
                ))}
              </select>
            </div>

            <button className="primary-save-btn" onClick={handleSave} disabled={loading || fetching}>
              {loading ? t('profile.goalSaving') : t('editProfile.save')}
            </button>

            {status && (
              <div
                role={status.type === 'error' ? 'alert' : 'status'}
                style={{
                  marginTop: 12,
                  padding: '12px 14px',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: status.type === 'error' ? '#B91C1C' : '#047857',
                  background: status.type === 'error' ? 'rgba(239,68,68,0.10)' : 'rgba(16,185,129,0.12)',
                  border: `1px solid ${status.type === 'error' ? 'rgba(239,68,68,0.30)' : 'rgba(16,185,129,0.30)'}`,
                }}
              >
                {status.type === 'error' ? <FaExclamationTriangle aria-hidden="true" /> : <FaCheckCircle aria-hidden="true" />}
                <span>{status.text}</span>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav active="profile" onNavigate={onNavigate} onOpenFoodRecognition={onOpenFoodRecognition} t={t} />
    </div>
  );
};
