-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('INTERNAL_STAFF', 'EXTERNAL_CUSTOMER');

-- AlterTable: Add account type and platform access control
-- Default values: INTERNAL_STAFF with both dashboard and mobile access
-- This ensures all existing users can continue accessing both platforms
ALTER TABLE "users" ADD COLUMN     "accountType" "AccountType" NOT NULL DEFAULT 'INTERNAL_STAFF',
ADD COLUMN     "canAccessDashboard" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canAccessMobile" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex: Ensure email uniqueness at database level for security
-- This index already exists from Prisma schema @unique directive
-- Prisma automatically creates: CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

-- Add comments for documentation
COMMENT ON COLUMN "users"."accountType" IS 'Account type: INTERNAL_STAFF for employees, EXTERNAL_CUSTOMER for mobile clients';
COMMENT ON COLUMN "users"."canAccessDashboard" IS 'Permission flag for dashboard/web application access';
COMMENT ON COLUMN "users"."canAccessMobile" IS 'Permission flag for mobile application access';
