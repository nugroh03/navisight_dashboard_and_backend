-- AlterTable
ALTER TABLE "cameras" ADD COLUMN     "description" TEXT,
ADD COLUMN     "location" VARCHAR(255),
ADD COLUMN     "status" VARCHAR(50) DEFAULT 'OFFLINE';
