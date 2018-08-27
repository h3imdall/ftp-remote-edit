# Ftp-Remote-Edit

Editing files on your server without the need for creating a local project. It is not necassary to download all files of your project.
Simply connect and edit your remote files. The files will be automatically updated to the server on saving.

![A screenshot of your package](https://raw.githubusercontent.com/h3imdall/ftp-remote-edit/master/screenshot.png)

## Whats new in 0.12

- Added Option "Open in Atom Dock" - Open the view as tab in atom dock instead of panel. Only available from Atom 1.17.0
- Added FTP Message Log - Shows sent/received FTP commands in log
- Changed refreshing behavior of the tree view
- Feature request: Drag-and-Drop (issue-25)
- Feature request: Copy / Cut / Paste files (issue-24)
- Feature request: Rename copied file if exists to prevent collision of names (issue-61)
- Feature request: Statusbar for upload/download (issue-69)
- Feature request: Option "Disable Notification on save/upload" (issue-55)
- Feature request: Option "Hide Ignored Names" (issue-78)
- Feature request: Option "Opening hidden files" (e.g. htaccess) (issue-66)
- Feature request: Option "Preview opened file in pending pane" to have the same behavior than in atom (issue-83)
- Feature request: Option "Sort Servers By Name" (issue-106)
- Feature request: Fuzzy finder for remote files (issue-109)
- Feature request: Support for file-icons package (issue-125)
- Feature request: Option "Auto Reveal Active File" (issue-158)
- Feature request: Open from command line (issue-165)
- Feature request: Option "Toggle on atom startup" (issue-168)
- Feature request: "Configuration view - Duplicate Server" (issue-77)
- Feature request: "Change permissions of a file" (issue-137)

## Getting started

- Toggle the view with "ftp-remote-edit:toggle" or use keybinding `ctrl-space`
- Enter the master password. If not allready set, enter the firsttime. All information about your server settings will be encrypted with this password.
- Right click and select "Edit Servers" to open the configuration view. Here you can add, edit and delete your (s)ftp server settings.

## Keybindings

- Toggle the view with `ctrl-space`
- Toggle the fuzzy finder with `ctrl-alt-p` (item must be selected in the tree view)

## Helpfull commands
- Toggle the view with "ftp-remote-edit:toggle"
- Change master password with "ftp-remote-edit:change-password"
- Toggle the fuzzy finder with "ftp-remote-edit:finder"
- Reindex the fuzzy finder cache with "ftp-remote-edit:finder-reindex-cache"

## URI handler
Add temporary server for ftp/sftp by using uri. It is possible to use it with/without username, password and port.
- atom://ftp-remote-edit/sftp://username:password@host:port
- atom://ftp-remote-edit/ftp://username:password@host:port

## Package preferences

- `Tree View` - `Open On Startup` - Open the view automatically when atom starts.
- `Tree View` - `Open In Atom Dock` - Open the view as tab in atom dock instead of panel. Only available from Atom 1.17.0
- `Tree View` - `Show On Right Side` - Show the view on the right side of the editor instead of the left.
- `Tree View` - `Allow Pending Pane Items` - Allow items to be previewed without adding them to a pane permanently.
- `Tree View` - `Hide Ignored Files` - Don't show items matched by the `Ignored Names` core config setting.
- `Tree View` - `Show Hidden Files` - Force FTP Server to show hidden files (e.g. htaccess)
- `Tree View` - `Sort Folders Before Files` - When listing directory items, list subdirectories before listing files.
- `Tree View` - `Sort Servers By Name` - When listing servers items, list servers by name rather than by host.
- `Tree View` - `Auto Reveal Active File` - Auto reveal the current active file on the tree view.
- `Tree View Finder` - `Key For Search` - Specifies the key at which the search is to be used.
- `Tree View Finder` - `Ignored Names` - Files and directories matching these patterns and the `Ignored Names` core config setting will be ignored during indexing.
- `Notification` - `Successful Upload` - Show notification on successful upload
- `Notification` - `Failed Upload` - Open protocol view in case of failed upload.
- `Development` - `Debug Mode` - Output debug messages to the console.

## I'd like to support this project

Help us bring this project to the moon! Atom's rocket needs to get somewhere, right?

- **Contribute!** I'll be happy to accept pull requests!
- **Bug hunting!** [Report](https://github.com/h3imdall/ftp-remote-edit/issues) them!
- **Feature request?** [Please let me know](https://github.com/h3imdall/ftp-remote-edit/issues) by filling an issue!
- **Star this project** on [Atom](https://atom.io/packages/ftp-remote-edit), [Github](https://github.com/h3imdall/ftp-remote-edit)
- **Donate for this project** - [![Donate](https://img.shields.io/badge/paypal-donate-yellow.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=KAMKHBBJH7KB2)

## Special Thanks

- [@miles-collier](https://github.com/miles-collier) [Issue-38](https://github.com/h3imdall/ftp-remote-edit/pull/38) Keybinding for toggling
- [@dustinparker](https://github.com/dustinparker) [Issue-106](https://github.com/h3imdall/ftp-remote-edit/pull/112) Sort servers by name
- [@Me1onRind](https://github.com/Me1onRind)
[Issue-109](https://github.com/h3imdall/ftp-remote-edit/pull/124) Fuzzy finder for remote files
- [@wacki4](https://github.com/wacki4)
[Issue-165](https://github.com/h3imdall/ftp-remote-edit/pull/169) Open from command line
- [@FabrizioCaldarelli ](https://github.com/FabrizioCaldarelli)
[Issue-173](https://github.com/h3imdall/ftp-remote-edit/pull/178),  [Issue-44](https://github.com/h3imdall/ftp-remote-edit/pull/174) Help fix some errors
