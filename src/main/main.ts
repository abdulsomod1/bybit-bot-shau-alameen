
import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  dialog,
  shell,
  Notification,
} from 'electron';
import * as path from 'path';
import log from 'electron-log';

import { registerIpcHandlers } from './ipc-handlers';
import {
  startDatabase,
  getAppSettings,
} from './services/database';
import {
  startBotWorker,
  stopBotWorker,
} from './services/bot-worker';

log.transports.file.level = 'info';
log.transports.console.level = 'debug';
log.transports.file.resolvePathFn = () =>
  path.join(app.getPath('userData'), 'logs', 'main.log');

log.info('Application starting...');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const isDev = !app.isPackaged;

async function createWindow(): Promise<void> {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
    return;
  }

  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js'),
      sandbox: false,
    },
    titleBarStyle: 'default',
  });

  mainWindow = window;

  // Fallback: ensure window is shown even if ready-to-show doesn't fire
  // This fixes the blank page issue on reload
  const showFallback = setTimeout(() => {
    if (!window.isDestroyed() && !window.isVisible()) {
      log.warn('ready-to-show timeout - showing window anyway');
      window.show();
      window.focus();
    }
  }, 5000); // 5 second fallback

  window.once('ready-to-show', () => {
    clearTimeout(showFallback);
    if (!window.isDestroyed()) {
      window.show();
      window.focus();
      log.info('Main window shown');
    }
  });

  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      log.error(
        'Window failed to load:',
        errorCode,
        errorDescription,
        validatedURL
      );
    }
  );

  window.webContents.on('did-finish-load', () => {
    log.info('Window finished loading:', window.webContents.getURL());
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    log.error('Renderer process stopped:', details);
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url).catch((error) => {
      log.error('Could not open external link:', error);
    });

    return { action: 'deny' };
  });

  try {
    if (isDev) {
      const devUrl = 'http://localhost:5173';
      log.info('Loading development frontend at ' + devUrl);
      window.webContents.on('did-fail-load', (_event, code, desc) => {
        log.error('Frontend load failed: [' + code + '] ' + desc + ' — URL: ' + devUrl);
      });
      await window.loadURL(devUrl);
      window.webContents.openDevTools();
    } else {
      const frontendPath = path.join(
        __dirname,
        '../renderer/index.html'
      );
      log.info('Loading production frontend:', frontendPath);
      await window.loadFile(frontendPath);
    }

    log.info('Frontend loaded successfully');
  } catch (error) {
    log.error('Failed to load frontend:', error);

    if (!window.isDestroyed()) {
      window.show();

      dialog.showErrorBox(
        'Window Loading Error',
        `The application window could not load the frontend.\n\n${String(error)}`
      );
    }
  }

  window.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      window.hide();

      if (Notification.isSupported()) {
        new Notification({
          title: 'Bybit P2P Bot',
          body: 'The application is still running in the system tray.',
        }).show();
      }
    }
  });

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });
}

function createTray(): void {
  if (tray) {
    return;
  }

  try {
    const iconPath = path.join(__dirname, 'icon.png');
    const icon = nativeImage.createFromPath(iconPath);

    if (icon.isEmpty()) {
      log.warn(
        'Tray icon not found at ' +
          iconPath +
          '. The system tray icon was not created.'
      );
      return;
    }

    tray = new Tray(icon);
    tray.setToolTip('Bybit P2P Bot');

    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: 'Open Bybit P2P Bot',
          click: () => {
            void createWindow();
          },
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ])
    );

    tray.on('double-click', () => {
      void createWindow();
    });

    log.info('System tray created');
  } catch (error) {
    log.error('Failed to create system tray:', error);
  }
}

app.whenReady().then(async () => {
  log.info('Electron is ready');

  // Create the window first so database startup cannot prevent
  // the initial attempt to display the application.
  await createWindow();

  // Initialize the database.
  try {
    await startDatabase();
    log.info('Database started successfully');
  } catch (error) {
    log.error('Database startup failed:', error);
  }

  // Register the IPC handlers used by the renderer.
  try {
    registerIpcHandlers();
    log.info('IPC handlers registered');
  } catch (error) {
    log.error('IPC registration failed:', error);
  }

  // Load settings and start the bot worker.
  try {
    await getAppSettings();
    log.info('Application settings loaded');

    await startBotWorker();
    log.info('Bot worker started');
  } catch (error) {
    log.error('Bot worker or settings startup failed:', error);
  }

  createTray();

  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      void createWindow();
    } else {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }

      mainWindow.show();
      mainWindow.focus();
    }
  });
}).catch((error: unknown) => {
  log.error('Electron startup failed:', error);

  dialog.showErrorBox(
    'Startup Error',
    `The application could not start correctly.\n\n${String(error)}`
  );
});

app.on('before-quit', () => {
  isQuitting = true;

  try {
    stopBotWorker();
    log.info('Bot worker stop requested');
  } catch (error) {
    log.error('Error while stopping bot worker:', error);
  }
});

app.on('window-all-closed', () => {
  // On Windows, keep running in the tray until the user selects Quit.
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit();
  }
});

process.on('uncaughtException', (error: Error) => {
  log.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason: unknown) => {
  log.error('Unhandled promise rejection:', reason);
});
