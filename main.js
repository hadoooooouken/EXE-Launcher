const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

let mainWindow;
let autoStartProcess = null;
const configPath = path.join(app.getPath('userData'), 'config.json');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 650,
    height: 210,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    resizable: false,
    autoHideMenuBar: true
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  const config = loadConfig();
  if (config.autoStart && config.filePath && fs.existsSync(config.filePath)) {
    autoStartProcess = execFile(config.filePath, (error) => {
      if (error) console.error('Auto-run error:', error);
    });
    
    if (config.autoClose) {
      setTimeout(() => {
        if (autoStartProcess && !autoStartProcess.killed) {
          autoStartProcess.kill();
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.close();
        }
      }, 2000);
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.error('Config load error:', e);
  }
  return { filePath: '', autoStart: false, autoClose: false, startup: false };
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config), 'utf8');
}

ipcMain.on('select-file', (event) => {
  dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Executable', extensions: ['exe'] }]
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      event.reply('file-selected', result.filePaths[0]);
    }
  });
});

ipcMain.on('save-config', (event, config) => {
  saveConfig(config);
});

ipcMain.on('run-exe', (event, filePath) => {
  execFile(filePath, (error) => {
    event.reply('run-result', error ? error.message : 'success');
  });
});

ipcMain.on('load-config', (event) => {
  event.reply('config-loaded', loadConfig());
});

ipcMain.on('set-startup', (event, enabled) => {
  setAutoLaunch(enabled);
});

function setAutoLaunch(enabled) {
  const appPath = process.execPath;
  const appName = app.getName();
  
  const { exec } = require('child_process');
  
  if (enabled) {
    // Add to Windows startup
    const command = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${appName}" /t REG_SZ /d "${appPath}" /f`;
    exec(command, (error) => {
      if (error) {
        console.error('Failed to add to startup:', error);
      }
    });
  } else {
    // Remove from Windows startup
    const command = `reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${appName}" /f`;
    exec(command, (error) => {
      if (error && !error.message.includes('The system was unable to find the specified registry key or value')) {
        console.error('Failed to remove from startup:', error);
      }
    });
  }
}