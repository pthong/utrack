'use strict';
const fs = require('node:fs');
const path = require('node:path');
const DEFAULT_COLORS = { background: '#f7f8f5', surface: '#ffffff', text: '#26302e', muted: '#78817f', border: '#e6e9e5', accent: '#53684e', highlight: '#edf1e9', danger: '#a43b3b' };
function validateAppearance(input) {
  if (!input || !['light', 'dark', 'custom'].includes(input.theme)) throw new Error('Kies een geldig thema.');
  const colors = { ...DEFAULT_COLORS };
  for (const key of Object.keys(colors)) {
    const value = input.colors?.[key] ?? colors[key];
    if (!/^#[a-f0-9]{6}$/i.test(value)) throw new Error('Kies geldige kleuren.');
    colors[key] = value;
  }
  const texts = {};
  if (input.texts && (typeof input.texts !== 'object' || Array.isArray(input.texts))) throw new Error('Ongeldige standaardteksten.');
  for (const [key, value] of Object.entries(input.texts || {})) {
    if (key.length > 4000 || typeof value !== 'string' || value.length > 4000 || Object.keys(texts).length >= 2000) throw new Error('Een aangepaste tekst is te lang.');
    if (value !== key) Object.defineProperty(texts, key, { value, enumerable: true });
  }
  return { theme: input.theme, colors, texts };
}
function readPreferences(folder) {
  const file = path.join(folder, 'voorkeuren.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}
function writePreferences(folder, patch) {
  const preferences = { ...readPreferences(folder), ...patch };
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, 'voorkeuren.json');
  fs.writeFileSync(file + '.tmp', JSON.stringify(preferences, null, 2));
  fs.renameSync(file + '.tmp', file);
  return preferences;
}
module.exports = { DEFAULT_COLORS, validateAppearance, readPreferences, writePreferences };
