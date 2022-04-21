import ImapServer from './source/imap';
import config from './config';
import chalk from 'chalk';
import Logger from './log';
import Forward from './forward';
import { KVP } from './types';

const rootLogger = new Logger([
  () => `[${new Date().toISOString()}]`,
]);

const env =  process.env.NODE_ENV || 'none';
rootLogger.info('Environment is', env);

config.load(rootLogger.fork([chalk.red('[config]')]), env);

const imapLogger = rootLogger.fork([chalk.cyan('[imap-server]')]);
imapLogger.info('Creating all IMAP servers');
Object
  .entries(config('ImapServers', Error))
  .sort(sortEntriesAlphabetically)
  .map(([name, options]) => new ImapServer(imapLogger, name, options))
  .forEach(async server => {
    try {
      imapLogger.debug('Starting server', server.name);
      await server.init();
      imapLogger.debug('Adding event listeners to server', server.name);
      server.addListener('message', async (message: any) => {
        imapLogger.info('Message from ' + message.server.name);
        for (const forward of forwards) {
          const done = await forward.forward(message);
          if (done) {
            imapLogger.debug(forward.name + ' marked the message handling as done');
            return;
          }
        }
      });
    } catch(error) {
      imapLogger.error('Failed to start server', server.name, error);
      process.exit(1);
    }
  });

const forwardLogger = rootLogger.fork([chalk.yellow('[forward]')]);
forwardLogger.info('Creating all forwarders');
const forwards = Object
  .entries(config('Forward', Error))
  .sort(sortEntriesAlphabetically)
  .map(([name, options]) => new Forward(forwardLogger, name, options));

function sortEntriesAlphabetically(a: KVP<string, unknown>, b: KVP<string, unknown>) {
  return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
}