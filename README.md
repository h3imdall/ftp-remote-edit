# Ftp-Remote-Edit

Editing files on your server without the need for creating a local project. It is not necassary to download all files of your project.
Simply connect and edit your remote files. The files will be automatically updated to the server on saving.

![A screenshot of your package](https://raw.githubusercontent.com/h3imdall/ftp-remote-edit/master/screenshot.png)

## Whats new

- Enhancement: Refactoring of the complete source code
- Enhancement: Updating of all dependencies
- Enhancement: Optimize configuration view for small screens and add option to duplicate servers
- Enhancement: Optimize support for default atom themes
- Enhancement: Optimize rename/duplicate dialogs (path preselection)
- Enhancement: Optimize context menu
- Enhancement: Speed up auto reveal active file by adding visibility checking
- Enhancement: Add upload of files (drag/drop from outside of atom)
- Enhancement: Add upload of directories (drag/drop from outside of atom)
- Feature request: "Add option to duplicate files." (issue-248)
- Feature request: "Add keyboard shortcuts for context-menu actions" (issue-250)
- Feature request: "Copy local folder/file into remote server" (issue-138)
- Feature request: Grouping servers (issue-72)
- Enhancement: Fix styles for Atom material UI theme (issue-261)
- Enhancement: Extends the URI handler so that you can use HTML entities in the credentials. (PR-265)
- Enhancement: Add option to permanently store the temp. server added by the URI handler in the config. (PR-266)
- Enhancement: Mark temp. server added by the URI handler with a different color
[more...](https://github.com/h3imdall/ftp-remote-edit/blob/master/CHANGELOG.md)

## Getting started

- Toggle the view with "ftp-remote-edit:toggle" or use keybinding `ctrl-space`
- Enter the master password. If not allready set, enter the firsttime. All information about your server settings will be encrypted with this password.
- Right click and select "Edit Servers" to open the configuration view. Here you can add, edit and delete your (s)ftp server settings.

## Keybindings

- Toggle the view with `ctrl-space`
- Toggle the focus with `ctrl-alt-space`
- Toggle the fuzzy finder with `ctrl-alt-p` (item must be selected in the tree view)

## Helpfull commands
- Toggle the view with "ftp-remote-edit:toggle"
- Change master password with "ftp-remote-edit:change-password"
- Toggle the fuzzy finder with "ftp-remote-edit:finder"
- Reindex the fuzzy finder cache with "ftp-remote-edit:finder-reindex-cache"

## URI handler
Add temporary server for ftp/sftp by using uri. It is possible to use it with/without username, password, port and path.
- atom://ftp-remote-edit/sftp://username:password@host:port/path
- atom://ftp-remote-edit/ftp://username:password@host:port/path

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

- [@miles-collier](https://github.com/miles-collier) [PR-38](https://github.com/h3imdall/ftp-remote-edit/pull/38) Keybinding for toggling
- [@dustinparker](https://github.com/dustinparker) [PR-112](https://github.com/h3imdall/ftp-remote-edit/pull/112) Sort servers by name
- [@Me1onRind](https://github.com/Me1onRind) [PR-124](https://github.com/h3imdall/ftp-remote-edit/pull/124) Fuzzy finder for remote files
- [@wacki4](https://github.com/wacki4) [PR-169](https://github.com/h3imdall/ftp-remote-edit/pull/169), [PR-245](https://github.com/h3imdall/ftp-remote-edit/pull/245), [PR-265](https://github.com/h3imdall/ftp-remote-edit/pull/265), [PR-266](https://github.com/h3imdall/ftp-remote-edit/pull/266) URI handler, [PR-252](https://github.com/h3imdall/ftp-remote-edit/pull/252) Grouping servers
- [@FabrizioCaldarelli ](https://github.com/FabrizioCaldarelli) [PR-178](https://github.com/h3imdall/ftp-remote-edit/pull/178),  [PR-174](https://github.com/h3imdall/ftp-remote-edit/pull/174) Help fix some errors
- [@pfitzseb](https://github.com/pfitzseb) [PR-228](https://github.com/h3imdall/ftp-remote-edit/pull/228), [PR-229](https://github.com/h3imdall/ftp-remote-edit/pull/229) Add providers for better [Juno](http://junolab.org/) integration, [PR-241](https://github.com/h3imdall/ftp-remote-edit/pull/241) Add suppport for agent based authentication
