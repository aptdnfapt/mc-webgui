import subprocess
import os

# Define paths based on the user's home directory
HOME_DIR = os.path.expanduser('~')
MINECRAFT_DIR = os.path.join(HOME_DIR, 'minecraft')
BACKUP_SCRIPT_PATH = os.path.join(HOME_DIR, 'backup.sh')
START_SCRIPT_PATH = os.path.join(MINECRAFT_DIR, 'start.sh')

TMUX_SESSION = 'mc:0.0'

def _send_tmux_command(command):
    """Helper function to send a command to the tmux session with detailed debugging."""
    try:
        # Using Popen to capture stdout and stderr
        process = subprocess.Popen(
            ['tmux', 'send-keys', '-t', TMUX_SESSION, command, 'C-m'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = process.communicate()
        
        if process.returncode != 0:
            return {
                "status": "error", 
                "message": f"tmux command failed with return code {process.returncode}.",
                "stdout": stdout,
                "stderr": stderr
            }
        
        return {"status": "success", "message": f"Command '{command}' sent."}
        
    except FileNotFoundError:
        return {"status": "error", "message": "tmux command not found. Is tmux installed and in your PATH?"}
    except Exception as e:
        return {"status": "error", "message": f"An unexpected error occurred: {e}"}

def start_minecraft_server():
    """Sends the start command to the Minecraft server tmux pane."""
    return _send_tmux_command(f"bash {START_SCRIPT_PATH}")

def stop_minecraft_server():
    """Sends the stop command to the Minecraft server."""
    return _send_tmux_command("stop")

def send_minecraft_command(command):
    if command is None:
        command = ''
    return _send_tmux_command(command)
def run_backup_script():
    """Executes the backup script and waits for it to complete."""
    if not os.path.exists(BACKUP_SCRIPT_PATH):
        return {"status": "error", "message": f"Backup script not found at {BACKUP_SCRIPT_PATH}"}

    try:
        # Use subprocess.run to execute the script and wait for it to complete.
        # This is a blocking call, necessary for the lock in app.py to work correctly.
        # We do NOT capture output here, because the script itself handles logging to a file
        # which is then streamed by log_streamer. Capturing it can cause buffering issues
        # that prevent real-time log updates.
        process = subprocess.run(
            [BACKUP_SCRIPT_PATH],
            check=False
        )
        if process.returncode != 0:
            error_message = (
                f"Backup script failed with exit code {process.returncode}. "
                "Check the backup log on the web interface for details."
            )
            print(error_message) # Log to Flask console for debugging
            return {"status": "error", "message": error_message}

        return {"status": "success", "message": "Backup script completed successfully."}
    except Exception as e:
        return {"status": "error", "message": f"Failed to run backup script: {e}"}

def is_server_running():
    """Checks if the Minecraft server (paper.jar) process is running."""
    # This uses pgrep to find a process whose command line matches 'paper.jar'.
    # pgrep returns an exit code of 0 if a process is found, and 1 otherwise.
    command = "pgrep -f paper.jar"
    try:
        # We run the command and check the return code.
        # We redirect stdout/stderr to DEVNULL as we don't need the PID, just its existence.
        # check=True makes subprocess.run raise CalledProcessError on a non-zero exit code.
        subprocess.run(command, shell=True, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except subprocess.CalledProcessError:
        # This exception occurs if pgrep returns a non-zero exit code (e.g., process not found).
        return False
    except FileNotFoundError:
        # This occurs if pgrep is not installed on the system.
        print("Warning: 'pgrep' command not found. Cannot determine server status reliably.")
        return False
