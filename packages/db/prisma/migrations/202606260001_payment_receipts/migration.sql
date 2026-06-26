DO $$ BEGIN
  CREATE TYPE "PaymentReceiptStatus" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE TABLE IF NOT EXISTS "PaymentReceipt" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "telegramFileId" TEXT,
  "telegramMessageId" TEXT,
  "claimedAmount" INTEGER,
  "approvedAmount" INTEGER,
  "status" "PaymentReceiptStatus" NOT NULL DEFAULT 'pending',
  "note" TEXT,
  "adminNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedByAdminId" TEXT,
  "metadata" JSONB,
  CONSTRAINT "PaymentReceipt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PaymentReceipt_status_createdAt_idx" ON "PaymentReceipt"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "PaymentReceipt_userId_createdAt_idx" ON "PaymentReceipt"("userId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
