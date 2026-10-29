'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Save, Camera } from 'lucide-react';
import { useCreateCCTV } from '@/hooks/use-cctv';
import { useProjects } from '@/hooks/use-projects';
import { createCCTVSchema, CreateCCTVInput } from '@/lib/validations';
import { toast } from 'sonner';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

export default function CreateCCTVPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createCCTV = useCreateCCTV();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: session } = useSession();
  const isAdmin = (session?.user?.role as string) === 'ADMINISTRATOR';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCCTVInput>({
    resolver: zodResolver(createCCTVSchema),
    defaultValues: {
      name: '',
      description: '',
      location: '',
      projectId: '',
      streamUrl: '',
      status: 'OFFLINE',
      go2rtcStream: '',
      isapiHost: '',
      ptzEnabled: false,
      audioEnabled: false,
    },
  });

  const onSubmit = async (data: CreateCCTVInput) => {
    setIsSubmitting(true);
    try {
      await createCCTV.mutateAsync(data);
      toast.success('Camera created successfully');
      router.push('/dashboard/cctv');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message || 'Failed to create camera'
          : 'Failed to create camera';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    reset();
    router.push('/dashboard/cctv');
  };

  return (
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
            <div className='flex items-center gap-3'>
              <div className='w-12 h-12 bg-[var(--color-primary)]/10 rounded-xl flex items-center justify-center'>
                <Camera className='h-6 w-6 text-[var(--color-primary-strong)]' />
              </div>
              <div>
                <h1 className='text-xl font-semibold text-[var(--color-text)]'>
                  Tambah Kamera Baru
                </h1>
                <p className='text-sm text-[var(--color-muted)] mt-0.5'>
                  Masukkan informasi untuk kamera CCTV baru
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className='p-6'>
          <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
            {/* Camera Name */}
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

            {/* Description */}
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

            {/* Location */}
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

            {/* Project */}
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

            {/* Stream URL */}
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
              <p className='text-sm text-[var(--color-muted)]'>
                Masukkan URL untuk stream kamera
              </p>
            </div>

            {/* Status */}
            <div className='space-y-2'>
              <label
                htmlFor='status'
                className='block text-sm font-medium text-[var(--color-text)]'
              >
                Status Awal
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
              <p className='text-sm text-[var(--color-muted)]'>
                Atur status awal kamera
              </p>
            </div>

            {/* Live View */}
            {isAdmin && (
              <div className='space-y-4 rounded-lg border border-[var(--color-border)] p-4'>
                <div>
                  <h2 className='text-sm font-semibold text-[var(--color-text)]'>
                    Live View (go2rtc)
                  </h2>
                  <p className='text-sm text-[var(--color-muted)] mt-0.5'>
                    Video WebRTC, PTZ, dan mic. Hanya ADMINISTRATOR yang bisa mengubah.
                  </p>
                </div>

                <div className='space-y-2'>
                  <label
                    htmlFor='go2rtcStream'
                    className='block text-sm font-medium text-[var(--color-text)]'
                  >
                    Nama Stream go2rtc
                  </label>
                  <input
                    id='go2rtcStream'
                    {...register('go2rtcStream')}
                    placeholder='contoh: cam141'
                    disabled={isSubmitting}
                    className={`input-field w-full ${
                      errors.go2rtcStream ? 'border-red-500' : ''
                    }`}
                  />
                  {errors.go2rtcStream && (
                    <p className='text-sm text-red-600'>
                      {errors.go2rtcStream.message}
                    </p>
                  )}
                </div>

                <div className='space-y-2'>
                  <label
                    htmlFor='isapiHost'
                    className='block text-sm font-medium text-[var(--color-text)]'
                  >
                    IP Kamera (ISAPI)
                  </label>
                  <input
                    id='isapiHost'
                    {...register('isapiHost')}
                    placeholder='contoh: 192.168.1.141'
                    disabled={isSubmitting}
                    className={`input-field w-full ${
                      errors.isapiHost ? 'border-red-500' : ''
                    }`}
                  />
                  {errors.isapiHost && (
                    <p className='text-sm text-red-600'>
                      {errors.isapiHost.message}
                    </p>
                  )}
                  <p className='text-sm text-[var(--color-muted)]'>
                    Dipakai untuk PTZ dan mic. Kredensial kamera disimpan di server, bukan di sini.
                  </p>
                </div>

                <div className='flex flex-col sm:flex-row gap-3 sm:gap-6'>
                  <label className='inline-flex items-center gap-2 text-sm text-[var(--color-text)]'>
                    <input
                      type='checkbox'
                      {...register('ptzEnabled')}
                      disabled={isSubmitting}
                      className='h-4 w-4'
                    />
                    Kontrol PTZ
                  </label>
                  <label className='inline-flex items-center gap-2 text-sm text-[var(--color-text)]'>
                    <input
                      type='checkbox'
                      {...register('audioEnabled')}
                      disabled={isSubmitting}
                      className='h-4 w-4'
                    />
                    Mic / audio dua arah
                  </label>
                </div>
              </div>
            )}

            {/* Form Actions */}
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
                    <span>Membuat...</span>
                  </>
                ) : (
                  <>
                    <Save className='h-4 w-4' />
                    <span>Buat Kamera</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
