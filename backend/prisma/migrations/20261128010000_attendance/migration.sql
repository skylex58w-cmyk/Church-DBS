CREATE TABLE "AttendanceSession" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "serviceDate" DATE NOT NULL,
  "serviceType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceRecord" (
  "id" SERIAL NOT NULL,
  "sessionId" INTEGER NOT NULL,
  "memberId" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AttendanceSession_branchId_serviceDate_idx"
  ON "AttendanceSession"("branchId", "serviceDate");
CREATE INDEX "AttendanceSession_branchId_serviceType_serviceDate_idx"
  ON "AttendanceSession"("branchId", "serviceType", "serviceDate");
CREATE UNIQUE INDEX "AttendanceRecord_sessionId_memberId_key"
  ON "AttendanceRecord"("sessionId", "memberId");
CREATE INDEX "AttendanceRecord_memberId_idx"
  ON "AttendanceRecord"("memberId");

ALTER TABLE "AttendanceSession"
  ADD CONSTRAINT "AttendanceSession_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord"
  ADD CONSTRAINT "AttendanceRecord_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord"
  ADD CONSTRAINT "AttendanceRecord_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
