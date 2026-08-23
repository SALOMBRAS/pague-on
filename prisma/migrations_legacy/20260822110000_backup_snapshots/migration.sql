CREATE TABLE "BackupSnapshot" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "version" TEXT NOT NULL,
  "exportedAt" TIMESTAMP(3) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "iv" TEXT NOT NULL,
  "authTag" TEXT NOT NULL,
  "ciphertext" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BackupSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BackupSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BackupSnapshot_userId_createdAt_idx" ON "BackupSnapshot"("userId", "createdAt");
