# Minecraft Server Web GUI

A simple Flask-based web interface to manage a Minecraft server running in a `tmux` session.

## Features

-   **Live Console View:** See the live output of your Minecraft server console.
-   **Server Controls:** Start and stop your server with the click of a button.
-   **Robust Backups:** Trigger a script that stops the server, creates a compressed backup, uploads it to Mega.nz, and restarts the server.
-   **File Manager:** Browse the `~/minecraft` directory and its subdirectories, and upload new `.jar` files. Deletion is not permitted.
-   **Private Access:** Designed to be run on a private network like Tailscale for security.

## Setup

### 1. Prerequisites

-   Python 3.8+
-   `tmux` installed and running.
-   A Minecraft server set up in `~/minecraft/`.
-   `mega-cmd` installed and logged in for backups.

### 2. Installation

1.  **Install Python dependencies:**
    *(A `requirements.txt` file will be created for this).*
    ```bash
    pip install Flask Flask-SocketIO eventlet python-dotenv
    ```

2.  **Make `backup.sh` executable:**
    ```bash
    chmod +x backup.sh
    ```

### 3. Configuration

1.  **Create your environment file:**
    Copy the example `.env.example` file to a new file named `.env`. This file is ignored by git and will hold your private settings.
    ```bash
    cp .env.example .env
    ```

2.  **Edit your `.env` file:**
    Open the `.env` file and set the values.
    - `FLASK_HOST`: Set this to your server's private IP (e.g., your Tailscale IP) or `0.0.0.0` to make it accessible on your local network.
    - `SECRET_KEY`: Generate a unique, random secret key. A simple way is to run the following command and paste the output:
      ```bash
      python3 -c 'import secrets; print(secrets.token_hex(24))'
      ```

### 4. `tmux` Preparation

Your Minecraft server must be running inside a `tmux` session named `mc`, in window `0`. The web interface reads the server output directly from `~/minecraft/logs/latest.log`, so no special `tmux` configuration (like `pipe-pane`) is required.

## Running the Application

Once everything is set up, start the Flask application:

```bash
python3 app.py
```

You can now access the web GUI by navigating to `http://<YOUR_SERVER_IP>:<FLASK_PORT>` in your web browser.
