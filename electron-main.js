const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let serverProcess;
let mainWindow;

// Get the app path
function getAppPath() {
    return app.getAppPath();
}

// Check if server is running
function checkServerRunning(callback) {
    const http = require('http');
    const options = {
        host: 'localhost',
        port: 3000,
        path: '/',
        timeout: 2000
    };
    
    const req = http.get(options, (res) => {
        callback(true);
    });
    
    req.on('error', () => {
        callback(false);
    });
    
    req.end();
}

function startServer() {
    const isDev = process.env.NODE_ENV === 'development';
    const serverPath = path.join(__dirname, 'server.js');
    
    console.log('Starting server from:', serverPath);
    
    // Check if server file exists
    if (!fs.existsSync(serverPath)) {
        dialog.showErrorBox('File Error', 'server.js not found. Please check your installation.');
        return;
    }
    
    serverProcess = spawn('node', [serverPath], {
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, NODE_ENV: 'production' },
        windowsHide: false
    });

    serverProcess.on('error', (err) => {
        console.error('Failed to start server:', err);
        dialog.showErrorBox('Server Error', 'Failed to start the chat server. Please check your installation.');
    });

    serverProcess.on('exit', (code) => {
        console.log('Server process exited with code:', code);
        if (code !== 0) {
            dialog.showErrorBox('Server Error', `Server crashed with exit code: ${code}`);
        }
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        icon: path.join(__dirname, 'public', 'favicon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false // Enable if you have CORS issues
        },
        title: 'Private Chat',
        backgroundColor: '#1a1a2e',
        show: false // Don't show until ready
    });

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Create menu
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Exit',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Reload',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => {
                        mainWindow.reload();
                    }
                },
                {
                    label: 'Toggle Developer Tools',
                    accelerator: 'CmdOrCtrl+Shift+I',
                    click: () => {
                        mainWindow.webContents.toggleDevTools();
                    }
                },
                {
                    label: 'Zoom In',
                    accelerator: 'CmdOrCtrl+=',
                    click: () => {
                        mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 0.5);
                    }
                },
                {
                    label: 'Zoom Out',
                    accelerator: 'CmdOrCtrl+-',
                    click: () => {
                        mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - 0.5);
                    }
                },
                {
                    label: 'Reset Zoom',
                    accelerator: 'CmdOrCtrl+0',
                    click: () => {
                        mainWindow.webContents.setZoomLevel(0);
                    }
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About Private Chat',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            title: 'About Private Chat',
                            message: 'Private Chat v1.0.0\n\nSecure messaging with your friends!\n\nDeveloped by Sreeram',
                            icon: path.join(__dirname, 'public', 'favicon.ico'),
                            buttons: ['OK']
                        });
                    }
                },
                {
                    label: 'GitHub Repository',
                    click: () => {
                        shell.openExternal('https://github.com/sreeram852007/private-chat');
                    }
                }
            ]
        }
    ];

    // Add Developer menu if in development mode
    if (process.env.NODE_ENV === 'development') {
        template.push({
            label: 'Developer',
            submenu: [
                {
                    label: 'Open Dev Tools',
                    accelerator: 'F12',
                    click: () => {
                        mainWindow.webContents.toggleDevTools();
                    }
                },
                {
                    label: 'Force Reload',
                    accelerator: 'CmdOrCtrl+Shift+R',
                    click: () => {
                        mainWindow.webContents.reloadIgnoringCache();
                    }
                }
            ]
        });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    // Retry loading URL with timeout
    let retryCount = 0;
    const maxRetries = 5;
    
    function loadURL() {
        mainWindow.loadURL('http://localhost:3000').catch((err) => {
            console.error('Failed to load URL:', err);
            retryCount++;
            
            if (retryCount < maxRetries) {
                setTimeout(loadURL, 2000);
            } else {
                dialog.showErrorBox('Connection Error', 
                    'Failed to connect to the chat server after multiple attempts.\n\n' +
                    'Please check:\n' +
                    '1. If server.js is present\n' +
                    '2. If port 3000 is available\n' +
                    '3. If dependencies are installed'
                );
            }
        });
    }
    
    // Wait for server to start then load URL
    setTimeout(() => {
        loadURL();
    }, 2000);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Handle external links (open in default browser)
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Handle certificate errors
    mainWindow.webContents.on('certificate-error', (event, url, error, certificate, callback) => {
        event.preventDefault();
        callback(true);
    });
}

// Application ready
app.whenReady().then(() => {
    startServer();
    createWindow();
});

app.on('window-all-closed', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});

app.on('will-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});

// Handle single instance (only one instance of app)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    dialog.showErrorBox('Application Error', 
        'An unexpected error occurred:\n\n' + error.message
    );
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});

// Export for testing
module.exports = { app, startServer, createWindow };