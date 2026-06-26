CREATE TABLE IF NOT EXISTS "PendingBotRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "telegramId" TEXT NOT NULL,
  "taskType" "TaskType" NOT NULL,
  "prompt" TEXT NOT NULL,
  "estimatedCost" INTEGER NOT NULL,
  "selectedModel" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PendingBotRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PendingBotRequest_telegramId_key" ON "PendingBotRequest"("telegramId");
CREATE INDEX IF NOT EXISTS "PendingBotRequest_expiresAt_idx" ON "PendingBotRequest"("expiresAt");
