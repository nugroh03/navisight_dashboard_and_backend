import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CCTV } from '@/types';

// Fetch all CCTV cameras
export function useCCTV(projectId?: string) {
  return useQuery({
    queryKey: ['cctv', projectId],
    queryFn: async () => {
      const url = projectId ? `/api/cctv?projectId=${projectId}` : '/api/cctv';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch CCTV cameras');
      }
      return response.json() as Promise<CCTV[]>;
    },
  });
}

// Fetch single CCTV camera
export function useCCTVCamera(id: string) {
  return useQuery({
    queryKey: ['cctv', id],
    queryFn: async () => {
      const response = await fetch(`/api/cctv/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch CCTV camera');
      }
      return response.json() as Promise<CCTV>;
    },
    enabled: !!id,
  });
}

// Create CCTV camera
export function useCreateCCTV() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      location?: string;
      projectId: string;
      streamUrl: string;
      status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
    }) => {
      const response = await fetch('/api/cctv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create CCTV camera');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cctv'] });
    },
  });
}

// Update CCTV camera
export function useUpdateCCTV() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      name?: string;
      description?: string;
      location?: string;
      projectId?: string;
      streamUrl?: string;
      status?: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
    }) => {
      const { id, ...updateData } = data;
      const response = await fetch(`/api/cctv/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update CCTV camera');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cctv'] });
      queryClient.invalidateQueries({ queryKey: ['cctv', variables.id] });
    },
  });
}

// Delete CCTV camera
export function useDeleteCCTV() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/cctv/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete CCTV camera');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cctv'] });
    },
  });
}
