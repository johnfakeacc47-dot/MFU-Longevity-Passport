import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  FaUser, FaWeight, FaRulerVertical, FaEdit, FaBars, FaTimes,
  FaShieldAlt, FaSignOutAlt, FaGlobe, FaChevronRight,
  FaHeartbeat, FaBullseye, FaUsers, FaInfoCircle, FaBell,
  FaDumbbell, FaAppleAlt, FaFire, FaCheck, FaSeedling,
} from 'react-icons/fa';
import {
  isSupabaseConfigured,
  getCurrentUserProfile,
  updateUserGoalAndActivity,
} from '../services/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { safeParse } from '../utils/safeStorage';
import { BottomNav } from '../components/BottomNav';
import { BackButton } from '../components/BackButton';
import { AchievementsGrid } from '../components/coach/AchievementsGrid';
import '../styles/Profile.css';

type PageType =
  | 'login' | 'home' | 'eating' | 'dashboard' | 'team'
  | 'profile' | 'edit-profile' | 'user-management'
  | 'privacy-settings' | 'set-goals' | 'about-tracker' | 'about-garden' | 'activity' | 'sleep' | 'settings' | 'eating-food-log' | 'eating-macros' | 'eating-water' | 'eating-schedule' | 'eating-history';

interface ProfileProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
  onLogout: () => void;
}

// ── Health Calculation Utilities ────────────────────────────────────────────
const calcBMI = (weightKg: number, heightCm: number): number => {
  const h = heightCm / 100;
  return parseFloat((weightKg / (h * h)).toFixed(1));
};

const getBMICategory = (bmi: number): { label: string; labelKey: string; color: string; desc: string; descKey: string } => {
  if (bmi < 18.5) return { label: 'Underweight', labelKey: 'profile.bmiUnderweight', color: '#3B82F6', desc: 'Consider increasing caloric intake with nutrient-dense foods.', descKey: 'profile.bmiUnderDesc' };
  if (bmi < 25)   return { label: 'Normal',      labelKey: 'profile.bmiNormal',      color: '#10B981', desc: 'Great job! Maintain your current healthy lifestyle.',     descKey: 'profile.bmiNormalDesc' };
  if (bmi < 30)   return { label: 'Overweight',  labelKey: 'profile.bmiOverweight',  color: '#F59E0B', desc: 'A modest calorie deficit with regular exercise can help.',descKey: 'profile.bmiOverDesc' };
  return              { label: 'Obese',       labelKey: 'profile.bmiObese',       color: '#EF4444', desc: 'Consult a healthcare provider for a personalised plan.', descKey: 'profile.bmiObeseDesc' };
};

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light:     1.375,
  moderate:  1.55,
  active:    1.725,
  very_active: 1.9,
};

const calcBMR = (weight: number, height: number, age: number, gender: string): number => {
  // Mifflin-St Jeor
  if (gender === 'female') return 10 * weight + 6.25 * height - 5 * age - 161;
  return 10 * weight + 6.25 * height - 5 * age + 5;
};

const calcTDEE = (bmr: number, activityLevel: string): number =>
  Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55));

const getTargetCalories = (tdee: number, goal: string): number => {
  if (goal === 'lose_weight') return tdee - 400;
  if (goal === 'gain_weight' || goal === 'build_muscle') return tdee + 400;
  return tdee;
};

const GOAL_OPTIONS = [
  { value: 'maintain',     labelKey: 'profile.goalMaintain',    label: 'Maintain Health',  icon: FaHeartbeat },
  { value: 'lose_weight',  labelKey: 'profile.goalLoseWeight',  label: 'Lose Weight',      icon: FaFire },
  { value: 'gain_weight',  labelKey: 'profile.goalGainWeight',  label: 'Gain Weight',      icon: FaAppleAlt },
  { value: 'build_muscle', labelKey: 'profile.goalBuildMuscle', label: 'Build Muscle',     icon: FaDumbbell },
  { value: 'longevity',    labelKey: 'profile.goalLongevity',   label: 'Longevity',        icon: FaBullseye },
] as const;

const ACTIVITY_OPTIONS = [
  { value: 'sedentary',   labelKey: 'profile.actSedentary',  label: 'Sedentary' },
  { value: 'light',       labelKey: 'profile.actLight',      label: 'Light' },
  { value: 'moderate',    labelKey: 'profile.actModerate',   label: 'Moderate' },
  { value: 'active',      labelKey: 'profile.actActive',     label: 'Active' },
  { value: 'very_active', labelKey: 'profile.actVeryActive', label: 'Very Active' },
] as const;

const buildAIRecommendation = (bmi: number, goal: string, tdee: number, targetCal: number, lang: string = 'th'): string[] => {
  const tips: string[] = [];
  const { label: bmiLabel } = getBMICategory(bmi);

  if (lang === 'th') {
    if (bmiLabel === 'Underweight') {
      tips.push('ค่า BMI ของคุณอยู่ในเกณฑ์น้ำหนักน้อย ควรเพิ่มพลังงานจากอาหารอย่างค่อยเป็นค่อยไป');
      tips.push(`ตั้งเป้าหมายพลังงานประมาณ ${targetCal.toLocaleString()} kcal/วัน พร้อมอาหารโปรตีนสูง`);
    } else if (bmiLabel === 'Normal') {
      tips.push('ค่า BMI ของคุณอยู่ในเกณฑ์สุขภาพดีเยี่ยม ยอดเยี่ยมมาก!');
      tips.push(`พลังงานที่แนะนำเพื่อคงน้ำหนักคือประมาณ ${tdee.toLocaleString()} kcal/วัน`);
    } else if (bmiLabel === 'Overweight') {
      tips.push('การปรับลดพลังงานเล็กน้อยพร้อมออกกำลังกายจะช่วยให้รูปร่างและสุขภาพดีขึ้น');
      tips.push(`เป้าหมายพลังงานแนะนำที่ ${targetCal.toLocaleString()} kcal/วัน เพื่อความยั่งยืน`);
    } else {
      tips.push('ควรปรึกษาแพทย์หรือผู้เชี่ยวชาญเพื่อวางแผนการลดน้ำหนักอย่างถูกวิธี');
      tips.push(`เริ่มต้นด้วยการควบคุมพลังงานประมาณ ${targetCal.toLocaleString()} kcal/วัน และบันทึกมื้ออาหารสม่ำเสมอ`);
    }

    if (goal === 'longevity') {
      tips.push('เน้นรับประทานอาหารจากธรรมชาติที่ไม่ผ่านการขัดสี นอนหลับอย่างมีคุณภาพ และออกกำลังกายสม่ำเสมอ');
    } else if (goal === 'build_muscle') {
      tips.push('ให้ความสำคัญกับโปรตีน (1.6–2.2 กรัม/กก.) และฝึกกล้ามเนื้อแบบเวทเทรนนิ่ง 3–5 ครั้ง/สัปดาห์');
    } else if (goal === 'lose_weight') {
      tips.push('ออกกำลังกายแบบคาร์ดิโอ 150–300 นาที/สัปดาห์ ควบคู่ไปกับการควบคุมปริมาณแคลอรี่');
    } else if (goal === 'gain_weight') {
      tips.push('เพิ่มมื้อว่างที่อุดมด้วยคุณค่าระหว่างวัน และเน้นฝึกกล้ามเนื้อเพื่อเพิ่มมวลกล้ามเนื้อ');
    } else {
      tips.push('ออกกำลังกายระดับปานกลางอย่างน้อย 150 นาที/สัปดาห์ เพื่อรักษาสมดุลสุขภาพ');
    }
  } else {
    if (bmiLabel === 'Underweight') {
      tips.push('Your BMI suggests you may benefit from increasing your calorie intake gradually.');
      tips.push(`Aim for ${targetCal.toLocaleString()} kcal per day with protein-rich meals.`);
    } else if (bmiLabel === 'Normal') {
      tips.push('Your BMI is in a healthy range — keep up the great work!');
      tips.push(`Your estimated maintenance calories are ${tdee.toLocaleString()} kcal/day.`);
    } else if (bmiLabel === 'Overweight') {
      tips.push('A moderate calorie deficit can help you reach a healthier weight range.');
      tips.push(`Target ${targetCal.toLocaleString()} kcal/day for steady, sustainable progress.`);
    } else {
      tips.push('A healthcare-guided approach will help you safely reduce to a healthier BMI.');
      tips.push(`Start with ${targetCal.toLocaleString()} kcal/day and track your meals consistently.`);
    }

    if (goal === 'longevity') {
      tips.push('Focus on whole foods, quality sleep, and consistent moderate-intensity exercise for long-term vitality.');
    } else if (goal === 'build_muscle') {
      tips.push('Prioritise protein (1.6–2.2 g/kg body weight) and progressive resistance training 3–5× per week.');
    } else if (goal === 'lose_weight') {
      tips.push('Aim for 150–300 min of moderate cardio per week alongside your calorie target.');
    } else if (goal === 'gain_weight') {
      tips.push('Add nutrient-dense snacks between meals and focus on strength training to gain lean mass.');
    } else {
      tips.push('Aim for at least 150 minutes of moderate exercise per week to maintain overall health.');
    }
  }

  return tips;
};

// ── Component ────────────────────────────────────────────────────────────────
export const Profile: React.FC<ProfileProps> = ({ onNavigate, onOpenFoodRecognition, onLogout }) => {
  const { language, t } = useLanguage();
  useSEO(`${t('profile.title')} · MFU Longevity Passport`, 'Manage your personal information and account settings.');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingGoal, setIsSavingGoal] = useState(false);

  const [profileData, setProfileData] = useState<{
    fullName?: string;
    email?: string;
    birthDate?: string;
    gender?: string;
    heightCm?: string;
    weightKg?: string;
    activityLevel?: string;
    goal?: string;
    role?: string;
  }>({});

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const fetchProfileData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const dbProfile = await getCurrentUserProfile();
        if (dbProfile) {
          setProfileData({
            fullName:      dbProfile.name,
            email:         dbProfile.email,
            birthDate:     dbProfile.birth_date,
            gender:        dbProfile.gender,
            heightCm:      dbProfile.height_cm ? String(dbProfile.height_cm) : undefined,
            weightKg:      dbProfile.weight_kg ? String(dbProfile.weight_kg) : undefined,
            activityLevel: dbProfile.activity_level || 'moderate',
            goal:          dbProfile.goal || 'maintain',
            role:          dbProfile.role || 'student',
          });
          return;
        }
        const userEmail = localStorage.getItem('userEmail');
        setProfileData({ fullName: 'New User', email: userEmail || undefined, activityLevel: 'moderate', goal: 'maintain' });
        return;
      }
      // Fallback localStorage
      const stored = localStorage.getItem('profileData');
      if (stored) setProfileData((prev) => safeParse(stored, prev));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfileData();
    const handler = () => fetchProfileData();
    window.addEventListener('profileUpdated', handler);
    return () => window.removeEventListener('profileUpdated', handler);
  }, [fetchProfileData]);

  // ── Derived Values ─────────────────────────────────────────────────────────
  const ageYears = useMemo(() => {
    if (!profileData.birthDate) return null;
    const birth = new Date(profileData.birthDate);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
    return age;
  }, [profileData.birthDate]);

  const healthCalcs = useMemo(() => {
    const w = parseFloat(profileData.weightKg || '0');
    const h = parseFloat(profileData.heightCm || '0');
    const age = ageYears ?? 25;
    const gender = profileData.gender || 'male';
    const activity = profileData.activityLevel || 'moderate';
    const goal = profileData.goal || 'maintain';

    if (!w || !h) return null;

    const bmi = calcBMI(w, h);
    const bmiCat = getBMICategory(bmi);
    const bmr = calcBMR(w, h, age, gender);
    const tdee = calcTDEE(bmr, activity);
    const loseCal  = tdee - 400;
    const gainCal  = tdee + 400;
    const targetCal = getTargetCalories(tdee, goal);
    const tips = buildAIRecommendation(bmi, goal, tdee, targetCal, language);

    return { bmi, bmiCat, bmr: Math.round(bmr), tdee, loseCal, gainCal, targetCal, tips };
  }, [profileData, ageYears, language]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleGoalChange = async (newGoal: string) => {
    const updated = { ...profileData, goal: newGoal };
    setProfileData(updated);
    setIsSavingGoal(true);
    try {
      if (isSupabaseConfigured()) {
        await updateUserGoalAndActivity(newGoal, profileData.activityLevel || 'moderate');
      }
      localStorage.setItem('profileData', JSON.stringify(updated));
    } finally {
      setIsSavingGoal(false);
    }
  };

  const handleActivityChange = async (newActivity: string) => {
    const updated = { ...profileData, activityLevel: newActivity };
    setProfileData(updated);
    if (isSupabaseConfigured()) {
      await updateUserGoalAndActivity(profileData.goal || 'maintain', newActivity);
    }
    localStorage.setItem('profileData', JSON.stringify(updated));
  };
  const avatarLetter = profileData.fullName?.charAt(0).toUpperCase() || 'U';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="profile-v2">
      {/* Header */}
      <header className="pv2-header">
        <BackButton onClick={() => onNavigate('home')} ariaLabel="Go back to home" />
        <h1 className="pv2-header-title">{t('profile.title')}</h1>
        <button
          className="pv2-hamburger"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open settings menu"
        >
          <FaBars />
        </button>
      </header>

      <div className="pv2-content page-content">

        {/* ── Hero Card ── */}
        <div className="pv2-card pv2-hero">
          <div className="pv2-avatar">
            <span className="pv2-avatar-letter">{isLoading ? '…' : avatarLetter}</span>
          </div>
          <div className="pv2-hero-info">
            <h2 className="pv2-name">{isLoading ? '…' : (profileData.fullName || 'New User')}</h2>
            <p className="pv2-email">{isLoading ? '…' : (profileData.email || '—')}</p>
            <span className="pv2-badge pv2-badge--active">{t('profile.active')}</span>
          </div>
          <button className="pv2-edit-btn" onClick={() => onNavigate('edit-profile')}>
            <FaEdit />
            <span>{t('profile.editProfile')}</span>
          </button>
        </div>

        {isLoading ? (
          <div className="pv2-skeleton-group">
            <div className="pv2-skeleton" style={{ height: 140 }} />
            <div className="pv2-skeleton" style={{ height: 160 }} />
            <div className="pv2-skeleton" style={{ height: 200 }} />
          </div>
        ) : (
          <>
            {/* ── Health Information Card ── */}
            {healthCalcs ? (
              <div className="pv2-card">
                <div className="pv2-card-header">
                  <FaHeartbeat className="pv2-card-icon" />
                  <h3 className="pv2-card-title">{t('profile.healthInfo')}</h3>
                </div>
                <div className="pv2-bmi-section">
                  <div className="pv2-bmi-value-wrap">
                    <span className="pv2-bmi-number">{healthCalcs.bmi}</span>
                    <span className="pv2-bmi-unit">BMI</span>
                  </div>
                  <div className="pv2-bmi-right">
                    <span
                      className="pv2-bmi-badge"
                      style={{ background: `${healthCalcs.bmiCat.color}18`, color: healthCalcs.bmiCat.color, borderColor: `${healthCalcs.bmiCat.color}30` }}
                    >
                      {t(healthCalcs.bmiCat.labelKey)}
                    </span>
                    <p className="pv2-bmi-desc">{t(healthCalcs.bmiCat.descKey)}</p>
                  </div>
                </div>
                {/* BMI Scale Bar */}
                <div className="pv2-bmi-scale">
                  <div className="pv2-bmi-track">
                    <div className="pv2-bmi-segment pv2-bmi-seg--under" />
                    <div className="pv2-bmi-segment pv2-bmi-seg--normal" />
                    <div className="pv2-bmi-segment pv2-bmi-seg--over" />
                    <div className="pv2-bmi-segment pv2-bmi-seg--obese" />
                    <div
                      className="pv2-bmi-marker"
                      style={{ left: `${Math.min(Math.max(((healthCalcs.bmi - 10) / 30) * 100, 0), 100)}%` }}
                    />
                  </div>
                  <div className="pv2-bmi-scale-labels">
                    <span>{t('profile.scaleUnder')}</span><span>{t('profile.scaleNormal')}</span><span>{t('profile.scaleOver')}</span><span>{t('profile.scaleObese')}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="pv2-card pv2-empty-card">
                <FaInfoCircle className="pv2-empty-icon" />
                <p className="pv2-empty-text">{t('profile.addHeightWeight')}</p>
                <button className="pv2-cta-btn" onClick={() => onNavigate('edit-profile')}>
                  {t('profile.completeProfile')}
                </button>
              </div>
            )}

            {/* ── Daily Calories Card ── */}
            {healthCalcs && (
              <div className="pv2-card">
                <div className="pv2-card-header">
                  <FaFire className="pv2-card-icon" />
                  <h3 className="pv2-card-title">{t('profile.dailyCalories')}</h3>
                </div>
                <div className="pv2-calorie-grid">
                  <div className="pv2-calorie-item">
                    <span className="pv2-cal-number pv2-cal--maintain">{healthCalcs.tdee.toLocaleString()}</span>
                    <span className="pv2-cal-label">{t('profile.calMaintain')}</span>
                    <span className="pv2-cal-sub">{t('profile.kcalDay')}</span>
                  </div>
                  <div className="pv2-calorie-item">
                    <span className="pv2-cal-number pv2-cal--lose">{healthCalcs.loseCal.toLocaleString()}</span>
                    <span className="pv2-cal-label">{t('profile.calLose')}</span>
                    <span className="pv2-cal-sub">{t('profile.kcalDay')}</span>
                  </div>
                  <div className="pv2-calorie-item">
                    <span className="pv2-cal-number pv2-cal--gain">{healthCalcs.gainCal.toLocaleString()}</span>
                    <span className="pv2-cal-label">{t('profile.calGain')}</span>
                    <span className="pv2-cal-sub">{t('profile.kcalDay')}</span>
                  </div>
                </div>
                <div className="pv2-bmr-row">
                  <span className="pv2-bmr-label">{t('profile.bmrLabel')}</span>
                  <span className="pv2-bmr-value">{healthCalcs.bmr.toLocaleString()} kcal</span>
                </div>
              </div>
            )}

            {/* ── Goal Card ── */}
            <div className="pv2-card">
              <div className="pv2-card-header">
                <FaBullseye className="pv2-card-icon" />
                <h3 className="pv2-card-title">{t('profile.myGoal')}</h3>
                {isSavingGoal && <span className="pv2-saving-badge">{t('profile.goalSaving')}</span>}
              </div>
              <div className="pv2-goal-grid">
                {GOAL_OPTIONS.map(({ value, labelKey, icon: Icon }) => {
                  const isSelected = (profileData.goal || 'maintain') === value;
                  return (
                    <button
                      key={value}
                      className={`pv2-goal-btn ${isSelected ? 'pv2-goal-btn--active' : ''}`}
                      onClick={() => handleGoalChange(value)}
                    >
                      <span className="pv2-goal-icon"><Icon /></span>
                      <span className="pv2-goal-label">{t(labelKey)}</span>
                      {isSelected && <FaCheck className="pv2-goal-check" />}
                    </button>
                  );
                })}
              </div>

              {/* Activity Level inside Goal card */}
              <div className="pv2-activity-section">
                <label className="pv2-activity-label">{t('profile.activityLevel')}</label>
                <div className="pv2-activity-row">
                  {ACTIVITY_OPTIONS.map(({ value, labelKey }) => {
                    const isSelected = (profileData.activityLevel || 'moderate') === value;
                    return (
                      <button
                        key={value}
                        className={`pv2-activity-chip ${isSelected ? 'pv2-activity-chip--active' : ''}`}
                        onClick={() => handleActivityChange(value)}
                      >
                        {t(labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── AI Recommendation Card ── */}
            {healthCalcs && (
              <div className="pv2-card pv2-ai-card">
                <div className="pv2-card-header">
                  <FaHeartbeat className="pv2-card-icon pv2-card-icon--ai" />
                  <h3 className="pv2-card-title">{t('profile.aiRecommendation')}</h3>
                </div>
                <ul className="pv2-ai-tips">
                  {healthCalcs.tips.map((tip, i) => (
                    <li key={i} className="pv2-ai-tip">
                      <span className="pv2-ai-tip-dot" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Health Summary Card ── */}
            {healthCalcs && (
              <div className="pv2-card">
                <div className="pv2-card-header">
                  <FaUser className="pv2-card-icon" />
                  <h3 className="pv2-card-title">{t('profile.healthSummary')}</h3>
                </div>
                <div className="pv2-summary-grid">
                  {[
                    { labelKey: 'profile.summaryWeight', value: profileData.weightKg ? `${profileData.weightKg} kg` : '—', icon: FaWeight },
                    { labelKey: 'profile.summaryHeight', value: profileData.heightCm ? `${profileData.heightCm} cm` : '—', icon: FaRulerVertical },
                    { labelKey: 'profile.summaryBMI', value: String(healthCalcs.bmi), icon: FaHeartbeat },
                    { labelKey: 'profile.summaryAge', value: ageYears ? `${ageYears} ${t('profile.summaryAgeUnit')}` : '—', icon: FaUser },
                    { labelKey: 'profile.summaryGoal', value: (() => {
                      const found = GOAL_OPTIONS.find(g => g.value === (profileData.goal || 'maintain'));
                      return found ? t(found.labelKey) : '—';
                    })(), icon: FaBullseye },
                    { labelKey: 'profile.summaryTargetCal', value: `${healthCalcs.targetCal.toLocaleString()} kcal`, icon: FaFire },
                  ].map(({ labelKey, value, icon: Icon }) => (
                    <div key={labelKey} className="pv2-summary-item">
                      <Icon className="pv2-summary-icon" />
                      <span className="pv2-summary-label">{t(labelKey)}</span>
                      <span className="pv2-summary-value">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Achievements & Badges Card ── */}
            <AchievementsGrid />
          </>
        )}

        <div className="pv2-version">v1.0.0 · MFU Longevity Passport</div>
      </div>

      {/* ── Settings Drawer ── */}
      {drawerOpen && (
        <div className="pv2-drawer-overlay" onClick={() => setDrawerOpen(false)} />
      )}
      <div className={`pv2-drawer ${drawerOpen ? 'pv2-drawer--open' : ''}`}>
        <div className="pv2-drawer-header">
          <span className="pv2-drawer-title">{t('profile.settings')}</span>
          <button className="pv2-drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Close settings">
            <FaTimes />
          </button>
        </div>

        <div className="pv2-drawer-body">
          <button className="pv2-drawer-item" onClick={() => { setDrawerOpen(false); onNavigate('settings'); }}>
            <span className="pv2-drawer-item-icon"><FaGlobe /></span>
            <span className="pv2-drawer-item-label">{t('settings.title')}</span>
            <FaChevronRight className="pv2-drawer-item-arrow" />
          </button>

          <button className="pv2-drawer-item" onClick={() => { setDrawerOpen(false); onNavigate('edit-profile'); }}>
            <span className="pv2-drawer-item-icon"><FaUser /></span>
            <span className="pv2-drawer-item-label">{t('profile.updateProfile')}</span>
            <FaChevronRight className="pv2-drawer-item-arrow" />
          </button>

          <button className="pv2-drawer-item" onClick={() => { setDrawerOpen(false); onNavigate('settings'); }}>
            <span className="pv2-drawer-item-icon"><FaBell /></span>
            <span className="pv2-drawer-item-label">{t('profile.notificationSettings')}</span>
            <FaChevronRight className="pv2-drawer-item-arrow" />
          </button>

          <button className="pv2-drawer-item" onClick={() => { setDrawerOpen(false); onNavigate('privacy-settings'); }}>
            <span className="pv2-drawer-item-icon"><FaShieldAlt /></span>
            <span className="pv2-drawer-item-label">{t('profile.privacySettings')}</span>
            <FaChevronRight className="pv2-drawer-item-arrow" />
          </button>

          <button className="pv2-drawer-item" onClick={() => { setDrawerOpen(false); onNavigate('about-tracker'); }}>
            <span className="pv2-drawer-item-icon"><FaInfoCircle /></span>
            <span className="pv2-drawer-item-label">{t('profile.aboutTracker')}</span>
            <FaChevronRight className="pv2-drawer-item-arrow" />
          </button>

          <button className="pv2-drawer-item" onClick={() => { setDrawerOpen(false); onNavigate('about-garden'); }}>
            <span className="pv2-drawer-item-icon"><FaSeedling /></span>
            <span className="pv2-drawer-item-label">{t('profile.aboutGarden')}</span>
            <FaChevronRight className="pv2-drawer-item-arrow" />
          </button>

          {(profileData.role === 'admin') && (
            <button className="pv2-drawer-item pv2-drawer-item--admin" onClick={() => { setDrawerOpen(false); onNavigate('user-management'); }}>
              <span className="pv2-drawer-item-icon"><FaUsers /></span>
              <span className="pv2-drawer-item-label">{t('profile.manageUsers')}</span>
              <FaChevronRight className="pv2-drawer-item-arrow" />
            </button>
          )}

          <div className="pv2-drawer-divider" />

          <button className="pv2-drawer-item pv2-drawer-item--logout" onClick={() => { setDrawerOpen(false); onLogout(); }}>
            <span className="pv2-drawer-item-icon"><FaSignOutAlt /></span>
            <span className="pv2-drawer-item-label">{t('profile.logout')}</span>
          </button>
        </div>
      </div>

      <BottomNav active="profile" onNavigate={onNavigate} onOpenFoodRecognition={onOpenFoodRecognition} t={t} />
    </div>
  );
};
