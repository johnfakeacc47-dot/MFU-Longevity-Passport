import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    const fetchProfile = async () => {
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
        setHeightCm(data.heightCm ?? '');
        setWeightKg(data.weightKg ?? '');
        setActivityLevel(data.activityLevel ?? 'moderate');
      }
    };

    fetchProfile();
  }, []);

  const handleSave = async () => {
    const payload = { fullName, email, birthDate, gender, heightCm, weightKg, activityLevel };
    try {
      setLoading(true);
      if (isSupabaseConfigured()) {
        await updateCurrentUserProfile(payload);
      }
      localStorage.setItem('profileData', JSON.stringify(payload));
      window.dispatchEvent(new Event('profileUpdated'));
      alert(t('editProfile.saved'));
      onNavigate('profile');
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert(t('editProfile.saveError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="edit-profile-container">
      <header className="edit-profile-header">
        <BackButton onClick={() => onNavigate('profile')} ariaLabel={t('common.back')} />
        <h1 className="header-title">{t('editProfile.title')}</h1>
        <div className="header-spacer" />
      </header>

      <div className="edit-profile-content page-content">
        <div className="form-section">
          <label className="form-label">{t('editProfile.fullName')}</label>
          <input
            className="form-input"
            type="text"
            placeholder={t('editProfile.fullNamePlaceholder')}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        <div className="form-section">
          <label className="form-label">{t('editProfile.email')}</label>
          <input
            className="form-input"
            type="email"
            placeholder={t('editProfile.emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="form-section">
            <label className="form-label">{t('editProfile.birthDate')}</label>
            <input
              className="form-input"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
          <div className="form-section">
            <label className="form-label">{t('editProfile.gender')}</label>
            <select
              className="form-input"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
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
            <label className="form-label">{t('editProfile.height')}</label>
            <input
              className="form-input"
              type="number"
              min="0"
              placeholder={t('editProfile.heightPlaceholder')}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          </div>
          <div className="form-section">
            <label className="form-label">{t('editProfile.weight')}</label>
            <input
              className="form-input"
              type="number"
              min="0"
              placeholder={t('editProfile.weightPlaceholder')}
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </div>
        </div>

        <div className="form-section">
          <label className="form-label">{t('profile.activityLevel')}</label>
          <select
            className="form-input"
            value={activityLevel}
            onChange={(e) => setActivityLevel(e.target.value)}
          >
            {ACTIVITY_OPTIONS.map(({ value, labelKey }) => (
              <option key={value} value={value}>{t(labelKey)}</option>
            ))}
          </select>
        </div>

        <button className="primary-save-btn" onClick={handleSave} disabled={loading}>
          {loading ? t('profile.goalSaving') : t('editProfile.save')}
        </button>
      </div>

      <BottomNav active="profile" onNavigate={onNavigate} onOpenFoodRecognition={onOpenFoodRecognition} t={t} />
    </div>
  );
};
