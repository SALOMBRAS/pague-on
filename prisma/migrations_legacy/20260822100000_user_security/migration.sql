CREATE TYPE "SecurityChallengeType" AS ENUM ('REGISTRATION', 'AUTHENTICATION');

CREATE TABLE "UserSecurity" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "biometricEnabled" BOOLEAN NOT NULL DEFAULT false,
  "pinHash" TEXT,
  "pinSalt" TEXT,
  "lockTimeout" INTEGER NOT NULL DEFAULT 5,
  "hideValues" BOOLEAN NOT NULL DEFAULT false,
  "pinAttempts" INTEGER NOT NULL DEFAULT 0,
  "pinLockedUntil" TIMESTAMP(3),
  "webauthnChallenge" TEXT,
  "challengeType" "SecurityChallengeType",
  "challengeExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserSecurity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserSecurity_userId_key" UNIQUE ("userId"),
  CONSTRAINT "UserSecurity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "WebAuthnCredential" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "credentialId" TEXT NOT NULL,
  "publicKey" BYTEA NOT NULL,
  "counter" BIGINT NOT NULL DEFAULT 0,
  "transports" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "deviceType" TEXT,
  "backedUp" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "WebAuthnCredential_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebAuthnCredential_credentialId_key" UNIQUE ("credentialId"),
  CONSTRAINT "WebAuthnCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "WebAuthnCredential_userId_idx" ON "WebAuthnCredential"("userId");
