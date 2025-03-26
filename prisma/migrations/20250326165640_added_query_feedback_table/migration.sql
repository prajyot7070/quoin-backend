/*
  Warnings:

  - The values [OWNER,MEMBER] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `ExecutionLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QueryVersion` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `userId` to the `SavedQuery` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'DEVELOPER', 'VIEWER');
ALTER TABLE "OrganizationMembership" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "OrganizationMembership" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "OrganizationMembership" ALTER COLUMN "role" SET DEFAULT 'VIEWER';
COMMIT;

-- DropForeignKey
ALTER TABLE "ExecutionLog" DROP CONSTRAINT "ExecutionLog_savedQueryId_fkey";

-- DropForeignKey
ALTER TABLE "QueryVersion" DROP CONSTRAINT "QueryVersion_savedQueryId_fkey";

-- AlterTable
ALTER TABLE "Connection" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrganizationMembership" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ALTER COLUMN "organizationId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SavedQuery" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "ExecutionLog";

-- DropTable
DROP TABLE "QueryVersion";

-- CreateTable
CREATE TABLE "ExecutedQuery" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "resultSize" INTEGER,

    CONSTRAINT "ExecutedQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueryFeedback" (
    "id" TEXT NOT NULL,
    "executedQueryId" TEXT,
    "savedQueryId" TEXT,
    "rawQuery" TEXT,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueryFeedback_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SavedQuery" ADD CONSTRAINT "SavedQuery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutedQuery" ADD CONSTRAINT "ExecutedQuery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutedQuery" ADD CONSTRAINT "ExecutedQuery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutedQuery" ADD CONSTRAINT "ExecutedQuery_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryFeedback" ADD CONSTRAINT "QueryFeedback_executedQueryId_fkey" FOREIGN KEY ("executedQueryId") REFERENCES "ExecutedQuery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryFeedback" ADD CONSTRAINT "QueryFeedback_savedQueryId_fkey" FOREIGN KEY ("savedQueryId") REFERENCES "SavedQuery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryFeedback" ADD CONSTRAINT "QueryFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
