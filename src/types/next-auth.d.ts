import { RoleName } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      id?: string;
      role?: RoleName | string;
    };
  }

  interface User {
    role?: {
      name: RoleName;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: RoleName | string;
  }
}
