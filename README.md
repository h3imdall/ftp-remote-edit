# Ftp-Remote-Edit

Edit files on your server without creating a project.
You do not need to download the whole project files from the server.
Just connect and edit the files. On save the file is written to the server.   

With the right click context menu you can add, delete and rename your files and directories.

![A screenshot of your package](https://raw.githubusercontent.com/h3imdall/ftp-remote-edit/master/screenshot.png)

## Whats new in 0.11
- Added setting to define path for ssh/sftp private keyfile
- Fixed styles for light theme (issue-17)
- The path in the dialogs is now corrected so that it corresponds to the schema. Spaces within the path caused errors.
- Fixed error while creating a folder (issue-20)
- Improved speed by keeping the connections open
- Added dialog to change the password. To open run command "ftp-remote-edit:change-password". Empty password caused error and will no longer be accepted.
- Checks connection status everytime the "connect" function is called. Fixes issue on sftp "keep connection alive" error. (issue-28)
- Added Option to enable debug mode
- Fixed error reported in "Unsyncing after idle" (issue-28)
- Added hotkey for toggling "ctrl+space" (issue-37)
- Hide password in server settings (issue-36)
- Fixed error while creating a folder (issue-32)
- Fixed error while renaming a file/folder (issue-42)
- Fixed error for "Image view doesn't work" (issue-58)
- Fixed error for "Undo just opened file" (issue-62)

## Getting started
- Toggle the view with "ftp-remote-edit:toggle" or use hotkey "ctrl+space"
- Enter the master password. If not allready set, enter the firsttime. All information about your server settings will be encrypted with this password.
- Right click and select "Edit server" to open the Configuration View. Here you can add, edit and delete your ftp servers settings.

## I'd like to support this project
Help us bring this project to the moon! Atom's rocket needs to get somewhere, right?
- **Contribute!** I'll be happy to accept pull requests!
- **Bug hunting!** [Report](https://github.com/h3imdall/ftp-remote-edit/issues) them!
- **Feature request?** [Please let me know](https://github.com/h3imdall/ftp-remote-edit/issues) by filling an issue!
- **Star this project** on [Atom](https://atom.io/packages/ftp-remote-edit), [Github](https://github.com/h3imdall/ftp-remote-edit)

## Special Thanks
 - [@miles-collier](https://github.com/miles-collier) [Issue-38](https://github.com/h3imdall/ftp-remote-edit/pull/38) added hotkey for toggling  
