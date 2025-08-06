# Minecraft Server Web GUI Plan

This document outlines the plan to create a Flask-based web GUI for managing a Minecraft server running within a `tmux` session.

## 1. Core Technologies

*   **Backend:** Python 3, Flask, Flask-SocketIO (`pip install Flask Flask-SocketIO eventlet`)
*   **Frontend:** HTML, CSS, JavaScript (Socket.IO client library)
*   **Server Management:** `tmux` (for session management and console output redirection), `subprocess` module in Python.

## 2. Server Environment Assumptions

*   **Minecraft Server Path:** `~/minecraft/` (contains `paper.jar`, `start.sh`, `logs/`, etc.)
*   **`tmux` Session Name:** `mc`
*   **`tmux` Window/Pane for Server:** `mc:0.0` (first window, first pane)
*   **Server Start Script:** `~/minecraft/start.sh` (e.g., `java -Xmx8G -Xms8G -jar paper.jar --nogui`)
*   **Console Output Log File:** `~/minecraft/console_output.log` (this will be created and managed by `tmux`)

## 3. `tmux` Setup for Live Console Output

To stream the `tmux` pane output live, we will use `tmux pipe-pane`.

### Manual Setup (Initial Run or if tmux restarts)

Before starting the Flask application, ensure your Minecraft server pane in `tmux` is piping its output:

1.  Attach to your `tmux` session: `tmux attach -t mc`
2.  Navigate to the pane where your Minecraft server runs (e.g., window 0, pane 0).
3.  Execute the `pipe-pane` command (you can bind this to a key or run it manually):
    ```bash
    tmux pipe-pane -o -t mc:0.0 'cat >> ~/minecraft/console_output.log'
    ```
    *   `-o`: Overwrite any existing `pipe-pane` configuration.
    *   `-t mc:0.0`: Target the specific `tmux` pane.
    *   `'cat >> ~/minecraft/console_output.log'`: Appends all pane output to this file.

### Automation Consideration (Future)

The Flask app could potentially execute this `tmux pipe-pane` command itself if the session/pane is detected, but for simplicity, initial manual setup is recommended. Ensure the `console_output.log` file exists and is writable by the user running the Flask app.

## 4. Backup Script (`backup.sh`)

A standalone, robust bash script (`~/backup.sh`) will handle the entire backup process. The Flask app will only be responsible for triggering it. The script will log its own progress to `~/backup/backup_latest.log`.

*   **Functionality:**
    1.  Sends `stop` command to the `mc` tmux session.
    2.  Waits for the server to shut down.
    3.  Creates a timestamped `.tar.gz` archive of the `~/minecraft` directory and saves it to `~/backup/`.
    4.  Uploads the archive to a designated folder on mega.nz using `mega-put`.
    5.  Sends the `start.sh` command to the `mc` tmux session to restart the server.
*   **Robustness:**
    *   Uses `set -e` to fail fast.
    *   Logs all steps with timestamps to `~/backup/backup_latest.log`.
    *   Uses direct commands for `tar` and `mega-put` instead of fragile `tmux send-keys` with `sleep`.

## 5. Flask Application Components

### 5.1. `app.py` (Main Flask Application)

*   **Initialization:**
    *   Import `Flask`, `SocketIO`, `subprocess`, `os`, `threading`, `time`.
    *   Configure `SECRET_KEY` for session management.
    *   Initialize `SocketIO` with `app`.
    *   Start background threads for streaming both the Minecraft console log and the backup log (see `log_streamer.py`).
*   **Routes:**
    *   `/`: Main dashboard (HTML template displaying console output, buttons, file browser).
    *   `/start_server`: Endpoint to start the Minecraft server.
    *   `/stop_server`: Endpoint to stop the Minecraft server.
    *   `/run_backup`: Endpoint to trigger the backup script.
    *   `/api/files`: RESTful endpoint to list files in a directory.
    *   `/api/upload`: RESTful endpoint for file uploads (e.g., `.jar` files).
    *   `/api/move`: RESTful endpoint to move files/directories.
*   **SocketIO Events:**
    *   `connect`: Handled when a client connects. This ensures any user joining at any time sees the current state.
        *   The server will immediately read the entire current content of `~/minecraft/console_output.log` and `~/backup/backup_latest.log`.
        *   It will emit the full log history for each (e.g., `console_history` and `backup_history`) to the *newly connected client only*. This provides the user with the complete picture up to the point of connection.
    *   `disconnect`: Handled when a client disconnects.
    *   `send_command`: (Optional) For sending commands directly to the server pane.

### 5.2. `server_manager.py` (Module for `tmux` interactions)

*   **`start_minecraft_server()`:**
    *   Uses `subprocess.run()` to execute `tmux send-keys -t mc:0.0 'bash ~/minecraft/start.sh' C-m`.
    *   Ensures the command is run in the correct directory if `start.sh` doesn't handle it (though `start.sh` should handle `cd` itself).
*   **`stop_minecraft_server()`:**
    *   Uses `subprocess.run()` to execute `tmux send-keys -t mc:0.0 'stop' C-m`.
*   **`send_minecraft_command(command)`:**
    *   Uses `subprocess.run()` to execute `tmux send-keys -t mc:0.0 '{command}' C-m`.
*   **`run_backup_script()`:**
    *   Uses `subprocess.Popen()` to execute `~/backup.sh`. This runs the script in the background so it doesn't block the web server. The script's progress can be monitored via its log file.

### 5.3. `log_streamer.py` (Generalized Log Streaming Module)

*   **`stream_log_file(log_path, socketio_event)`:**
    *   This function will run in a separate `threading.Thread`.
    *   It will continuously read the specified `log_path` (e.g., `~/minecraft/console_output.log` or `~/backup/backup_latest.log`) using a `tail -f` like mechanism.
    *   Whenever new lines are detected, it will emit them via `socketio.emit(socketio_event, {'data': new_line})` to all connected clients.
    *   This module replaces the single-purpose `console_streamer.py`. `app.py` will start two threads using this function, one for each log file.

### 5.4. File Management (e.g., `file_manager.py`)

*   **`list_directory_contents(path)`:**
    *   Uses `os.listdir()` and `os.path.isdir`/`os.path.isfile` to get contents (files and subdirectories) of the target path (e.g., `~/minecraft/`, `~/minecraft/plugins/`, `~/minecraft/old_plugins/`, `~/minecraft/old_paper/`).
    *   Returns structured data (e.g., list of dictionaries) indicating type (file/directory), name, size, etc.
    *   **Crucially, this module must NOT expose any function to delete files.**
*   **`move_file(source_path, destination_path)`:**
    *   Uses `shutil.move()` to perform the file movement.
    *   This function will be triggered by the "cut-paste" or "move" action from the frontend.
    *   Validation should ensure `destination_path` is within the allowed Minecraft ecosystem directories.
*   **`handle_upload(file_storage_object, destination_path)`:**
    *   Saves uploaded files to the specified `destination_path`.
    *   **Strictly enforce file type: only `.jar` files are allowed.**
    *   The `destination_path` should typically be `~/minecraft/plugins/` for new plugins or `~/minecraft/` for a new `paper.jar`.

## 6. Frontend (`templates/index.html` and `static/js/main.js`)

### 6.1. `index.html`

*   **Console Display:** A `<pre>` or `<div>` element to show the main Minecraft server console output.
*   **Backup Log Display:** A separate `<pre>` or `<div>` element to show the output from the backup script.
*   **Control Buttons:** Buttons for "Start Server", "Stop Server", "Run Backup", and a command input.
*   **File Manager Area:**
    *   A section to display the hierarchical file structure of `~/minecraft/` and its subdirectories (`plugins`, `old_plugins`, `old_paper`).
    *   Elements to navigate directories.
    *   Checkboxes next to files/directories for selection.
    *   Buttons for "Move Selected" (or "Cut" and "Paste" functionality).
    *   An HTML form for "Upload JAR File" with a file input and an upload button.
*   **Socket.IO Client:** Include `socket.io.min.js`.

### 6.2. `main.js`

*   **Socket.IO Connection:** Initialize `const socket = io();`.
*   **Event Listeners:**
    *   Listen for `console_history` and `backup_history` events. When received (typically on connection), these will contain the full log files. The client should clear the respective display areas and render this full history.
    *   Listen for the continuous `console_output` and `backup_output` events. These represent live, new lines and should be appended to the correct display element.
    *   Event listeners for "Start Server", "Stop Server", and "Run Backup" buttons to make AJAX calls to the respective backend endpoints.
    *   JavaScript for file uploads (e.g., `FormData` and `fetch` API).
    *   Logic for displaying file listings dynamically.
    *   Event listeners for file selection (checkboxes), "Move" actions, and handling the "cut/paste" state in the UI. These will trigger AJAX calls or Socket.IO events to the backend's file management functions.

## 7. Development Workflow

1.  Set up `tmux` session and `pipe-pane` as described in Section 3.
2.  Create the `backup.sh` script and ensure it is executable (`chmod +x ~/backup.sh`). Test it manually from the command line first.
3.  Develop the Flask `app.py` with basic routes and SocketIO.
4.  Implement `server_manager.py` for `tmux` and backup script interactions.
5.  Implement the generalized `log_streamer.py` and integrate it into `app.py` to stream both console and backup logs.
6.  Create `index.html` and `main.js` to display both logs and handle all control buttons.
7.  Implement file browsing and upload functionalities.

This plan provides a clear roadmap for building the Minecraft server web GUI.
