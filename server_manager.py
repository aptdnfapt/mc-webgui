import subprocess
import os

# Define paths based on the user's home directory
HOME_DIR = os.path.expanduser('~')
MINECRAFT_DIR = os.path.join(HOME_DIR, 'minecraft')
BACKUP_SCRIPT_PATH = os.path.join(HOME_DIR, 'backup.sh')
START_SCRIPT_PATH = os.path.join(MINECRAFT_DIR, 'start.sh')

TMUX_SESSION = 'mc:0.0'

def _send_tmux_command(command):
    try:
        subprocess.run(['tmux', 'send-keys', '-t', TMUX_SESSION, command, 'C-m'])
        return {"status": "success", "message": command, "rc": 0}
    except FileNotFoundError:
        return {"status": "error", "message": "tmux command not found. Is tmux installed and in your PATH?", "rc": 127}
    except Exception as e:
        return {"status": "error", "message": str(e)}

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
    """Executes the backup script in the background."""
    if not os.path.exists(BACKUP_SCRIPT_PATH):
        return {"status": "error", "message": f"Backup script not found at {BACKUP_SCRIPT_PATH}"}

    try:
        # Popen runs the script in a new process and doesn't wait for it to complete.
        subprocess.Popen([BACKUP_SCRIPT_PATH])
        return {"status": "success", "message": "Backup script started."}
    except Exception as e:
        return {"status": "error", "message": f"Failed to start backup script: {e}"}
