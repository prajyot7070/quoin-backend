/*
  Warnings:

  - You are about to drop the column `physicalInputBytes` on the `ExecutedQuery` table. All the data in the column will be lost.
  - You are about to drop the column `processedBytes` on the `ExecutedQuery` table. All the data in the column will be lost.
  - You are about to drop the column `processedRows` on the `ExecutedQuery` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ExecutedQuery" DROP COLUMN "physicalInputBytes",
DROP COLUMN "processedBytes",
DROP COLUMN "processedRows",
ADD COLUMN     "peakMemoryBytes" DOUBLE PRECISION;
