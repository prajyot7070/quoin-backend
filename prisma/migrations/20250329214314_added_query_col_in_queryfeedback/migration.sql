/*
  Warnings:

  - Added the required column `query` to the `SavedQuery` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SavedQuery" ADD COLUMN     "query" TEXT NOT NULL;
