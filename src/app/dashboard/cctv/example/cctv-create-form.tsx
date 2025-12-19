'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Save, Camera } from 'lucide-react';
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
import { useCreateCCTV } from '@/hooks/use-cctv';
import { useProjects } from '@/hooks/use-projects';
import { createCCTVSchema, CreateCCTVInput } from '@/lib/validations';
import { Project } from '@prisma/client';
import { toast } from 'sonner';
import Link from 'next/link';

export function CCTVCreateForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createCCTV = useCreateCCTV();
  const { data: projects, isLoading: projectsLoading } = useProjects();

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
    },
  });

  const onSubmit = async (data: CreateCCTVInput) => {
    setIsSubmitting(true);
    try {
      await createCCTV.mutateAsync(data);
      toast.success('Camera created successfully');
      router.push('/cctv');
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
    router.push('/cctv');
  };

  return (
    <div className='max-w-2xl mx-auto'>
      <Card>
        <CardHeader>
          <div className='flex items-center gap-4'>
            <Link href='/cctv'>
              <Button variant='ghost' size='icon'>
                <ArrowLeft className='h-4 w-4' />
              </Button>
            </Link>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center'>
                <Camera className='h-5 w-5 text-primary' />
              </div>
              <div>
                <CardTitle>Camera Information</CardTitle>
                <CardDescription>
                  Enter the information for the new CCTV camera
                </CardDescription>
              </div>
            </div>
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
                {...register('projectId')}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                disabled={isSubmitting || projectsLoading}
              >
                <option value=''>Select a project</option>
                {projects?.map((project: Project) => (
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
                Enter the public URL for the camera stream (HTTP/HTTPS or RTSP)
              </p>
            </div>

            {/* Status */}
            <div className='space-y-2'>
              <Label htmlFor='status'>Initial Status</Label>
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
              <p className='text-sm text-gray-500'>
                Set the initial status of the camera
              </p>
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
              <Button type='submit' disabled={isSubmitting} className='flex-1'>
                {isSubmitting ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className='mr-2 h-4 w-4' />
                    Create Camera
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
