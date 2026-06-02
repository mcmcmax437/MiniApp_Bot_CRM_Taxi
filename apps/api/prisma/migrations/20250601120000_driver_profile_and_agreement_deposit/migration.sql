-- Driver profile fields; deposit moved to rental agreements.

ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "pesel" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "passportNumber" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "addressCity" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "addressStreet" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "addressHouse" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "addressFlat" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "fatherName" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "motherName" TEXT;

UPDATE "Driver"
SET
  "firstName" = COALESCE(NULLIF("firstName", ''), split_part("fullName", ' ', 1)),
  "lastName" = COALESCE(
    NULLIF("lastName", ''),
    NULLIF(trim(substring("fullName" from length(split_part("fullName", ' ', 1)) + 1)), ''),
    split_part("fullName", ' ', 1)
  )
WHERE "firstName" IS NULL OR "lastName" IS NULL;

ALTER TABLE "Driver" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "Driver" ALTER COLUMN "lastName" SET NOT NULL;

ALTER TABLE "RentalAgreement" ADD COLUMN IF NOT EXISTS "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "RentalAgreement" ra
SET "depositAmount" = d."depositAmount"
FROM "Driver" d
WHERE ra."driverId" = d.id
  AND ra."status" = 'ACTIVE'
  AND d."depositAmount" > 0
  AND ra."depositAmount" = 0;

ALTER TABLE "Driver" DROP COLUMN IF EXISTS "depositAmount";
ALTER TABLE "Driver" DROP COLUMN IF EXISTS "assignedCarId";
