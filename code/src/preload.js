'use strict';
const { contextBridge, ipcRenderer } = require('electron');
async function invokeAction(channel, input) {
  const response = await ipcRenderer.invoke(channel, input);
  if (!response.ok) throw new Error(response.error);
  return response.value;
}
contextBridge.exposeInMainWorld('uTrack', {
  loadPreferences: () => invokeAction('load-preferences'),
  savePreferences: input => invokeAction('save-preferences', input),
  loadData: () => invokeAction('load-data'),
  saveObject: input => invokeAction('save-object', input),
  saveGroup: input => invokeAction('save-group', input),
  deleteGroup: groupId => invokeAction('delete-group', groupId),
  reorderGroups: groupIds => invokeAction('reorder-groups', groupIds),
  saveNote: input => invokeAction('save-note', input),
  deleteNote: input => invokeAction('delete-note', input),
  openDataFolder: () => invokeAction('open-data-folder'),
  chooseDataFolder: () => invokeAction('choose-data-folder')
});
