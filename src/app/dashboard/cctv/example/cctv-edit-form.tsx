'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Save, Trash2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCCTVCamera, useUpdateCCTV } from '@/hooks/use-cctv';
import { useProjects } from '@/hooks/use-projects';
import { updateCCTVSchema, UpdateCCTVInput } from '@/lib/validations';
import { toast } from 'sonner';
import { RoleName } from '@prisma/client';
import Link from 'next/link';
import { CCTVDeleteModal } from './cctv-delete-modal';

import { CCTV, User } from '@/types';
import type { ProjectOption } from '@/types';

interface CCTVEditFormProps {
  user: User;
  cameraId: string;
}

export function CCTVEditForm({ user, cameraId }: CCTVEditFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { data: camera, isLoading: cameraLoading } = useCCTVCamera(cameraId);
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const updateCCTV = useUpdateCCTV();

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

  // Ensure form values are populated once camera data is loaded
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
      toast.success('Camera updated successfully');
      router.push('/cctv');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message || 'Failed to update camera';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/cctv');
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return 'default';
      case 'OFFLINE':
        return 'secondary';
      case 'MAINTENANCE':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (cameraLoading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <Loader2 className='h-8 w-8 animate-spin' />
      </div>
    );
  }

  if (!camera) {
    return (
      <div className='text-center py-8'>
        <p className='text-gray-500'>Camera not found</p>
        <Button onClick={() => router.push('/cctv')} className='mt-4'>
          Back to CCTV List
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className='max-w-2xl mx-auto'>
        <Card>
          <CardHeader>
            <div className='flex items-center gap-4'>
              <Link href='/cctv'>
                <Button variant='ghost' size='icon'>
                  <ArrowLeft className='h-4 w-4' />
                </Button>
              </Link>
              <div className='flex items-center gap-3 flex-1'>
                <div className='w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center'>
                  <Camera className='h-5 w-5 text-primary' />
                </div>
                <div>
                  <CardTitle>Edit Camera Information</CardTitle>
                  <CardDescription>
                    Update camera details and settings
                  </CardDescription>
                </div>
              </div>
              {user.role === RoleName.ADMINISTRATOR && (
                <Button
                  variant='outline'
                  size='sm'
                  className='text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/20'
                  onClick={() => setShowDeleteModal(true)}
                >
                  <Trash2 className='h-4 w-4 mr-2' />
                  Delete
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
              {/* Camera Name */}
              <div className='space-y-2'>
                <Label htmlFor='name'>
                  Camera Name <span className='text-red-500'>*</span>
                </Label>
                <Input
                  id='name'
                  {...register('name')}
                  placeholder='Enter camera name'
                  disabled={isSubmitting}
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className='text-sm text-red-600'>{errors.name.message}</p>
                )}
              </div>

              {/* Description */}
              <div className='space-y-2'>
                <Label htmlFor='description'>Description</Label>
                <textarea
                  id='description'
                  {...register('description')}
                  placeholder='Enter camera description (optional)'
                  disabled={isSubmitting}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]'
                />
                {errors.description && (
                  <p className='text-sm text-red-600'>
                    {errors.description.message}
                  </p>
                )}
              </div>

              {/* Location */}
              <div className='space-y-2'>
                <Label htmlFor='location'>Location</Label>
                <Input
                  id='location'
                  {...register('location')}
                  placeholder='Enter camera location'
                  disabled={isSubmitting}
                  className={errors.location ? 'border-red-500' : ''}
                />
                {errors.location && (
                  <p className='text-sm text-red-600'>
                    {errors.location.message}
                  </p>
                )}
              </div>

              {/* Project */}
              <div className='space-y-2'>
                <Label htmlFor='projectId'>
                  Project <span className='text-red-500'>*</span>
                </Label>
                <select
                  id='projectId'
                  {...register('projectId' as keyof UpdateCCTVInput)}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  disabled={isSubmitting || projectsLoading}
                >
                  <option value=''>Select a project</option>
                  {projects?.map((project: ProjectOption) => (
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
                <Label htmlFor='streamUrl'>Stream URL</Label>
                <Input
                  id='streamUrl'
                  type='url'
                  {...register('streamUrl')}
                  placeholder='https://example.com/stream or rtsp://camera-ip/stream'
                  disabled={isSubmitting}
                  className={errors.streamUrl ? 'border-red-500' : ''}
                />
                {errors.streamUrl && (
                  <p className='text-sm text-red-600'>
                    {errors.streamUrl.message}
                  </p>
                )}
                <p className='text-sm text-gray-500'>
                  Enter the public URL for the camera stream (HTTP/HTTPS or
                  RTSP)
                </p>
              </div>

              {/* Status */}
              <div className='space-y-2'>
                <Label htmlFor='status'>Status</Label>
                <select
                  id='status'
                  {...register('status')}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  disabled={isSubmitting}
                >
                  <option value='OFFLINE'>Offline</option>
                  <option value='ONLINE'>Online</option>
                  <option value='MAINTENANCE'>Maintenance</option>
                </select>
              </div>

              {/* Camera Stats */}
              <div className='bg-gray-50 p-4 rounded-lg'>
                <h3 className='font-medium text-gray-900 mb-3'>
                  Camera Information
                </h3>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4 text-sm'>
                  <div>
                    <p className='text-gray-500'>Current Status</p>
                    <Badge variant={getStatusBadgeVariant(camera.status)}>
                      {camera.status}
                    </Badge>
                  </div>
                  <div>
                    <p className='text-gray-500'>Project</p>
                    <p className='font-medium'>
                      {camera.project?.name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className='text-gray-500'>Last Activity</p>
                    <p className='font-medium'>
                      {camera.lastActivity
                        ? new Date(camera.lastActivity).toLocaleDateString()
                        : 'Never'}
                    </p>
                  </div>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-4'>
                  <div>
                    <p className='text-gray-500'>Created</p>
                    <p className='font-medium'>
                      {new Date(camera.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className='text-gray-500'>Last Updated</p>
                    <p className='font-medium'>
                      {new Date(camera.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className='flex gap-3 pt-6 border-t'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className='flex-1'
                >
                  Cancel
                </Button>
                <Button
                  type='submit'
                  disabled={isSubmitting}
                  className='flex-1'
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className='mr-2 h-4 w-4' />
                      Update Camera
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <CCTVDeleteModal
          camera={camera}
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onSuccess={() => router.push('/cctv')}
        />
      )}
    </>
  );
}
