import React, { useState, useEffect } from 'react';
import { FaExclamationTriangle, FaFileAlt, FaHandshake, FaListAlt, FaShieldAlt, FaSkullCrossbones } from 'react-icons/fa';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { BottomNav } from '../components/BottomNav';
import { supabase, getCurrentUserProfile, updateScoreVisibility, deleteUserAccount } from '../services/supabaseClient';
import { BackButton } from '../components/BackButton';

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
  const [shareHabits, setShareHabits] = useState(false);
  const [anonymousAI, setAnonymousAI] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
    if (checked) {
      // Show confirmation modal before enabling
      setShowConfirmModal(true);
    } else {
      // Disable directly
      confirmShareChange(false);
    }
  };

  const confirmShareChange = async (isPublic: boolean) => {
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
      console.error('Error updating score visibility:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteStep === 1) {
      setDeleteStep(2);
      return;
    }
    // Step 2 confirmed — proceed with deletion
    setIsDeleting(true);
    try {
      // Part 1: Delete data from tables
      await deleteUserAccount();

      // Part 2: Call Edge Function to delete auth user
      if (supabase) {
        const { error: fnError } = await supabase.functions.invoke('delete-user', { body: {} });
        if (fnError) console.error('delete-user function error:', fnError);
      }

      // Clear local storage and redirect
      localStorage.clear();
      onNavigate('login');
    } catch (error) {
      console.error('Error deleting account:', error);
      alert(isTh ? 'ลบบัญชีไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' : 'Failed to delete account. Please try again.');
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

      <div className="profile-content page-content p-4 space-y-6">
        {/* Main Controls */}
        <div className="glass-card p-6 rounded-2xl" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content' }}>
          <div className="section-header mb-6">
            <span className="section-icon"><FaShieldAlt /></span>
            <span className="section-title font-bold">{isTh ? 'การตั้งค่าการแบ่งปันข้อมูล' : 'Sharing Preferences'}</span>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex-1 pr-4">
                <div className="font-bold text-sm">{isTh ? 'แชร์คะแนนการชะลอวัย' : 'Share Longevity Score'}</div>
                <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{isTh ? 'อนุญาตให้สมาชิกในทีมเห็นคะแนนรวมของคุณ' : 'Allow team members to see your overall score.'}</div>
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

            <div className="flex justify-between items-center pt-4 border-t" style={{ borderTopColor: 'var(--border-glass)' }}>
              <div className="flex-1 pr-4">
                <div className="font-bold text-sm">{isTh ? 'แชร์รายละเอียดพฤติกรรม' : 'Share Detailed Habits'}</div>
                <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{isTh ? 'แสดงให้สมาชิกในทีมเห็นระหว่างทำภารกิจร่วมกัน' : 'Visible to team members during shared missions.'}</div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={shareHabits} onChange={(e) => setShareHabits(e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="flex justify-between items-center pt-4 border-t" style={{ borderTopColor: 'var(--border-glass)' }}>
              <div className="flex-1 pr-4">
                <div className="font-bold text-sm">{isTh ? 'การมีส่วนร่วมพัฒนาระบบ AI' : 'AI Model Contribution'}</div>
                <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{isTh ? 'แบ่งปันข้อมูลการแก้ไขโดยไม่ระบุตัวตนเพื่อปรับปรุงการจดจำอาหาร' : 'Share anonymous corrections to improve food recognition.'}</div>
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
          <div className="grid grid-cols-1 gap-4 mt-4">
            <div className="p-3 rounded-xl border" style={{ background: 'var(--surface-soft)', borderColor: 'var(--border-glass)' }}>
              <div className="text-sm font-bold">{isTh ? 'สิทธิในการเข้าถึงข้อมูล' : 'Right to Access'}</div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{isTh ? 'คุณสามารถขอสำเนาข้อมูลส่วนบุคคลทั้งหมดที่เราจัดเก็บไว้เกี่ยวกับคุณได้ตลอดเวลา' : 'You can request a copy of all personal data we store about you at any time.'}</p>
            </div>
            <div className="p-3 rounded-xl border" style={{ background: 'var(--surface-soft)', borderColor: 'var(--border-glass)' }}>
              <div className="text-sm font-bold">{isTh ? 'สิทธิในการลบข้อมูล' : 'Right to Erasure'}</div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{isTh ? 'คุณมีสิทธิขอให้ลบบันทึกข้อมูลสุขภาพของคุณออกจากระบบอย่างถาวร' : 'You have the right to request permanent deletion of your health records.'}</p>
            </div>
            <div className="p-3 rounded-xl border" style={{ background: 'var(--surface-soft)', borderColor: 'var(--border-glass)' }}>
              <div className="text-sm font-bold">{isTh ? 'สิทธิในการถ่ายโอนข้อมูล' : 'Data Portability'}</div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{isTh ? 'ส่งออกประวัติกิจกรรมและโภชนาการของคุณในรูปแบบไฟล์มาตรฐาน' : 'Export your activity and nutrition history in standard digital formats.'}</p>
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
          <button className="mt-4 text-xs font-bold text-blue-700 underline">{isTh ? 'อ่านนโยบายความเป็นส่วนตัวฉบับเต็ม' : 'Read Full Privacy Policy'}</button>
        </div>

        {/* Danger Zone */}
        <div className="p-6 rounded-2xl border-2 border-dashed" style={{ padding: '1.5rem', background: 'var(--color-danger-soft, rgba(239, 68, 68, 0.12))', borderColor: 'var(--color-danger, #EF4444)' }}>
          <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--color-danger, #EF4444)' }}>{isTh ? 'พื้นที่อันตราย' : 'Danger Zone'}</h3>
          <p className="text-sm mb-4 break-words" style={{ overflowWrap: 'break-word', color: 'var(--text-secondary)' }}>{isTh ? 'การลบบัญชีของคุณจะลบประวัติสุขภาพทั้งหมดออกจากเซิร์ฟเวอร์ของเรา การดำเนินการนี้ไม่สามารถย้อนกลับได้' : 'Deleting your account will remove all health history from our servers. This action is irreversible.'}</p>
          <button 
            className="w-full py-3 rounded-xl text-white text-sm font-bold active:scale-95 transition-transform mt-6"
            style={{ marginTop: '1.5rem', background: 'var(--color-danger, #EF4444)', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.25)' }}
            onClick={() => { setDeleteStep(1); setShowDeleteModal(true); }}
          >
            {isTh ? 'ลบบัญชีและข้อมูลของฉัน' : 'Delete My Account & Data'}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px',
          }}
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            style={{
              background: 'var(--surface-solid)', backdropFilter: 'blur(16px)',
              borderRadius: '24px', padding: '28px', maxWidth: '360px', width: '100%',
              border: '1px solid var(--border-glass)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
              textAlign: 'center',
              animation: 'slideUp 0.3s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '48px', marginBottom: '12px' }}><FaHandshake /></div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary)', marginBottom: '8px' }}>
              {isTh ? 'แชร์กับทีมหรือไม่?' : 'Share with Team?'}
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
              {isTh ? 'คะแนนการชะลอวัยของคุณจะแสดงให้สมาชิกในทีมเห็น' : 'Your current longevity score will be visible to your team members.'}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px',
                  border: '1px solid var(--border-glass)', background: 'var(--surface-soft)',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)',
                }}
              >
                {isTh ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                onClick={() => confirmShareChange(true)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px',
                  border: 'none', background: 'linear-gradient(135deg, #1976D2, #1565C0)',
                  color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(25,118,210,0.3)',
                }}
              >
                {isTh ? 'ยืนยัน' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Double-Confirmation Modal */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px',
          }}
          onClick={() => { setShowDeleteModal(false); setDeleteStep(1); }}
        >
          <div
            style={{
              background: 'var(--surface-solid)', backdropFilter: 'blur(16px)',
              borderRadius: '24px', padding: '28px', maxWidth: '360px', width: '100%',
              border: '1px solid var(--border-glass)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
              textAlign: 'center',
              animation: 'slideUp 0.3s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>{deleteStep === 1 ? <FaExclamationTriangle /> : <FaSkullCrossbones />}</div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-danger)', marginBottom: '8px' }}>
              {deleteStep === 1 ? (isTh ? 'ต้องการลบบัญชีหรือไม่?' : 'Delete Account?') : (isTh ? 'คุณแน่ใจจริง ๆ หรือไม่?' : 'Are you absolutely sure?')}
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
              {deleteStep === 1
                ? (isTh ? 'การดำเนินการนี้จะลบบัญชีและข้อมูลการชะลอวัยของคุณอย่างถาวร' : 'This will permanently delete your account and all longevity data.')
                : (isTh ? 'การดำเนินการนี้เป็นการถาวรและข้อมูลทั้งหมดของคุณจะสูญหาย ไม่สามารถกู้คืนได้' : 'This action is permanent and all your longevity data will be lost. This cannot be undone.')}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteStep(1); }}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px',
                  border: '1px solid var(--border-glass)', background: 'var(--surface-soft)',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)',
                }}
              >
                {isTh ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px',
                  border: 'none', background: deleteStep === 1 ? 'var(--color-danger)' : '#b91c1c',
                  color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
                  opacity: isDeleting ? 0.6 : 1,
                }}
              >
                {isDeleting ? (isTh ? 'กำลังลบ...' : 'Deleting...') : (deleteStep === 1 ? (isTh ? 'ยืนยันการลบ' : 'Yes, Delete') : (isTh ? 'ลบอย่างถาวร' : 'Permanently Delete'))}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav
        active="profile"
        onNavigate={onNavigate}
        onOpenFoodRecognition={onOpenFoodRecognition}
        t={t}
        className="bottom-nav glass-card"
      />
    </div>
  );
};
