'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { UTrackStorage } = require('./storage');
const { DEFAULT_COLORS, validateAppearance, readPreferences, writePreferences } = require('./preferences');
app.setName('u-track');
app.setPath('userData', path.join(app.getPath('appData'), 'u-track'));
let mainWindow, storage;
const smokeTest = process.argv.includes('--smoke-test');
const testMode = smokeTest || process.argv.includes('--test-data');
if (testMode) app.setPath('userData', path.join(process.env.UTRACK_TEST_ROOT, 'app-settings'));
protocol.registerSchemesAsPrivileged([{ scheme: 'u-track', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  app.whenReady().then(initializeApplication).catch(error => { dialog.showErrorBox('u-track kan niet starten', error.message); app.quit(); });
}
function readDataFolderPreference() {
  return readPreferences(app.getPath('userData')).dataFolder || (testMode ? process.env.UTRACK_TEST_ROOT : path.join(app.getPath('documents'), 'u-track'));
}

function registerAction(name, handler) {
  ipcMain.handle(name, async (event, input) => {
    if (event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Geen toegang.');
    try { return { ok: true, value: await handler(input) }; }
    catch (error) { return { ok: false, error: error.message }; }
  });
}
async function initializeApplication() {
  storage = new UTrackStorage(readDataFolderPreference());
  protocol.handle('u-track', request => {
    const url = new URL(request.url);
    const assets = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css', '/settings.js': 'settings.js', '/text-defaults.js': 'text-defaults.js' };
    const file = url.host === 'app' && assets[url.pathname];
    return file ? net.fetch(pathToFileURL(path.join(__dirname, file)).href) : new Response('Niet gevonden', { status: 404 });
  });
  registerAction('load-preferences', () => ({ theme: 'light', colors: DEFAULT_COLORS, texts: {}, ...readPreferences(app.getPath('userData')), dataFolder: storage.rootPath }));
  registerAction('save-preferences', input => { const appearance = validateAppearance(input); writePreferences(app.getPath('userData'), appearance); return appearance; });
  registerAction('load-data', () => { storage.synchronizeGroupObjectFiles(); return storage.getSnapshot(); });
  registerAction('save-object', input => storage.saveObject(input));
  registerAction('save-group', input => storage.saveGroup(input));
  registerAction('delete-group', groupId => storage.deleteGroup(groupId));
  registerAction('reorder-groups', input => storage.reorderGroups(input));
  registerAction('save-note', input => storage.saveNote(input));
  registerAction('delete-note', input => storage.deleteNote(input));
  registerAction('open-data-folder', async () => { const error = await shell.openPath(storage.rootPath); if (error) throw new Error(error); });
  registerAction('choose-data-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { title: 'Open een gegevensmap (bestaande gegevens blijven in hun huidige map)', properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled) return null;
    const next = new UTrackStorage(result.filePaths[0]);
    writePreferences(app.getPath('userData'), { dataFolder: next.rootPath });
    storage = next;
    return storage.getSnapshot();
  });
  createMainWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
}
function createMainWindow() {
  mainWindow = new BrowserWindow({ title: 'u-track', width: 1380, height: 900, minWidth: 980, minHeight: 640,
    backgroundColor: '#f8f9fb', icon: path.join(__dirname, 'icon.png'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  mainWindow.removeMenu();
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', event => event.preventDefault());
  mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  mainWindow.loadURL('u-track://app/');
  if (smokeTest) mainWindow.webContents.once('did-finish-load', async () => {
    try {
      const result = await mainWindow.webContents.executeJavaScript(`document.title + '|' + Boolean(window.uTrack) + '|' + document.querySelector('h1').textContent`);
      console.log('SMOKE_TEST_OK', result);
      fs.writeFileSync(path.join(process.env.UTRACK_TEST_ROOT, 'screenshot.png'), (await mainWindow.webContents.capturePage()).toPNG());
      app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
  });
}
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
