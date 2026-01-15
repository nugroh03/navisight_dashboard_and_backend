/*
  Warnings:

  - You are about to drop the column `voyageId` on the `position_reports` table. All the data in the column will be lost.
  - You are about to drop the `timeline_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `voyages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `voyages_leg` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `projectId` to the `position_reports` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "position_reports" DROP CONSTRAINT "position_reports_voyageId_fkey";

-- DropForeignKey
ALTER TABLE "timeline_events" DROP CONSTRAINT "timeline_events_voyageId_fkey";

-- DropForeignKey
ALTER TABLE "voyages" DROP CONSTRAINT "voyages_projectId_fkey";

-- DropForeignKey
ALTER TABLE "voyages_leg" DROP CONSTRAINT "voyages_leg_fromPortId_fkey";

-- DropForeignKey
ALTER TABLE "voyages_leg" DROP CONSTRAINT "voyages_leg_toPortId_fkey";

-- DropForeignKey
ALTER TABLE "voyages_leg" DROP CONSTRAINT "voyages_leg_voyageId_fkey";

-- AlterTable
ALTER TABLE "position_reports" DROP COLUMN "voyageId",
ADD COLUMN     "projectId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "deviceId" VARCHAR(255),
ADD COLUMN     "lastHeadingDeg" DECIMAL(10,2),
ADD COLUMN     "lastLat" DECIMAL(10,6),
ADD COLUMN     "lastLng" DECIMAL(10,6),
ADD COLUMN     "lastReportedAt" TIMESTAMP(3),
ADD COLUMN     "lastSpeedKn" DECIMAL(10,2);

-- DropTable
DROP TABLE "timeline_events";

-- DropTable
DROP TABLE "voyages";

-- DropTable
DROP TABLE "voyages_leg";

-- AddForeignKey
ALTER TABLE "position_reports" ADD CONSTRAINT "position_reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
