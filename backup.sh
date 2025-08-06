#!/bin/bash
# A robust script to back up the Minecraft server and upload it to mega.nz

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
# Expand paths to be absolute
MINECRAFT_DIR=$(eval echo ~)/minecraft
BACKUP_DIR=$(eval echo ~)/backup
LOG_FILE="$BACKUP_DIR/backup_latest.log"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILENAME="mc_backup__${TIMESTAMP}.tar.gz"
LOCAL_BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILENAME"
REMOTE_MEGA_DIR="/backup" # The target folder inside mega.nz

# --- Logging Function ---
# Logs messages to stdout and to the log file.
log() {
    echo "$(date +'%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# --- Main Script ---

# 1. Prepare for backup
# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"
# Clear previous log file for the new run
> "$LOG_FILE"
log "Starting Minecraft backup process..."
log "-----------------------------------"

# 2. Stop Minecraft Server
log "Sending 'stop' command to Minecraft server via tmux session 'mc'..."
tmux send-keys -t mc:0.0 'stop' C-m
log "Waiting 30 seconds for the server to shut down safely..."
sleep 30
log "Server should now be stopped."

# 3. Create Backup Archive
log "Creating backup archive: $LOCAL_BACKUP_PATH"
log "Archiving contents of: $MINECRAFT_DIR"
# The tar command will now log its verbose output and any errors to the log file.
# Using 'v' for verbose to see the files being archived in the log.
tar -czvf "$LOCAL_BACKUP_PATH" -C "$MINECRAFT_DIR" . >> "$LOG_FILE" 2>&1
log "Backup archive created successfully."

# 4. Upload to Mega.nz
log "Uploading '$BACKUP_FILENAME' to Mega.nz folder: '$REMOTE_MEGA_DIR'"
# Use non-interactive mega-put. This assumes mega-cmd is already running and logged in.
# Redirecting output to the log file.
mega-put "$LOCAL_BACKUP_PATH" "$REMOTE_MEGA_DIR/" >> "$LOG_FILE" 2>&1
log "Upload to Mega.nz completed."

# 5. Restart Minecraft Server
log "Restarting Minecraft server..."
# Using the start script in the minecraft directory
tmux send-keys -t mc:0.0 "bash $MINECRAFT_DIR/start.sh" C-m
log "Server restart command sent."

log "-----------------------------------"
log "Backup process finished successfully."

exit 0
