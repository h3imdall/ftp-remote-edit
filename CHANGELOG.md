## 0.11.5 - Release
- Checks connection status everytime the "connect" function is called. Fixes issue on sftp "keep connection alive" error. (issue-28)

## 0.11.4 - Release
- Added dialog to change the password. To open run command "ftp-remote-edit:change-password". Empty password caused error and will no longer be accepted.

## 0.11.3 - Release
- Fixed error while creating a folder (issue-20)
- Improved speed by keeping the connections open

## 0.11.2 - Release
- The path in the dialogs is now corrected so that it corresponds to the schema. Spaces within the path caused errors.

## 0.11.1 - Release
- Fixed styles for light theme (issue-17)

## 0.11.0 - Release
- Added setting to define path for ssh/sftp private keyfile

## 0.10.0 - Release
- Added setting to define initial directory.

## 0.9.0 - Release
- New action "ftp-remote-edit: find" added to search in tree for a folder

## 0.8.0 - Release
- Refactoring of the complete source code
- Added UI like TreeView
- Added Keyboard Navigation
- Added function to remember the password during the session
- Added promises for ftp and sftp classes
- Extends settings (sortFoldersBeforeFiles, showOnRightSide)

## 0.7.0 - Release
- Fix erros
- Refactoring

## 0.6.0 - Release
- Error and file saved response implemented

## 0.5.0 - Release
- Better configuration interface

## 0.4.0 - Release
- Sftp integrated

## 0.3.0 - Release
- Added function new file, new directory, delete file, delete directory, rename file and rename directory.

## 0.2.0 - Release
- Better usability

## 0.1.0 - Release
- First Release
