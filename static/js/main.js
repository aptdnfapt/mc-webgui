document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    const tabs = document.querySelectorAll('.tab');
    const panels = document.querySelectorAll('.panel');
    tabs.forEach(t => t.addEventListener('click', () => {
        tabs.forEach(b => b.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        t.classList.add('active');
        document.getElementById(t.dataset.tab).classList.add('active');
    }));

    const consoleOutput = document.getElementById('console-output');
    const backupOutput = document.getElementById('backup-output');
    const uptimeClock = document.getElementById('uptime-clock');
    
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const backupBtn = document.getElementById('backup-btn');
    const sendCommandBtn = document.getElementById('send-command-btn');
    const commandInput = document.getElementById('command-input');

    // Event Listeners for server control buttons
    async function updateServerStatus() {
        try {
            const response = await fetch('/api/server_status');
            const data = await response.json();
            if (data.status === 'success') {
                startBtn.disabled = data.is_running;
                stopBtn.disabled = !data.is_running;
            } else {
                console.error('Could not get server status:', data.message);
                // Disable both if status is uncertain
                startBtn.disabled = true;
                stopBtn.disabled = true;
            }
        } catch (error) {
            console.error('Error fetching server status:', error);
            startBtn.disabled = true;
            stopBtn.disabled = true;
        }
    }

    startBtn.addEventListener('click', async () => {
        startBtn.disabled = true; // Immediately disable to prevent double clicks
        await postData('/api/start_server');
        setTimeout(updateServerStatus, 2000); // Re-check status after a delay
    });

    stopBtn.addEventListener('click', async () => {
        stopBtn.disabled = true; // Immediately disable to prevent double clicks
        await postData('/api/stop_server');
        setTimeout(updateServerStatus, 2000); // Re-check status after a delay
    });
    backupBtn.addEventListener('click', async () => {
        if (confirm("Are you sure you want to start a new backup? The server will be stopped temporarily.")) {
            backupBtn.disabled = true;
            // The backup script clears its own log, so we just give initial feedback.
            backupOutput.textContent = 'Requesting backup start...\n';
            const result = await postData('/api/run_backup');
            // If the backup couldn't be started (e.g., already running), show an error and re-enable the button.
            if (result && result.status === 'error') {
                appendToLog(backupOutput, `\nError: ${result.message}\n`);
                backupBtn.disabled = false;
            }
        }
    });
    sendCommandBtn.addEventListener('click', async () => {
        console.log('Send command button clicked.');
        const command = commandInput.value;
        if (command) {
            console.log('Command to send:', command);
            const result = await postAPIData('/api/send_command', { command: command });
            console.log('Response from server:', result);
            commandInput.value = ''; // Clear input after sending
        } else {
            console.log('Please enter a command.');
        }
    });

    commandInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendCommandBtn.click();
        }
    });

    const fileUploadInput = document.getElementById('file-upload-input');
    const uploadDestSelect = document.getElementById('upload-dest');
    const uploadBtn = document.getElementById('upload-btn');
    const renameBtn = document.getElementById('rename-btn');
    const cutBtn = document.getElementById('cut-btn');
    const pasteBtn = document.getElementById('paste-btn');
    const cancelMoveBtn = document.getElementById('cancel-move-btn');
    
    const currentPathSpan = document.getElementById('current-path');
    const fileListUl = document.getElementById('file-list');
    const fileRoots = document.getElementById('file-roots');
    const chosenFile = document.getElementById('chosen-file');

    // Tabs
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabButtons.forEach(btn => btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    }));

    async function postData(url, data = {}) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            console.log(result);
            return result;
        } catch (error) {
            console.error('Error:', error);
            return { status: 'error', message: 'A network error occurred.' };
        }
    }

    async function postAPIData(url, data = {}) {
        console.log('postAPIData called with url:', url, 'and data:', data);
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            console.log('Fetch response status:', response.status);
            const result = await response.json();
            console.log('Fetch response json:', result);
            return result;
        } catch (error) {
            console.error('Error posting data:', error);
            return { status: 'error', message: 'A network error occurred while posting data.' };
        }
    }
    
    function appendToLog(element, text) {
        element.textContent += text;
        element.scrollTop = element.scrollHeight;
    }

    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('console_history', (msg) => {
        consoleOutput.textContent = msg.data;
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    });

    socket.on('backup_history', (msg) => {
        backupOutput.textContent = msg.data;
        backupOutput.scrollTop = backupOutput.scrollHeight;
    });

    socket.on('console_output', (msg) => {
        appendToLog(consoleOutput, msg.data);
    });

    socket.on('backup_output', (msg) => {
        appendToLog(backupOutput, msg.data);
    });

    socket.on('backup_status', (msg) => {
        if (msg.status === 'finished') {
            console.log('Backup process finished.');
            backupBtn.disabled = false;
        }
    });

    function formatUptime(totalSeconds) {
        const days = Math.floor(totalSeconds / 86400);
        totalSeconds %= 86400;
        const hours = Math.floor(totalSeconds / 3600);
        totalSeconds %= 3600;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);

        const pad = (num) => String(num).padStart(2, '0');

        let uptimeString = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
        if (days > 0) {
            uptimeString = `${days}d ${uptimeString}`;
        }
        return uptimeString;
    }

    socket.on('system_uptime', (data) => {
        if (uptimeClock && data.uptime) {
            uptimeClock.textContent = formatUptime(data.uptime);
        }
    });

    // File Manager
    let currentDirectory = '.';
    let filesToMove = [];

    function updateFileActionButtons() {
        const checkedBoxes = document.querySelectorAll('.file-checkbox:checked');
        const allCheckBoxes = document.querySelectorAll('.file-checkbox');

        if (filesToMove.length > 0) {
            // Cut mode is active
            cutBtn.style.display = 'none';
            renameBtn.style.display = 'none';
            pasteBtn.style.display = 'inline-block';
            cancelMoveBtn.style.display = 'inline-block';
            allCheckBoxes.forEach(cb => { cb.disabled = true; cb.checked = false; });
        } else {
            // Not in cut mode
            cutBtn.style.display = checkedBoxes.length > 0 ? 'inline-block' : 'none';
            renameBtn.style.display = checkedBoxes.length === 1 ? 'inline-block' : 'none';
            pasteBtn.style.display = 'none';
            cancelMoveBtn.style.display = 'none';
            allCheckBoxes.forEach(cb => { cb.disabled = false; });
        }
    }

    function renderFileList(data) {
        fileListUl.innerHTML = '';
        const segments = (currentDirectory === '.' ? [] : currentDirectory.split('/'));
        const crumbs = ['<a href="#" data-path=".">~</a>'].concat(segments.map((seg, i) => {
            const p = segments.slice(0, i+1).join('/') || '.';
            return `<span class="muted">/</span> <a href="#" data-path="${p}">${seg}</a>`;
        }));
        currentPathSpan.innerHTML = crumbs.join(' ');

        const contents = (data && Array.isArray(data.contents)) ? data.contents : [];

        if (currentDirectory === '.') {
            fileRoots.style.display = 'grid';
            fileRoots.innerHTML = '';
            const names = new Set(contents.map(i => i.name));
            ['minecraft', 'backup'].forEach(root => {
                const div = document.createElement('a');
                div.className = 'file-root';
                div.href = '#';
                div.dataset.path = root;
                div.textContent = root.toUpperCase();
                fileRoots.appendChild(div);
            });
            
            // Add quick navigation buttons for plugins and old-plugins
            const pluginsDiv = document.createElement('a');
            pluginsDiv.className = 'file-root';
            pluginsDiv.href = '#';
            pluginsDiv.dataset.path = 'minecraft/plugins';
            pluginsDiv.textContent = 'PLUGINS';
            fileRoots.appendChild(pluginsDiv);
            
            const oldPluginsDiv = document.createElement('a');
            oldPluginsDiv.className = 'file-root';
            oldPluginsDiv.href = '#';
            oldPluginsDiv.dataset.path = 'minecraft/old-plugins';
            oldPluginsDiv.textContent = 'OLD PLUGINS';
            fileRoots.appendChild(oldPluginsDiv);
        } else {
            fileRoots.style.display = 'none';
        }

        if (currentDirectory !== '.') {
            const parentLi = document.createElement('li');
            const parentPath = currentDirectory.includes('/') ? (currentDirectory.substring(0, currentDirectory.lastIndexOf('/')) || '.') : '.';
            const back = document.createElement('a');
            back.href = '#'; back.dataset.path = parentPath; back.innerHTML = '← Back';
            const row = document.createElement('div'); row.className = 'file';
            const name = document.createElement('div'); name.className='name'; name.appendChild(back);
            row.appendChild(name);
            parentLi.appendChild(row);
            fileListUl.appendChild(parentLi);
        }

        contents.forEach(item => {
            const li = document.createElement('li');
            const itemFullPath = currentDirectory === '.' ? item.name : `${currentDirectory}/${item.name}`;

            const row = document.createElement('div');
            row.className = 'file';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'file-checkbox chk';
            checkbox.setAttribute('data-path', itemFullPath);
            row.appendChild(checkbox);

            const name = document.createElement('div');
            name.className = 'name';
            if (item.is_dir) {
                name.innerHTML = `<a href=\"#\" data-path=\"${itemFullPath}\">${item.name}/</a>`;
            } else {
                name.textContent = item.name;
            }
            row.appendChild(name);

            if (item.is_dir) {
                const tag = document.createElement('span');
                tag.className = 'tag';
                tag.textContent = 'DIR';
                row.appendChild(tag);
            }

            li.appendChild(row);
            fileListUl.appendChild(li);
        });
        updateFileActionButtons();
    }

    async function fetchFiles(path = '.') {
        currentDirectory = path;
        try {
            const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
            const data = await response.json();
            if (data.status === 'success') {
                renderFileList(data);
            } else {
                console.error(`Error: ${data.message}`);
            }
        } catch (error) {
            console.error('Error fetching files:', error);
            alert('Could not fetch file list.');
        }
    }

    fileListUl.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link) {
            e.preventDefault();
            const path = link.getAttribute('data-path');
            fetchFiles(path);
        }
    });

    fileRoots.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link) {
            e.preventDefault();
            fetchFiles(link.dataset.path);
        }
    });

    fileListUl.addEventListener('change', (e) => {
        if (e.target.classList.contains('file-checkbox')) {
            updateFileActionButtons();
        }
    });

    cutBtn.addEventListener('click', () => {
        filesToMove = [];
        const checkedBoxes = document.querySelectorAll('.file-checkbox:checked');
        checkedBoxes.forEach(box => {
            filesToMove.push(box.getAttribute('data-path'));
        });
        
        if (filesToMove.length > 0) {
            console.log(`Cut ${filesToMove.length} item(s). Navigate to a new directory and click 'Paste'.`);
            updateFileActionButtons();
        }
    });

    renameBtn.addEventListener('click', async () => {
        const checkedBox = document.querySelector('.file-checkbox:checked');
        const oldPath = checkedBox.getAttribute('data-path');
        const oldName = oldPath.split('/').pop();

        const newName = prompt('Enter new name for the item:', oldName);

        if (newName && newName.trim() && newName !== oldName) {
            const result = await postAPIData('/api/rename', { old_path: oldPath, new_name: newName.trim() });
            if (result.status === 'success') {
                fetchFiles(currentDirectory);
            } else {
                alert(`Error: ${result.message}`);
            }
        }
    });

    pasteBtn.addEventListener('click', async () => {
        if (filesToMove.length === 0) return;

        const destination = currentDirectory;
        const promises = filesToMove.map(source => postAPIData('/api/move', { source, destination }));
        
        const results = await Promise.all(promises);
        
        const successes = results.filter(r => r.status === 'success').length;
        const failures = results.filter(r => r.status !== 'success');
        
        let summary = `${successes} item(s) moved successfully.`;
        if (failures.length > 0) {
            summary += `\n\n${failures.length} item(s) failed to move:\n` + failures.map(f => `- ${f.message}`).join('\n');
        }
        console.log(summary);

        filesToMove = [];
        fetchFiles(currentDirectory);
    });

    cancelMoveBtn.addEventListener('click', () => {
        filesToMove = [];
        console.log('Move operation cancelled.');
        updateFileActionButtons();
    });


    fileUploadInput.addEventListener('change', () => {
        if (fileUploadInput.files.length === 0) {
            chosenFile.textContent = '';
        } else if (fileUploadInput.files.length === 1) {
            chosenFile.textContent = fileUploadInput.files[0].name;
        } else {
            chosenFile.textContent = `${fileUploadInput.files.length} files selected`;
        }
    });

    uploadBtn.addEventListener('click', () => {
        const files = fileUploadInput.files;
        const destination = uploadDestSelect.value;
        if (files.length === 0) {
            alert('Please select file(s) to upload.');
            return;
        }

        const formData = new FormData();
        
        // Append all selected files to the form data
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }
        formData.append('destination', destination);

        const xhr = new XMLHttpRequest();
        const progressContainer = document.getElementById('upload-progress-container');
        const progressBar = document.getElementById('upload-progress');

        xhr.open('POST', '/api/upload', true);

        xhr.upload.onprogress = function (e) {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                progressBar.value = percentComplete;
            }
        };

        xhr.onloadstart = function () {
            progressContainer.style.display = 'block';
            progressBar.value = 0;
            uploadBtn.disabled = true;
        };

        xhr.onload = function () {
            progressContainer.style.display = 'none';
            uploadBtn.disabled = false;
            if (xhr.status === 200) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    console.log(result.message);
                    if (result.status === 'success') {
                        fetchFiles(destination); // Refresh the destination directory
                        fileUploadInput.value = '';
                        chosenFile.textContent = '';
                        alert(result.message); // Show success message
                    } else {
                        alert('Upload failed: ' + result.message);
                    }
                } catch (e) {
                    console.error('Error parsing server response:', e);
                    alert('An unexpected error occurred during upload (invalid server response).');
                }
            } else {
                console.error('Upload Error:', xhr.status, xhr.statusText);
                alert(`An error occurred during upload. Server responded with status ${xhr.status}.`);
            }
        };

        xhr.onerror = function () {
            progressContainer.style.display = 'none';
            uploadBtn.disabled = false;
            console.error('Upload Error:', xhr.statusText);
            alert('A network error occurred during upload.');
        };

        xhr.send(formData);
    });

    fetchFiles(currentDirectory);
    updateServerStatus(); // Check server status on page load
});
