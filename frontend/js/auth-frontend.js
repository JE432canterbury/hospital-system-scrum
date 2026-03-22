// HospitalDB Medical Portal Authentication System
import { supabase, dbHelpers, TABLES } from './supabaseClient.js';

const hospitalAuth = {
    async login(email, password, role) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                throw new Error('Invalid email or password');
            }

            await supabase.auth.getSession();

            console.log('Looking up user profile for Supabase ID:', data.user.id);
            
            const { data: userProfile, error: profileError } = await supabase
                .from(TABLES.USER_INFO)
                .select('*, role:role("roleName"), patient:patient(*), doctor:doctor(*)')
                .eq('supabaseUserId', data.user.id)
                .single();
            
            if (profileError || !userProfile) {
                throw new Error('User profile not found');
            }

            if (userProfile.role.roleName !== role) {
                throw new Error('Access denied - role mismatch');
            }

            const patient = Array.isArray(userProfile.patient) ? userProfile.patient[0] : userProfile.patient;
            const doctor = Array.isArray(userProfile.doctor) ? userProfile.doctor[0] : userProfile.doctor;
            
            const sessionData = {
                userId: userProfile.userInfoID,
                patientId: patient?.patientID,
                role: userProfile.role.roleName,
                email: userProfile.email,
                name: this.extractUserName(userProfile) || `${data.user.user_metadata?.firstName} ${data.user.user_metadata?.lastName}`,
                authenticated: true,
                sessionTime: new Date().toISOString(),
                supabaseUser: data.user
            };

            localStorage.setItem('currentUser', JSON.stringify(sessionData));
            window.location.href = "dashboard.html";
            
            return { success: true, user: sessionData };

        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    },

    // Extract user display name from role specific profile
    extractUserName(user) {
        const patient = Array.isArray(user.patient) ? user.patient[0] : user.patient;
        const doctor = Array.isArray(user.doctor) ? user.doctor[0] : user.doctor;
        
        if (patient) {
            return `${patient.firstName} ${patient.lastName}`;
        }
        if (doctor) {
            return `Dr. ${doctor.firstName} ${doctor.lastName}`;
        }
        return 'Hospital User';
    },

    async signup(userData) {
        try {
            const { role, email, password, confirmPassword, ...additionalInfo } = userData;

            if (password !== confirmPassword) {
                throw new Error('Password confirmation does not match');
            }

            if (password.length < 8) {
                throw new Error('Password must be at least 8 characters long');
            }

            if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
                throw new Error('Password must contain uppercase, lowercase, and numbers');
            }

            const { exists } = await dbHelpers.userExistsByEmail(email);
            if (exists) {
                throw new Error('A user with this email already exists in the system');
            }

            if (!email.includes('@') || !email.includes('.')) {
                throw new Error('Please enter a valid email address');
            }

            console.log('Attempting signup with:', { 
                email: email, 
                passwordLength: password.length,
                role: role 
            });

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        role,
                        firstName: additionalInfo.firstName,
                        lastName: additionalInfo.lastName
                    },
                    emailRedirectTo: window.location.origin + '/login.html'
                }
            });

            console.log('Signup response:', { data, error });
            if (error) throw new Error(error.message);

            console.log('Supabase auth user created:', data.user.id);

            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session) {
                throw new Error('Session not established after signup');
            }

            console.log('Looking for role:', role);
            
            const { data: roleData, error: roleError } = await supabase
                .from(TABLES.ROLE)
                .select('roleID, roleName')
                .eq('roleName', role)
                .single();

            console.log('Role data found:', roleData);
            console.log('Role error:', roleError);

            if (!roleData) {
                throw new Error('Invalid role specified');
            }

            const { data: newUser, error: userError } = await dbHelpers.createUser({
                roleID: roleData.roleID,
                email,
                supabaseUserId: data.user.id,
                accountActive: true,
                dateCreated: new Date().toISOString().split('T')[0]
            });

            if (userError) throw userError;

            const { data: userinfo } = await supabase
                .from(TABLES.USER_INFO)
                .select('userInfoID')
                .eq('supabaseUserId', data.user.id)
                .single();
                
            console.log('Fetched userinfo after insert:', userinfo);

            if (role === 'Patient') {
                const { firstName, lastName, dateOfBirth, phoneNumber, addressLine1, addressLine2, townCity, postcode, nhsNumber } = additionalInfo;
                
                console.log('Creating patient profile with data:', {
                    userInfoID: userinfo.userInfoID,
                    firstName, lastName, dateOfBirth, phoneNumber, 
                    addressLine1, addressLine2, townCity, postcode, nhsNumber
                });
                
                try {
                    const patientResult = await dbHelpers.createPatient({
                        userInfoID: userinfo.userInfoID,
                        firstName,
                        lastName,
                        dateOfBirth,
                        phoneNumber,
                        addressLine1: addressLine1 || "123 Test Street",
                        addressLine2: addressLine2 || null,
                        townCity: townCity || "London",
                        postcode: postcode || "SW1A 1AA",
                        nhsNumber: nhsNumber || "1234567890"
                    });
                    
                    console.log('Patient profile created:', patientResult);
                } catch (patientError) {
                    console.error('Patient profile creation failed:', patientError);
                    throw patientError;
                }
            } else if (role === 'Doctor') {
                const { firstName, lastName, phoneNumber, doctorSpecialityID } = additionalInfo;
                
                console.log('Creating doctor profile with data:', {
                    userInfoID: userinfo.userInfoID,
                    firstName, lastName, email, phoneNumber, doctorSpecialityID
                });
                
                try {
                    const doctorResult = await dbHelpers.createDoctor({
                        userInfoID: userinfo.userInfoID,
                        doctorSpecialityID: doctorSpecialityID || 1,
                        firstName,
                        lastName,
                        email,
                        phoneNumber
                    });
                    
                    console.log('Doctor profile created:', doctorResult);
                } catch (doctorError) {
                    console.error('Doctor profile creation failed:', doctorError);
                    throw doctorError;
                }
            }

            return { 
                success: true, 
                message: 'Account created successfully! You can now login.',
                needsEmailVerification: false
            };

        } catch (error) {
            console.error('Signup error:', error);
            return { success: false, error: error.message };
        }
    },

    async logout() {
        try {
            await supabase.auth.signOut();
            localStorage.removeItem('currentUser');
            
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
            localStorage.removeItem('currentUser');
            window.location.href = 'login.html';
        }
    },

    async isLoggedIn() {
        try {
            console.log('Checking if user is logged in...');
            
            const { data: { session } } = await supabase.auth.getSession();
            console.log('Supabase session check result:', session);
            
            if (!session) {
                console.log('No Supabase session found');
                return null;
            }

            const userData = localStorage.getItem('currentUser');
            console.log('Local storage user data:', userData);
            
            if (!userData) {
                console.log('No local user data found');
                return null;
            }
            
            const user = JSON.parse(userData);
            console.log('User session valid:', user);
            return user;
        } catch (error) {
            console.error('Session validation error:', error);
            return null;
        }
    },

    async getCurrentUser() {
        return await this.isLoggedIn();
    }
};

// Login form handler
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const togglePassword = document.getElementById('togglePassword');
    const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const eyeIcon = document.getElementById('eyeIcon');
    const eyeIconConfirm = document.getElementById('eyeIconConfirm');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');

    // Check if we're on login or signup page
    if (loginForm) {
        setupLogin();
    }
    if (signupForm) {
        setupSignup();
    }

    // Setup password toggles
    if (togglePassword) {
        togglePassword.addEventListener('click', function() {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                eyeIcon.textContent = 'Hide';
            } else {
                passwordInput.type = 'password';
                eyeIcon.textContent = 'Show';
            }
        });
    }

    if (toggleConfirmPassword) {
        toggleConfirmPassword.addEventListener('click', function() {
            if (confirmPasswordInput.type === 'password') {
                confirmPasswordInput.type = 'text';
                eyeIconConfirm.textContent = 'Hide';
            } else {
                confirmPasswordInput.type = 'password';
                eyeIconConfirm.textContent = 'Show';
            }
        });
    }

    function setupLogin() {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const role = document.getElementById('role').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            if (!role || !email || !password) {
                showError('Please fill in all fields');
                return;
            }

            // Show loading state
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Logging in...';
            submitBtn.disabled = true;

            try {
                // Use database authentication
                const result = await hospitalAuth.login(email, password, role);
                
                if (result.success) {
                    showSuccess('Login successful! Redirecting...');
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 1000);
                } else {
                    showError(result.error);
                }
            } catch (error) {
                showError('Login failed. Please try again.');
            } finally {
                // Restore button state
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    function setupSignup() {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const role = document.getElementById('role').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (!role || !email || !password || !confirmPassword) {
                showError('Please fill in all fields');
                return;
            }

            // Show loading state
            const submitBtn = signupForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Creating account...';
            submitBtn.disabled = true;

            try {
                // Collect role-specific data
                let additionalData = {};
                
                if (role === 'Patient') {
                    additionalData = {
                        firstName: document.getElementById('firstName')?.value || '',
                        lastName: document.getElementById('lastName')?.value || '',
                        dateOfBirth: document.getElementById('dateOfBirth')?.value || '',
                        phoneNumber: document.getElementById('phoneNumber')?.value || '',
                        addressLine1: document.getElementById('addressLine1')?.value || '',
                        addressLine2: document.getElementById('addressLine2')?.value || '',
                        townCity: document.getElementById('townCity')?.value || '',
                        postcode: document.getElementById('postcode')?.value || '',
                        nhsNumber: document.getElementById('nhsNumber')?.value || ''
                    };
                } else if (role === 'Doctor') {
                    additionalData = {
                        firstName: document.getElementById('doctorFirstName')?.value || '',
                        lastName: document.getElementById('doctorLastName')?.value || '',
                        email: email,
                        phoneNumber: document.getElementById('doctorPhoneNumber')?.value || '',
                        doctorSpecialityID: document.getElementById('doctorSpecialityID')?.value || '1'
                    };
                }

                // Use database authentication
                const result = await hospitalAuth.signup({
                    role,
                    email,
                    password,
                    confirmPassword,
                    ...additionalData
                });
                
                if (result.success) {
                    showSuccess(result.message);
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);
                } else {
                    showError(result.error);
                }
            } catch (error) {
                showError('Account creation failed. Please try again.');
            } finally {
                // Restore button state
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    function showError(message) {
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
            if (successMessage) successMessage.style.display = 'none';
            
            setTimeout(function() {
                errorMessage.style.display = 'none';
            }, 5000);
        }
    }

    function showSuccess(message) {
        if (successMessage) {
            successMessage.textContent = message;
            successMessage.style.display = 'block';
            if (errorMessage) errorMessage.style.display = 'none';
            
            setTimeout(function() {
                successMessage.style.display = 'none';
            }, 5000);
        }
    }

    // Check if already logged in
    async function checkLogin() {
        const currentUser = await hospitalAuth.getCurrentUser();
        
        if (currentUser && currentUser.authenticated) {
            window.location.href = 'dashboard.html';
        }
    }

    // Run login check on page load (but not on dashboard)
    if (!window.location.pathname.includes('dashboard.html')) {
        checkLogin();
    }
});

// Logout function
async function logout() {
    await hospitalAuth.logout();
}

// Export hospitalAuth for use in other modules
export { hospitalAuth };
