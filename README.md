# Ftp-Remote-Edit

Edit files on your server without creating a project.
You do not need to download the whole project files from the server.
Just connect and edit the files. On save the file is written to the server.   

With the right click context menu you can add, delete and rename your files and directories.

![A screenshot of your package](https://raw.githubusercontent.com/h3imdall/ftp-remote-edit/development/screenshot.png)

## Whats new in 0.12
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

## Getting started
- Toggle the view with "ftp-remote-edit:toggle" or use hotkey "ctrl+space"
- Enter the master password. If not allready set, enter the firsttime. All information about your server settings will be encrypted with this password.
- Right click and select "Edit server" to open the Configuration View. Here you can add, edit and delete your (s)ftp servers settings.

## Package preferences
- `Open In Atom Dock` - Open the view as tab in atom dock instead of panel. Only available from Atom 1.17.0
- `Show On Right Side` - Show the view on the right side of the editor instead of the left.
- `Hide Ignored Files` - Don't show items matched by the `Ignored Names` core config setting.
- `Show Hidden Files` - Force FTP Server to show hidden files (e.g. htaccess)
- `Sort Folders Before Files` - When listing directory items, list subdirectories before listing files.
- `Successful Upload Notification` - Show Notification on successful Upload
- `Debug Mode` - Output debug messages to the console.

## I'd like to support this project
Help us bring this project to the moon! Atom's rocket needs to get somewhere, right?
- **Contribute!** I'll be happy to accept pull requests!
- **Bug hunting!** [Report](https://github.com/h3imdall/ftp-remote-edit/issues) them!
- **Feature request?** [Please let me know](https://github.com/h3imdall/ftp-remote-edit/issues) by filling an issue!
- **Star this project** on [Atom](https://atom.io/packages/ftp-remote-edit), [Github](https://github.com/h3imdall/ftp-remote-edit)
- **Donate for this project** - [![Donate](https://img.shields.io/badge/paypal-donate-yellow.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=KAMKHBBJH7KB2)

## Special Thanks
 - [@miles-collier](https://github.com/miles-collier) [Issue-38](https://github.com/h3imdall/ftp-remote-edit/pull/38) added hotkey for toggling  
