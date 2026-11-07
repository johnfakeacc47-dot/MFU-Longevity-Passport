import React, { useState, useEffect } from 'react';
import {
  FaExclamationTriangle, FaFileAlt, FaHandshake, FaListAlt, FaShieldAlt, FaSkullCrossbones,
  FaChartLine, FaClipboardList, FaRobot, FaDownload, FaTrashAlt, FaFileExport, FaChevronDown, FaChevronUp,
} from 'react-icons/fa';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { BottomNav } from '../components/BottomNav';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { supabase, getCurrentUserProfile, updateScoreVisibility, deleteUserAccount } from '../services/supabaseClient';
import { BackButton } from '../components/BackButton';

// Local-only preference flags (no server column exists for these yet).
const SHARE_HABITS_KEY = 'privacy.shareHabits';
const ANONYMOUS_AI_KEY = 'privacy.anonymousAI';

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw === 'true';
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch (err) {
    console.warn(`Could not persist ${key}:`, err);
  }
}

interface NoticeState {
  title: string;
  body: string;
  /** Runs when the notice is dismissed (e.g. finish navigating to login). */
  onDismiss?: () => void;
}

type PageType = 'login' | 'home' | 'eating' | 'dashboard' | 'team' | 'profile' | 'edit-profile' | 'user-management' | 'privacy-settings' | 'set-goals' | 'about-tracker';

interface PrivacySettingsProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const { t, language } = useLanguage();
  const isTh = language === 'th';
  useSEO(`${t('privacySettings.title')} · MFU Longevity Passport`, 'Manage your privacy and data preferences.');
  const [shareScore, setShareScore] = useState(false);
  const [shareHabits, setShareHabitsState] = useState(() => readFlag(SHARE_HABITS_KEY, false));
  const [anonymousAI, setAnonymousAIState] = useState(() => readFlag(ANONYMOUS_AI_KEY, true));
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [sharePending, setSharePending] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showFullPolicy, setShowFullPolicy] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const setShareHabits = (value: boolean) => {
    setShareHabitsState(value);
    writeFlag(SHARE_HABITS_KEY, value);
  };
  const setAnonymousAI = (value: boolean) => {
    setAnonymousAIState(value);
    writeFlag(ANONYMOUS_AI_KEY, value);
  };

  // Load the real setting from Supabase on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await getCurrentUserProfile();
        if (profile) {
          setShareScore(profile.is_score_public ?? false);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleShareToggle = (checked: boolean) => {
    setShareError(null);
    if (checked) {
      // Show confirmation modal before enabling
      setShowConfirmModal(true);
    } else {
      // Disable directly
      confirmShareChange(false);
    }
  };

  const confirmShareChange = async (isPublic: boolean) => {
    setSharePending(true);
    setShareError(null);
    try {
      await updateScoreVisibility(isPublic);
      setShareScore(isPublic);
      setShowConfirmModal(false);

      if (isPublic) {
        // Send push notification
        if ('Notification' in window && Notification.permission === 'granted') {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((registration) => {
              registration.showNotification(isTh ? 'อัปเดตความเป็นส่วนตัวแล้ว' : 'Privacy Updated', {
                body: isTh ? 'คุณได้แชร์คะแนนการชะลอวัยกับทีมของคุณแล้ว คุณสามารถปิดการแชร์ได้ตลอดเวลาในหน้าตั้งค่า' : 'You are now sharing your longevity score with your team. You can disable this anytime in settings.',
                icon: '/pwa-192x192.png',
                badge: '/pwa-192x192.png',
              });
            });
          } else {
            new Notification(isTh ? 'อัปเดตความเป็นส่วนตัวแล้ว' : 'Privacy Updated', {
              body: isTh ? 'คุณได้แชร์คะแนนการชะลอวัยกับทีมของคุณแล้ว คุณสามารถปิดการแชร์ได้ตลอดเวลาในหน้าตั้งค่า' : 'You are now sharing your longevity score with your team. You can disable this anytime in settings.',
              icon: '/pwa-192x192.png',
            });
          }
        }
      }
    } catch (error) {
      // The switch is controlled by `shareScore`, which we only flip on
      // success — so it already shows the real (unchanged) state. Surface the
      // failure inline (in the modal when enabling, under the row when
      // disabling) instead of leaving the modal silently stuck.
      console.error('Error updating score visibility:', error);
      setShareError(t('privacySettings.shareErr'));
    } finally {
      setSharePending(false);
    }
  };

  const closeShareModal = () => {
    if (sharePending) return;
    setShowConfirmModal(false);
    setShareError(null);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setShowDeleteModal(false);
    setDeleteStep(1);
  };

  const handleDeleteAccount = async () => {
    if (deleteStep === 1) {
      setDeleteStep(2);
      return;
    }
    // Step 2 confirmed — proceed with deletion
    setIsDeleting(true);
    try {
      // Part 1: Delete data from tables (profiles + everything cascading
      // from it — team_members, health_scores, notifications, etc.)
      await deleteUserAccount();

      // Part 2: Edge Function deletes the actual auth.users row (also
      // cascades ai_reports/chat_messages/daily_logs, which hang off
      // auth.users rather than profiles). If Part 1 succeeded but this
      // fails, the bulk of their data is already gone, but the login
      // credential and those 3 tables would be left behind — say so
      // honestly instead of quietly treating it as a full success.
      let authDeleteFailed = false;
      if (supabase) {
        const { error: fnError } = await supabase.functions.invoke('delete-user', { body: {} });
        if (fnError) {
          console.error('delete-user function error:', fnError);
          authDeleteFailed = true;
        }
      }

      const finishLogout = () => {
        // Clear local storage and redirect
        localStorage.clear();
        onNavigate('login');
      };

      if (authDeleteFailed) {
        // Non-blocking replacement for the old alert(): hold the redirect
        // until the user has actually read the message.
        setNotice({
          title: t('privacySettings.deletePartialTitle'),
          body: t('privacySettings.deletePartialBody'),
          onDismiss: finishLogout,
        });
      } else {
        finishLogout();
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      setNotice({
        title: t('privacySettings.deleteFailedTitle'),
        body: t('privacySettings.deleteFailedBody'),
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setDeleteStep(1);
    }
  };

  return (
    <div className="profile-container pb-24 premium-gradient" style={{ minHeight: '100vh' }}>
      <header className="profile-top-header" style={{ background: 'transparent', border: 'none' }}>
        <BackButton onClick={() => onNavigate('profile')} ariaLabel={t('common.back')} />
        <h1 className="header-title text-gradient">{isTh ? 'ความเป็นส่วนตัวและข้อมูล' : 'Privacy & Data'}</h1>
        <div style={{ width: 44 }} />
      </header>

      <div className="profile-content page-content p-4">
        {/* Main Controls */}
        <div className="glass-card p-6 rounded-2xl" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content' }}>
          <div className="section-header mb-6">
            <span className="section-icon"><FaShieldAlt /></span>
            <span className="section-title font-bold">{isTh ? 'การตั้งค่าการแบ่งปันข้อมูล' : 'Sharing Preferences'}</span>
          </div>

          <div className="pv-toggle-list">
            <div className="pv-toggle-row">
              <span className="pv-row-icon" style={{ color: '#3B82F6', background: 'rgba(59,130,246,0.15)' }}><FaChartLine /></span>
              <div className="pv-row-text">
                <div className="pv-row-title">{isTh ? 'แชร์คะแนนการชะลอวัย' : 'Share Longevity Score'}</div>
                <div className="pv-row-desc">{isTh ? 'อนุญาตให้สมาชิกในทีมเห็นคะแนนรวมของคุณ' : 'Allow team members to see your overall score.'}</div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={shareScore}
                  disabled={isLoading}
                  onChange={(e) => handleShareToggle(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            {shareError && !showConfirmModal && (
              <p role="alert" style={{ color: 'var(--color-danger, #EF4444)', fontSize: 12.5, margin: '-4px 0 8px', lineHeight: 1.5 }}>{shareError}</p>
            )}

            <div className="pv-toggle-row">
              <span className="pv-row-icon" style={{ color: '#F59E0B', background: 'rgba(245,158,11,0.15)' }}><FaClipboardList /></span>
              <div className="pv-row-text">
                <div className="pv-row-title">{isTh ? 'แชร์รายละเอียดพฤติกรรม' : 'Share Detailed Habits'}</div>
                <div className="pv-row-desc">{isTh ? 'แสดงให้สมาชิกในทีมเห็นระหว่างทำภารกิจร่วมกัน' : 'Visible to team members during shared missions.'}</div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={shareHabits} onChange={(e) => setShareHabits(e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="pv-toggle-row">
              <span className="pv-row-icon" style={{ color: '#8B5CF6', background: 'rgba(139,92,246,0.15)' }}><FaRobot /></span>
              <div className="pv-row-text">
                <div className="pv-row-title">{isTh ? 'การมีส่วนร่วมพัฒนาระบบ AI' : 'AI Model Contribution'}</div>
                <div className="pv-row-desc">{isTh ? 'แบ่งปันข้อมูลการแก้ไขโดยไม่ระบุตัวตนเพื่อปรับปรุงการจดจำอาหาร' : 'Share anonymous corrections to improve food recognition.'}</div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={anonymousAI} onChange={(e) => setAnonymousAI(e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        {/* Your Rights Section */}
        <div className="glass-card p-6 rounded-2xl" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content' }}>
          <div className="section-header mb-4">
            <span className="section-icon"><FaFileAlt /></span>
            <span className="section-title font-bold">{isTh ? 'สิทธิของคุณตามกฎหมายคุ้มครองข้อมูลส่วนบุคคล' : 'Your Rights (PDPA)'}</span>
          </div>
          <div className="pv-rights-list mt-4">
            <div className="pv-rights-item">
              <span className="pv-row-icon" style={{ color: '#3B82F6', background: 'rgba(59,130,246,0.15)' }}><FaDownload /></span>
              <div className="pv-row-text">
                <div className="pv-row-title">{isTh ? 'สิทธิในการเข้าถึงข้อมูล' : 'Right to Access'}</div>
                <p className="pv-row-desc">{isTh ? 'คุณสามารถขอสำเนาข้อมูลส่วนบุคคลทั้งหมดที่เราจัดเก็บไว้เกี่ยวกับคุณได้ตลอดเวลา' : 'You can request a copy of all personal data we store about you at any time.'}</p>
              </div>
            </div>
            <div className="pv-rights-item">
              <span className="pv-row-icon" style={{ color: '#EF4444', background: 'rgba(239,68,68,0.15)' }}><FaTrashAlt /></span>
              <div className="pv-row-text">
                <div className="pv-row-title">{isTh ? 'สิทธิในการลบข้อมูล' : 'Right to Erasure'}</div>
                <p className="pv-row-desc">{isTh ? 'คุณมีสิทธิขอให้ลบบันทึกข้อมูลสุขภาพของคุณออกจากระบบอย่างถาวร' : 'You have the right to request permanent deletion of your health records.'}</p>
              </div>
            </div>
            <div className="pv-rights-item">
              <span className="pv-row-icon" style={{ color: '#10B981', background: 'rgba(16,185,129,0.15)' }}><FaFileExport /></span>
              <div className="pv-row-text">
                <div className="pv-row-title">{isTh ? 'สิทธิในการถ่ายโอนข้อมูล' : 'Data Portability'}</div>
                <p className="pv-row-desc">{isTh ? 'ส่งออกประวัติกิจกรรมและโภชนาการของคุณในรูปแบบไฟล์มาตรฐาน' : 'Export your activity and nutrition history in standard digital formats.'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Policy Summary */}
        <div className="glass-card p-6 rounded-2xl" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content' }}>
          <div className="section-header mb-4">
            <span className="section-icon"><FaListAlt /></span>
            <span className="section-title font-bold">{isTh ? 'สรุปนโยบายความเป็นส่วนตัว' : 'Policy Summary'}</span>
          </div>
          <p className="text-sm leading-relaxed break-words" style={{ overflowWrap: 'break-word', color: 'var(--text-secondary)' }}>
            {isTh
              ? 'MFU Longevity Passport เก็บรวบรวมข้อมูลที่เกี่ยวข้องกับสุขภาพเพื่อวัตถุประสงค์ในการคำนวณคะแนนการชะลอวัยและให้คำแนะนำสุขภาพส่วนบุคคลเท่านั้น'
              : 'The MFU Longevity Passport collects health-related data solely to calculate your longevity score and provide personalized wellness insights.'}
            <br/><br/>
            {isTh ? (
              <>เราใช้การเข้ารหัสข้อมูลตามมาตรฐานสากลเพื่อปกป้องข้อมูลของคุณ บันทึกสุขภาพของคุณจะ<strong>ไม่ถูกเปิดเผย</strong>ต่อบุคคลที่สามโดยปราศจากความยินยอมที่ชัดแจ้งของคุณ</>
            ) : (
              <>We use industry-standard encryption to protect your data. Your specific health logs are <strong>never</strong> shared with third parties without your explicit consent.</>
            )}
          </p>
          {/* There is no separate policy page or /privacy-policy.html in this
              app, so "read the full policy" expands the summary in place
              rather than being a dead control. */}
          {showFullPolicy && (
            <div id="pv-full-policy" className="mt-4" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {([
                ['privacySettings.policyCollectTitle', 'privacySettings.policyCollectBody'],
                ['privacySettings.policyUseTitle', 'privacySettings.policyUseBody'],
                ['privacySettings.policyShareTitle', 'privacySettings.policyShareBody'],
                ['privacySettings.policyControlTitle', 'privacySettings.policyControlBody'],
              ] as const).map(([titleKey, bodyKey]) => (
                <div key={titleKey} className="pv-rights-item" style={{ flexDirection: 'column', gap: 4 }}>
                  <div className="pv-row-title">{t(titleKey)}</div>
                  <p className="pv-row-desc" style={{ margin: 0 }}>{t(bodyKey)}</p>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            className="pv-policy-link"
            onClick={() => setShowFullPolicy((v) => !v)}
            aria-expanded={showFullPolicy}
            aria-controls="pv-full-policy"
          >
            {showFullPolicy ? t('privacySettings.hideFullPolicy') : t('privacySettings.readFullPolicy')}
            {showFullPolicy ? <FaChevronUp /> : <FaChevronDown />}
          </button>
        </div>

        {/* Danger Zone */}
        <div className="p-6 rounded-2xl border-2 border-dashed" style={{ padding: '1.5rem', background: 'var(--color-danger-soft, rgba(239, 68, 68, 0.12))', borderColor: 'var(--color-danger, #EF4444)' }}>
          <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--color-danger, #EF4444)' }}>{isTh ? 'พื้นที่อันตราย' : 'Danger Zone'}</h3>
          <p className="text-sm mb-4 break-words" style={{ overflowWrap: 'break-word', color: 'var(--text-secondary)' }}>{isTh ? 'การลบบัญชีของคุณจะลบประวัติสุขภาพทั้งหมดออกจากเซิร์ฟเวอร์ของเรา การดำเนินการนี้ไม่สามารถย้อนกลับได้' : 'Deleting your account will remove all health history from our servers. This action is irreversible.'}</p>
          {/* Fixed red-600 rather than --color-danger: that token is a light
              #F87171 in dark mode, where white text on it fails contrast. */}
          <button
            type="button"
            className="w-full py-3 rounded-xl text-white text-sm font-bold active:scale-95 transition-transform"
            style={{ marginTop: '1.5rem', background: '#DC2626', boxShadow: '0 4px 14px rgba(220, 38, 38, 0.25)' }}
            onClick={() => { setDeleteStep(1); setShowDeleteModal(true); }}
          >
            {isTh ? 'ลบบัญชีและข้อมูลของฉัน' : 'Delete My Account & Data'}
          </button>
        </div>
      </div>

      {/* Share-with-team confirmation */}
      <ConfirmDialog
        open={showConfirmModal}
        icon={<FaHandshake />}
        title={isTh ? 'แชร์กับทีมหรือไม่?' : 'Share with Team?'}
        message={isTh ? 'คะแนนการชะลอวัยของคุณจะแสดงให้สมาชิกในทีมเห็น' : 'Your current longevity score will be visible to your team members.'}
        confirmLabel={isTh ? 'ยืนยัน' : 'Confirm'}
        cancelLabel={isTh ? 'ยกเลิก' : 'Cancel'}
        pending={sharePending}
        pendingLabel={t('privacySettings.saving')}
        error={shareError}
        onConfirm={() => confirmShareChange(true)}
        onClose={closeShareModal}
      />

      {/* Delete account — two-step confirmation */}
      <ConfirmDialog
        open={showDeleteModal}
        variant="danger"
        icon={deleteStep === 1 ? <FaExclamationTriangle /> : <FaSkullCrossbones />}
        title={deleteStep === 1 ? (isTh ? 'ต้องการลบบัญชีหรือไม่?' : 'Delete Account?') : (isTh ? 'คุณแน่ใจจริง ๆ หรือไม่?' : 'Are you absolutely sure?')}
        message={deleteStep === 1
          ? (isTh ? 'การดำเนินการนี้จะลบบัญชีและข้อมูลการชะลอวัยของคุณอย่างถาวร' : 'This will permanently delete your account and all longevity data.')
          : (isTh ? 'การดำเนินการนี้เป็นการถาวรและข้อมูลทั้งหมดของคุณจะสูญหาย ไม่สามารถกู้คืนได้' : 'This action is permanent and all your longevity data will be lost. This cannot be undone.')}
        confirmLabel={deleteStep === 1 ? (isTh ? 'ยืนยันการลบ' : 'Yes, Delete') : (isTh ? 'ลบอย่างถาวร' : 'Permanently Delete')}
        cancelLabel={isTh ? 'ยกเลิก' : 'Cancel'}
        pending={isDeleting}
        pendingLabel={isTh ? 'กำลังลบ...' : 'Deleting...'}
        onConfirm={handleDeleteAccount}
        onClose={closeDeleteModal}
      />

      {/* Non-blocking replacement for alert() */}
      <ConfirmDialog
        open={notice !== null}
        variant="danger"
        icon={<FaExclamationTriangle />}
        title={notice?.title ?? ''}
        message={notice?.body}
        confirmLabel={t('common.close')}
        onConfirm={() => { const n = notice; setNotice(null); n?.onDismiss?.(); }}
        onClose={() => { const n = notice; setNotice(null); n?.onDismiss?.(); }}
      />

      <BottomNav
        active="profile"
        onNavigate={onNavigate}
        onOpenFoodRecognition={onOpenFoodRecognition}
        t={t}
      />
    </div>
  );
};
