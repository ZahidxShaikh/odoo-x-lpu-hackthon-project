-- AlterTable
ALTER TABLE "EmailVerificationToken" ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ResetToken" ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0;
