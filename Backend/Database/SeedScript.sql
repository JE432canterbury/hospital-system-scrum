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


COMMIT;


-- END OF INSERT SCRIPT
