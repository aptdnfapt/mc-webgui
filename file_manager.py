import os
import shutil
from werkzeug.utils import secure_filename

HOME_DIR = os.path.expanduser('~')
MINECRAFT_ROOT = os.path.join(HOME_DIR, 'minecraft')
BACKUP_DIR = os.path.join(HOME_DIR, 'backup')
ALLOWED_UPLOAD_EXTENSIONS = {'.jar'}

# Define the root directories that are accessible.
ALLOWED_ROOTS = [MINECRAFT_ROOT, BACKUP_DIR]

def _is_path_safe(path):
    """Check if a path is within the allowed directories to prevent traversal."""
    # Ensure allowed root directories exist
    for p in ALLOWED_ROOTS:
        os.makedirs(p, exist_ok=True)

    abs_path = os.path.abspath(path)

    # Check if the path is a child of any of the allowed roots.
    for root in ALLOWED_ROOTS:
        if os.path.commonpath([abs_path, root]) == root:
            return True
    return False

def list_directory_contents(path):
    """Lists contents of a directory. Path is relative to the user's home directory."""
    # Ensure the plugins and old_plugins directories exist when accessing minecraft root or subdirectories
    if path.startswith('minecraft'):
        plugins_dir = os.path.join(MINECRAFT_ROOT, 'plugins')
        old_plugins_dir = os.path.join(MINECRAFT_ROOT, 'old_plugins')
        os.makedirs(plugins_dir, exist_ok=True)
        os.makedirs(old_plugins_dir, exist_ok=True)
    
    # Special case for the root view (~), only show the allowed directories.
    if path == '.':
        contents = []
        for p in ALLOWED_ROOTS:
            if os.path.exists(p):
                contents.append({'name': os.path.basename(p), 'is_dir': True})
        return {"status": "success", "contents": sorted(contents, key=lambda x: x['name'].lower())}

    full_path = os.path.join(HOME_DIR, path)

    if not _is_path_safe(full_path):
        return {"status": "error", "message": "Access to this path is denied."}

    if not os.path.isdir(full_path):
        return {"status": "error", "message": "Path is not a valid directory."}

    try:
        contents = []
        for item in os.listdir(full_path):
            item_path = os.path.join(full_path, item)
            # Ensure listed items don't lead to unsafe paths (e.g., via symlinks)
            if _is_path_safe(item_path):
                contents.append({'name': item, 'is_dir': os.path.isdir(item_path)})
        return {"status": "success", "contents": sorted(contents, key=lambda x: (not x['is_dir'], x['name'].lower()))}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def move_file(source, destination):
    """Moves a file or directory. Paths are relative to the home directory."""
    source_path = os.path.join(HOME_DIR, source)
    dest_path = os.path.join(HOME_DIR, destination)

    if not _is_path_safe(source_path) or not _is_path_safe(dest_path):
        return {"status": "error", "message": "Access denied for source or destination path."}

    if not os.path.exists(source_path):
        return {"status": "error", "message": "Source path does not exist."}

    try:
        # To move into a directory, the full destination path must be constructed
        final_dest_path = os.path.join(dest_path, os.path.basename(source_path))
        shutil.move(source_path, final_dest_path)
        return {"status": "success", "message": f"Moved '{os.path.basename(source)}' to '{destination}'."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def rename_item(old_path_relative, new_name):
    """Renames a file or directory. Path is relative to the home directory."""
    # Security: new_name should not contain path separators.
    if '/' in new_name or '\\' in new_name or '..' in new_name:
        return {"status": "error", "message": "Invalid characters in new name."}

    old_path_abs = os.path.join(HOME_DIR, old_path_relative)
    
    if not _is_path_safe(old_path_abs):
        return {"status": "error", "message": "Access denied for source path."}
    
    if not os.path.exists(old_path_abs):
        return {"status": "error", "message": "Source path does not exist."}

    # Construct the new absolute path
    new_path_abs = os.path.join(os.path.dirname(old_path_abs), new_name)

    # Check if the new path is also safe
    if not _is_path_safe(new_path_abs):
        return {"status": "error", "message": "Access denied for destination path."}

    if os.path.exists(new_path_abs):
        return {"status": "error", "message": "An item with the new name already exists."}
    
    try:
        os.rename(old_path_abs, new_path_abs)
        return {"status": "success", "message": f"Renamed to '{new_name}'."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def handle_upload(file, destination_folder):
    """Handles file uploads. Destination is relative to the home directory."""
    if not file or not file.filename:
        return {"status": "error", "message": "No file selected."}

    filename = secure_filename(file.filename)
    _, ext = os.path.splitext(filename)

    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        return {"status": "error", "message": f"File type not allowed. Only {list(ALLOWED_UPLOAD_EXTENSIONS)} are permitted."}

    destination_path = os.path.join(HOME_DIR, destination_folder)

    if not _is_path_safe(destination_path):
        return {"status": "error", "message": "Upload to this location is not allowed."}

    try:
        file.save(os.path.join(destination_path, filename))
        return {"status": "success", "message": f"File '{filename}' uploaded to '{destination_folder}'."}
    except Exception as e:
        return {"status": "error", "message": str(e)}
