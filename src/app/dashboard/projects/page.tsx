'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { APP_CONFIG } from '@/config/app';

// Types
interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

// API functions
const fetchProjects = async (): Promise<Project[]> => {
  const response = await fetch('/api/projects');
  if (!response.ok) {
    throw new Error('Failed to fetch projects');
  }
  return response.json();
};

const createProject = async (name: string): Promise<Project> => {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create project');
  }
  return response.json();
};

const updateProject = async ({
  id,
  name,
}: {
  id: string;
  name: string;
}): Promise<Project> => {
  const response = await fetch(`/api/projects/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update project');
  }
  return response.json();
};

const deleteProject = async (id: string): Promise<void> => {
  const response = await fetch(`/api/projects/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete project');
  }
};

export default function ProjectsPage() {
  const { data: session } = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Check if user is ADMINISTRATOR
  const isAdministrator = session?.user?.role === 'ADMINISTRATOR';

  const {
    data: projects,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    enabled: isAdministrator, // Only fetch if user is ADMINISTRATOR
  });

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      handleCloseModal();
    },
    onError: (error: Error) => {
      setErrors([error.message]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      handleCloseModal();
    },
    onError: (error: Error) => {
      setErrors([error.message]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setDeleteConfirmId(null);
    },
    onError: (error: Error) => {
      alert(`Error deleting project: ${error.message}`);
      setDeleteConfirmId(null);
    },
  });

  const handleOpenModal = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setProjectName(project.name);
    } else {
      setEditingProject(null);
      setProjectName('');
    }
    setErrors([]);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProject(null);
    setProjectName('');
    setErrors([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    if (!projectName.trim()) {
      setErrors(['Project name is required']);
      return;
    }

    if (projectName.trim().length < 3) {
      setErrors(['Project name must be at least 3 characters']);
      return;
    }

    if (editingProject) {
      updateMutation.mutate({
        id: editingProject.id,
        name: projectName.trim(),
      });
    } else {
      createMutation.mutate(projectName.trim());
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  // Check if user is not ADMINISTRATOR
  if (!isAdministrator) {
    return (
      <div className='space-y-6'>
        <div className='card border-[var(--color-border)] bg-white p-8 shadow-lg'>
          <div className='text-center py-12'>
            <div className='text-red-600 mb-4'>
              <svg
                className='mx-auto h-16 w-16'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
                />
              </svg>
            </div>
            <h3 className='text-xl font-semibold text-[var(--color-text)] mb-2'>
              Access Restricted
            </h3>
            <p className='text-[var(--color-muted)] max-w-md mx-auto'>
              Only administrators can access the Projects page. Please contact
              your system administrator if you need access.
            </p>
            <p className='text-sm text-[var(--color-muted)] mt-4'>
              Your current role:{' '}
              <span className='font-medium'>
                {session?.user?.role || 'Unknown'}
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='space-y-6'>
        <div className='card border-[var(--color-border)] bg-white p-8 shadow-lg'>
          <h1 className='text-2xl font-semibold text-[var(--color-text)]'>
            Projects
          </h1>
          <p className='mt-2 text-red-600'>
            Error loading projects: {(error as Error).message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='card border-[var(--color-border)] bg-white p-8 shadow-lg'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-primary-strong)]'>
              Project Management
            </p>
            <h1 className='mt-3 text-2xl font-semibold text-[var(--color-text)]'>
              Projects
            </h1>
            <p className='mt-2 text-[var(--color-muted)]'>
              Manage your projects and their configurations
            </p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            disabled={isLoading || createMutation.isPending}
            className='btn-primary'
          >
            {createMutation.isPending ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>

      {/* Projects List */}
      <div className='card border-[var(--color-border)] bg-white p-8 shadow-lg'>
        {isLoading ? (
          <div className='flex items-center justify-center py-12'>
            <div className='text-[var(--color-muted)]'>Loading projects...</div>
          </div>
        ) : projects && projects.length > 0 ? (
          <div className='space-y-4'>
            <div className='grid gap-4'>
              {projects.map((project) => (
                <div
                  key={project.id}
                  className='flex items-center justify-between rounded-lg border border-[var(--color-border)] p-6 hover:bg-[#f8fafc] transition-colors'
                >
                  <div className='flex-1'>
                    <h3 className='text-lg font-semibold text-[var(--color-text)]'>
                      {project.name}
                    </h3>
                    <p className='mt-1 text-sm text-[var(--color-muted)]'>
                      Created:{' '}
                      {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                    <p className='text-sm text-[var(--color-muted)]'>
                      Last updated:{' '}
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className='flex items-center gap-2'>
                    <button
                      onClick={() => handleOpenModal(project)}
                      disabled={updateMutation.isPending}
                      className='px-4 py-2 text-sm font-medium text-[var(--color-primary-strong)] border border-[var(--color-primary-strong)] rounded-lg hover:bg-[var(--color-primary)] hover:text-white transition-colors'
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(project.id)}
                      disabled={deleteMutation.isPending}
                      className='px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors'
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className='text-center py-12'>
            <div className='text-[var(--color-muted)] mb-4'>
              <svg
                className='mx-auto h-12 w-12 text-[var(--color-muted)]'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
                />
              </svg>
            </div>
            <h3 className='text-lg font-medium text-[var(--color-text)] mb-2'>
              No projects yet
            </h3>
            <p className='text-[var(--color-muted)] mb-4'>
              Create your first project to get started with {APP_CONFIG.name}
            </p>
            <button
              onClick={() => handleOpenModal()}
              disabled={createMutation.isPending}
              className='btn-primary'
            >
              {createMutation.isPending
                ? 'Creating...'
                : 'Create Your First Project'}
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className='fixed inset-0 bg-slate-900/30 flex items-center justify-center p-4 z-50'>
          <div className='bg-white rounded-lg shadow-xl max-w-md w-full p-6'>
            <h2 className='text-xl font-semibold text-[var(--color-text)] mb-4'>
              {editingProject ? 'Edit Project' : 'Create New Project'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className='space-y-4'>
                <div>
                  <label
                    htmlFor='projectName'
                    className='block text-sm font-medium text-[var(--color-text)] mb-1'
                  >
                    Project Name
                  </label>
                  <input
                    type='text'
                    id='projectName'
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className='w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent'
                    placeholder='Enter project name'
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                  />
                </div>
                {errors.length > 0 && (
                  <div className='bg-red-50 border border-red-200 rounded-lg p-3'>
                    {errors.map((error, index) => (
                      <p key={index} className='text-sm text-red-600'>
                        {error}
                      </p>
                    ))}
                  </div>
                )}
              </div>
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
                    ? editingProject
                      ? 'Updating...'
                      : 'Creating...'
                    : editingProject
                    ? 'Update Project'
                    : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className='fixed inset-0 bg-slate-900/30 flex items-center justify-center p-4 z-50'>
          <div className='bg-white rounded-lg shadow-xl max-w-md w-full p-6'>
            <div className='flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4'>
              <svg
                className='w-6 h-6 text-red-600'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                />
              </svg>
            </div>
            <h3 className='text-lg font-medium text-[var(--color-text)] text-center mb-2'>
              Delete Project
            </h3>
            <p className='text-sm text-[var(--color-muted)] text-center mb-6'>
              Are you sure you want to delete this project? This action cannot
              be undone.
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
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className='px-4 py-2 text-sm font-medium text-white bg-red-600 border border-red-600 rounded-lg hover:bg-red-700 transition-colors'
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
