import { prisma } from '@/lib/prisma';

/**
 * Ambil kamera hanya jika user boleh mengaksesnya.
 * Aturan sama dengan GET /api/cctv: CLIENT dan ADMINISTRATOR hanya boleh
 * kamera di project tempat mereka menjadi anggota.
 * Mengembalikan camera = null jika kamera tidak ada atau tidak boleh diakses,
 * supaya keberadaan kamera milik project lain tidak bocor.
 */
export async function findAccessibleCamera(email: string, cameraId: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      role: true,
      projectUsers: { select: { projectId: true } },
    },
  });

  if (!user) {
    return { user: null, camera: null };
  }

  const camera = await prisma.camera.findUnique({
    where: { id: cameraId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!camera) {
    return { user, camera: null };
  }

  const roleName = user.role?.name as string | undefined;
  if (roleName === 'CLIENT' || roleName === 'ADMINISTRATOR') {
    const isMember = user.projectUsers.some(
      (pu) => pu.projectId === camera.projectId
    );
    if (!isMember) {
      return { user, camera: null };
    }
  }

  return { user, camera };
}
