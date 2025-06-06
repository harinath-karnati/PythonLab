// Form and UI Interaction Management
document.addEventListener('DOMContentLoaded', () => {
    // Form Elements
    const home = document.querySelector(".home");
    const formContainer = document.querySelector(".form_container");
    const formCloseBtn = document.querySelector(".form_close");
    const signupBtn = document.querySelector("#signup");
    const loginBtn = document.querySelector("#login");
    const pwShowHide = document.querySelectorAll(".pw_hide");
    const formOpenBtn = document.querySelector("#form-open");

    // Check if there's an error message and auto-open form if needed
    const errorMsg = document.querySelector(".form_container p[style*='color: red']");
    if (errorMsg && errorMsg.textContent.trim() !== '') {
        if (home) home.classList.add("show");
        if (formContainer) formContainer.classList.add("active");
    }

    // Password Visibility Toggle
    const togglePasswordVisibility = (passwordInput, icon) => {
        const isPassword = passwordInput.type === "password";
        passwordInput.type = isPassword ? "text" : "password";
        
        // Toggle eye icon classes
        if (icon.classList.contains("uil-eye-slash")) {
            icon.classList.replace("uil-eye-slash", "uil-eye");
        } else {
            icon.classList.replace("uil-eye", "uil-eye-slash");
        }
    };

    // Form Close Functionality
    const closeForm = () => {
        if (home) home.classList.remove("show");
        if (formContainer) formContainer.classList.remove("active");
    };

    // Event Listeners
    if (formCloseBtn) {
        formCloseBtn.addEventListener("click", closeForm);
    }

    // Password Show/Hide Functionality
    pwShowHide.forEach((icon) => {
        icon.addEventListener("click", () => {
            const passwordInput = icon.parentElement.querySelector("input");
            togglePasswordVisibility(passwordInput, icon);
        });
    });

    // Form Open Functionality
    if (formOpenBtn) {
        formOpenBtn.addEventListener("click", () => {
            if (home) home.classList.add("show");
            if (formContainer) formContainer.classList.add("active");
        });
    }

    // Signup/Login Form Toggle (if applicable)
    if (signupBtn) {
        signupBtn.addEventListener("click", (e) => {
            e.preventDefault();
            if (formContainer) formContainer.classList.add("active");
        });
    }

    if (loginBtn) {
        loginBtn.addEventListener("click", (e) => {
            e.preventDefault();
            if (formContainer) formContainer.classList.remove("active");
        });
    }

    // Face ID Login Handling
    const handleFaceIDLogin = () => {
        const faceLoginForm = document.getElementById('faceLoginForm');
        if (faceLoginForm) {
            // Check if there was an error with face recognition and update button text
            const errorMsg = document.querySelector(".form_container p[style*='color: red']");
            const faceIdButton = faceLoginForm.querySelector('button');
            
            if (errorMsg && errorMsg.textContent.includes('Face recognition failed')) {
                if (faceIdButton) {
                    faceIdButton.textContent = 'Re-take Face ID';
                }
            }
            
            faceLoginForm.addEventListener('submit', (e) => {
                // Optional: Add pre-submission checks or UI updates
                console.log('Initiating Face ID Login');
                
                // Update button state during scanning
                if (faceIdButton) {
                    faceIdButton.disabled = true;
                    faceIdButton.textContent = 'Scanning...';
                }
            });
        }
    };

    // Form Validation Utilities
    const setupFormValidation = () => {
        const forms = document.querySelectorAll('form');
        
        forms.forEach(form => {
            form.addEventListener('submit', (e) => {
                // Username validation (if present)
                const usernameInput = form.querySelector('input[name="username"]');
                if (usernameInput) {
                    if (usernameInput.value.trim().length < 4) {
                        e.preventDefault();
                        alert('Username must be at least 4 characters long');
                        return;
                    }
                }

                // Password validation (if present)
                const passwordInput = form.querySelector('input[name="password"]');
                if (passwordInput) {
                    const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
                    if (!passwordRegex.test(passwordInput.value)) {
                        e.preventDefault();
                        alert('Password must be at least 8 characters and contain uppercase, lowercase, and number');
                        return;
                    }
                }
            });
        });
    };

    // Image Preview for Registration
    const setupImagePreview = () => {
        const faceImageUpload = document.getElementById('faceImageUpload');
        const imagePreview = document.getElementById('imagePreview');

        if (faceImageUpload && imagePreview) {
            faceImageUpload.addEventListener('change', (event) => {
                const file = event.target.files[0];
                
                if (file) {
                    const reader = new FileReader();
                    
                    reader.onload = (e) => {
                        imagePreview.src = e.target.result;
                        imagePreview.style.display = 'block';
                    };
                    
                    reader.readAsDataURL(file);
                }
            });
        }
    };

    // Check if this is the register page and auto-show form
    const isRegisterPage = document.querySelector(".signup_form") !== null;
    if (isRegisterPage && home && window.location.pathname.includes("register")) {
        home.classList.add("show");
    }

    // Initialize all functionalities
    handleFaceIDLogin();
    setupFormValidation();
    setupImagePreview();
});

// Error Handling and Notifications
window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error);
    // Optional: Send error to logging service
});