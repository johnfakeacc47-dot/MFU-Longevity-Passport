import React, { useState, useEffect, useCallback } from 'react';
import { FaChevronRight, FaEdit, FaExclamationTriangle, FaSearch, FaTimes, FaTrash } from 'react-icons/fa';
import type { User, CreateUserPayload } from '../services/userApi';
import { isSupabaseConfigured, getAllProfiles, updateProfile, deleteProfile, adminCreateUser, supabase } from '../services/supabaseClient';
import { userApi } from '../services/userApi';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { BottomNav } from '../components/BottomNav';
import { BackButton } from '../components/BackButton';

// Sample rows for local development only. In production a failed fetch must
// surface as an error, never as a table of fabricated people.
const MOCK_USERS: User[] = [
  { id: '1', name: 'John Doe', email: 'john@mfu.ac.th', mfuId: '643010001', role: 'student', createdAt: new Date().toISOString() },
  { id: '2', name: 'Somchai Rakdee', email: 'somchai@mfu.ac.th', mfuId: '643010002', role: 'staff', createdAt: new Date().toISOString() },
  { id: '3', name: 'Admin User', email: 'admin@mfu.ac.th', mfuId: 'admin01', role: 'admin', createdAt: new Date().toISOString() },
];

const EMPTY_FORM = {
  email: '',
  mfuId: '',
  name: '',
  role: 'student' as User['role'],
  faculty: '',
  department: '',
};

interface UserManagementProps {
  onNavigate?: (page: any) => void;
  onOpenFoodRecognition?: () => void;
}

/** Minimal `{n}` / `{name}` substitution — t() itself returns plain strings. */
const fill = (template: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), template);

const infoBannerStyle: React.CSSProperties = {
  background: 'rgba(59,130,246,0.10)',
  padding: '10px 16px',
  borderRadius: 8,
  marginBottom: 16,
  fontSize: 13,
  color: 'var(--text-accent, #1976D2)',
  border: '1px solid rgba(59,130,246,0.25)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

export default function UserManagement({ onNavigate, onOpenFoodRecognition }: UserManagementProps) {
  const { t, language } = useLanguage();
  useSEO(`${t('userManagement.title')} · MFU Longevity Passport`, 'Manage users and permissions across the platform.');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | User['role']>('all');
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | '365d'>('all');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  const formatDate = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatRelative = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return t('userManagement.justNow');
    if (minutes < 60) return fill(t('userManagement.minAgo'), { n: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return fill(t('userManagement.hoursAgo'), { n: hours });
    const days = Math.floor(hours / 24);
    if (days < 7) return fill(t('userManagement.daysAgo'), { n: days });
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return fill(t('userManagement.weeksAgo'), { n: weeks });
    const months = Math.floor(days / 30);
    if (months < 12) return fill(t('userManagement.monthsAgo'), { n: months });
    const years = Math.floor(days / 365);
    return fill(t('userManagement.yearsAgo'), { n: years });
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  };

  const formatRole = (role?: string) => {
    switch (role) {
      case 'student': return t('userManagement.roleStudent');
      case 'staff': return t('userManagement.roleStaff');
      case 'admin': return t('userManagement.roleAdmin');
      default: return t('userManagement.roleUser');
    }
  };

  const matchesSearch = (user: User, term: string) => {
    const normalized = term.trim().toLowerCase();
    if (!normalized) return true;
    return [user?.name, user?.email, user?.mfuId, user?.faculty, user?.department]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalized));
  };

  const isWithinDate = (user: User, filter: typeof dateFilter) => {
    if (filter === 'all') return true;
    if (!user?.createdAt) return true;
    const created = new Date(user.createdAt);
    if (Number.isNaN(created.getTime())) return true;
    const now = new Date();
    const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    if (filter === '7d') return diffDays <= 7;
    if (filter === '30d') return diffDays <= 30;
    if (filter === '365d') return diffDays <= 365;
    return true;
  };

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setLoadFailed(false);

      // 1. Try Supabase first
      if (isSupabaseConfigured()) {
        const profiles = await getAllProfiles();
        if (profiles && profiles.length > 0) {
          const mappedUsers = profiles.map((p: any) => ({
            id: p.id || String(Math.random()),
            name: p.name || '',
            email: p.email || '',
            mfuId: p.mfu_id || '-',
            role: (p.role as User['role']) || 'student',
            createdAt: p.created_at || new Date().toISOString(),
            faculty: p.faculty || '',
            department: p.department || ''
          }));
          setUsers(mappedUsers);
          setError('');
          setIsOffline(false);
          return;
        }
      }

      // 2. Try API fallback
      const data = await userApi.getAllUsers();
      setUsers(data);
      setError('');
      setIsOffline(false);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('Backend fetch failed, using mock data (DEV only).', err);
        setUsers(MOCK_USERS);
        setIsOffline(true);
        setError('');
      } else {
        console.error('Failed to load users:', err);
        setUsers([]);
        setIsOffline(false);
        setLoadFailed(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setNotice('');

      if (editingId) {
        // Update existing user
        let updated: User;
        if (isSupabaseConfigured()) {
            const result = await updateProfile(editingId, formData);
            updated = {
                id: result.id,
                name: result.name,
                email: result.email,
                mfuId: result.mfu_id,
                role: result.role as User['role'],
                createdAt: result.created_at,
                faculty: result.faculty,
                department: result.department
            };
        } else {
            updated = await userApi.updateUser(editingId, {
              name: formData.name,
              email: formData.email,
              role: formData.role,
              faculty: formData.faculty,
              department: formData.department,
            });
        }
        setUsers(users.map(u => (u.id === editingId ? updated : u)));
        setEditingId(null);
      } else {
        // Create new user
        let result: User;
        if (isSupabaseConfigured()) {
            const newUser = await adminCreateUser(formData);
            result = {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                mfuId: newUser.mfu_id,
                role: newUser.role as User['role'],
                createdAt: newUser.created_at,
                faculty: newUser.faculty,
                department: newUser.department
            };
        } else {
            result = await userApi.createUser(formData as CreateUserPayload);

            // Handle spoofed offline response
            if ('offlineQueued' in (result as any)) {
              const tempUser: User = {
                id: 'temp-' + Date.now(),
                ...formData,
                createdAt: new Date().toISOString(),
              } as User;
              setUsers([tempUser, ...users]);
              setNotice(t('userManagement.offlineQueued'));
              setFormData({ ...EMPTY_FORM });
              setShowForm(false);
              setLoading(false);
              return;
            }
        }
        setUsers([result, ...users]);
      }

      setFormData({ ...EMPTY_FORM });
      setShowForm(false);
      setError('');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('userManagement.errOperation'));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setFormData({
      email: user.email,
      mfuId: user.mfuId,
      name: user.name,
      role: user.role,
      faculty: user.faculty || '',
      department: user.department || '',
    });
    setEditingId(user.id);
    setShowForm(true);
  };

  const requestDelete = async (user: User) => {
    setError('');
    // Safety check: an admin must not delete the account they are signed in with.
    if (isSupabaseConfigured() && supabase) {
      const { data } = await supabase.auth.getUser();
      if (data.user && data.user.id === user.id) {
        setError(t('userManagement.errSelfDelete'));
        return;
      }
    }
    setPendingDelete(user);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setDeleting(true);
    try {
      if (isSupabaseConfigured()) {
        await deleteProfile(id);
      } else {
        await userApi.deleteUser(id);
      }
      setUsers((prev) => prev.filter(u => u.id !== id));
      setError('');
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('userManagement.errDelete'));
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  // Escape closes the confirm panel (mirrors the overlay click).
  useEffect(() => {
    if (!pendingDelete) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !deleting) setPendingDelete(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingDelete, deleting]);

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ ...EMPTY_FORM });
  };

  const filteredUsers = users.filter((user) => {
    const roleMatch = roleFilter === 'all' ? true : user.role === roleFilter;
    const dateMatch = isWithinDate(user, dateFilter);
    return roleMatch && dateMatch && matchesSearch(user, searchTerm);
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const pagedUsers = filteredUsers.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);
  const roleLabel = t('userManagement.roleLabel');

  return (
    <div className="user-management-page">
      <div className="user-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          {onNavigate && (
            <BackButton onClick={() => onNavigate('home')} ariaLabel={t('common.back')} />
          )}
          <div>
            <h1>{t('userManagement.title')}</h1>
            <p>{t('userManagement.subtitle')}</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => (showForm ? handleCancel() : setShowForm(true))}>
            {showForm ? t('common.close') : t('userManagement.addUser')}
          </button>
        </div>
      </div>

      {isOffline && (
        <div style={{ ...infoBannerStyle, color: '#B45309', background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.30)' }} role="status">
          <FaExclamationTriangle aria-hidden="true" /> <span>{t('userManagement.offlineBanner')}</span>
        </div>
      )}

      {notice && (
        <div style={infoBannerStyle} role="status">
          <span>{notice}</span>
        </div>
      )}

      {isSupabaseConfigured() && !isOffline && !loadFailed && (
        <div style={{ ...infoBannerStyle, fontSize: 12, padding: '8px 16px' }}>
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" aria-hidden="true"></span>
          <span>{t('userManagement.liveBanner')}</span>
        </div>
      )}

      <div className="filter-bar">
        <div className="search-input">
          <span className="search-icon"><FaSearch aria-hidden="true" /></span>
          <input
            type="search"
            placeholder={t('userManagement.searchPlaceholder')}
            aria-label={t('userManagement.searchPlaceholder')}
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="filter-group">
          <select
            className="filter-select"
            aria-label={roleLabel}
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value as typeof roleFilter);
              setCurrentPage(1);
            }}
          >
            <option value="all">{roleLabel}: {t('common.all')}</option>
            <option value="student">{roleLabel}: {t('userManagement.roleStudent')}</option>
            <option value="staff">{roleLabel}: {t('userManagement.roleStaff')}</option>
            <option value="admin">{roleLabel}: {t('userManagement.roleAdmin')}</option>
          </select>
          <select
            className="filter-select"
            aria-label={t('userManagement.dateLabel')}
            value={dateFilter}
            onChange={(event) => {
              setDateFilter(event.target.value as typeof dateFilter);
              setCurrentPage(1);
            }}
          >
            <option value="all">{t('userManagement.dateLabel')}: {t('common.all')}</option>
            <option value="7d">{t('userManagement.last7')}</option>
            <option value="30d">{t('userManagement.last30')}</option>
            <option value="365d">{t('userManagement.last365')}</option>
          </select>
        </div>
      </div>

      {error && <div className="error-message" role="alert">{error}</div>}

      {showForm && (
        <form className="user-form" onSubmit={handleSubmit}>
          <div className="form-header">
            <h2>{editingId ? t('userManagement.editUser') : t('userManagement.createUser')}</h2>
            <button type="button" className="icon-close" onClick={handleCancel} aria-label={t('common.close')}>
              <FaTimes aria-hidden="true" />
            </button>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="um-name">{t('userManagement.name')} *</label>
              <input
                id="um-name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="um-email">{t('userManagement.email')} *</label>
              <input
                id="um-email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="um-mfu-id">{t('userManagement.mfuId')} *</label>
              <input
                id="um-mfu-id"
                type="text"
                required
                disabled={!!editingId}
                value={formData.mfuId}
                onChange={(e) => setFormData({ ...formData, mfuId: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="um-role">{roleLabel} *</label>
              <select
                id="um-role"
                required
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as User['role'] })}
              >
                <option value="student">{t('userManagement.roleStudent')}</option>
                <option value="staff">{t('userManagement.roleStaff')}</option>
                <option value="admin">{t('userManagement.roleAdmin')}</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="um-faculty">{t('userManagement.faculty')} ({t('common.optional')})</label>
              <input
                id="um-faculty"
                type="text"
                value={formData.faculty}
                onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="um-department">{t('userManagement.department')} ({t('common.optional')})</label>
              <input
                id="um-department"
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? t('profile.goalSaving') : editingId ? t('userManagement.updateUser') : t('userManagement.createUserBtn')}
            </button>
            <button type="button" className="btn-outline" onClick={handleCancel}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      <div className="table-card">
        {loading && !showForm && <p className="loading-text">{t('userManagement.loading')}</p>}

        {loadFailed && !loading && (
          <div className="no-users" role="alert">
            <FaExclamationTriangle style={{ color: '#F59E0B', fontSize: 28, marginBottom: 10 }} aria-hidden="true" />
            <p style={{ margin: '0 0 16px' }}>{t('userManagement.loadError')}</p>
            <button type="button" className="btn-primary" onClick={() => void fetchUsers()}>
              {t('userManagement.retry')}
            </button>
          </div>
        )}

        {!loadFailed && filteredUsers.length === 0 && !loading && (
          <p className="no-users">{t('userManagement.noUsers')}</p>
        )}

        {filteredUsers.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>{t('userManagement.colName')}</th>
                  <th>{t('userManagement.colEmail')}</th>
                  <th>{t('userManagement.colUsername')}</th>
                  <th>{roleLabel}</th>
                  <th>{t('userManagement.colJoined')}</th>
                  <th>{t('userManagement.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-cell">
                        <div className="avatar" aria-hidden="true">{getInitials(user?.name || user?.email || '??')}</div>
                        <div>
                          <div className="user-name">{user?.name || t('userManagement.unknownUser')}</div>
                          <div className="user-sub">{user?.faculty || user?.department || 'MFU'}</div>
                        </div>
                      </div>
                    </td>
                    <td>{user.email || '-'}</td>
                    <td>{user.mfuId}</td>
                    <td><span className={`role-pill role-${user.role}`}>{formatRole(user.role)}</span></td>
                    <td>
                      <div>{formatDate(user.createdAt)}</div>
                      <div className="user-sub">{formatRelative(user.createdAt)}</div>
                    </td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="um-icon-btn"
                        onClick={() => handleEdit(user)}
                        disabled={loading}
                        aria-label={`${t('userManagement.editUser')}: ${user.name || user.email}`}
                        title={t('userManagement.editUser')}
                      >
                        <FaEdit aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="um-icon-btn danger"
                        onClick={() => void requestDelete(user)}
                        disabled={loading}
                        aria-label={`${t('common.delete')}: ${user.name || user.email}`}
                        title={t('common.delete')}
                      >
                        <FaTrash aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="table-footer">
          <div className="rows-info">
            <label htmlFor="um-rows-per-page">{t('userManagement.rowsPerPage')}</label>
            <select
              id="um-rows-per-page"
              className="rows-select"
              value={rowsPerPage}
              onChange={(event) => {
                setRowsPerPage(Number(event.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            {fill(t('userManagement.rowsOf'), { n: filteredUsers.length })}
          </div>
          <nav className="pagination" aria-label={t('userManagement.pagination')}>
            <button
              type="button"
              className="page-btn"
              onClick={() => setCurrentPage(1)}
              disabled={safePage === 1}
              aria-label={t('userManagement.firstPage')}
            >
              «
            </button>
            <button
              type="button"
              className="page-btn"
              onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
              disabled={safePage === 1}
              aria-label={t('userManagement.prevPage')}
            >
              ‹
            </button>
            <span className="page-btn active" aria-current="page">{safePage}</span>
            <button
              type="button"
              className="page-btn"
              onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
              disabled={safePage === totalPages}
              aria-label={t('userManagement.nextPage')}
            >
              <FaChevronRight aria-hidden="true" />
            </button>
            <button
              type="button"
              className="page-btn"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage === totalPages}
              aria-label={t('userManagement.lastPage')}
            >
              »
            </button>
          </nav>
        </div>
      </div>

      {/* In-page delete confirmation (replaces window.confirm) */}
      {pendingDelete && (
        <div className="modal-overlay" onClick={() => { if (!deleting) setPendingDelete(null); }}>
          <div
            className="modal-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="um-confirm-title"
            aria-describedby="um-confirm-body"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-v2">
              <h3 className="modal-title" id="um-confirm-title">{t('userManagement.confirmDeleteTitle')}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setPendingDelete(null)} aria-label={t('common.close')} disabled={deleting}>
                <FaTimes aria-hidden="true" />
              </button>
            </div>
            <div className="modal-body">
              <p id="um-confirm-body" style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                {fill(t('userManagement.confirmDeleteBody'), { name: pendingDelete.name || pendingDelete.email })}
              </p>
              <div className="modal-actions">
                <button type="button" className="modal-btn modal-btn--cancel" onClick={() => setPendingDelete(null)} disabled={deleting}>
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="modal-btn modal-btn--confirm"
                  style={{ background: '#EF4444' }}
                  onClick={() => void confirmDelete()}
                  disabled={deleting}
                  autoFocus
                >
                  {deleting ? t('userManagement.deleting') : t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {onNavigate && onOpenFoodRecognition && (
        <BottomNav active="profile" onNavigate={onNavigate} onOpenFoodRecognition={onOpenFoodRecognition} t={t} />
      )}
    </div>
  );
}
