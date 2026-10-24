'use strict';
// Build a Debian/Ubuntu installer from the installed Electron distribution.
// The installed sandbox helper is owned by root and has mode 4755.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const projectPath = path.resolve(__dirname, '..');
const packageInfo = require('../package.json');
const outputPath = path.resolve(process.argv[2] || path.join(projectPath, 'release'));
if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('Dit bouwscript maakt een Ubuntu/Debian-pakket op Linux x64.');
const stagePath = fs.mkdtempSync(path.join(os.tmpdir(), 'u-track-deb-'));
try {
  const applicationPath = path.join(stagePath, 'opt', 'u-track');
  const electronPath = path.dirname(require('electron'));
  fs.cpSync(electronPath, applicationPath, { recursive: true });
  fs.renameSync(path.join(applicationPath, 'electron'), path.join(applicationPath, 'u-track'));
  fs.renameSync(path.join(applicationPath, 'LICENSE'), path.join(applicationPath, 'LICENSE.electron'));
  fs.chmodSync(path.join(applicationPath, 'chrome-sandbox'), 0o4755);
  fs.rmSync(path.join(applicationPath, 'resources', 'default_app.asar'), { force: true });
  const appPath = path.join(applicationPath, 'resources', 'app');
  fs.mkdirSync(appPath, { recursive: true });
  fs.cpSync(path.join(projectPath, 'src'), path.join(appPath, 'src'), { recursive: true });
  for (const name of ['package.json', 'README.md']) fs.copyFileSync(path.join(projectPath, name), path.join(appPath, name));
  if (fs.existsSync(path.join(projectPath, 'LICENSE'))) fs.copyFileSync(path.join(projectPath, 'LICENSE'), path.join(appPath, 'LICENSE'));
  const desktopPath = path.join(stagePath, 'usr', 'share', 'applications');
  const iconPath = path.join(stagePath, 'usr', 'share', 'icons', 'hicolor', 'scalable', 'apps');
  fs.mkdirSync(desktopPath, { recursive: true }); fs.mkdirSync(iconPath, { recursive: true });
  fs.writeFileSync(path.join(desktopPath, 'u-track.desktop'), `[Desktop Entry]\nName=u-track\nComment=Onderwerpen, categorieën en Markdown-notities\nExec=/opt/u-track/u-track %U\nIcon=u-track\nTerminal=false\nType=Application\nCategories=Office;Utility;\nStartupWMClass=u-track\n`);
  fs.copyFileSync(path.join(projectPath, 'src', 'icon.svg'), path.join(iconPath, 'u-track.svg'));
  const controlPath = path.join(stagePath, 'DEBIAN'); fs.mkdirSync(controlPath);
  fs.writeFileSync(path.join(controlPath, 'control'), `Package: u-track\nVersion: ${packageInfo.version}\nSection: utils\nPriority: optional\nArchitecture: amd64\nMaintainer: u-track <noreply@example.invalid>\nDepends: libgtk-3-0 | libgtk-3-0t64, libnss3, libxss1, libasound2 | libasound2t64, libgbm1, libatk-bridge2.0-0 | libatk-bridge2.0-0t64, libdrm2, libxkbcommon0\nDescription: Lokale onderwerpen, categorieën en Markdown-notities\n Beheer onderwerpen en personen in categorieën met CSV en Markdown.\n`);
  fs.mkdirSync(outputPath, { recursive: true });
  const target = path.join(outputPath, `u-track_${packageInfo.version}_amd64.deb`);
  execFileSync('dpkg-deb', ['--root-owner-group', '-Zgzip', '-z6', '--build', stagePath, target], { stdio: 'inherit' });
  console.log(target);
} finally { fs.rmSync(stagePath, { recursive: true, force: true }); }
