
## 0.16.3
- Feature request: "FTP with TLS/SSL encryption" (issue-45)

## 0.16.2
- Enhancement: Add debug log for sftp connections

## 0.16.1
- Fix error reported in "Import .ftpconfig - Unknown file format" (issue-293)
- Fix error reported in "Import from filezilla - Remote dir doesn't work right" (issue-292)

## 0.16.0
- Feature request: "Add tab order/index on 'Edit Servers'" (issue-279)
- Feature request: "Import from FileZilla" (issue-49)
- Enhancement: Import from FileZilla, Remote-ftp, PHP Storm config file (PR-272)
- Enhancement: Small correction for temp servers - keep them after adding one to config (PR-285)
- Enhancement: Allow to select default path for download and upload (PR-286)
- Enhancement: Add migration from outdated ftp-remote-edit-plus package

## 0.15.2
- Fix error reported in "Can't duplicate files since 0.15.0" (issue-282)
- Fix error in context menu. Remove wrong actions for folders

## 0.15.1
- Fix error reported in "Edit Servers` button and message always appear" (issue-280)

## 0.15.0
- Feature request: "Allow to reload opened file from context menu" (issue-239)
- Enhancement: Allow to reload opened directory from context menu
- Enhancement: Allow to download file/directory from context menu (PR-267)
- Enhancement: Allow to download file/directory from context menu (PR-268)
- Enhancement: Add option to remove temp. server added by the URI handler from tree view (PR-274)

## 0.14.2
- Fix error reported in "'toggle panel' without closing tree view" (issue-271)

## 0.14.1
- Enhancement: Extends the URI handler so that you can use HTML entities in the credentials (PR-265)
- Enhancement: Add option to permanently store temp. server added by the URI handler in the config (PR-266)
- Enhancement: Mark temp. server added by the URI handler with a different color
- Fix error reported in "Uncaught TypeError: Cannot read property '0' of undefined" (issue-269)

## 0.14.0
- Enhancement: Grouping servers (PR-252)
- Enhancement: Fix styles for Atom material UI theme (issue-261)
- Feature request: "Grouping servers." (issue-72)

## 0.13.6
- Enhancement: Integrate ssh2 sftp client into plugin to fix dependency update errors without git installed
- Fix error reported in "Problem updating from 0.13.4 to 0.13.5" (issue-260)

## 0.13.5
- Fix error reported in "Connection ends when ftp open for a while" (issue-258)
- Fix error reported in "Support for TCP Keepalive" (issue-204)
- Fix error reported in "Can't open files en SFTP after updating" (issue-257)
- Enhancement: Fix error for remote keyboard navigation

## 0.13.4
- Enhancement: Restore keyboard shortcuts from 0.12.23
- Enhancement: Add more debug messages for "get" function to find error for issue-257

## 0.13.3
- Enhancement: Unfavorable shortcut (cmd + space) for macOS (issue-256)
- Enhancement: Some correction of URI handler, add auto toggle on using URI handler (PR-253)

## 0.13.2
- Downgrade @icetee/ftp to 0.3.11 to prevent EPSV (unknown command) error on Pure-FTPd server
- Fix error reported in "Add option to duplicate files." (issue-248)

## 0.13.1 - Release
- Downgrade @icetee/ftp to 0.3.15 to prevent EPSV (unknown command) error on Pure-FTPd server
- Fix error reported in "Connection Issue - Unknown command" (issue-254)

## 0.13.0 - Release
- Enhancement: Refactoring of the complete source code
- Enhancement: Updating of all dependencies
- Enhancement: Optimize configuration view for small screens and add option to duplicate servers
- Enhancement: Optimize support for default atom themes
- Enhancement: Optimize rename/duplicate dialogs (path preselection)
- Enhancement: Optimize context menu
- Enhancement: Speed up auto reveal active file by adding visibility checking
- Enhancement: Add Upload of files (drag/drop from outside of atom)
- Enhancement: Add Upload of directories (drag/drop from outside of atom)
- Feature request: "Add option to duplicate files." (issue-248)
- Feature request: "Add keyboard shortcuts for context-menu actions" (issue-250)
- Feature request: "Copy local folder/file into remote server" (issue-#138)

## 0.12.23 - Release
- Enhancement: Extend URI handler to allow path parameter (PR-245, issue-244)
- Enhancement: Correct sorting on treeview by alphabet, ignoring lower/upper case characters (PR-246)

## 0.12.22 - Release
- Enhancement: Add suppport for agent based authentication (PR-241, issue-143)

## 0.12.21 - Release
- Fix errors

## 0.12.20 - Release
- Enhancement: Add providers for opening files and getting server config (PR-228)
- Enhancement: More descriptive pane item names (PR-229)

## 0.12.19 - Release
- Fix error reported in "Empty files on server after save" (issue-220)

## 0.12.18 - Release
- Enhancement: Corrected URI handler allowing special characters in login and password. (PR-215)

## 0.12.17 - Release
- Fix error reported in "Image view doesn't work". The transfer mode has been changed from utf8 to binary mode. (issue-58)

## 0.12.16 - Release
- Fix error reported in "Permissions change after save" (issue-205)
- Fix error reported in "Files do not open after update" (issue-206)

## 0.12.15 - Release
- Ignore - Error occurred during publishing

## 0.12.14 - Release
- Fix error reported in "fs is not defined" (issue-203)

## 0.12.13 - Release
- Feature request: "Configuration view - Duplicate Server" (issue-77)
- Feature request: "Change permissions of a file" (issue-137)
- Fix error reported in "Uncaught Error: EEXIST: file already exists, mkdir '~/AppData\Local\Temp\8bfa6933\159.65.146.12\v...'" (issue-192)
- Fix error reported in "Uncaught TypeError: Cannot read property 'constructor' of undefined" (issue-164)
- Fix error reported in "Uncaught RangeError: Maximum call stack size exceeded" (issue-180)
- Feature request: "Stop bottom pane from opening on upload" (issue-199)

## 0.12.12 - Release
- Feature request: "Option for double-click on treeview" (issue-171)
- Feature request: "Toggle on atom startup" (issue-168)
- Fix error reported in "Uncaught TypeError: Cannot read property 'replace' of undefined!" (issue-173)
- Fix error reported in "Uncaught SyntaxError: Unexpected token  in JSON at position 0" (issue-44)
- Fix error reported in "Files don't load after being left for a while" (issue-163)

## 0.12.11 - Release
- Fix error reported in "Unable to open after upgrade to 0.12.10" (issue-172)

## 0.12.10 - Release
- Fix error reported in "Object.add is deprecated" (issue-161)
- Feature request: "Auto Reveal Active file in Tree" (issue-158)
- Feature request: "Open from command line" (issue-165)

## 0.12.9 - Release
- Prepare 0.12.9 release

## 0.12.8 - Release
- Fix error reported in "Disable/Hide FTP Message Log in config" (issue-117)
- Fix error reported in "Encoding when saving file to remote always utf-8" (issue-155)

## 0.12.7 - Release
- Feature request: "Support for file-icons package" (issue-125)
- Feature request: "Fuzzy finder for remote files" (issue-109)
- Fix error reported in "Path to private keyfile not editable" (issue-48)
- Fix error reported in "Cannot connect to servers after resuming from suspend" (issue-76)
- Fix error reported in "Not able to get directory listing for regular FTP to an IBM i (or AS/400 or iSeries)" (issue-123)

## 0.12.6 - Release
- Update dependencies (minimatch)
- Fix error reported in "Adding New Server" (issue-131)
- Fix error reported in "Cannot Delete Server" (issue-129)

## 0.12.5 - Release
- Fix error reported in "Uncaught ReferenceError: fs is not defined" (issue-122)

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
- Add Option "Open in Atom Dock" - Open the view as tab in atom dock instead of panel. Only available from Atom 1.17.0
- Add FTP Message Log - Shows sent/received FTP commands in log
- Changed refreshing behavior of the TreeView
- Feature request: Drag-and-Drop (issue-25)
- Feature request: Copy / Cut / Paste files (issue-24)
- Feature request: Rename copied file if exists to prevent collision of names (issue-61)
- Feature request: Statusbar for upload/download (issue-69)
- Feature request: Option "Disable Notification on save/upload" (issue-55)
- Feature request: Option "Hide Ignored Names" (issue-78)
- Feature request: Option "Opening hidden files" (e.g. htaccess) (issue-66)
- Feature request: Preview opened file in pending pane to have the same behavior than in Atom (issue-83)
- Fix error reported in "Refreshing directory when moving a file using Rename" (issue-51)

## 0.11.9 - Release
- Fix error reported in "Image view doesn't work" (issue-58)
- Fix error reported in "Undo just opened file" (issue-62)
- Fix error reported in "Uncaught SyntaxError: Unexpected token ? in JSON at position 0" (issue-44)

## 0.11.8 - Release
- Fix error while creating a folder (issue-32)
- Fix error while renaming a file/folder (issue-42)

## 0.11.7 - Release
- Feature request: Added hotkey for toggling "ctrl+space" (issue-37)
- Hide password in server settings (issue-36)

## 0.11.6 - Release
- Add Option to enable debug mode
- Fix error reported in "Unsyncing after idle" (issue-28)

## 0.11.5 - Release
- Checks connection status everytime the "connect" function is called. Fixes issue on sftp "keep connection alive" error. (issue-28)

## 0.11.4 - Release
- Add dialog to change the password. To open run command "ftp-remote-edit:change-password". Empty password caused error and will no longer be accepted.

## 0.11.3 - Release
- Fix error while creating a folder (issue-20)
- Improve speed by keeping the connections open

## 0.11.2 - Release
- The path in the dialogs is now corrected so that it corresponds to the schema. Spaces within the path caused errors.

## 0.11.1 - Release
- Fix styles for light theme (issue-17)

## 0.11.0 - Release
- Feature request: Added setting to define path for ssh/sftp private keyfile

## 0.10.0 - Release
- Feature request: Added setting to define initial directory.

## 0.9.0 - Release
- New action "ftp-remote-edit: find" added to search in tree for a folder

## 0.8.0 - Release
- Refactoring of the complete source code
- Add UI like TreeView
- Add Keyboard Navigation
- Add function to remember the password during the session
- Add promises for ftp and sftp classes
- Extends settings (sortFoldersBeforeFiles, showOnRightSide)

## 0.7.0 - Release
- Fix errors
- Refactoring

## 0.6.0 - Release
- Add Error and file saved response

## 0.5.0 - Release
- Better configuration interface

## 0.4.0 - Release
- Sftp integrated

## 0.3.0 - Release
- Add function new file, new directory, delete file, delete directory, rename file and rename directory.

## 0.2.0 - Release
- Better usability

## 0.1.0 - Release
- First Release
