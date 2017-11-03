'use babel';

import { decrypt } from './secure.js';
const { shell } = require('electron')

// Add detail information in error notification
// Uncaught SyntaxError: Unexpected token  in JSON at position 0 #44
// https://github.com/h3imdall/ftp-remote-edit/issues/44
export const throwErrorIssue44 = function (e, password) {
  let passwordHash = atom.config.get('ftp-remote-edit.password');
  let configHash = atom.config.get('ftp-remote-edit.config');
  let config = decrypt(password, configHash);

  let regularExpression = /^[a-zA-Z0-9]+$/;
  let detail = {
    config: {
      decrypt: (config !== null),
    },
    password: {
      exists: (password.length > 0),
      length: password.length,
      alphanumeric: regularExpression.test(password)
    }
  };

  console.error('Detail Error Information');
  console.info('Uncaught SyntaxError: Unexpected token  in JSON at position 0 #44');
  console.info('https://github.com/h3imdall/ftp-remote-edit/issues/44');

  console.warn('password:');
  console.log('password:', password);
  console.log('password exists:', detail.password.exists);
  console.log('password length:', detail.password.length);
  console.log('password alphanumeric:', detail.password.alphanumeric);

  console.warn('hash:');
  console.log('password hash:', passwordHash);
  console.log('config hash:', configHash);

  console.warn('config:');
  console.log('config:', config);

  atom.notifications.addError(e.message, {
    detail: e.message,
    stack: e.stack,
    dismissable: true,
    buttons: [{
      text: 'View Issue',
      onDidClick: () => {
        shell.openExternal('https://github.com/h3imdall/ftp-remote-edit/issues/44');
      }
    }],
    description: 'The error was thrown from the ftp-remote-edit package. The error has already been reported in issue on github and a solution is being worked on. You can help by adding information to this issue. Please explain what actions triggered this error.',
  });
};
