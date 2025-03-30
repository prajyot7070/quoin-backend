/*
  Warnings:

  - You are about to alter the column `peakMemoryBytes` on the `ExecutedQuery` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.

*/
-- AlterTable
ALTER TABLE "ExecutedQuery" ALTER COLUMN "peakMemoryBytes" SET DATA TYPE INTEGER;
