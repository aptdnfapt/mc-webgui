import os
import threading
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv

import server_manager
import log_streamer
import file_manager

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY') or 'a_super_secret_key_that_should_be_changed'
socketio = SocketIO(app, async_mode=os.getenv('SOCKETIO_MODE', 'threading'))

# --- Path Configuration ---
HOME_DIR = os.path.expanduser('~')
MINECRAFT_CONSOLE_LOG = os.path.join(HOME_DIR, 'minecraft', 'logs', 'latest.log')
BACKUP_DIR = os.path.join(HOME_DIR, 'backup')
BACKUP_LOG = os.path.join(BACKUP_DIR, 'backup_latest.log')

# Ensure log directories exist
os.makedirs(os.path.dirname(MINECRAFT_CONSOLE_LOG), exist_ok=True)
os.makedirs(BACKUP_DIR, exist_ok=True)

@app.route('/')
def index():
    """Serve the main page."""
    return render_template('index.html')

# --- API Routes for Server Control ---
@app.route('/api/start_server', methods=['POST'])
def start_server_route():
    result = server_manager.start_minecraft_server()
    return jsonify(result)

@app.route('/api/stop_server', methods=['POST'])
def stop_server_route():
    result = server_manager.stop_minecraft_server()
    return jsonify(result)

@app.route('/api/send_command', methods=['POST'])
def send_command_route():
    command = request.json.get('command')
    result = server_manager.send_minecraft_command(command)
    return jsonify(result)

@app.route('/api/run_backup', methods=['POST'])
def run_backup_route():
    result = server_manager.run_backup_script()
    return jsonify(result)

# --- API Routes for File Management ---
@app.route('/api/files', methods=['GET'])
def list_files_route():
    path = request.args.get('path', '.')
    result = file_manager.list_directory_contents(path)
    return jsonify(result)

@app.route('/api/move', methods=['POST'])
def move_file_route():
    source = request.json.get('source')
    destination = request.json.get('destination')
    result = file_manager.move_file(source, destination)
    return jsonify(result)

@app.route('/api/upload', methods=['POST'])
def upload_file_route():
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No file part in request."})
    file = request.files['file']
    destination = request.form.get('destination', 'plugins') # Default to plugins folder
    result = file_manager.handle_upload(file, destination)
    return jsonify(result)

# --- SocketIO Event Handlers ---
def read_log_history(log_path):
    """Reads the entire content of a log file, cleaning ANSI codes."""
    try:
        with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            return log_streamer.clean_ansi(content)
    except FileNotFoundError:
        return f"Log file not found: {log_path}\n"
    except Exception as e:
        return f"Error reading log file {log_path}: {e}\n"

@socketio.on('connect')
def handle_connect():
    """Send log history to a newly connected client."""
    print('Client connected')
    console_history = read_log_history(MINECRAFT_CONSOLE_LOG)
    emit('console_history', {'data': console_history}, to=request.sid)
    backup_history = read_log_history(BACKUP_LOG)
    emit('backup_history', {'data': backup_history}, to=request.sid)

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

if __name__ == '__main__':
    # Start background threads for log streaming
    threading.Thread(target=log_streamer.stream_log_file, args=(socketio, MINECRAFT_CONSOLE_LOG, 'console_output'), daemon=True).start()
    threading.Thread(target=log_streamer.stream_log_file, args=(socketio, BACKUP_LOG, 'backup_output'), daemon=True).start()

    host = os.getenv('FLASK_HOST', '0.0.0.0')
    port = int(os.getenv('FLASK_PORT', 5000))
    print(f"Starting server on http://{host}:{port}")
    socketio.run(app, host=host, port=port, use_reloader=False)
