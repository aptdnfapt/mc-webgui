import os
import shutil
from werkzeug.utils import secure_filename

HOME_DIR = os.path.expanduser('~')
MINECRAFT_ROOT = os.path.join(HOME_DIR, 'minecraft')
ALLOWED_UPLOAD_EXTENSIONS = {'.jar'}
# Define safe zones for file operations
ALLOWED_PATHS = [
    MINECRAFT_ROOT,
    os.path.join(MINECRAFT_ROOT, 'plugins'),
    os.path.join(MINECRAFT_ROOT, 'old_plugins'),
    os.path.join(MINECRAFT_ROOT, 'old_paper'),
]

def _is_path_safe(path):
    """Check if a path is within the allowed directories to prevent traversal."""
    # Create allowed paths if they don't exist
    for p in ALLOWED_PATHS:
        os.makedirs(p, exist_ok=True)
        
    abs_path = os.path.abspath(path)
    # Ensure the path is a subdirectory of the minecraft root
    if os.path.commonpath([abs_path, MINECRAFT_ROOT]) != MINECRAFT_ROOT:
        return False
    return True

def list_directory_contents(path):
    """Lists contents of a directory if it's within the allowed paths."""
    full_path = os.path.join(MINECRAFT_ROOT, path)

    if not _is_path_safe(full_path):
        return {"status": "error", "message": "Access to this path is denied."}
    
    if not os.path.isdir(full_path):
        return {"status": "error", "message": "Path is not a valid directory."}

    try:
        contents = []
        for item in os.listdir(full_path):
            item_path = os.path.join(full_path, item)
            contents.append({
                'name': item,
                'is_dir': os.path.isdir(item_path)
            })
        return {"status": "success", "contents": sorted(contents, key=lambda x: (not x['is_dir'], x['name'].lower()))}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def move_file(source, destination):
    """Moves a file or directory from source to destination."""
    source_path = os.path.join(MINECRAFT_ROOT, source)
    dest_path = os.path.join(MINECRAFT_ROOT, destination)

    if not _is_path_safe(source_path) or not _is_path_safe(dest_path):
        return {"status": "error", "message": "Access denied for source or destination path."}

    if not os.path.exists(source_path):
        return {"status": "error", "message": "Source path does not exist."}

    try:
        shutil.move(source_path, dest_path)
        return {"status": "success", "message": f"Moved '{source}' to '{destination}'."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def handle_upload(file, destination_folder):
    """Handles file uploads, ensuring they are .jar files and saved to a safe location."""
    if not file or not file.filename:
        return {"status": "error", "message": "No file selected."}

    filename = secure_filename(file.filename)
    _, ext = os.path.splitext(filename)

    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        return {"status": "error", "message": f"File type not allowed. Only {list(ALLOWED_UPLOAD_EXTENSIONS)} are permitted."}
    
    destination_path = os.path.join(MINECRAFT_ROOT, destination_folder)

    if not _is_path_safe(destination_path):
        return {"status": "error", "message": "Upload to this location is not allowed."}
    
    try:
        os.makedirs(destination_path, exist_ok=True)
        file.save(os.path.join(destination_path, filename))
        return {"status": "success", "message": f"File '{filename}' uploaded to '{destination_folder}'."}
    except Exception as e:
        return {"status": "error", "message": str(e)}
