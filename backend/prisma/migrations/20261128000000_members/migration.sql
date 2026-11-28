CREATE TABLE "Member" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "middleName" TEXT,
  "gender" TEXT,
  "dateOfBirth" DATE,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "maritalStatus" TEXT,
  "membershipStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
  "joinedAt" DATE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Member_branchId_lastName_firstName_idx"
  ON "Member"("branchId", "lastName", "firstName");
CREATE INDEX "Member_branchId_membershipStatus_idx"
  ON "Member"("branchId", "membershipStatus");
CREATE INDEX "Member_phone_idx" ON "Member"("phone");

ALTER TABLE "Member"
  ADD CONSTRAINT "Member_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
