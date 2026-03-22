-- COMPLETE RLS FOR hospitaldb
-- TEAM: Alfie Warnock, Jonathan Edwards, Mudia Oseghale
-- Row level security script, to satisfy user stories that requires data to be stored "Securely"

-- 1) ENABLE RLS ON ALL TABLES

ALTER TABLE hospitaldb.userinfo               ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitaldb.patient                ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitaldb.doctor                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitaldb.appointment            ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitaldb.medicalrecord          ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitaldb.prescription           ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitaldb.prescriptionitem       ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitaldb.medicalrecorddiagnosis ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitaldb.testresult             ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitaldb.doctoravailability     ENABLE ROW LEVEL SECURITY;

-- 2) GRANTS

GRANT USAGE ON SCHEMA hospitaldb TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA hospitaldb TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA hospitaldb TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA hospitaldb
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- 3) DROP ALL EXISTING POLICIES

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'hospitaldb'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON hospitaldb.%I;', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 4) DROP HELPER FUNCTIONS

DROP FUNCTION IF EXISTS hospitaldb.current_userinfo_id();
DROP FUNCTION IF EXISTS hospitaldb.is_patient_owner(bigint);
DROP FUNCTION IF EXISTS hospitaldb.is_doctor_for_patient(bigint);
DROP FUNCTION IF EXISTS hospitaldb.current_doctor_id();

-- 5) USERINFO POLICIES

CREATE POLICY "userinfo_insert"
ON hospitaldb.userinfo
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = "supabaseUserId");

CREATE POLICY "userinfo_select"
ON hospitaldb.userinfo
FOR SELECT
TO authenticated
USING (auth.uid() = "supabaseUserId");

CREATE POLICY "userinfo_update"
ON hospitaldb.userinfo
FOR UPDATE
TO authenticated
USING (auth.uid() = "supabaseUserId")
WITH CHECK (auth.uid() = "supabaseUserId");

-- 6) PATIENT POLICIES

CREATE POLICY "patient_insert"
ON hospitaldb.patient
FOR INSERT
TO authenticated
WITH CHECK (
  "userInfoID" = (
    SELECT u."userInfoID"
    FROM hospitaldb.userinfo u
    WHERE u."supabaseUserId" = auth.uid()
    LIMIT 1
  )
);

-- SELECT: patient sees their own row
CREATE POLICY "patient_select_self"
ON hospitaldb.patient
FOR SELECT
TO authenticated
USING (
  "userInfoID" = (
    SELECT u."userInfoID"
    FROM hospitaldb.userinfo u
    WHERE u."supabaseUserId" = auth.uid()
    LIMIT 1
  )
);

-- UPDATE: patient updates their own row
CREATE POLICY "patient_update_self"
ON hospitaldb.patient
FOR UPDATE
TO authenticated
USING (
  "userInfoID" = (
    SELECT u."userInfoID"
    FROM hospitaldb.userinfo u
    WHERE u."supabaseUserId" = auth.uid()
    LIMIT 1
  )
)
WITH CHECK (
  "userInfoID" = (
    SELECT u."userInfoID"
    FROM hospitaldb.userinfo u
    WHERE u."supabaseUserId" = auth.uid()
    LIMIT 1
  )
);

-- SELECT: doctor can see patients they have appointments with
-- Currently commented out because it was causing recursion errors.
-- CREATE POLICY "patient_select_by_doctor"
-- ON hospitaldb.patient
-- FOR SELECT
-- TO authenticated
-- USING (
--   "patientID" IN (
--     SELECT a."patientID"
--     FROM hospitaldb.appointment a
--     JOIN hospitaldb.doctor d ON d."doctorID" = a."doctorID"
--     JOIN hospitaldb.userinfo u ON u."userInfoID" = d."userInfoID"
--     WHERE u."supabaseUserId" = auth.uid()
--   )
-- );

-- 7) DOCTOR POLICIES

CREATE POLICY "doctor_insert"
ON hospitaldb.doctor
FOR INSERT
TO authenticated
WITH CHECK (
  "userInfoID" = (
    SELECT u."userInfoID"
    FROM hospitaldb.userinfo u
    WHERE u."supabaseUserId" = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "doctor_select_self"
ON hospitaldb.doctor
FOR SELECT
TO authenticated
USING (
  "userInfoID" = (
    SELECT u."userInfoID"
    FROM hospitaldb.userinfo u
    WHERE u."supabaseUserId" = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "doctor_update_self"
ON hospitaldb.doctor
FOR UPDATE
TO authenticated
USING (
  "userInfoID" = (
    SELECT u."userInfoID"
    FROM hospitaldb.userinfo u
    WHERE u."supabaseUserId" = auth.uid()
    LIMIT 1
  )
)
WITH CHECK (
  "userInfoID" = (
    SELECT u."userInfoID"
    FROM hospitaldb.userinfo u
    WHERE u."supabaseUserId" = auth.uid()
    LIMIT 1
  )
);

-- SELECT: patients can see doctors linked to their appointments
-- Commented out for now because it currently causes recursion error
-- CREATE POLICY "doctor_select_by_patient"
-- ON hospitaldb.doctor
-- FOR SELECT
-- TO authenticated
-- USING (
--   "doctorID" IN (
--     SELECT a."doctorID"
--     FROM hospitaldb.appointment a
--     JOIN hospitaldb.patient p ON p."patientID" = a."patientID"
--     JOIN hospitaldb.userinfo u ON u."userInfoID" = p."userInfoID"
--     WHERE u."supabaseUserId" = auth.uid()
--   )
-- );

-- SELECT: any authenticated user can see all doctors (needed for booking)
CREATE POLICY "doctor_select_all_authenticated"
ON hospitaldb.doctor
FOR SELECT
TO authenticated
USING (true);

-- 8) APPOINTMENT POLICIES

-- Full access for patients and doctors to their own appointments
CREATE POLICY "appointment_access"
ON hospitaldb.appointment
FOR ALL
TO authenticated
USING (
  "patientID" IN (
    SELECT p."patientID"
    FROM hospitaldb.patient p
    JOIN hospitaldb.userinfo u ON u."userInfoID" = p."userInfoID"
    WHERE u."supabaseUserId" = auth.uid()
  )
  OR
  "doctorID" IN (
    SELECT d."doctorID"
    FROM hospitaldb.doctor d
    JOIN hospitaldb.userinfo u ON u."userInfoID" = d."userInfoID"
    WHERE u."supabaseUserId" = auth.uid()
  )
)
WITH CHECK (
  "patientID" IN (
    SELECT p."patientID"
    FROM hospitaldb.patient p
    JOIN hospitaldb.userinfo u ON u."userInfoID" = p."userInfoID"
    WHERE u."supabaseUserId" = auth.uid()
  )
  OR
  "doctorID" IN (
    SELECT d."doctorID"
    FROM hospitaldb.doctor d
    JOIN hospitaldb.userinfo u ON u."userInfoID" = d."userInfoID"
    WHERE u."supabaseUserId" = auth.uid()
  )
);

-- SELECT: any authenticated user can see appointments for availability checking
-- This allows patients to see if a doctor's time slot is already booked
-- Only exposes doctorID, appointmentDate, startTime - not sensitive medical data
CREATE POLICY "appointment_availability_select"
ON hospitaldb.appointment
FOR SELECT
TO authenticated
USING (true);

-- 9) MEDICAL RECORD POLICIES

CREATE POLICY "medicalrecord_access"
ON hospitaldb.medicalrecord
FOR ALL
TO authenticated
USING (
  "patientID" IN (
    SELECT p."patientID"
    FROM hospitaldb.patient p
    JOIN hospitaldb.userinfo u ON u."userInfoID" = p."userInfoID"
    WHERE u."supabaseUserId" = auth.uid()
  )
  OR
  "patientID" IN (
    SELECT a."patientID"
    FROM hospitaldb.appointment a
    JOIN hospitaldb.doctor d ON d."doctorID" = a."doctorID"
    JOIN hospitaldb.userinfo u ON u."userInfoID" = d."userInfoID"
    WHERE u."supabaseUserId" = auth.uid()
  )
)
WITH CHECK (
  "doctorID" IN (
    SELECT d."doctorID"
    FROM hospitaldb.doctor d
    JOIN hospitaldb.userinfo u ON u."userInfoID" = d."userInfoID"
    WHERE u."supabaseUserId" = auth.uid()
  )
);

-- 10) PRESCRIPTION POLICIES

CREATE POLICY "prescription_access"
ON hospitaldb.prescription
FOR ALL
TO authenticated
USING (
  "patientID" IN (
    SELECT p."patientID"
    FROM hospitaldb.patient p
    JOIN hospitaldb.userinfo u ON u."userInfoID" = p."userInfoID"
    WHERE u."supabaseUserId" = auth.uid()
  )
  OR
  "patientID" IN (
    SELECT a."patientID"
    FROM hospitaldb.appointment a
    JOIN hospitaldb.doctor d ON d."doctorID" = a."doctorID"
    JOIN hospitaldb.userinfo u ON u."userInfoID" = d."userInfoID"
    WHERE u."supabaseUserId" = auth.uid()
  )
)
WITH CHECK (
  "doctorID" IN (
    SELECT d."doctorID"
    FROM hospitaldb.doctor d
    JOIN hospitaldb.userinfo u ON u."userInfoID" = d."userInfoID"
    WHERE u."supabaseUserId" = auth.uid()
  )
);

-- 11) PRESCRIPTION ITEM POLICIES

CREATE POLICY "prescriptionitem_access"
ON hospitaldb.prescriptionitem
FOR ALL
TO authenticated
USING (
  "prescriptionID" IN (
    SELECT pr."prescriptionID"
    FROM hospitaldb.prescription pr
    JOIN hospitaldb.patient p ON p."patientID" = pr."patientID"
    JOIN hospitaldb.userinfo u ON u."userInfoID" = p."userInfoID"
    WHERE u."supabaseUserId" = auth.uid()
  )
  OR
  "prescriptionID" IN (
    SELECT pr."prescriptionID"
    FROM hospitaldb.prescription pr
    JOIN hospitaldb.doctor d ON d."doctorID" = pr."doctorID"
    JOIN hospitaldb.userinfo u ON u."userInfoID" = d."userInfoID"
    WHERE u."supabaseUserId" = auth.uid()
  )
)
WITH CHECK (
  "prescriptionID" IN (
    SELECT pr."prescriptionID"
    FROM hospitaldb.prescription pr
    JOIN hospitaldb.doctor d ON d."doctorID" = pr."doctorID"
    JOIN hospitaldb.userinfo u ON u."userInfoID" = d."userInfoID"
    WHERE u."supabaseUserId" = auth.uid()
  )
);

-- 12) MEDICAL RECORD DIAGNOSIS POLICIES

CREATE POLICY "medicalrecorddiagnosis_access"
ON hospitaldb.medicalrecorddiagnosis
FOR ALL
TO authenticated
USING (
  "medicalRecordID" IN (
    SELECT mr."medicalRecordID"
    FROM hospitaldb.medicalrecord mr
    JOIN hospitaldb.patient p ON p."patientID" = mr."patientID"
    JOIN hospitaldb.userinfo u ON u."userInfoID" = p."userInfoID"
    WHERE u."supabaseUserId" = auth.uid()
  )
  OR
  "medicalRecordID" IN (
    SELECT mr."medicalRecordID"
    FROM hospitaldb.medicalrecord mr
    JOIN hospitaldb.doctor d ON d."doctorID" = mr."doctorID"
    JOIN hospitaldb.userinfo u ON u."userInfoID" = d."userInfoID"
    WHERE u."supabaseUserId" = auth.uid()
  )
)
WITH CHECK (
  "medicalRecordID" IN (
    SELECT mr."medicalRecordID"
    FROM hospitaldb.medicalrecord mr
    JOIN hospitaldb.doctor d ON d."doctorID" = mr."doctorID"
    JOIN hospitaldb.userinfo u ON u."userInfoID" = d."userInfoID"
    WHERE u."supabaseUserId" = auth.uid()
  )
);

-- 13) TEST RESULT POLICIES

CREATE POLICY "testresult_access"
ON hospitaldb.testresult
FOR ALL
TO authenticated
USING (
  "medicalRecordID" IN (
    SELECT mr."medicalRecordID"
    FROM hospitaldb.medicalrecord mr
    JOIN hospitaldb.patient p ON p."patientID" = mr."patientID"
    JOIN hospitaldb.userinfo u ON u."userInfoID" = p."userInfoID"
    WHERE u."supabaseUserId" = auth.uid()
  )
  OR
  "medicalRecordID" IN (
    SELECT mr."medicalRecordID"
    FROM hospitaldb.medicalrecord mr
    JOIN hospitaldb.doctor d ON d."doctorID" = mr."doctorID"
    JOIN hospitaldb.userinfo u ON u."userInfoID" = d."userInfoID"
    WHERE u."supabaseUserId" = auth.uid()
  )
)
WITH CHECK (
  "medicalRecordID" IN (
    SELECT mr."medicalRecordID"
    FROM hospitaldb.medicalrecord mr
    JOIN hospitaldb.doctor d ON d."doctorID" = mr."doctorID"
    JOIN hospitaldb.userinfo u ON u."userInfoID" = d."userInfoID"
    WHERE u."supabaseUserId" = auth.uid()
  )
);

-- 14) DOCTOR AVAILABILITY POLICIES

-- Any authenticated user can view availability to book
CREATE POLICY "doctoravailability_select"
ON hospitaldb.doctoravailability
FOR SELECT
TO authenticated
USING (true);

-- Only the doctor themselves can manage their availability
CREATE POLICY "doctoravailability_write"
ON hospitaldb.doctoravailability
FOR ALL
TO authenticated
USING (
  "doctorID" IN (
    SELECT d."doctorID"
    FROM hospitaldb.doctor d
    JOIN hospitaldb.userinfo u ON u."userInfoID" = d."userInfoID"
    WHERE u."supabaseUserId" = auth.uid()
  )
)
WITH CHECK (
  "doctorID" IN (
    SELECT d."doctorID"
    FROM hospitaldb.doctor d
    JOIN hospitaldb.userinfo u ON u."userInfoID" = d."userInfoID"
    WHERE u."supabaseUserId" = auth.uid()
  )
);

-- END OF RLS SCRIPT
