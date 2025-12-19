import { useQuery } from '@tanstack/react-query';
import type { ProjectOption } from '@/types';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await fetch('/api/projects/options');
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      return response.json() as Promise<ProjectOption[]>;
    },
  });
}
