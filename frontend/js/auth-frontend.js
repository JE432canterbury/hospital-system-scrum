// Mock database stored in localStorage, this is only the case until the supabase database is created. Only then can it be connected to that. 
const initMockDatabase = function() {
    if (!localStorage.getItem('mockUsers')) {
        const defaultUsers = [
            {
                id: 'patient1',
                email: 'patient@example.com',
                password: 'password123',
                name: 'John Doe',
                role: 'patient'
            },
            {
                id: 'patient2', 
                email: 'jane@example.com',
                password: 'password123',
                name: 'Jane Smith',
                role: 'patient'
            },
            {
                id: 'doctor1',
                email: 'doctor@example.com',
                password: 'password123',
                name: 'Dr. Sarah Johnson',
                role: 'doctor'
            },
            {
                id: 'doctor2',
                email: 'drwilson@example.com',
                password: 'password123',
                name: 'Dr. Michael Wilson',
                role: 'doctor'
            }
        ];
        localStorage.setItem('mockUsers', JSON.stringify(defaultUsers));
    }
};

// Database operations
const frontendDB = {
    getUsers: function() {
        return JSON.parse(localStorage.getItem('mockUsers') || '[]');
    },
    
    saveUsers: function(users) {
        localStorage.setItem('mockUsers', JSON.stringify(users));
    },
    
    findUser: function(email, role) {
        const users = this.getUsers();
        return users.find(user => user.email === email && user.role === role);
    },
    
    createUser: function(userData) {
        const users = this.getUsers();
        const newUser = {
            id: userData.role + '_' + Date.now(),
            email: userData.email,
            password: userData.password,
            name: userData.name,
            role: userData.role
        };
        users.push(newUser);
        this.saveUsers(users);
        return newUser;
    },
    
    userExists: function(email, role) {
        return this.findUser(email, role) !== undefined;
    }
};

// Initialize database on load
initMockDatabase();

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
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const role = document.getElementById('role').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            if (!role || !email || !password) {
                showError('Please fill in all fields');
                return;
            }

            // Simulate database lookup
            const user = frontendDB.findUser(email, role);
            if (!user) {
                showError('Invalid email or password');
                return;
            }

            // Check password
            if (user.password !== password) {
                showError('Invalid email or password');
                return;
            }

            // Store user data (simulates session)
            localStorage.setItem('currentUser', JSON.stringify({
                userId: user.id,
                role: user.role,
                email: user.email,
                name: user.name
            }));

            // Redirect to dashboard without role parameter
            window.location.href = 'dashboard.html';
        });
    }

    function setupSignup() {
        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const role = document.getElementById('role').value;
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (!role || !name || !email || !password || !confirmPassword) {
                showError('Please fill in all fields');
                return;
            }

            if (password !== confirmPassword) {
                showError('Passwords do not match');
                return;
            }

            if (password.length < 6) {
                showError('Password must be at least 6 characters long');
                return;
            }

            // Check if user already exists
            if (frontendDB.userExists(email, role)) {
                showError('User with this email already exists');
                return;
            }

            // Create new user
            const newUser = frontendDB.createUser({
                role: role,
                name: name,
                email: email,
                password: password
            });

            console.log('New user created:', newUser.email);
            
            showSuccess('Account created successfully! You can now login.');
            setTimeout(function() {
                window.location.href = 'login.html';
            }, 2000);
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
    function checkLogin() {
        const userData = localStorage.getItem('currentUser');
        
        if (userData) {
            window.location.href = 'dashboard.html';
        }
    }

    // Run login check on page load (but not on dashboard)
    if (!window.location.pathname.includes('dashboard.html')) {
        checkLogin();
    }
});

// Logout function
function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}
