import time
import os

def stream_log_file(socketio, log_path, event_name):
    """
    Reads a log file from the end and emits new lines via SocketIO.
    Runs in a background thread.
    """
    try:
        with open(log_path, 'r') as f:
            # Go to the end of the file
            f.seek(0, 2)
            while True:
                line = f.readline()
                if not line:
                    time.sleep(0.1)  # Wait for new lines
                    continue
                socketio.emit(event_name, {'data': line})
    except FileNotFoundError:
        print(f"Log file not found: {log_path}. Waiting for it to be created.")
        while not os.path.exists(log_path):
            time.sleep(2)
        # Restart the stream once the file exists
        stream_log_file(socketio, log_path, event_name)
    except Exception as e:
        print(f"Error streaming log file {log_path}: {e}")
