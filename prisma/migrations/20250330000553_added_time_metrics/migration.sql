-- AlterTable
ALTER TABLE "ExecutedQuery" ADD COLUMN     "analysisTime" DOUBLE PRECISION,
ADD COLUMN     "cpuTime" DOUBLE PRECISION,
ADD COLUMN     "elapsedTime" DOUBLE PRECISION,
ADD COLUMN     "finishingTime" DOUBLE PRECISION,
ADD COLUMN     "physicalInputBytes" BIGINT,
ADD COLUMN     "planningTime" DOUBLE PRECISION,
ADD COLUMN     "processedBytes" BIGINT,
ADD COLUMN     "processedRows" BIGINT,
ADD COLUMN     "queuedTime" DOUBLE PRECISION,
ADD COLUMN     "wallTime" DOUBLE PRECISION;
