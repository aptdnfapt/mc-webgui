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
    
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const backupBtn = document.getElementById('backup-btn');
    const sendCommandBtn = document.getElementById('send-command-btn');
    const commandInput = document.getElementById('command-input');

    // Event Listeners for server control buttons
    startBtn.addEventListener('click', () => postData('/api/start_server'));
    stopBtn.addEventListener('click', () => postData('/api/stop_server'));
    backupBtn.addEventListener('click', () => postData('/api/run_backup'));
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
    const cutBtn = document.getElementById('cut-btn');
    const pasteBtn = document.getElementById('paste-btn');
    
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
        } catch (error) {
            console.error('Error:', error);
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

    // File Manager
    let currentDirectory = '.';
    let filesToMove = [];

    function updateFileActionButtons() {
        const checkedBoxes = document.querySelectorAll('.file-checkbox:checked');
        cutBtn.style.display = checkedBoxes.length > 0 ? 'inline-block' : 'none';
        pasteBtn.style.display = filesToMove.length > 0 ? 'inline-block' : 'none';
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
            console.log(`Cut ${filesToMove.length} item(s). Navigate to a new directory and click 'Paste Here'.`);
            checkedBoxes.forEach(box => box.checked = false);
            updateFileActionButtons();
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

    fileUploadInput.addEventListener('change', () => {
        chosenFile.textContent = fileUploadInput.files[0] ? fileUploadInput.files[0].name : '';
    });

    uploadBtn.addEventListener('click', async () => {
        const file = fileUploadInput.files[0];
        const destination = uploadDestSelect.value;
        if (!file) {
            alert('Please select a file to upload.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('destination', destination);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });
            const result = await response.json();
            console.log(result.message);
            if(result.status === 'success') {
                fetchFiles(currentDirectory);
                fileUploadInput.value = '';
                chosenFile.textContent = '';
            }
        } catch(error) {
            console.error('Upload Error:', error);
            alert('An error occurred during upload.');
        }
    });

    fetchFiles(currentDirectory);
});
