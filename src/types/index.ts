import { RoleName, Project, AccountType } from '@prisma/client';

// User types
export interface User {
  id: string;
  name?: string | null;
  email: string;
  role: RoleName;
  image?: string | null;
  accountType?: AccountType;
  canAccessDashboard?: boolean;
  canAccessMobile?: boolean;
}

// Platform login types
export type Platform = 'dashboard' | 'mobile';

export interface PlatformLoginRequest {
  email: string;
  password: string;
}

export interface PlatformLoginResponse {
  success: boolean;
  user?: {
    id: string;
    name?: string | null;
    email: string;
    role?: string;
    accountType: AccountType;
  };
  message?: string;
  error?: string;
}

// CCTV types
export interface CCTV {
  id: string;
  name: string;
  description?: string | null;
  location?: string | null;
  projectId: string;
  streamUrl: string;
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
  project?: Project;
  createdAt: Date;
  updatedAt: Date;
  lastActivity?: Date | string | null;
}

// Props types
export interface CCTVListProps {
  user: User;
}

export interface CCTVViewerProps {
  cameraId: string;
}

export interface CCTVDeleteModalProps {
  camera: {
    id: string;
    name: string;
    location?: string | null;
    project?: {
      name: string;
    };
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Project types
export interface ProjectOption {
  id: string;
  name: string;
}
