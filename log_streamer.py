import time
import os
import re

def clean_ansi(text):
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    return ansi_escape.sub('', text)

def stream_log_file(socketio, log_path, event_name):
    """
    Reads a log file from the end and emits new lines via SocketIO.
    Runs in a background thread.
    """
    try:
        with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
            f.seek(0, 2)
            while True:
                line = f.readline()
                if not line:
                    time.sleep(0.1)
                    continue
                socketio.emit(event_name, {'data': clean_ansi(line)})
    except FileNotFoundError:
        print(f"Log file not found: {log_path}. Waiting for it to be created.")
        while not os.path.exists(log_path):
            time.sleep(2)
        stream_log_file(socketio, log_path, event_name)
    except Exception as e:
        print(f"Error streaming log file {log_path}: {e}")
