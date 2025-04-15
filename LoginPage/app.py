from flask import Flask, render_template, request, redirect, url_for, session, flash
import pyodbc
import cv2
import numpy as np
import pickle
import os
import time
import logging
import base64
import re
from werkzeug.security import generate_password_hash, check_password_hash
from PIL import Image
import io
import math
from werkzeug.exceptions import RequestEntityTooLarge

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s',
                    filename='login_attempts.log')

app = Flask(__name__)
app.secret_key = os.urandom(24)  # More secure secret key generation

# Face recognition configuration
FACE_DETECTOR = "models/face_detection"
FACE_EMBEDDER = "models/openface_nn4.small2.v1.t7"
MIN_CONFIDENCE = 0.5
WEBCAM_TIMEOUT = 5  # seconds

# Secure database configuration
server = os.getenv('DB_SERVER', 'AUSSQLSIS01D')
database = os.getenv('DB_NAME', 'MSDINT')
connection_string = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};Trusted_Connection=yes;TrustServerCertificate=yes;'

def get_db_connection():
    """Establish a secure database connection."""
    try:
        return pyodbc.connect(connection_string)
    except Exception as e:
        logging.error(f"Database connection error: {e}")
        raise

# Load face recognition models
def load_face_models():
    """Load face recognition models with error handling."""
    try:
        detector = cv2.dnn.readNetFromCaffe(
            os.path.join(FACE_DETECTOR, "deploy.prototxt"),
            os.path.join(FACE_DETECTOR, "res10_300x300_ssd_iter_140000.caffemodel")
        )
        embedder = cv2.dnn.readNetFromTorch(FACE_EMBEDDER)
        return detector, embedder
    except Exception as e:
        logging.error(f"Error loading face recognition models: {e}")
        raise

# Global model loading (do this once at startup)
try:
    DETECTOR, EMBEDDER = load_face_models()
except Exception as e:
    logging.critical(f"Failed to load face recognition models: {e}")
    DETECTOR, EMBEDDER = None, None

def generate_face_embedding(image):
    """Generate facial embedding with improved error handling."""
    if image is None:
        logging.warning("Received None image for embedding")
        return None

    try:
        (h, w) = image.shape[:2]
        blob = cv2.dnn.blobFromImage(cv2.resize(image, (300, 300)), 1.0,
                                    (300, 300), (104.0, 177.0, 123.0))
        DETECTOR.setInput(blob)
        detections = DETECTOR.forward()

        for i in range(0, detections.shape[2]):
            confidence = detections[0, 0, i, 2]
            if confidence > MIN_CONFIDENCE:
                box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                (startX, startY, endX, endY) = box.astype("int")

                face_roi = image[startY:endY, startX:endX]
                face_blob = cv2.dnn.blobFromImage(face_roi, 1.0/255, (96, 96),
                                                 (0, 0, 0), swapRB=True, crop=False)
                EMBEDDER.setInput(face_blob)
                return EMBEDDER.forward()
        
        logging.info("No face detected with sufficient confidence")
        return None

    except Exception as e:
        logging.error(f"Error in face embedding generation: {e}")
        return None

def process_webcam_image(data_url):
    """Process webcam image from data URL."""
    try:
        # Extract base64 encoded image from data URL
        image_data = re.sub('^data:image/.+;base64,', '', data_url)
        image_bytes = base64.b64decode(image_data)
        
        # Convert to numpy array
        image_array = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        
        return image
    except Exception as e:
        logging.error(f"Error processing webcam image: {e}")
        return None

@app.route('/')
def index():
    return redirect(url_for('login'))

@app.route('/login/', methods=['GET'])
def login():
    return render_template('login.html')

@app.route('/login/credentials', methods=['POST'])
def login_credentials():
    username = request.form['username']
    password = request.form['password']

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM accounts WHERE username = ?', (username,))
            account = cursor.fetchone()

        if account:
            # Here you would typically use check_password_hash for secure password checking
            if account[2] == password:  # Replace with actual password verification
                session.update({
                    'loggedin': True,
                    'id': account[0],
                    'username': account[1]
                })
                logging.info(f"Successful login for user: {username}")
                return redirect(url_for('home'))
        
        logging.warning(f"Failed login attempt for user: {username}")
        return render_template('login.html', msg='Invalid credentials')

    except Exception as e:
        logging.error(f"Login error: {e}")
        return render_template('login.html', msg='An error occurred during login')

@app.route('/login/face', methods=['POST'])
def login_face():
    if DETECTOR is None or EMBEDDER is None:
        logging.error("Face recognition models not loaded")
        return render_template('login.html', msg='Face recognition is currently unavailable')

    cap = cv2.VideoCapture(0)
    logging.info("Starting face login process")

    start_time = time.time()
    face_matched = False
    timeout_duration = 5  # 5 seconds timeout

    try:
        while time.time() - start_time <= timeout_duration:
            ret, frame = cap.read()
            if not ret:
                logging.warning("Failed to capture frame")
                break

            # Display countdown
         #   remaining_time = max(0, int(timeout_duration - (time.time() - start_time)))
         #   cv2.putText(frame, f"Time Remaining: {remaining_time}s", 
         #               (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            
         #   cv2.imshow("Face ID Login", frame)

            embedding = generate_face_embedding(frame)

            if embedding is not None:
                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute('SELECT id, username, face_embedding FROM accounts')
                    accounts = cursor.fetchall()

                best_match_id, best_match_username, min_distance = None, None, float('inf')

                for account in accounts:
                    try:
                        stored_embedding = pickle.loads(account.face_embedding)
                    except (TypeError, pickle.UnpicklingError):
                        continue

                    distance = np.linalg.norm(stored_embedding - embedding)
                    if distance < min_distance:
                        min_distance = distance
                        best_match_id = account.id
                        best_match_username = account.username

                if min_distance < 0.6:
                    face_matched = True
                    logging.info(f"Successful face login for user: {best_match_username}")
                    break

            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

    except Exception as e:
        logging.error(f"Face login error: {e}")
        return render_template('login.html', msg='An unexpected error occurred')
    
    finally:
        cap.release()
        cv2.destroyAllWindows()

    if face_matched:
        session.update({
            'loggedin': True,
            'id': best_match_id,
            'username': best_match_username
        })
        return redirect(url_for('home'))
    else:
        logging.warning("Face recognition failed within timeout")
        return render_template('login.html', 
                               msg='Face recognition failed. No match found within 5 seconds.')

@app.route('/register/', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        # Validate inputs
        if not username or not password:
            return render_template('register.html', msg='Username and password are required')

        # Get image from webcam only (file upload removed)
        webcam_image_data = request.form.get('webcam_image')
        
        if not webcam_image_data:
            return render_template('register.html', msg='Webcam image is required')
            
        # Process webcam image
        image = process_webcam_image(webcam_image_data)
        if image is None:
            return render_template('register.html', msg='Error processing webcam image')
            
        # Generate face embedding
        embedding = generate_face_embedding(image)
        
        if embedding is None:
            return render_template('register.html', msg='Face not detected in the image')

        try:
            # Store in database
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Check if username already exists
                cursor.execute('SELECT * FROM accounts WHERE username = ?', (username,))
                existing_account = cursor.fetchone()
                
                if existing_account:
                    return render_template('register.html', msg='Username already exists')
                
                # Insert new account
                cursor.execute(
                    'INSERT INTO accounts (username, password, face_embedding) VALUES (?, ?, ?)',
                    (username, password, pickle.dumps(embedding))
                )
                conn.commit()

            logging.info(f"New user registered: {username}")
            return render_template('login.html', msg='Registration successful!')

        except Exception as e:
            logging.error(f"Registration error: {e}")
            return render_template('register.html', msg=f'Registration failed: {str(e)}')

    return render_template('register.html')

@app.route('/home')
def home():
    if 'loggedin' not in session:
        return redirect(url_for('login'))
    return render_template('home.html', username=session['username'])

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

if __name__ == '__main__':
    # Ensure uploads directory exists (still needed for potential future use)
    os.makedirs('static/uploads', exist_ok=True)
    os.makedirs('logs', exist_ok=True)
    
    # Run the application
    app.run(debug=True)