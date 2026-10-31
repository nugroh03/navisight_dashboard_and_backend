import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CCTV } from '@/types';

// Status online/offline kamera dicek server; muat ulang berkala agar tampilan mengikuti.
const CAMERA_STATUS_REFRESH_MS = 30_000;

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
    refetchInterval: CAMERA_STATUS_REFRESH_MS,
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
    refetchInterval: CAMERA_STATUS_REFRESH_MS,
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

// Reorder CCTV cameras per project (admin only)
export function useReorderCCTV() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { projectId: string; orderedIds: string[] }) => {
      const response = await fetch('/api/cctv/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reorder CCTV cameras');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cctv'] });
      queryClient.invalidateQueries({
        queryKey: ['cctv', variables.projectId],
      });
    },
  });
}

// Daftar nama stream go2rtc (khusus ADMINISTRATOR, untuk form kamera)
export function useGo2rtcStreams(enabled: boolean) {
  return useQuery({
    queryKey: ['cctv', 'go2rtc-streams'],
    queryFn: async () => {
      const response = await fetch('/api/cctv/go2rtc-streams');
      if (!response.ok) {
        throw new Error('Failed to fetch go2rtc streams');
      }
      return response.json() as Promise<string[]>;
    },
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

// Daftar preset PTZ kamera
export function useCCTVPtzPresets(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ['cctv', id, 'ptz-presets'],
    queryFn: async () => {
      const response = await fetch(`/api/cctv/${id}/ptz`);
      if (!response.ok) {
        throw new Error('Failed to fetch PTZ presets');
      }
      return response.json() as Promise<{ id: number; name: string }[]>;
    },
    enabled: enabled && !!id,
    retry: false,
  });
}
