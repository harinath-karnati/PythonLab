// Auto-show the form when page loads
document.addEventListener('DOMContentLoaded', function() {
    const home = document.querySelector(".home");
    if (home) {
        home.classList.add("show");
    }
    
    // Initialize webcam
    startWebcam();
});

// Webcam handling
let stream = null;

function startWebcam() {
    const video = document.getElementById('videoElement');
    const captureBtn = document.getElementById('captureBtn');
    const retakeBtn = document.getElementById('retakeBtn');
    const canvas = document.getElementById('canvas');
    const capturedImage = document.getElementById('capturedImage');
    const webcamImageData = document.getElementById('webcamImageData');
    
    // Check if form submission should be allowed
    function updateFormSubmitStatus() {
        const submitBtn = document.querySelector('button[type="submit"]');
        submitBtn.disabled = !webcamImageData.value;
    }
    
    // Initial check
    updateFormSubmitStatus();
    
    // Access webcam
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(function(streamObj) {
            stream = streamObj;
            video.srcObject = stream;
        })
        .catch(function(error) {
            console.error("Error accessing webcam:", error);
            alert("Unable to access your camera. Please make sure it's connected and you've given permission.");
        });
    
    // Compress image to avoid "Request entity too large" error
    function compressImage(imageDataUrl, maxSizeKB = 100) {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = imageDataUrl;
            
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Calculate scaling factor to maintain aspect ratio
                let quality = 0.7; // Initial quality setting
                let scaleFactor = 1;
                
                if (width > 640 || height > 480) {
                    scaleFactor = Math.min(640 / width, 480 / height);
                    width = width * scaleFactor;
                    height = height * scaleFactor;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Function to compress iteratively if needed
                function tryCompression(currentQuality) {
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', currentQuality);
                    
                    // Check size in KB (base64 length * 0.75 / 1024)
                    const sizeInKB = (compressedDataUrl.length - 22) * 0.75 / 1024;
                    
                    if (sizeInKB > maxSizeKB && currentQuality > 0.1) {
                        // Try again with lower quality
                        return tryCompression(currentQuality - 0.1);
                    } else {
                        console.log(`Image compressed to ${sizeInKB.toFixed(2)} KB`);
                        return compressedDataUrl;
                    }
                }
                
                resolve(tryCompression(quality));
            };
        });
    }
    
    // Capture photo
    captureBtn.addEventListener('click', async function() {
        const context = canvas.getContext('2d');
        
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw current video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to data URL (uncompressed)
        const rawImageDataUrl = canvas.toDataURL('image/jpeg');
        
        try {
            // Compress the image to prevent "Request entity too large" errors
            const compressedImageDataUrl = await compressImage(rawImageDataUrl, 500); // Max 500KB
            
            // Update hidden input with compressed image data
            webcamImageData.value = compressedImageDataUrl;
            
            // Show captured image
            capturedImage.src = compressedImageDataUrl;
            capturedImage.style.display = 'block';
            
            // Hide video, show retake button, hide capture button
            video.style.display = 'none';
            retakeBtn.style.display = 'inline-block';
            captureBtn.style.display = 'none';
            
            // Update form submit button
            updateFormSubmitStatus();
        } catch (error) {
            console.error("Error compressing image:", error);
            alert("There was an error processing your photo. Please try again.");
        }
    });
    
    // Retake photo
    retakeBtn.addEventListener('click', function() {
        // Clear captured image
        capturedImage.style.display = 'none';
        webcamImageData.value = '';
        
        // Show video, hide retake button, show capture button
        video.style.display = 'block';
        retakeBtn.style.display = 'none';
        captureBtn.style.display = 'inline-block';
        
        // Update form submit button
        updateFormSubmitStatus();
    });
    
    // Handle form submission
    document.getElementById('registrationForm').addEventListener('submit', function(event) {
        if (!webcamImageData.value) {
            event.preventDefault();
            alert('Please capture your photo before registering.');
            return;
        }
        
        // Check image size
        const sizeInKB = (webcamImageData.value.length - 22) * 0.75 / 1024;
        if (sizeInKB > 1000) { // If still over 1MB
            event.preventDefault();
            alert('The captured image is too large. Please try capturing again with less detail or in better lighting.');
            // Force retake
            retakeBtn.click();
        }
    });
}

// Clean up when page is closed
window.addEventListener('beforeunload', function() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
});