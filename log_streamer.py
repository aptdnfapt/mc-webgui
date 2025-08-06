import time
import os
import re

def clean_ansi(text):
    """Removes ANSI escape sequences for colors and formatting."""
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    return ansi_escape.sub('', text)

def stream_log_file(socketio, log_path, event_name):
    """
    Reads a log file from the end and emits new lines via SocketIO.
    Runs in a background thread and handles file creation/deletion robustly.
    """
    while True:
        try:
            with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
                # Go to the end of the file in case we are re-opening
                f.seek(0, 2)
                while True:
                    line = f.readline()
                    if not line:
                        time.sleep(0.1)  # Wait for new lines
                        continue
                    cleaned_line = clean_ansi(line)
                    socketio.emit(event_name, {'data': cleaned_line})
        except FileNotFoundError:
            print(f"Log file not found: {log_path}. Waiting for it to be created.")
            # This loop will block until the file is found
            while not os.path.exists(log_path):
                time.sleep(2)
            # After the file is found, the outer 'while True' loop will cause it to be reopened.
            continue
        except Exception as e:
            print(f"Error streaming log file {log_path}: {e}")
            time.sleep(5) # Avoid spamming errors on repeated failures
