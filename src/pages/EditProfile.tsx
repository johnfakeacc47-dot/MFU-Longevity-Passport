import React, { useEffect, useState } from 'react';
import { isSupabaseConfigured, getCurrentUserProfile, updateCurrentUserProfile } from '../services/supabaseClient';
import { calculateBMI, getBMICategory } from '../utils/healthCalculations';

import { useLanguage } from '../contexts/LanguageContext';

type PageType = 'login' | 'home' | 'fasting' | 'dashboard' | 'team' | 'profile' | 'edit-profile'

interface EditProfileProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

export const EditProfile: React.FC<EditProfileProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const { t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);

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
          setPhone(dbProfile.phone || '');
          
          // Sync to cache
          localStorage.setItem('profileData', JSON.stringify({
            fullName: dbProfile.name,
            email: dbProfile.email,
            birthDate: dbProfile.birth_date,
            gender: dbProfile.gender,
            heightCm: dbProfile.height_cm,
            weightKg: dbProfile.weight_kg,
            phone: dbProfile.phone
          }));
          return;
        }

        // If Supabase is active but no profile exists (new user)
        const userEmail = localStorage.getItem('userEmail');
        setFullName('');
        setEmail(userEmail || '');
        setBirthDate('');
        setGender('');
        setHeightCm('');
        setWeightKg('');
        setPhone('');
        return; // DO NOT fallback to local storage
      }

      // Fallback local storage
      const stored = localStorage.getItem('profileData');
      if (stored) {
        const data = JSON.parse(stored);
        setFullName(data.fullName ?? '');
        setEmail(data.email ?? '');
        setBirthDate(data.birthDate ?? '');
        setGender(data.gender ?? '');
        setHeightCm(data.heightCm ?? '');
        setWeightKg(data.weightKg ?? '');
        setPhone(data.phone ?? '');
      }
    };

    fetchProfile();
  }, []);

  const handleSave = async () => {
    const payload = {
      fullName,
      email,
      birthDate,
      gender,
      heightCm,
      weightKg,
      phone,
    };
    try {
      setLoading(true);
      if (isSupabaseConfigured()) {
        await updateCurrentUserProfile(payload);
      }
      
      console.log('Profile updated locally/cloud:', payload);
      localStorage.setItem('profileData', JSON.stringify(payload));
      
      // Emit event for rapid UI sync
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
        <button className="back-btn" onClick={() => onNavigate('profile')}>←</button>
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

        {/* BMI Display */}
        {(heightCm && weightKg) && (
          <div className="glass-card mb-6 p-4 rounded-2xl bg-white/30 border border-white/50">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('editProfile.bmiLabel')}</span>
                <div className="text-2xl font-black text-indigo-900">
                  {calculateBMI(Number(weightKg), Number(heightCm))}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('editProfile.categoryLabel')}</span>
                <div className={`text-sm font-bold ${
                  t(getBMICategory(calculateBMI(Number(weightKg), Number(heightCm))!)) === t('bmi.normal') 
                    ? 'text-green-600' : 'text-orange-600'
                }`}>
                  {t(getBMICategory(calculateBMI(Number(weightKg), Number(heightCm))!))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="form-section">
          <label className="form-label">{t('editProfile.phone')}</label>
          <input
            className="form-input"
            type="tel"
            placeholder={t('editProfile.phonePlaceholder')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <button className="primary-save-btn" onClick={handleSave} disabled={loading}>
          {loading ? t('editProfile.saving') : t('editProfile.save')}
        </button>
      </div>

      <footer className="bottom-nav">
        <button className="nav-icon" onClick={() => onNavigate('home')}>
          <span className="nav-emoji">🏠</span>
          <span className="nav-label">{t('nav.home')}</span>
        </button>
        <button className="nav-icon" onClick={onOpenFoodRecognition}>
          <span className="nav-emoji">🍽️</span>
          <span className="nav-label">{t('nav.fasting')}</span>
        </button>
        <button className="nav-icon" onClick={() => onNavigate('dashboard')}>
          <span className="nav-emoji">📊</span>
          <span className="nav-label">{t('nav.dashboard')}</span>
        </button>
        <button className="nav-icon" onClick={() => onNavigate('team')}>
          <span className="nav-emoji">👥</span>
          <span className="nav-label">{t('nav.team')}</span>
        </button>
        <button className="nav-icon active" onClick={() => onNavigate('profile')}>
          <span className="nav-emoji">👤</span>
          <span className="nav-label">{t('nav.profile')}</span>
        </button>
      </footer>
    </div>
  );
};
