import React, { useState, useEffect } from 'react';
import { FaChevronRight, FaEdit, FaExclamationTriangle, FaSearch, FaTimes, FaTrash } from 'react-icons/fa';
import type { User, CreateUserPayload } from '../services/userApi';
import { isSupabaseConfigured, getAllProfiles, updateProfile, deleteProfile, adminCreateUser, supabase } from '../services/supabaseClient';
import { userApi } from '../services/userApi';
import { useLanguage } from '../contexts/LanguageContext';
import { BottomNav } from '../components/BottomNav';
import { BackButton } from '../components/BackButton';

const MOCK_USERS: User[] = [
  { id: '1', name: 'John Doe', email: 'john@mfu.ac.th', mfuId: '643010001', role: 'student', createdAt: new Date().toISOString() },
  { id: '2', name: 'Somchai Rakdee', email: 'somchai@mfu.ac.th', mfuId: '643010002', role: 'staff', createdAt: new Date().toISOString() },
  { id: '3', name: 'Admin User', email: 'admin@mfu.ac.th', mfuId: 'admin01', role: 'admin', createdAt: new Date().toISOString() },
];

interface UserManagementProps {
  onNavigate?: (page: any) => void;
  onOpenFoodRecognition?: () => void;
}

export default function UserManagement({ onNavigate, onOpenFoodRecognition }: UserManagementProps) {
  const { t } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | User['role']>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | '365d'>('all');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isOffline, setIsOffline] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    mfuId: '',
    name: '',
    role: 'student' as const,
    faculty: '',
    department: '',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const formatDate = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-US', {
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
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} days ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks} weeks ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} months ago`;
    const years = Math.floor(days / 365);
    return `${years} years ago`;
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  };

  const formatRole = (role?: string) => {
    if (!role) return 'User';
    return role.charAt(0).toUpperCase() + role.slice(1);
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

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // 1. Try Supabase first
      if (isSupabaseConfigured()) {
        const profiles = await getAllProfiles();
        if (profiles && profiles.length > 0) {
          console.log('Fetched profiles:', profiles);
          const mappedUsers = profiles.map((p: any) => ({
            id: p.id || String(Math.random()),
            name: p.name || 'Unknown',
            email: p.email || 'no-email@mfu.ac.th',
            mfuId: p.mfu_id || 'N/A',
            role: (p.role as any) || 'student',
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
      console.warn('Backend fetch failed, using mock data for demonstration.', err);
      setUsers(MOCK_USERS);
      setIsOffline(true);
      setError('');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);

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
                role: result.role as any,
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
                role: newUser.role as any,
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
              alert('Backend offline. User creation queued for later sync.');
              setFormData({ email: '', mfuId: '', name: '', role: 'student', faculty: '', department: '' });
              setShowForm(false);
              setLoading(false);
              return;
            }
        }
        setUsers([result, ...users]);
      }

      setFormData({
        email: '',
        mfuId: '',
        name: '',
        role: 'student',
        faculty: '',
        department: '',
      });
      setShowForm(false);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setFormData({
      email: user.email,
      mfuId: user.mfuId,
      name: user.name,
      role: user.role as any,
      faculty: user.faculty || '',
      department: user.department || '',
    });
    setEditingId(user.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    // Safety Check: Prevent self-deletion
    if (isSupabaseConfigured()) {
        const { data } = await supabase!.auth.getUser();
        if (data.user && data.user.id === id) {
            alert('Security Restriction: You cannot delete your own admin account while logged in.');
            return;
        }
    }

    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      if (isSupabaseConfigured()) {
        await deleteProfile(id);
      } else {
        await userApi.deleteUser(id);
      }
      setUsers(users.filter(u => u.id !== id));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      email: '',
      mfuId: '',
      name: '',
      role: 'student',
      faculty: '',
      department: '',
    });
  };

  const filteredUsers = users.filter((user) => {
    const roleMatch = roleFilter === 'all' ? true : user.role === roleFilter;
    const statusMatch = statusFilter === 'all' ? true : statusFilter === 'active';
    const dateMatch = isWithinDate(user, dateFilter);
    return roleMatch && statusMatch && dateMatch && matchesSearch(user, searchTerm);
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const pagedUsers = filteredUsers.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  return (
    <div className="user-management-page">
      <div className="user-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          {onNavigate && (
            <BackButton onClick={() => onNavigate('home')} ariaLabel="Go back to home" />
          )}
          <div>
            <h1>User Management</h1>
            <p>Manage all users in one place. Control access, assign roles, and monitor activity across your platform.</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-outline">Export</button>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Close' : '+ Add User'}
          </button>
        </div>
      </div>

      {isOffline && (
        <div style={{ background: '#E3F2FD', padding: '10px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', color: '#1976D2', border: '1px solid #bbdefb', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><FaExclamationTriangle /> <b>Offline Mode:</b> Connection to backend failed. Showing mock data. Changes will be queued for sync.</span>
        </div>
      )}

      {isSupabaseConfigured() && !isOffline && (
          <div style={{ background: '#E3F2FD', padding: '8px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '12px', color: '#1976D2', border: '1px solid #bbdefb', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
           <b>Supabase Active:</b> Pulling live user profiles from your cloud database.
        </div>
      )}

      <div className="filter-bar">
        <div className="search-input">
          <span className="search-icon"><FaSearch /></span>
          <input
            placeholder="Search"
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
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value as typeof roleFilter);
              setCurrentPage(1);
            }}
          >
            <option value="all">Role: All</option>
            <option value="student">Role: Student</option>
            <option value="staff">Role: Staff</option>
            <option value="admin">Role: Admin</option>
          </select>
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as typeof statusFilter);
              setCurrentPage(1);
            }}
          >
            <option value="all">Status: All</option>
            <option value="active">Status: Active</option>
          </select>
          <select
            className="filter-select"
            value={dateFilter}
            onChange={(event) => {
              setDateFilter(event.target.value as typeof dateFilter);
              setCurrentPage(1);
            }}
          >
            <option value="all">Date: All</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="365d">Last 12 months</option>
          </select>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showForm && (
        <form className="user-form" onSubmit={handleSubmit}>
          <div className="form-header">
            <h2>{editingId ? 'Edit User' : 'Create New User'}</h2>
            <button type="button" className="icon-close" onClick={handleCancel}><FaTimes aria-hidden="true" /></button>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>MFU ID *</label>
              <input
                type="text"
                required
                disabled={!!editingId}
                value={formData.mfuId}
                onChange={(e) => setFormData({ ...formData, mfuId: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Role *</label>
              <select
                required
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              >
                <option value="student">Student</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="form-group">
              <label>Faculty (Optional)</label>
              <input
                type="text"
                value={formData.faculty}
                onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Department (Optional)</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : editingId ? 'Update User' : 'Create User'}
            </button>
            <button type="button" className="btn-outline" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="table-card">
        {loading && !showForm && <p className="loading-text">Loading users...</p>}

        {filteredUsers.length === 0 && !loading && (
          <p className="no-users">No users found. Create one to get started!</p>
        )}

        {filteredUsers.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" /></th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Username</th>
                  <th>Status</th>
                  <th>Role</th>
                  <th>Joined Date</th>
                  <th>Last Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedUsers.map((user) => (
                  <tr key={user.id}>
                    <td><input type="checkbox" /></td>
                    <td>
                      <div className="user-cell">
                        <div className="avatar">{getInitials(user?.name || user?.email || '??')}</div>
                        <div>
                          <div className="user-name">{user?.name || 'Unknown User'}</div>
                          <div className="user-sub">{user?.faculty || user?.department || 'MFU'}</div>
                        </div>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>{user.mfuId}</td>
                    <td><span className="status-pill status-active">Active</span></td>
                    <td><span className={`role-pill role-${user.role}`}>{formatRole(user.role)}</span></td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>{formatRelative(user.createdAt)}</td>
                    <td className="actions-cell">
                      <button className="icon-btn" onClick={() => handleEdit(user)} disabled={loading}><FaEdit /></button>
                      <button className="icon-btn danger" onClick={() => handleDelete(user.id)} disabled={loading}><FaTrash /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="table-footer">
          <div className="rows-info">
            Rows per page
            <select
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
            of {filteredUsers.length} rows
          </div>
          <div className="pagination">
            <button
              className="page-btn"
              onClick={() => setCurrentPage(1)}
              disabled={safePage === 1}
            >
              «
            </button>
            <button
              className="page-btn"
              onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
              disabled={safePage === 1}
            >
              ‹
            </button>
            <button className="page-btn active">{safePage}</button>
            <button
              className="page-btn"
              onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
              disabled={safePage === totalPages}
            >
              <FaChevronRight />
            </button>
            <button
              className="page-btn"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage === totalPages}
            >
              »
            </button>
          </div>
        </div>
      </div>

      {onNavigate && onOpenFoodRecognition && (
        <BottomNav active="profile" onNavigate={onNavigate} onOpenFoodRecognition={onOpenFoodRecognition} t={t} />
      )}
    </div>
  );
}
