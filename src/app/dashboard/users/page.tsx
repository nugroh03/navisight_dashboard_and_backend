'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

type ProjectOption = {
  id: string;
  name: string;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
  projects: ProjectOption[];
};

const EMAIL_DOMAIN = 'translautjatim.com';

const normalizeEmailInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const localPart = trimmed.split('@')[0].trim();
  return localPart ? `${localPart}@${EMAIL_DOMAIN}` : '';
};

const getEmailLocalPart = (email: string) => {
  const trimmed = email.trim();
  const domainSuffix = `@${EMAIL_DOMAIN}`;
  if (trimmed.toLowerCase().endsWith(domainSuffix)) {
    return trimmed.slice(0, -domainSuffix.length);
  }
  return trimmed;
};

const fetchUsers = async (): Promise<UserRow[]> => {
  const response = await fetch('/api/users');
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch users');
  }
  return response.json();
};

const fetchProjectOptions = async (): Promise<ProjectOption[]> => {
  const response = await fetch('/api/projects/options');
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch projects');
  }
  return response.json();
};

const createUser = async (payload: {
  name?: string;
  email: string;
  password: string;
  role: 'CLIENT' | 'WORKER';
  projectIds: string[];
}) => {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create user');
  }
  return response.json();
};

const updateUser = async (
  id: string,
  payload: {
    id?: string;
    name?: string;
    email?: string;
    password?: string;
    role?: 'CLIENT' | 'WORKER';
    projectIds?: string[];
  },
) => {
  if (!id) {
    throw new Error('User id tidak ditemukan.');
  }
  const response = await fetch(`/api/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, id }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update user');
  }
  return response.json();
};

const deleteUser = async (id: string) => {
  const response = await fetch(`/api/users/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete user');
  }
  return response.json();
};

export default function UsersPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const isAdmin = session?.user?.role === 'ADMINISTRATOR';
  const isClient = session?.user?.role === 'CLIENT';
  const isAdminOrClient = isAdmin || isClient;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'CLIENT' | 'WORKER'>('CLIENT');
  const [formProjectIds, setFormProjectIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const {
    data: users,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    enabled: isAdminOrClient,
  });

  const {
    data: projectOptions,
    isLoading: isProjectsLoading,
    error: projectError,
  } = useQuery({
    queryKey: ['project-options'],
    queryFn: fetchProjectOptions,
    enabled: isAdminOrClient && isModalOpen,
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      handleCloseModal();
    },
    onError: (err: Error) => {
      setErrors([err.message]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof updateUser>[1];
    }) => updateUser(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      handleCloseModal();
    },
    onError: (err: Error) => {
      setErrors([err.message]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteConfirmId(null);
    },
    onError: (err: Error) => {
      setErrors([err.message]);
      setDeleteConfirmId(null);
    },
  });

  const projectMap = useMemo(() => {
    return new Map(
      (projectOptions ?? []).map((project) => [project.id, project]),
    );
  }, [projectOptions]);

  const handleOpenModal = (user?: UserRow) => {
    if (user) {
      setEditingUser(user);
      setEditingUserId(user.id ?? null);
      setFormName(user.name ?? '');
      setFormEmail(getEmailLocalPart(user.email));
      setFormPassword('');
      setFormRole((user.role as 'CLIENT' | 'WORKER') ?? 'CLIENT');
      setFormProjectIds(user.projects.map((project) => project.id));
    } else {
      setEditingUser(null);
      setEditingUserId(null);
      setFormName('');
      setFormEmail('');
      setFormPassword('');
      // CLIENT hanya bisa create WORKER
      setFormRole(isClient ? 'WORKER' : 'CLIENT');
      setFormProjectIds([]);
    }
    setErrors([]);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setEditingUserId(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole(isClient ? 'WORKER' : 'CLIENT');
    setFormProjectIds([]);
    setErrors([]);
  };

  const handleRoleChange = (value: 'CLIENT' | 'WORKER') => {
    setFormRole(value);
    if (value === 'WORKER' && formProjectIds.length > 1) {
      setFormProjectIds(formProjectIds.slice(0, 1));
    }
  };

  const handleProjectToggle = (projectId: string) => {
    if (formRole === 'WORKER') {
      setFormProjectIds(projectId ? [projectId] : []);
      return;
    }
    setFormProjectIds((prev) => {
      if (prev.includes(projectId)) {
        return prev.filter((id) => id !== projectId);
      }
      return [...prev, projectId];
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrors([]);

    if (!formEmail.trim()) {
      setErrors(['Email wajib diisi.']);
      return;
    }

    const normalizedEmail = normalizeEmailInput(formEmail);
    if (!normalizedEmail) {
      setErrors(['Format email tidak valid.']);
      return;
    }

    if (!editingUser && !formPassword.trim()) {
      setErrors(['Password wajib diisi untuk user baru.']);
      return;
    }

    if (formRole === 'WORKER' && formProjectIds.length > 1) {
      setErrors(['Worker hanya boleh memiliki 1 project.']);
      return;
    }

    const payload = {
      name: formName.trim() ? formName.trim() : undefined,
      email: normalizedEmail,
      role: formRole,
      projectIds: formProjectIds,
      ...(formPassword.trim() ? { password: formPassword.trim() } : {}),
    };

    if (editingUser) {
      const targetUserId = (editingUserId ?? editingUser.id ?? '').trim();
      if (!targetUserId) {
        setErrors(['User id tidak ditemukan.']);
        return;
      }
      updateMutation.mutate({
        id: targetUserId,
        payload: { ...payload, id: targetUserId },
      });
    } else {
      createMutation.mutate({
        name: payload.name,
        email: payload.email,
        password: payload.password ?? '',
        role: payload.role,
        projectIds: payload.projectIds ?? [],
      });
    }
  };

  if (!isAdminOrClient) {
    return (
      <div className='space-y-6'>
        <div className='card border-[var(--color-border)] bg-white p-8 shadow-lg'>
          <h1 className='text-2xl font-semibold text-[var(--color-text)]'>
            Manajemen Pengguna
          </h1>
          <p className='mt-2 text-[var(--color-muted)]'>
            Hanya administrator dan client yang dapat mengelola user.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='space-y-6'>
        <div className='card border-[var(--color-border)] bg-white p-8 shadow-lg'>
          <h1 className='text-2xl font-semibold text-[var(--color-text)]'>
            Manajemen Pengguna
          </h1>
          <p className='mt-2 text-red-600'>
            Error loading users: {(error as Error).message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='card border-[var(--color-border)] bg-white p-8 shadow-lg'>
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div>
            <p className='text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-primary-strong)]'>
              Users
            </p>
            <h1 className='mt-3 text-2xl font-semibold text-[var(--color-text)]'>
              Manajemen Pengguna
            </h1>
            <p className='mt-2 text-[var(--color-muted)]'>
              Tambahkan user client/worker, kelola role, dan hubungkan ke
              project.
            </p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className='btn-primary'
            disabled={isLoading || createMutation.isPending}
          >
            {createMutation.isPending ? 'Menambahkan...' : 'Tambah User'}
          </button>
        </div>
      </div>

      <div className='card border-[var(--color-border)] bg-white p-8 shadow-lg'>
        {isLoading ? (
          <div className='flex items-center justify-center py-12'>
            <div className='text-[var(--color-muted)]'>Loading users...</div>
          </div>
        ) : users && users.length > 0 ? (
          <div className='space-y-4'>
            {users.map((user) => (
              <div
                key={user.id}
                className='flex flex-col gap-4 rounded-lg border border-[var(--color-border)] p-6 md:flex-row md:items-center md:justify-between'
              >
                <div className='space-y-2'>
                  <div>
                    <h3 className='text-lg font-semibold text-[var(--color-text)]'>
                      {user.name || 'Tanpa Nama'}
                    </h3>
                    <p className='text-sm text-[var(--color-muted)]'>
                      {user.email}
                    </p>
                  </div>
                  <div className='flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-primary-strong)]'>
                    {user.role ?? 'UNKNOWN'}
                  </div>
                  <div className='text-sm text-[var(--color-muted)]'>
                    {user.projects.length > 0 ? (
                      <span>
                        Project:{' '}
                        {user.projects
                          .map((project) => project.name)
                          .join(', ')}
                      </span>
                    ) : (
                      <span>Belum terhubung ke project.</span>
                    )}
                  </div>
                </div>
                <div className='flex flex-wrap gap-2'>
                  <button
                    onClick={() => handleOpenModal(user)}
                    disabled={updateMutation.isPending}
                    className='px-4 py-2 text-sm font-medium text-[var(--color-primary-strong)] border border-[var(--color-primary-strong)] rounded-lg hover:bg-[var(--color-primary)] hover:text-white transition-colors'
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(user.id)}
                    disabled={deleteMutation.isPending}
                    className='px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors'
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className='text-center py-12'>
            <h3 className='text-lg font-medium text-[var(--color-text)] mb-2'>
              Belum ada user
            </h3>
            <p className='text-[var(--color-muted)] mb-4'>
              Tambahkan user client atau worker untuk memulai.
            </p>
            <button onClick={() => handleOpenModal()} className='btn-primary'>
              Tambah User
            </button>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className='fixed inset-0 bg-slate-900/30 flex items-center justify-center p-4 z-50'>
          <div className='bg-white rounded-lg shadow-xl max-w-lg w-full p-6'>
            <h2 className='text-xl font-semibold text-[var(--color-text)] mb-4'>
              {editingUser ? 'Edit User' : 'Tambah User'}
            </h2>
            <form onSubmit={handleSubmit} className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-[var(--color-text)] mb-1'>
                  Nama
                </label>
                <input
                  type='text'
                  value={formName}
                  onChange={(event) => setFormName(event.target.value)}
                  className='w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent'
                  placeholder='Nama user'
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-[var(--color-text)] mb-1'>
                  Email
                </label>
                <div className='flex items-center'>
                  <input
                    type='text'
                    value={formEmail}
                    onChange={(event) =>
                      setFormEmail(event.target.value.split('@')[0])
                    }
                    className='flex-1 px-3 py-2 border border-[var(--color-border)] rounded-l-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent'
                    placeholder='andre'
                    required
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                  />
                  <span className='px-3 py-2 border border-l-0 border-[var(--color-border)] rounded-r-lg bg-[#f8fafc] text-sm text-[var(--color-muted)]'>
                    @{EMAIL_DOMAIN}
                  </span>
                </div>
              </div>

              <div>
                <label className='block text-sm font-medium text-[var(--color-text)] mb-1'>
                  {editingUser ? 'Password Baru (opsional)' : 'Password'}
                </label>
                <input
                  type='password'
                  value={formPassword}
                  onChange={(event) => setFormPassword(event.target.value)}
                  className='w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent'
                  placeholder={
                    editingUser
                      ? 'Kosongkan jika tidak diubah'
                      : 'Masukkan password'
                  }
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-[var(--color-text)] mb-1'>
                  Role
                </label>
                <select
                  value={formRole}
                  onChange={(event) =>
                    handleRoleChange(event.target.value as 'CLIENT' | 'WORKER')
                  }
                  className='w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent'
                  disabled={
                    isClient ||
                    createMutation.isPending ||
                    updateMutation.isPending
                  }
                >
                  <option value='CLIENT'>Client</option>
                  <option value='WORKER'>Worker</option>
                </select>
                {isClient ? (
                  <p className='mt-2 text-xs text-[var(--color-muted)]'>
                    Client hanya dapat membuat user dengan role Worker.
                  </p>
                ) : (
                  <p className='mt-2 text-xs text-[var(--color-muted)]'>
                    Client bisa terhubung ke banyak project, worker hanya satu.
                  </p>
                )}
              </div>

              <div>
                <label className='block text-sm font-medium text-[var(--color-text)] mb-2'>
                  Hubungkan Project
                </label>
                {projectError ? (
                  <p className='text-sm text-red-600'>
                    {(projectError as Error).message || 'Gagal memuat project.'}
                  </p>
                ) : isProjectsLoading ? (
                  <p className='text-sm text-[var(--color-muted)]'>
                    Loading project...
                  </p>
                ) : (
                  <>
                    {formRole === 'WORKER' ? (
                      <select
                        value={formProjectIds[0] ?? ''}
                        onChange={(event) =>
                          handleProjectToggle(event.target.value)
                        }
                        className='w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent'
                        disabled={
                          createMutation.isPending || updateMutation.isPending
                        }
                      >
                        <option value=''>Belum dihubungkan</option>
                        {(projectOptions ?? []).map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className='grid gap-2 sm:grid-cols-2'>
                        {(projectOptions ?? []).map((project) => (
                          <label
                            key={project.id}
                            className='flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[#f8fafc] px-3 py-2 text-sm text-[var(--color-text)]'
                          >
                            <input
                              type='checkbox'
                              checked={formProjectIds.includes(project.id)}
                              onChange={() => handleProjectToggle(project.id)}
                              disabled={
                                createMutation.isPending ||
                                updateMutation.isPending
                              }
                            />
                            {project.name}
                          </label>
                        ))}
                      </div>
                    )}
                    {formProjectIds.length > 0 && (
                      <p className='mt-2 text-xs text-[var(--color-muted)]'>
                        Terhubung:{' '}
                        {formProjectIds
                          .map((id) => projectMap.get(id)?.name ?? '')
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}
                  </>
                )}
              </div>

              {errors.length > 0 && (
                <div className='bg-red-50 border border-red-200 rounded-lg p-3'>
                  {errors.map((err, idx) => (
                    <p key={idx} className='text-sm text-red-600'>
                      {err}
                    </p>
                  ))}
                </div>
              )}

              <div className='mt-6 flex justify-end gap-3'>
                <button
                  type='button'
                  onClick={handleCloseModal}
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  className='px-4 py-2 text-sm font-medium text-[var(--color-muted)] border border-[var(--color-border)] rounded-lg hover:bg-[#f8fafc] transition-colors'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  className='btn-primary'
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? editingUser
                      ? 'Updating...'
                      : 'Creating...'
                    : editingUser
                      ? 'Update User'
                      : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className='fixed inset-0 bg-slate-900/30 flex items-center justify-center p-4 z-50'>
          <div className='bg-white rounded-lg shadow-xl max-w-md w-full p-6'>
            <h3 className='text-lg font-medium text-[var(--color-text)] text-center mb-2'>
              Nonaktifkan User
            </h3>
            <p className='text-sm text-[var(--color-muted)] text-center mb-6'>
              User akan dinonaktifkan (soft delete) dan tidak bisa login lagi.
            </p>
            <div className='flex justify-center gap-3'>
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleteMutation.isPending}
                className='px-4 py-2 text-sm font-medium text-[var(--color-muted)] border border-[var(--color-border)] rounded-lg hover:bg-[#f8fafc] transition-colors'
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className='px-4 py-2 text-sm font-medium text-white bg-red-600 border border-red-600 rounded-lg hover:bg-red-700 transition-colors'
              >
                {deleteMutation.isPending ? 'Processing...' : 'Disable User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
