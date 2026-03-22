/*

DATABASE INSERT SCRIPT - HOSPITAL DATABASE

PURPOSE:
This script inserts the basic reference data required for the system
to function correctly.

NOTE:
Run the database creation script first.

*/

BEGIN;


-- ROLE DATA


INSERT INTO hospitaldb.role ("roleName") VALUES
('Patient'),
('Doctor'),
('Administrator')
ON CONFLICT DO NOTHING;


-- DOCTOR SPECIALITIES


INSERT INTO hospitaldb.doctorSpeciality ("Speciality") VALUES
('General Practice'),
('Cardiology'),
('Dermatology'),
('Neurology'),
('Orthopedics')
ON CONFLICT DO NOTHING;


-- APPOINTMENT STATUS


INSERT INTO hospitaldb.appointmentStatus ("status") VALUES
('Scheduled'),
('Completed'),
('Cancelled'),
('Rescheduled')
ON CONFLICT DO NOTHING;


-- APPOINTMENT TYPES


INSERT INTO hospitaldb.appointmentType ("type") VALUES
('Consultation'),
('Check-up'),
('Follow-up'),
('Emergency')
ON CONFLICT DO NOTHING;


-- DIAGNOSIS TYPES


INSERT INTO hospitaldb.diagnosis ("diagnosis") VALUES
('Hypertension'),
('Diabetes'),
('Asthma'),
('Flu'),
('Migraine')
ON CONFLICT DO NOTHING;


-- MEDICATION DATA


INSERT INTO hospitaldb.medication ("medication") VALUES
('Paracetamol'),
('Ibuprofen'),
('Amoxicillin'),
('Metformin'),
('Aspirin')
ON CONFLICT DO NOTHING;


-- DOCTOR AVAILABILITY
-- Populates Mon-Fri 9am availability for all doctors for the next 6 months
-- The calendar component uses this table to determine which days are bookable
-- Any date not present here is blocked on the calendar regardless of day of week
-- If a doctor takes a day off, remove their row for that date to block it


INSERT INTO hospitaldb.doctoravailability ("doctorID", "dateAvailable", "timeAvailable")
SELECT
    d."doctorID",
    generate_series::date,
    '09:00'::time
FROM hospitaldb.doctor d
CROSS JOIN generate_series(
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '6 months',
    '1 day'::interval
) generate_series
WHERE EXTRACT(DOW FROM generate_series) BETWEEN 1 AND 5
ON CONFLICT DO NOTHING;

-- MEDICAL RECORDS
INSERT INTO hospitaldb.medicalrecord (
    "patientID",
    "doctorID",
    "recordDate",
    "recordNotes"
)
SELECT
    p."patientID",
    d."doctorID",
    record_date,
    record_notes
FROM
    hospitaldb.patient p,
    hospitaldb.doctor d,
    (VALUES
        (CURRENT_DATE - INTERVAL '6 months', 'Patient presented with persistent headaches and elevated blood pressure. Blood pressure reading 145/92. Advised lifestyle changes and prescribed medication. Follow-up in 4 weeks.'),
        (CURRENT_DATE - INTERVAL '3 months', 'Follow-up appointment. Blood pressure improved to 130/85. Patient reports headaches less frequent. Continuing current medication. Review in 3 months.'),
        (CURRENT_DATE - INTERVAL '1 month',  'Annual check-up. Blood pressure stable at 128/82. General health good. Blood tests ordered. Patient reports mild fatigue.')
    ) AS records(record_date, record_notes)
WHERE p."patientID" = (SELECT MIN("patientID") FROM hospitaldb.patient)
  AND d."doctorID"  = (SELECT MIN("doctorID")  FROM hospitaldb.doctor);


-- MEDICAL RECORD DIAGNOSES
INSERT INTO hospitaldb.medicalrecorddiagnosis ("medicalRecordID", "diagnosisID")
SELECT
    mr."medicalRecordID",
    diag."diagnosisID"
FROM hospitaldb.medicalrecord mr
CROSS JOIN (
    SELECT "diagnosisID" FROM hospitaldb.diagnosis
    WHERE "diagnosis" IN ('Hypertension', 'Migraine')
) diag
WHERE mr."patientID" = (SELECT MIN("patientID") FROM hospitaldb.patient);


-- TEST RESULTS
INSERT INTO hospitaldb.testresult (
    "medicalRecordID",
    "testName",
    "testResultNotes",
    "testResultDate"
)
SELECT
    mr."medicalRecordID",
    test_name,
    test_notes,
    CURRENT_DATE - INTERVAL '1 month'
FROM hospitaldb.medicalrecord mr,
(VALUES
    ('Full Blood Count',       'Results within normal range. Haemoglobin 14.2 g/dL. White cell count normal. Platelets normal.'),
    ('Blood Pressure Monitor', 'Ambulatory blood pressure monitoring over 24 hours. Average reading 128/82. Well controlled.'),
    ('Cholesterol Screen',     'Total cholesterol 4.8 mmol/L. LDL 2.9 mmol/L. HDL 1.4 mmol/L. Within acceptable range.')
) AS tests(test_name, test_notes)
WHERE mr."medicalRecordID" = (SELECT MAX("medicalRecordID") FROM hospitaldb.medicalrecord);


-- PRESCRIPTIONS
INSERT INTO hospitaldb.prescription (
    "patientID",
    "doctorID",
    "issueDate",
    "prescriptionNotes"
)
SELECT
    p."patientID",
    d."doctorID",
    issue_date,
    notes
FROM
    hospitaldb.patient p,
    hospitaldb.doctor d,
    (VALUES
        (CURRENT_DATE - INTERVAL '6 months', 'Initial prescription for hypertension management. Take as directed. Review in 4 weeks.'),
        (CURRENT_DATE - INTERVAL '1 month',  'Repeat prescription following satisfactory review. Continue current dosage.')
    ) AS prescriptions(issue_date, notes)
WHERE p."patientID" = (SELECT MIN("patientID") FROM hospitaldb.patient)
  AND d."doctorID"  = (SELECT MIN("doctorID")  FROM hospitaldb.doctor);


-- PRESCRIPTION ITEMS
INSERT INTO hospitaldb.prescriptionitem (
    "prescriptionID",
    "medicationID",
    "dosage",
    "frequency",
    "startDate",
    "endDate"
)
SELECT
    pr."prescriptionID",
    m."medicationID",
    dosage,
    frequency,
    pr."issueDate",
    pr."issueDate" + INTERVAL '3 months'
FROM hospitaldb.prescription pr
CROSS JOIN (
    VALUES
        ('Metformin',   '500mg', 'Twice daily with meals'),
        ('Aspirin',     '75mg',  'Once daily with food'),
        ('Paracetamol', '500mg', 'As required, max 4 times daily')
) AS items(med_name, dosage, frequency)
JOIN hospitaldb.medication m ON m."medication" = items.med_name;


-- This is specifically for testing. As this is the ID of the user signed in currently. Ensures unverified users can't see others medical history.
UPDATE hospitaldb.medicalrecord 
SET "patientID" = 2
WHERE "patientID" = 1;

UPDATE hospitaldb.prescription
SET "patientID" = 2
WHERE "patientID" = 1;


COMMIT;


-- END OF INSERT SCRIPT
