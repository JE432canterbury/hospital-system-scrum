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



COMMIT;


-- END OF INSERT SCRIPT
