// The one top bar for every main tab page (Home, Log, Overview, Coach, Team).
// Layout is fixed: [brand mark] [title + optional subtitle] ........ [page actions] [bell] [profile].
// Pages only supply content (title, subtitle, extra actions) — never geometry. Sub-pages that
// need a back button keep using <PageHeader/>, which shares the same row height/padding tokens.
import React, { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { BrandLogo } from './BrandLogo';
import { IconBtn, ICON_PROPS } from './v2';
import { NotificationBell } from './notifications/NotificationBell';
import { supabase, isSupabaseConfigured, getCurrentUserProfile } from '../services/supabaseClient';
import { safeParse } from '../utils/safeStorage';
import type { PageType } from '../types/pages';

// Same lookup the Home greeting always used (profiles row → stored profile → e-mail prefix),
// cached for the session so five tab pages don't each repeat the request.
let nameCache: Promise<string> | null = null;
const loadName = (): Promise<string> => {
  if (!nameCache) {
    nameCache = (async () => {
      const stored = safeParse<any>(localStorage.getItem('profileData') || '{}', {});
      if (!isSupabaseConfigured()) return stored.fullName || '';
      try {
        const { data: { user } } = await supabase!.auth.getUser();
        if (!user) return '';
        const db = await getCurrentUserProfile();
        return db?.name || stored.fullName || user.email?.split('@')[0] || '';
      } catch { return stored.fullName || ''; }
    })();
  }
  return nameCache;
};
/** Call on logout / profile edit so the avatar re-reads the name. */
export const resetTopBarProfile = () => { nameCache = null; };

export const TopBar: React.FC<{
  title: string;
  subtitle?: string;
  onNavigate: (page: PageType) => void;
  actions?: React.ReactNode;
}> = ({ title, subtitle, onNavigate, actions }) => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  useEffect(() => { let on = true; loadName().then((n) => { if (on) setName(n); }); return () => { on = false; }; }, []);
  const letter = name ? name[0].toUpperCase() : null;

  return (
    <header className="v2-topbar">
      <BrandLogo size={28} className="v2-topbar-logo" />
      <div className="v2-topbar-text">
        <h1 className="v2-topbar-title">{title}</h1>
        {subtitle && <p className="v2-topbar-sub">{subtitle}</p>}
      </div>
      <div className="v2-topbar-actions">
        {actions}
        <NotificationBell onNavigate={onNavigate} />
        <IconBtn label={name ? `${t('nav.profile')} · ${name}` : t('nav.profile')} round primary onClick={() => onNavigate('profile')}>
          {letter ? <b className="v2-topbar-profile-letter">{letter}</b> : <UserRound size={22} {...ICON_PROPS} />}
        </IconBtn>
      </div>
    </header>
  );
};
