-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bio" VARCHAR(300),
ADD COLUMN     "branch" TEXT,
ADD COLUMN     "collegeEmail" TEXT,
ADD COLUMN     "course" TEXT,
ADD COLUMN     "isVerifiedStudent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "profilePictureUrl" TEXT,
ADD COLUMN     "ratingAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "year" INTEGER;

-- CreateTable
CREATE TABLE "email_otps" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "collegeEmail" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_otps_userId_idx" ON "email_otps"("userId");

-- CreateIndex
CREATE INDEX "email_otps_collegeEmail_idx" ON "email_otps"("collegeEmail");

-- CreateIndex
CREATE UNIQUE INDEX "users_collegeEmail_key" ON "users"("collegeEmail");

-- AddForeignKey
ALTER TABLE "email_otps" ADD CONSTRAINT "email_otps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
