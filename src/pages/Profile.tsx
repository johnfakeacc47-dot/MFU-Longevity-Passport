import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  UserRound, Pencil, Sun, Globe, Bell, Shield, Info, Download, LogOut, Trash2,
  BellRing, Sprout, HeartPulse, Users, FileText, Scale, Flame,
} from 'lucide-react';
import {
  isSupabaseConfigured,
  getCurrentUserProfile,
  updateUserGoalAndActivity,
} from '../services/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../contexts/ThemeContext';
import { useSEO } from '../hooks/useSEO';
import { safeParse } from '../utils/safeStorage';
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed } from '../services/notifications';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader, IconBtn, Group, Row, Chip, Segmented, Toggle, ICON_PROPS } from '../components/v2';
import { APP_VERSION } from '../utils/appVersion';

import type { PageType } from '../types/pages';

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
  { value: 'maintain',     labelKey: 'profile.goalMaintain',    label: 'Maintain Health' },
  { value: 'lose_weight',  labelKey: 'profile.goalLoseWeight',  label: 'Lose Weight' },
  { value: 'gain_weight',  labelKey: 'profile.goalGainWeight',  label: 'Gain Weight' },
  { value: 'build_muscle', labelKey: 'profile.goalBuildMuscle', label: 'Build Muscle' },
  { value: 'longevity',    labelKey: 'profile.goalLongevity',   label: 'Longevity' },
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
export const Profile: React.FC<ProfileProps> = ({ onNavigate, onLogout }) => {
  const { language, t } = useLanguage();
  useSEO(`${t('profile.title')} · MFU Longevity Passport`, 'Manage your personal information and account settings.');

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  // Transient "couldn't save" message shown in the goal-card header slot.
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveErrorTimer = useRef<number | null>(null);

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
    handle?: string;
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
            handle:        dbProfile.handle ?? undefined,
          });
          return;
        }
        const userEmail = localStorage.getItem('userEmail');
        // fullName stays undefined; the hero renders t('profile.newUser') so it follows the current language.
        setProfileData({ email: userEmail || undefined, activityLevel: 'moderate', goal: 'maintain' });
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

  useEffect(() => () => {
    if (saveErrorTimer.current) window.clearTimeout(saveErrorTimer.current);
  }, []);

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

  const profileCompletion = useMemo(() => {
    const fields = [
      profileData.fullName,
      profileData.email,
      profileData.birthDate,
      profileData.gender,
      profileData.heightCm,
      profileData.weightKg,
      profileData.activityLevel,
      profileData.goal,
    ];
    const completed = fields.filter((value) => Boolean(value && String(value).trim())).length;
    return Math.round((completed / fields.length) * 100);
  }, [profileData]);

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
  const flashSaveError = () => {
    setSaveError(t('profile.saveFailed'));
    if (saveErrorTimer.current) window.clearTimeout(saveErrorTimer.current);
    saveErrorTimer.current = window.setTimeout(() => setSaveError(null), 4000);
  };

  // Optimistic update of goal / activity level. updateUserGoalAndActivity()
  // swallows Supabase errors and returns null, so a null while configured is a
  // failure too — in that case revert the optimistic state and tell the user.
  const persistGoalAndActivity = async (updated: typeof profileData, previous: typeof profileData) => {
    setProfileData(updated);
    setIsSavingGoal(true);
    setSaveError(null);
    try {
      if (isSupabaseConfigured()) {
        const result = await updateUserGoalAndActivity(updated.goal || 'maintain', updated.activityLevel || 'moderate');
        if (!result) throw new Error('goal/activity save returned no row');
      }
      localStorage.setItem('profileData', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save goal/activity:', err);
      setProfileData(previous);
      flashSaveError();
    } finally {
      setIsSavingGoal(false);
    }
  };

  const handleGoalChange = (newGoal: string) => {
    if (isSavingGoal || (profileData.goal || 'maintain') === newGoal) return;
    void persistGoalAndActivity({ ...profileData, goal: newGoal }, profileData);
  };

  const handleActivityChange = (newActivity: string) => {
    if (isSavingGoal || (profileData.activityLevel || 'moderate') === newActivity) return;
    void persistGoalAndActivity({ ...profileData, activityLevel: newActivity }, profileData);
  };
  const avatarLetter = profileData.fullName?.charAt(0).toUpperCase() || 'U';

  // ── Settings state (same services the old Settings page used) ─────────────
  const { language: lang, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const pushSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    if (pushSupported) isPushSubscribed().then(setPushEnabled).catch(() => undefined);
  }, [pushSupported]);

  const togglePush = async (next: boolean) => {
    if (pushBusy) return;
    setPushBusy(true);
    setPushError(null);
    if (next) {
      const res = await subscribeToPush();
      setPushEnabled(res.ok);
      if (!res.ok) {
        setPushError(
          res.reason === 'permission_denied' ? t('settings.pushErrDenied')
          : res.reason === 'timeout' ? t('settings.pushErrTimeout')
          : t('settings.pushErrGeneric'),
        );
      }
    } else {
      try { await unsubscribeFromPush(); } catch (err) { console.error('unsubscribeFromPush failed:', err); }
      // Re-check rather than assume — the browser may have refused.
      setPushEnabled(await isPushSubscribed());
    }
    setPushBusy(false);
  };

  const handle = (profileData as { handle?: string }).handle;
  const displayName = profileData.fullName || t('profile.newUser');
  const goalLabel = (v?: string) => { const g = GOAL_OPTIONS.find((o) => o.value === (v || 'maintain')); return g ? t(g.labelKey) : ''; };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="v2-page v2-page--nonav">
      <PageHeader title={t('v2.profileSettings')} onBack={() => onNavigate('home')} backLabel={t('profile.backHome')} />

      <div className="v2-profile-head">
        <span className="v2-avatar v2-avatar--lg" aria-hidden="true">{isLoading ? '…' : avatarLetter}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="v2-h2" style={{ fontSize: 22 }}>{displayName}</h2>
          <p className="v2-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {handle ? `@${handle}` : profileData.email}
          </p>
        </div>
        <IconBtn label={t('profile.edit')} onClick={() => onNavigate('edit-profile')}><Pencil size={20} {...ICON_PROPS} /></IconBtn>
      </div>

      {/* ── Health profile (BMI / calories / goal / activity) ── */}
      <span className="v2-group-label">{t('v2.healthData')}</span>
      <Group>
        {healthCalcs ? (
          <>
            <Row pillar="food" icon={<Scale size={22} {...ICON_PROPS} />} title="BMI" value={healthCalcs.bmi}
              sub={t(healthCalcs.bmiCat.labelKey)} />
            <Row pillar="act" icon={<Flame size={22} {...ICON_PROPS} />} title={t('v2.calorieTarget')}
              value={<>{healthCalcs.targetCal.toLocaleString()} <small className="v2-unit">kcal</small></>}
              sub={`TDEE ${healthCalcs.tdee.toLocaleString()} kcal · ${goalLabel(profileData.goal)}`} />
          </>
        ) : (
          <Row pillar="food" icon={<HeartPulse size={22} {...ICON_PROPS} />} title={t('v2.completeProfile')}
            sub={`${profileCompletion}% · ${t('v2.completeProfileSub')}`} chevron onClick={() => onNavigate('edit-profile')} />
        )}
      </Group>
      <div className="v2-field">
        <span className="v2-label">{t('v2.myGoal')}</span>
        <div className="v2-chips" role="group" aria-label={t('v2.myGoal')}>
          {GOAL_OPTIONS.map((g) => (
            <Chip key={g.value} on={(profileData.goal || 'maintain') === g.value} disabled={isSavingGoal} onClick={() => handleGoalChange(g.value)}>
              {t(g.labelKey)}
            </Chip>
          ))}
        </div>
      </div>
      <div className="v2-field">
        <span className="v2-label">{t('v2.activityLevel')}</span>
        <div className="v2-chips" role="group" aria-label={t('v2.activityLevel')}>
          {ACTIVITY_OPTIONS.map((a) => (
            <Chip key={a.value} on={(profileData.activityLevel || 'moderate') === a.value} disabled={isSavingGoal} onClick={() => handleActivityChange(a.value)}>
              {t(a.labelKey)}
            </Chip>
          ))}
        </div>
      </div>
      {saveError && <p className="v2-alert v2-alert--error" role="alert">{saveError}</p>}

      {/* ── General ── */}
      <span className="v2-group-label">{t('v2.general')}</span>
      <Group>
        <Row pillar="water" icon={<Sun size={22} {...ICON_PROPS} />} title={t('settings.appearance')}
          end={
            <Segmented className="v2-seg--theme" value={theme} onChange={(v) => setTheme(v as Theme)} options={[
              { value: 'light', label: t('v2.theme.light') },
              { value: 'dark', label: t('v2.theme.dark') },
              { value: 'system', label: t('v2.theme.system') },
            ]} />
          } />
        <Row pillar="water" icon={<Globe size={22} {...ICON_PROPS} />} title={t('settings.language')}
          end={
            <Segmented className="v2-seg--theme" value={lang} onChange={(v) => setLanguage(v as 'th' | 'en')} options={[
              { value: 'th', label: 'ไทย' },
              { value: 'en', label: 'EN' },
            ]} />
          } />
        <Row pillar="water" icon={<Bell size={22} {...ICON_PROPS} />} title={t('v2.remindLog')}
          sub={!pushSupported ? t('v2.pushUnsupported') : pushError ?? undefined}
          end={pushSupported ? <Toggle on={pushEnabled} onChange={(v) => void togglePush(v)} label={t('v2.remindLog')} /> : undefined} />
        <Row pillar="water" icon={<BellRing size={22} {...ICON_PROPS} />} title={t('settings.title')} sub={t('v2.settingsRowSub')} chevron onClick={() => onNavigate('settings')} />
      </Group>

      {/* ── Data & privacy ── */}
      <span className="v2-group-label">{t('v2.dataPrivacy')}</span>
      <Group>
        <Row pillar="water" icon={<Shield size={22} {...ICON_PROPS} />} title={t('v2.teamVisibility')} chevron onClick={() => onNavigate('privacy-settings')} />
        <Row pillar="water" icon={<Info size={22} {...ICON_PROPS} />} title={t('v2.aiDataUse')} chevron onClick={() => onNavigate('privacy-settings')} />
        <Row pillar="water" icon={<Download size={22} {...ICON_PROPS} />} title={t('v2.installApp')} chevron
          onClick={() => window.dispatchEvent(new Event('mfu:show-install'))} />
      </Group>

      {/* ── About ── */}
      <span className="v2-group-label">{t('v2.about')}</span>
      <Group>
        <Row pillar="water" icon={<FileText size={22} {...ICON_PROPS} />} title={t('aboutTracker.title')} chevron onClick={() => onNavigate('about-tracker')} />
        <Row pillar="water" icon={<Sprout size={22} {...ICON_PROPS} />} title={t('aboutGarden.title')} chevron onClick={() => onNavigate('about-garden')} />
        <Row pillar="water" icon={<UserRound size={22} {...ICON_PROPS} />} title={t('aboutUs.title')} chevron onClick={() => onNavigate('about-us')} />
        {profileData.role === 'admin' && (
          <Row pillar="water" icon={<Users size={22} {...ICON_PROPS} />} title={t('profile.manageUsers')} chevron onClick={() => onNavigate('user-management')} />
        )}
      </Group>

      {/* ── Account ── */}
      <span className="v2-group-label">{t('v2.account')}</span>
      <Group>
        <Row pillar="water" icon={<LogOut size={22} {...ICON_PROPS} />} title={t('v2.logout')} onClick={() => setShowLogoutConfirm(true)} />
        <Row icon={<Trash2 size={22} {...ICON_PROPS} />} danger title={t('v2.deleteAccount')} sub={t('v2.deleteAccountSub')}
          onClick={() => onNavigate('privacy-settings')} />
      </Group>

      <p className="v2-foot">MFU Longevity Passport {t('v2.version')} {APP_VERSION}</p>

      <ConfirmDialog
        open={showLogoutConfirm}
        title={t('settings.logoutTitle')}
        variant="danger"
        confirmLabel={t('v2.logout')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => { setShowLogoutConfirm(false); onLogout(); }}
        onClose={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
};
