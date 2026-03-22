// Single Shared Supabase Client
// Supabase database Medical Portal Integration

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export const supabase = createClient(
  'https://wjkojxzkbxjunbsnqfkp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indqa29qeHprYnhqdW5ic25xZmtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NDAxNzYsImV4cCI6MjA4OTAxNjE3Nn0.O68JZbWNMQ6cJYQDUZOFb-iiDIHzuH7eboprrdDs-6Y',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    db: {
      schema: 'hospitaldb'
    }
  }
);

// Database table names (matching our schema)
export const TABLES = {
    ROLE: 'role',
    USER_INFO: 'userinfo',
    PATIENT: 'patient',
    DOCTOR: 'doctor',
    APPOINTMENT: 'appointment',
    MEDICAL_RECORD: 'medicalrecord',
    PRESCRIPTION: 'prescription',
    APPOINTMENT_STATUS: 'appointmentstatus',
    APPOINTMENT_TYPE: 'appointmenttype',
    DOCTOR_SPECIALITY: 'doctorspeciality',
    MEDICAL_RECORD_DIAGNOSIS: 'medicalrecorddiagnosis',
    TEST_RESULT: 'testresult',
    MEDICATION: 'medication',
    PRESCRIPTION_ITEM: 'prescriptionitem',
    DOCTOR_AVAILABILITY: 'doctoravailability',
    DIAGNOSIS: 'diagnosis'
};

// Helper functions for database operations
export const dbHelpers = {
    // Get user by email
    async getUserByEmail(email) {
        const { data, error } = await supabase
            .from(TABLES.USER_INFO)
            .select(`
                *,
                role:role(roleName),
                patient:patient(*),
                doctor:doctor(*)
            `)
            .eq('email', email)
            .single();
        
        return { data, error };
    },

    // Get user by Supabase user ID 
    async getUserBySupabaseId(supabaseUserId) {
        const { data, error } = await supabase
            .from(TABLES.USER_INFO)
            .select(`
                *,
                role:role(roleName),
                patient:patient(*),
                doctor:doctor(*)
            `)
            .eq('supabaseUserId', supabaseUserId)
            .single();
        
        return { data, error };
    },

    // Check if user exists by email
    async userExistsByEmail(email) {
        const { data, error } = await supabase
            .from(TABLES.USER_INFO)
            .select('userInfoID')
            .eq('email', email)
            .single();
        
        return { 
            exists: !!data, 
            error 
        };
    },

    // Create new user profile
    async createUser(userData) {
        console.log('dbHelpers.createUser called with:', userData);
        
        const { data, error } = await supabase
            .from(TABLES.USER_INFO)
            .insert(userData)
            .select()
            .single();
        
        console.log('createUser result:', { data, error });
        
        return { data, error };
    },

    // Create new patient profile
    async createPatient(patientData) {
        // Force session confirmation before any database calls
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
            throw new Error('No active session - cannot create patient');
        }

        console.log('dbHelpers.createPatient called with:', patientData);
        
        const { data, error } = await supabase
            .from(TABLES.PATIENT)
            .insert(patientData)
            .select()
            .single();
        
        console.log('createPatient result:', { data, error });
        
        return { data, error };
    },

    // Create doctor profile
    async createDoctor(doctorData) {
        const { data, error } = await supabase
            .from(TABLES.DOCTOR)
            .insert(doctorData)
            .select()
            .single();
        
        return { data, error };
    },

    // Get patient appointments
    async getPatientAppointments(patientId) {
        const { data, error } = await supabase
            .from(TABLES.APPOINTMENT)
            .select(`
                *,
                appointmentStatus:appointmentStatus(status),
                appointmentType:appointmentType(type)
            `)
            .eq('patientID', patientId)
            .order('appointmentDate', { ascending: true });
        
        return { data, error };
    },

    // Get doctor appointments
    async getDoctorAppointments(doctorId) {
        const { data, error } = await supabase
            .from(TABLES.APPOINTMENT)
            .select(`
                *,
                appointmentStatus:appointmentStatus(status),
                appointmentType:appointmentType(type),
                patient:patient(firstName, lastName),
                doctor:doctor(firstName, lastName)
            `)
            .eq('doctorID', doctorId)
            .order('appointmentDate', 'startTime');
        
        return { data, error };
    },

    // Get patient medical records
    async getPatientMedicalRecords(patientId) {
        const { data, error } = await supabase
            .from(TABLES.MEDICAL_RECORD)
            .select(`
                *,
                patient:patient(firstName, lastName),
                doctor:doctor(firstName, lastName)
            `)
            .eq('patientID', patientId)
            .order('recordDate', 'desc');
        
        return { data, error };
    },

    // Get doctor medical records
    async getDoctorMedicalRecords(doctorId) {
        const { data, error } = await supabase
            .from(TABLES.MEDICAL_RECORD)
            .select(`
                *,
                patient:patient(firstName, lastName),
                doctor:doctor(firstName, lastName)
            `)
            .eq('doctorID', doctorId)
            .order('recordDate', 'desc');
        
        return { data, error };
    },

    // Get patient prescriptions
    async getPatientPrescriptions(patientId) {
        const { data, error } = await supabase
            .from(TABLES.PRESCRIPTION)
            .select(`
                *,
                patient:patient(firstName, lastName),
                doctor:doctor(firstName, lastName)
            `)
            .eq('patientID', patientId)
            .order('issueDate', 'desc');
        
        return { data, error };
    },

    // Get doctor prescriptions
    async getDoctorPrescriptions(doctorId) {
        const { data, error } = await supabase
            .from(TABLES.PRESCRIPTION)
            .select(`
                *,
                patient:patient(firstName, lastName),
                doctor:doctor(firstName, lastName)
            `)
            .eq('doctorID', doctorId)
            .order('issueDate', 'desc');
        
        return { data, error };
    }
};
