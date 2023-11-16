// @ts-ignore
import ParseServer from 'parse-server';
import config from './config';
import MoralisEthAdapter from './auth/MoralisEthAdapter';
const sendGridAdapter = require('parse-server-sendgrid-email-adapter');

export const parseServer = new ParseServer({
  databaseURI: config.DATABASE_URI,
  cloud: config.CLOUD_PATH,
  serverURL: config.SERVER_URL,
  publicServerURL: config.PUBLIC_SERVER_URL,
  appId: config.APPLICATION_ID,
  masterKey: config.MASTER_KEY,
  auth: {
    moralisEth: {
      module: MoralisEthAdapter,
    },
  },
  appName: 'Sepolia Parse Server',
  emailAdapter: sendGridAdapter({
    apiKey: config.SENDGRID_API_KEY,
    from: config.FROM_ADDRESS,
    passwordResetEmailTemplate: config.PASSWORD_RESET_TEMPLATE,
    verificationEmailTemplate: config.VERIFICATION_EMAIL_TEMPLATE,
  }),
  verifyUserEmails: true
});
