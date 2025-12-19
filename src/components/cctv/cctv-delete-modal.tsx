'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useDeleteCCTV } from '@/hooks/use-cctv';
import { CCTVDeleteModalProps } from '@/types';
import { toast } from 'sonner';

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
    <div className='fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
      <div className='card w-full max-w-md shadow-2xl'>
        <div className='flex items-center justify-between p-6 border-b border-[var(--color-border)]'>
          <h2 className='text-lg font-semibold text-red-600'>Hapus Kamera</h2>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className='w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <X className='h-4 w-4 text-[var(--color-text)]' />
          </button>
        </div>

        <div className='p-6'>
          <div className='flex items-center gap-3 mb-4'>
            <div className='shrink-0'>
              <AlertTriangle className='h-8 w-8 text-red-500' />
            </div>
            <div>
              <h3 className='text-lg font-medium text-[var(--color-text)]'>
                Apakah Anda yakin?
              </h3>
              <p className='text-sm text-[var(--color-muted)] mt-1'>
                Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
          </div>

          <div className='bg-red-50 border border-red-200 rounded-lg p-4 mb-6'>
            <p className='text-sm text-red-800'>
              Anda akan menghapus kamera{' '}
              <strong>&ldquo;{camera.name}&rdquo;</strong>
              {camera.location && ` yang berlokasi di ${camera.location}`}. Ini
              akan menghapus semua data kamera secara permanen.
            </p>
            {camera.project && (
              <p className='text-sm text-red-700 mt-3'>
                <strong>Project:</strong> {camera.project.name}
              </p>
            )}
          </div>

          <div className='flex gap-3'>
            <button
              type='button'
              onClick={onClose}
              disabled={isDeleting}
              className='flex-1 px-4 py-2.5 text-sm font-medium text-[var(--color-text)] border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            >
              Batal
            </button>
            <button
              type='button'
              onClick={handleDelete}
              disabled={isDeleting}
              className='flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2'
            >
              {isDeleting ? (
                <>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  <span>Menghapus...</span>
                </>
              ) : (
                'Hapus Kamera'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
