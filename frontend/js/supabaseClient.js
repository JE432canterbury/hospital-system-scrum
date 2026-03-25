// Single Shared Supabase Client
// HospitalDB Medical Portal Integration

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
                appointmentStatus:appointmentstatus(status),
                appointmentType:appointmenttype(type),
                doctor:doctor(firstName, lastName)
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
                appointmentStatus:appointmentstatus(status),
                appointmentType:appointmenttype(type)
            `)
            .eq('doctorID', doctorId)
            .order('appointmentDate', { ascending: true });
        
        return { data, error };
    },

    // Get patient medical records
    async getPatientMedicalRecords(patientId) {
        const { data, error } = await supabase
            .from(TABLES.MEDICAL_RECORD)
            .select('*')
            .eq('patientID', patientId)
            .order('recordDate', { ascending: false });
        
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
            .select('*')
            .eq('patientID', patientId)
            .order('issueDate', { ascending: false });
        
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
    },

    // Get available doctors for appointment booking
    async getAvailableDoctors() {
        const { data, error } = await supabase
            .from(TABLES.DOCTOR)
            .select(`
                doctorID,
                firstName,
                lastName,
                doctorSpecialityID
            `);
        
        return { data, error };
    },

    // Get doctor specialities
    async getDoctorSpecialities() {
        const { data, error } = await supabase
            .from(TABLES.DOCTOR_SPECIALITY)
            .select('*');
        
        return { data, error };
    },

    // Get doctor availability for specific date
    async getDoctorAvailability(doctorID, date) {
        const { data, error } = await supabase
            .from(TABLES.DOCTOR_AVAILABILITY)
            .select('*')
            .eq('doctorID', doctorID)
            .eq('dateAvailable', date);
        
        return { data, error };
    },

    // Get appointment types
    async getAppointmentTypes() {
        const { data, error } = await supabase
            .from(TABLES.APPOINTMENT_TYPE)
            .select('*');
        
        return { data, error };
    },

    // Check if time slot is available
    async checkTimeSlotAvailability(doctorID, date, time) {
        // Check existing appointments
        const { data: appointments, error } = await supabase
            .from(TABLES.APPOINTMENT)
            .select('startTime, endTime')
            .eq('doctorID', doctorID)
            .eq('appointmentDate', date)
            .in('appointmentStatusID', [1, 2]); // scheduled or confirmed
        
        if (error) return { available: false, error };
        
        // Check if time slot conflicts with existing appointments
        const bookedTimes = appointments.map(apt => `${apt.startTime}-${apt.endTime}`);
        const isBooked = bookedTimes.some(booked => 
            (time >= booked.split('-')[0] && time < booked.split('-')[1]) ||
            (time > booked.split('-')[0] && time <= booked.split('-')[1])
        );
        
        return { available: !isBooked, appointments };
    },

    // Create new appointment
    async createAppointment(appointmentData) {
        const { data, error } = await supabase
            .from(TABLES.APPOINTMENT)
            .insert(appointmentData)
            .select()
            .single();
        
        return { data, error };
    },

    // Cancel appointment
    async cancelAppointment(appointmentID) {
        const { data, error } = await supabase
            .from(TABLES.APPOINTMENT)
            .update({ appointmentStatusID: 3 }) // 'cancelled'
            .eq('appointmentID', appointmentID)
            .select();
        
        return { data, error };
    },

    // Delete appointment completely
    async deleteAppointment(appointmentID) {
        const { data, error } = await supabase
            .from(TABLES.APPOINTMENT)
            .delete()
            .eq('appointmentID', appointmentID);
        
        return { data, error };
    },

    // Reschedule appointment
    async rescheduleAppointment(appointmentID, newDateTime) {
        // Update existing appointment instead of creating new one
        const { data: oldAppointment, error: fetchError } = await supabase
            .from(TABLES.APPOINTMENT)
            .select('*')
            .eq('appointmentID', appointmentID)
            .single();
        
        if (fetchError || !oldAppointment) return { data: null, error: 'Appointment not found' };
        
        // Update the existing appointment with new date/time
        const updateData = {
            appointmentDate: newDateTime.split('T')[0],
            startTime: newDateTime.split('T')[1],
            endTime: calculateEndTime(newDateTime.split('T')[1], 1),
            appointmentStatusID: 1 // 'scheduled'
        };
        
        const { data, error } = await supabase
            .from(TABLES.APPOINTMENT)
            .update(updateData)
            .eq('appointmentID', appointmentID)
            .select()
            .single();
        
        return { data, error };
    }
};

// Add calculateEndTime helper function
function calculateEndTime(startTime, durationHours = 1) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const endHours = hours + durationHours;
    return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
