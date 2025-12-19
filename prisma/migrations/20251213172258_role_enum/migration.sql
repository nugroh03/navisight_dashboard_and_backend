-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('ADMINISTRATOR', 'CLIENT', 'WORKER');

-- Add new column with the enum type
ALTER TABLE "roles" ADD COLUMN "name_new" "RoleName";

-- Migrate existing string values to enum values (fallback to ADMINISTRATOR)
UPDATE "roles"
SET "name_new" = CASE
  WHEN LOWER("name") = 'administrator' THEN 'ADMINISTRATOR'::"RoleName"
  WHEN LOWER("name") = 'client' THEN 'CLIENT'::"RoleName"
  WHEN LOWER("name") = 'worker' THEN 'WORKER'::"RoleName"
  ELSE 'ADMINISTRATOR'::"RoleName"
END;

-- Ensure the new column is required
ALTER TABLE "roles" ALTER COLUMN "name_new" SET NOT NULL;

-- Drop old column and rename the new one
ALTER TABLE "roles" DROP COLUMN "name";
ALTER TABLE "roles" RENAME COLUMN "name_new" TO "name";
