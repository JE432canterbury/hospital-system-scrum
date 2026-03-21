DROP SCHEMA IF EXISTS HospitalDB CASCADE;

CREATE SCHEMA HospitalDB;

SET search_path TO HospitalDB;

/*

DATABASE CREATION SCRIPT - HOSPITAL DATABASE

FILE NAME: HospitalDB.sql
TEAM MEMBERS: Alfie Warnock Jonathan Edwards Mudia Oseghale
DATE CREATED: 13/03/2026
DBMS / TOOLING:
	- SCRIPTED IN PostgreSQL
	- IMPLEMENTED IN Supabase via GitHub
	- TESTED USING DBEAVER V25.3.1.202512211813

PURPOSE:
This script creates the full relational database schma for the NHS hospital
database system. It defines all tables, primary keys, foreign keys, constraints
and indexes required to support users.

USGAE INSTRUCTIONS:
	- This script must be executed before running insert scripts
	- It is safe to re-run as all tables are dropped initally
	- Intended to be executed an SQL enviroment

CHANGELOG:
	- Initial version created by the team 13 March 2026

*/

drop table if exists role cascade;

-- role table creation
create table role (
"roleID" BIGSERIAL primary key,
"roleName" VARCHAR(255) not null
);

drop table if exists userInfo cascade;

-- user table creation
create table userInfo (
"userInfoID" BIGSERIAL primary key,
"supabaseUserId" UUID NOT NULL UNIQUE,
"roleID" BIGINT not null references role("roleID") on delete restrict,
"email" VARCHAR(255),
"passwordHash" VARCHAR(255),
"accountActive" BOOLEAN not null,
"dateCreated" DATE not null default now(),
"authenticated" BOOLEAN not null default false
);

drop table if exists patient cascade;

-- patient table creation
create table patient (
"patientID" BIGSERIAL primary key,
"userInfoID" BIGINT not null references userInfo("userInfoID") on delete restrict,
"firstName" VARCHAR(255) not null,
"lastName" VARCHAR(255) not null,
"dateOfBirth" DATE not null,
"phoneNumber" VARCHAR(12) not null,
"addressLine1" VARCHAR(255) not null,
"addressLine2" VARCHAR(255),
"townCity" VARCHAR(255) not null,
"postcode" VARCHAR(255) not null,
"nhsNumber" VARCHAR(255) not null
);

drop table if exists doctorSpeciality cascade;

-- doctorSpeciality table creation
create table doctorSpeciality (
"doctorSpecialityID" BIGSERIAL primary key,
"Speciality" VARCHAR(255) not null
);

drop table if exists doctor cascade;

-- doctor table creation
create table doctor (
"doctorID" BIGSERIAL primary key,
"userInfoID" BIGINT not null references userInfo("userInfoID") on delete restrict,
"doctorSpecialityID" BIGINT not null references doctorSpeciality("doctorSpecialityID") on delete restrict,
"firstName" VARCHAR(255) not null,
"lastName" VARCHAR(255) not null,
"email" VARCHAR(255) not null,
"phoneNumber" VARCHAR(12) not null
);

drop table if exists appointmentStatus cascade;

-- appointmentStatus table creation
create table appointmentStatus (
"appointmentStatusID" BIGSERIAL primary key,
"status" VARCHAR(255) not null
);

drop table if exists appointmentType cascade;

-- appointmentType table creation
create table appointmentType (
"appointmentTypeID" BIGSERIAL primary key,
"type" VARCHAR(255) not null
);

drop table if exists appointment cascade;

-- appointment table creation
create table appointment(
"appointmentID" BIGSERIAL primary key,
"patientID" BIGINT not null references patient("patientID") on delete restrict,
"doctorID" BIGINT not null references doctor("doctorID") on delete restrict,
"appointmentStatusID" BIGINT not null references appointmentStatus("appointmentStatusID") on delete restrict,
"appointmentTypeID" BIGINT not null references appointmentType("appointmentTypeID") on delete restrict,
"appointmentDate" DATE not null,
"startTime" TIME not null,
"endTime" TIME not null,
"dateCreated" DATE not null default now()
);

drop table if exists doctorAvailability cascade; 

-- doctorAvailability table creation
create table doctorAvailability (
"doctorAvailabilityID" BIGSERIAL primary key,
"doctorID" BIGINT not null references doctor("doctorID") on delete restrict,
"dateAvailable" DATE not null,
"timeAvailable" TIME not null
);

drop table if exists medicalRecord cascade;

-- medicalRecord table creation
create table medicalRecord (
"medicalRecordID" BIGSERIAL primary key,
"patientID" BIGINT not null references patient("patientID") on delete restrict,
"doctorID" BIGINT not null references doctor("doctorID") on delete restrict,
"recordDate" DATE not null default now(),
"recordNotes" TEXT
);

drop table if exists diagnosis cascade;

-- diagnosis table creation
create table diagnosis (
"diagnosisID" BIGSERIAL primary key,
"diagnosis" VARCHAR(255) not null
);

drop table if exists MedicalRecordDiagnosis cascade;

-- medicalRecordDiagnosis table creation
create table medicalRecordDiagnosis (
"medicalRecordID" BIGINT not null references medicalRecord("medicalRecordID") on delete restrict,
"diagnosisID" BIGINT not null references diagnosis("diagnosisID") on delete restrict
);

drop table if exists testResult cascade;

-- testResult table creation
create table testResult (
"testResultID" BIGSERIAL primary key,
"medicalRecordID" BIGINT not null references medicalRecord("medicalRecordID") on delete restrict,
"testName" VARCHAR(255),
"testResultNotes" TEXT,
"testResultDate" DATE default now()
);

drop table if exists medication cascade;

-- medication table creation
create table medication (
"medicationID" BIGSERIAL primary key,
"medication" VARCHAR(255) not null
);

drop table if exists prescription cascade;

-- prescription table creation
create table prescription (
"prescriptionID" BIGSERIAL primary key,
"patientID" BIGINT not null references patient("patientID") on delete restrict,
"doctorID" BIGINT not null references doctor("doctorID") on delete restrict,
"issueDate" DATE not null default now(),
"prescriptionNotes" TEXT
);

drop table if exists prescriptionItem cascade;

-- prescriptionItem table creation
create table prescriptionItem (
"prescriptionItemID" BIGSERIAL primary key,
"prescriptionID" BIGINT not null references prescription("prescriptionID") on delete restrict,
"medicationID" BIGINT not null references medication("medicationID") on delete restrict,
"dosage" VARCHAR(255) not null,
"frequency" VARCHAR(255) not null,
"startDate" DATE not null default now(),
"endDate" DATE
);

/*

END OF CREATION SCRIPT
READY TO RUN
NEXT - RUN DATA INSERT SCRIPT IF NECESSARY

*/