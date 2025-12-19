'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2, Save, Trash2, Camera } from 'lucide-react';
import { useCCTVCamera, useUpdateCCTV } from '@/hooks/use-cctv';
import { useProjects } from '@/hooks/use-projects';
import { updateCCTVSchema, UpdateCCTVInput } from '@/lib/validations';
import { toast } from 'sonner';
import Link from 'next/link';
import { CCTVDeleteModal } from '@/components/cctv/cctv-delete-modal';
import { RoleName } from '@prisma/client';
import { useSession } from 'next-auth/react';

export default function EditCCTVPage() {
  const router = useRouter();
  const params = useParams();
  const cameraId = params?.id as string;
  const { data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { data: camera, isLoading: cameraLoading } = useCCTVCamera(cameraId);
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const updateCCTV = useUpdateCCTV();

  const userRole =
    (session?.user?.role as string) === 'ADMINISTRATOR'
      ? RoleName.ADMINISTRATOR
      : RoleName.CLIENT;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdateCCTVInput>({
    resolver: zodResolver(updateCCTVSchema),
    defaultValues: {
      name: camera?.name || '',
      description: camera?.description || '',
      location: camera?.location || '',
      projectId: camera?.projectId || '',
      streamUrl: camera?.streamUrl || '',
      status: camera?.status || 'OFFLINE',
    },
  });

  useEffect(() => {
    if (camera) {
      const isStatus = (val: unknown): val is UpdateCCTVInput['status'] =>
        val === 'ONLINE' || val === 'OFFLINE' || val === 'MAINTENANCE';

      const statusValue: UpdateCCTVInput['status'] = isStatus(camera.status)
        ? camera.status
        : 'OFFLINE';

      reset({
        name: camera.name ?? '',
        description: camera.description ?? '',
        location: camera.location ?? '',
        projectId: camera.projectId ?? '',
        streamUrl: camera.streamUrl ?? '',
        status: statusValue,
      });
    }
  }, [camera, reset]);

  const onSubmit = async (data: UpdateCCTVInput) => {
    setIsSubmitting(true);
    try {
      await updateCCTV.mutateAsync({ ...data, id: cameraId });
      toast.success('Kamera berhasil diperbarui');
      router.push('/dashboard/cctv');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message || 'Gagal memperbarui kamera';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/dashboard/cctv');
  };

  if (cameraLoading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-strong)]'></div>
      </div>
    );
  }

  if (!camera) {
    return (
      <div className='card p-12 text-center'>
        <p className='text-[var(--color-muted)] mb-4'>Kamera tidak ditemukan</p>
        <button
          onClick={() => router.push('/dashboard/cctv')}
          className='btn-primary inline-flex items-center gap-2'
        >
          Kembali ke Daftar CCTV
        </button>
      </div>
    );
  }

  return (
    <>
      <div className='max-w-2xl mx-auto'>
        <div className='card p-0 overflow-hidden'>
          {/* Header */}
          <div className='bg-white p-6 border-b border-[var(--color-border)]'>
            <div className='flex items-center gap-4'>
              <Link
                href='/dashboard/cctv'
                className='w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors'
              >
                <ArrowLeft className='h-5 w-5 text-[var(--color-text)]' />
              </Link>
              <div className='flex items-center gap-3 flex-1'>
                <div className='w-12 h-12 bg-[var(--color-primary)]/10 rounded-xl flex items-center justify-center'>
                  <Camera className='h-6 w-6 text-[var(--color-primary-strong)]' />
                </div>
                <div>
                  <h1 className='text-xl font-semibold text-[var(--color-text)]'>
                    Edit Kamera
                  </h1>
                  <p className='text-sm text-[var(--color-muted)] mt-0.5'>
                    Perbarui detail dan pengaturan kamera
                  </p>
                </div>
              </div>
              {userRole === RoleName.ADMINISTRATOR && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className='px-4 py-2 text-sm font-medium text-red-600 border border-[var(--color-border)] rounded-lg hover:bg-red-50 transition-colors inline-flex items-center gap-2'
                >
                  <Trash2 className='h-4 w-4' />
                  Hapus
                </button>
              )}
            </div>
          </div>

          {/* Form */}
          <div className='p-6'>
            <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
              <div className='space-y-2'>
                <label
                  htmlFor='name'
                  className='block text-sm font-medium text-[var(--color-text)]'
                >
                  Nama Kamera <span className='text-red-500'>*</span>
                </label>
                <input
                  id='name'
                  {...register('name')}
                  placeholder='Masukkan nama kamera'
                  disabled={isSubmitting}
                  className={`input-field w-full ${
                    errors.name ? 'border-red-500' : ''
                  }`}
                />
                {errors.name && (
                  <p className='text-sm text-red-600'>{errors.name.message}</p>
                )}
              </div>

              <div className='space-y-2'>
                <label
                  htmlFor='description'
                  className='block text-sm font-medium text-[var(--color-text)]'
                >
                  Deskripsi
                </label>
                <textarea
                  id='description'
                  {...register('description')}
                  placeholder='Masukkan deskripsi kamera (opsional)'
                  disabled={isSubmitting}
                  className='w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-[var(--color-text)] rounded-[var(--radius-md)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-strong)] focus:border-transparent min-h-[80px] resize-y'
                />
                {errors.description && (
                  <p className='text-sm text-red-600'>
                    {errors.description.message}
                  </p>
                )}
              </div>

              <div className='space-y-2'>
                <label
                  htmlFor='location'
                  className='block text-sm font-medium text-[var(--color-text)]'
                >
                  Lokasi
                </label>
                <input
                  id='location'
                  {...register('location')}
                  placeholder='Masukkan lokasi kamera'
                  disabled={isSubmitting}
                  className={`input-field w-full ${
                    errors.location ? 'border-red-500' : ''
                  }`}
                />
                {errors.location && (
                  <p className='text-sm text-red-600'>
                    {errors.location.message}
                  </p>
                )}
              </div>

              <div className='space-y-2'>
                <label
                  htmlFor='projectId'
                  className='block text-sm font-medium text-[var(--color-text)]'
                >
                  Project <span className='text-red-500'>*</span>
                </label>
                <select
                  id='projectId'
                  {...register('projectId')}
                  className='w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-[var(--color-text)] rounded-[var(--radius-md)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-strong)] focus:border-transparent'
                  disabled={isSubmitting || projectsLoading}
                >
                  <option value=''>Pilih project</option>
                  {projects?.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                {errors.projectId && (
                  <p className='text-sm text-red-600'>
                    {errors.projectId.message}
                  </p>
                )}
              </div>

              <div className='space-y-2'>
                <label
                  htmlFor='streamUrl'
                  className='block text-sm font-medium text-[var(--color-text)]'
                >
                  Stream URL <span className='text-red-500'>*</span>
                </label>
                <input
                  id='streamUrl'
                  type='url'
                  {...register('streamUrl')}
                  placeholder='https://example.com/stream'
                  disabled={isSubmitting}
                  className={`input-field w-full ${
                    errors.streamUrl ? 'border-red-500' : ''
                  }`}
                />
                {errors.streamUrl && (
                  <p className='text-sm text-red-600'>
                    {errors.streamUrl.message}
                  </p>
                )}
              </div>

              <div className='space-y-2'>
                <label
                  htmlFor='status'
                  className='block text-sm font-medium text-[var(--color-text)]'
                >
                  Status
                </label>
                <select
                  id='status'
                  {...register('status')}
                  className='w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-[var(--color-text)] rounded-[var(--radius-md)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-strong)] focus:border-transparent'
                  disabled={isSubmitting}
                >
                  <option value='OFFLINE'>Offline</option>
                  <option value='ONLINE'>Online</option>
                  <option value='MAINTENANCE'>Maintenance</option>
                </select>
              </div>

              <div className='flex gap-3 pt-6 border-t border-[var(--color-border)]'>
                <button
                  type='button'
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className='flex-1 px-4 py-2.5 text-sm font-medium text-[var(--color-text)] border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  Batal
                </button>
                <button
                  type='submit'
                  disabled={isSubmitting}
                  className='btn-primary flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className='h-4 w-4 animate-spin' />
                      <span>Memperbarui...</span>
                    </>
                  ) : (
                    <>
                      <Save className='h-4 w-4' />
                      <span>Perbarui Kamera</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {camera && (
        <CCTVDeleteModal
          camera={camera}
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onSuccess={() => router.push('/dashboard/cctv')}
        />
      )}
    </>
  );
}
