ALTER TABLE "cameras" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "createdAt" ASC) AS rn
  FROM "cameras"
)
UPDATE "cameras"
SET "sortOrder" = ranked.rn
FROM ranked
WHERE "cameras"."id" = ranked.id;

CREATE INDEX "cameras_projectId_sortOrder_idx"
  ON "cameras"("projectId", "sortOrder");
