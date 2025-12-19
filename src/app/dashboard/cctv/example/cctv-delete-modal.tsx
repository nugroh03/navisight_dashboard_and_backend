'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDeleteCCTV } from '@/hooks/use-cctv';
import { CCTVDeleteModalProps } from '@/types';
import { toast } from 'sonner';

interface Camera {
  id: string;
  name: string;
  location: string;
  project?: {
    name: string;
  };
}

export function CCTVDeleteModal({
  camera,
  isOpen,
  onClose,
  onSuccess,
}: CCTVDeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteCCTV = useDeleteCCTV();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteCCTV.mutateAsync(camera.id);
      toast.success('Camera deleted successfully');
      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message || 'Failed to delete camera';
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
      <div className='bg-background rounded-lg shadow-2xl border border-border w-full max-w-md'>
        <div className='flex items-center justify-between p-6 border-b border-border'>
          <h2 className='text-lg font-semibold text-red-600 dark:text-red-400'>
            Delete Camera
          </h2>
          <Button
            variant='ghost'
            size='icon'
            onClick={onClose}
            disabled={isDeleting}
          >
            <X className='h-4 w-4' />
          </Button>
        </div>

        <div className='p-6'>
          <div className='flex items-center gap-3 mb-4'>
            <div className='flex-shrink-0'>
              <AlertTriangle className='h-8 w-8 text-red-500' />
            </div>
            <div>
              <h3 className='text-lg font-medium text-gray-900'>
                Are you sure?
              </h3>
              <p className='text-sm text-gray-500 mt-1'>
                This action cannot be undone.
              </p>
            </div>
          </div>

          <div className='bg-red-50 border border-red-200 rounded-md p-4 mb-6'>
            <p className='text-sm text-red-800'>
              You are about to delete the camera{' '}
              <strong>&ldquo;{camera.name}&rdquo;</strong>
              {camera.location && ` located at ${camera.location}`}. This will
              permanently remove:
            </p>
            <ul className='list-disc list-inside text-sm text-red-700 mt-2 space-y-1'>
              <li>Camera configuration and settings</li>
              <li>Stream URL and connection details</li>
              <li>Recording history and metadata</li>
              <li>Project association</li>
              <li>Monitoring data and logs</li>
            </ul>
            {camera.project && (
              <p className='text-sm text-red-700 mt-3'>
                <strong>Project:</strong> {camera.project.name}
              </p>
            )}
            {/* Removed IP Address display as it's no longer used */}
          </div>

          <div className='flex gap-3'>
            <Button
              type='button'
              variant='outline'
              onClick={onClose}
              disabled={isDeleting}
              className='flex-1'
            >
              Cancel
            </Button>
            <Button
              type='button'
              variant='destructive'
              onClick={handleDelete}
              disabled={isDeleting}
              className='flex-1'
            >
              {isDeleting ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Deleting...
                </>
              ) : (
                'Delete Camera'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
