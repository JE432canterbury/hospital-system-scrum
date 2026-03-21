// Dashboard Data Service - HospitalDB Integration
// Fetches real data from Supabase database for dashboard display (No data yet as this will be completed in future user stories)


import { supabase, dbHelpers, TABLES } from './supabaseClient.js';

export const dashboardService = {
    // Get patient dashboard data
    async getPatientDashboardData(userId) {
        try {
            // Get patient info
            const { data: patient, error: patientError } = await supabase
                .from(TABLES.PATIENT)
                .select('*')
                .eq('userInfoID', userId)
                .single();
            
            if (patientError) throw patientError;
            
            // Get user info separately
            const { data: userInfo, error: userInfoError } = await supabase
                .from(TABLES.USER_INFO)
                .select('email, dateCreated')
                .eq('userInfoID', userId)
                .single();
                
            if (userInfoError) throw userInfoError;
            
            // Combine data
            patient.userInfo = userInfo;

            // Get patient appointments
            const { data: appointments, error: apptError } = await dbHelpers.getPatientAppointments(patient.patientID);
            
            // Get patient medical records
            const { data: medicalRecords, error: recordsError } = await dbHelpers.getPatientMedicalRecords(patient.patientID);
            
            // Get patient prescriptions
            const { data: prescriptions, error: prescriptionError } = await dbHelpers.getPatientPrescriptions(patient.patientID);

            return {
                patient,
                appointments: appointments || [],
                medicalRecords: medicalRecords || [],
                prescriptions: prescriptions || [],
                errors: {
                    patient: patientError,
                    appointments: apptError,
                    medicalRecords: recordsError,
                    prescriptions: prescriptionError
                }
            };
        } catch (error) {
            console.error('Error fetching patient dashboard data:', error);
            return { error: error.message };
        }
    },

    // Get doctor dashboard data
    async getDoctorDashboardData(userId) {
        try {
            // Get doctor info
            const { data: doctor, error: doctorError } = await supabase
                .from(TABLES.DOCTOR)
                .select(`
                    *,
                    userInfo!inner(email, dateCreated),
                    speciality!inner(Speciality)
                `)
                .eq('userInfoID', userId)
                .single();

            if (doctorError) throw doctorError;

            // Get doctor's appointments
            const { data: appointments, error: apptError } = await dbHelpers.getDoctorAppointments(doctor.doctorID);
            
            // Get doctor's patients
            const { data: patients, error: patientsError } = await supabase
                .from(TABLES.PATIENT)
                .select(`
                    *,
                    userInfo:userInfo(email)
                `)
                .order('lastName', { ascending: true });

            // Get today's appointments specifically
            const today = new Date().toISOString().split('T')[0];
            const { data: todayAppointments, error: todayError } = await supabase
                .from(TABLES.APPOINTMENT)
                .select(`
                    *,
                    patient:patient(firstName, lastName, nhsNumber),
                    status:appointmentStatus(status),
                    type:appointmentType(type)
                `)
                .eq('doctorID', doctor.doctorID)
                .eq('appointmentDate', today)
                .order('startTime', { ascending: true });

            return {
                doctor,
                appointments: appointments || [],
                patients: patients || [],
                todayAppointments: todayAppointments || [],
                errors: {
                    doctor: doctorError,
                    appointments: apptError,
                    patients: patientsError,
                    todayAppointments: todayError
                }
            };
        } catch (error) {
            console.error('Error fetching doctor dashboard data:', error);
            return { error: error.message };
        }
    }
};
