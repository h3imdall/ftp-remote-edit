# Ftp-Remote-Edit

Editing files on your server without the need for creating a local project. It is not necassary to download all files of your project.
Simply connect and edit your remote files. The files will be automatically updated to the server on saving.

![A screenshot of your package](https://raw.githubusercontent.com/h3imdall/ftp-remote-edit/master/screenshot.png)

## Whats new

- Enhancement: After Atom is no longer developed, this plugin can now be used with [Pulsar](https://pulsar-edit.dev/)
- Enhancement: Improve loading time of package (issue-301)
- Enhancement: Allows to remember last selected path for download/upload
- Enhancement: Extends the logon type of the server configuration with "Prompt for Password"
- Enhancement: Add option to restore previous state after closing and reopening atom (BETA)
- Enhancement: Allow to reconnect opened server from context menu (issue-290)
- Enhancement: Don't allow to create temp duplicates on server list (PR-336)
- Feature request: "Add option to display dialog to confirm drag & drop action" (issue-334)

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
- `Tree View` - `Restore State` - Restoring the previous state after closing and reopening atom. (Beta)
- `Tree View` - `Allow Pending Pane Items` - Allow items to be previewed without adding them to a pane permanently.
- `Tree View` - `Hide Ignored Files` - Don't show items matched by the `Ignored Names` core config setting.
- `Tree View` - `Sort Folders Before Files` - When listing directory items, list subdirectories before listing files.
- `Tree View` - `Sort Servers By Name` - When listing servers items, list servers by name rather than by host.
- `Tree View` - `Auto Reveal Active File` - Auto reveal the current active file on the tree view.
- `Tree View` - `Drag & Drop Confirmation` - Show dialog to confirm drag & drop action.
- `File Transfer` - `Default Download Path` - Default download path for folders and files.
- `File Transfer` - `Default Upload Path` - "Default upload path for folders and files.
- `Tree View Finder` - `Key For Search` - Specifies the key at which the search is to be used.
- `Tree View Finder` - `Ignored Names` - Files and directories matching these patterns and the `Ignored Names` core config setting will be ignored during indexing.
- `Notification` - `Successful Upload` - Show notification on successful upload
- `Notification` - `Failed Upload` - Open protocol view in case of failed upload.
- `Development` - `Debug Mode` - Output debug messages to the console.
- `Development` - `Disable Lazy Loading` - Disable lazy loading of this package.

## I'd like to support this project

Help us bring this project to the moon! Atom's rocket needs to get somewhere, right?

- **Contribute!** I'll be happy to accept pull requests!
- **Bug hunting!** [Report](https://github.com/h3imdall/ftp-remote-edit/issues) them!
- **Feature request?** [Please let me know](https://github.com/h3imdall/ftp-remote-edit/issues) by filling an issue!
- **Star this project** on [Pulsar](https://web.pulsar-edit.dev/packages/ftp-remote-edit), [Github](https://github.com/h3imdall/ftp-remote-edit)
- **Donate for this project** - [![Donate](https://img.shields.io/badge/paypal-donate-yellow.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=KAMKHBBJH7KB2)

## Special Thanks

- [@xingkongwuhen](https://github.com/xingkongwuhen) [PR-447](https://github.com/h3imdall/ftp-remote-edit/pull/447) Eliminate errors and warnings during the use of Puslar
- [@miles-collier](https://github.com/miles-collier) [PR-38](https://github.com/h3imdall/ftp-remote-edit/pull/38) Keybinding for toggling
- [@dustinparker](https://github.com/dustinparker) [PR-112](https://github.com/h3imdall/ftp-remote-edit/pull/112) Sort servers by name
- [@Me1onRind](https://github.com/Me1onRind) [PR-124](https://github.com/h3imdall/ftp-remote-edit/pull/124) Fuzzy finder for remote files
- [@wacki4](https://github.com/wacki4) [PR-169](https://github.com/h3imdall/ftp-remote-edit/pull/169), [PR-245](https://github.com/h3imdall/ftp-remote-edit/pull/245), [PR-265](https://github.com/h3imdall/ftp-remote-edit/pull/265), [PR-266](https://github.com/h3imdall/ftp-remote-edit/pull/266) URI handler, [PR-252](https://github.com/h3imdall/ftp-remote-edit/pull/252) Grouping servers, [PR-267](https://github.com/h3imdall/ftp-remote-edit/pull/267), [PR-268](https://github.com/h3imdall/ftp-remote-edit/pull/268) Allow to upload/download file/directory from context menu, [PR-272](https://github.com/h3imdall/ftp-remote-edit/pull/272) Import from FileZilla, Remote-ftp, PHP Storm config file, [PR-286](https://github.com/h3imdall/ftp-remote-edit/pull/286), [PR-302](https://github.com/h3imdall/ftp-remote-edit/pull/320), [PR-320](https://github.com/h3imdall/ftp-remote-edit/pull/320) Allow to select default path for download and upload, [PR-321](https://github.com/h3imdall/ftp-remote-edit/pull/321) Extends the logon type of the server configuration with "Prompt for Password", [PR-336](https://github.com/h3imdall/ftp-remote-edit/pull/336) Don't allow to create temp duplicates on server list"
- [@FabrizioCaldarelli ](https://github.com/FabrizioCaldarelli) [PR-178](https://github.com/h3imdall/ftp-remote-edit/pull/178),  [PR-174](https://github.com/h3imdall/ftp-remote-edit/pull/174) Help fix some errors
- [@pfitzseb](https://github.com/pfitzseb) [PR-228](https://github.com/h3imdall/ftp-remote-edit/pull/228), [PR-229](https://github.com/h3imdall/ftp-remote-edit/pull/229) Add providers for better [Juno](http://junolab.org/) integration, [PR-241](https://github.com/h3imdall/ftp-remote-edit/pull/241) Add suppport for agent based authentication
