## 0.12.17 - Release
- Fixed error reported in "Image view doesn't work". The transfer mode has been changed from utf8 to binary mode. (issue-58)

## 0.12.16 - Release
- Fixed error reported in "Permissions change after save" (issue-205)
- Fixed error reported in "Files do not open after update" (issue-206)

## 0.12.15 - Release
- Ignore - Error occurred during publishing

## 0.12.14 - Release
- Fixed error reported in "fs is not defined" (issue-203)

## 0.12.13 - Release
- Feature request: "Configuration view - Duplicate Server" (issue-77)
- Feature request: "Change permissions of a file" (issue-137)
- Fixed error reported in "Uncaught Error: EEXIST: file already exists, mkdir '~/AppData\Local\Temp\8bfa6933\159.65.146.12\v...'" (issue-192)
- Fixed error reported in "Uncaught TypeError: Cannot read property 'constructor' of undefined" (issue-164)
- Fixed error reported in "Uncaught RangeError: Maximum call stack size exceeded" (issue-180)
- Feature request: "Stop bottom pane from opening on upload" (issue-199)

## 0.12.12 - Release
- Feature request: "Option for double-click on treeview" (issue-171)
- Feature request: "Toggle on atom startup" (issue-168)
- Fixed error reported in "Uncaught TypeError: Cannot read property 'replace' of undefined!" (issue-173)
- Fixed error reported in "Uncaught SyntaxError: Unexpected token  in JSON at position 0" (issue-44)
- Fixed error reported in "Files don't load after being left for a while" (issue-163)

## 0.12.11 - Release
- Fixed error reported in "Unable to open after upgrade to 0.12.10" (issue-172)

## 0.12.10 - Release
- Fixed error reported in "Object.add is deprecated" (issue-161)
- Feature request: "Auto Reveal Active file in Tree" (issue-158)
- Feature request: "Open from command line" (issue-165)

## 0.12.9 - Release
- Prepare 0.12.9 release

## 0.12.8 - Release
- Fixed error reported in "Disable/Hide FTP Message Log in config" (issue-117)
- Fixed error reported in "Encoding when saving file to remote always utf-8" (issue-155)

## 0.12.7 - Release
- Feature request: "Support for file-icons package" (issue-125)
- Feature request: "Fuzzy finder for remote files" (issue-109)
- Fixed error reported in "Path to private keyfile not editable" (issue-48)
- Fixed error reported in "Cannot connect to servers after resuming from suspend" (issue-76)
- Fixed error reported in "Not able to get directory listing for regular FTP to an IBM i (or AS/400 or iSeries)" (issue-123)

## 0.12.6 - Release
- Update dependencies (minimatch)
- Fixed error reported in "Adding New Server" (issue-131)
- Fixed error reported in "Cannot Delete Server" (issue-129)

## 0.12.5 - Release
- Fixed error reported in "Uncaught ReferenceError: fs is not defined" (issue-122)

## 0.12.4 - Release
- Feature request: Option "Sort Servers By Name" (issue-106)
- Fix error reported in "Uncaught TypeError: Cannot read property 'collapse' of undefined..." (issue-119)
- Fix error reported in "Can't open multiple files with same path" (issue-114)

## 0.12.3 - Release
- Fix error reported in "Uncaught ReferenceError: reject is not defined" (issue-107)
- Fix error reported in "Unknown command" (issue-101)

## 0.12.2 - Release
- Fix error reported in "Uncaught Error: No transfer timeout (180 seconds): closing control connection" (issue-105)
- Fix error reported in "Uncaught Error: Timed out while waiting for handshake" (issue-102)
- Fix error reported in "Uncaught Error: All configured authentication methods failed" (issue-100)
- Fix deprecated message reported in "Object.add is deprecated" (issue-98)

## 0.12.1 - Release
- Fix error reported in "Failed to load the ftp-remote-edit package" (issue-97)

## 0.12.0 - Release
- Added Option "Open in Atom Dock" - Open the view as tab in atom dock instead of panel. Only available from Atom 1.17.0
- Added FTP Message Log - Shows sent/received FTP commands in log
- Changed refreshing behavior of the TreeView
- Feature request: Drag-and-Drop (issue-25)
- Feature request: Copy / Cut / Paste files (issue-24)
- Feature request: Rename copied file if exists to prevent collision of names (issue-61)
- Feature request: Statusbar for upload/download (issue-69)
- Feature request: Option "Disable Notification on save/upload" (issue-55)
- Feature request: Option "Hide Ignored Names" (issue-78)
- Feature request: Option "Opening hidden files" (e.g. htaccess) (issue-66)
- Feature request: Preview opened file in pending pane to have the same behavior than in Atom (issue-83)
- Fixed error reported in "Refreshing directory when moving a file using Rename" (issue-51)

## 0.11.9 - Release
- Fixed error reported in "Image view doesn't work" (issue-58)
- Fixed error reported in "Undo just opened file" (issue-62)
- Fixed error reported in "Uncaught SyntaxError: Unexpected token ? in JSON at position 0" (issue-44)

## 0.11.8 - Release
- Fixed error while creating a folder (issue-32)
- Fixed error while renaming a file/folder (issue-42)

## 0.11.7 - Release
- Feature request: Added hotkey for toggling "ctrl+space" (issue-37)
- Hide password in server settings (issue-36)

## 0.11.6 - Release
- Added Option to enable debug mode
- Fixed error reported in "Unsyncing after idle" (issue-28)

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
- Feature request: Added setting to define path for ssh/sftp private keyfile

## 0.10.0 - Release
- Feature request: Added setting to define initial directory.

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
- Fix errors
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
