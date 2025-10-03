import fs from 'fs';
import path from 'path';

const logFile = path.join(process.cwd(), 'twilio-server.log');

function writeLog(level: string, message: string, ...args: unknown[]) {
  const logLine = `[${level}] ${new Date().toISOString()} - ${message} ${args.length > 0 ? JSON.stringify(args) : ''}\n`;
  console.log(logLine.trim());
  fs.appendFileSync(logFile, logLine);
}

export const logger = {
  info: (message: string, ...args: unknown[]) => {
    writeLog('INFO', message, ...args);
  },

  error: (message: string, ...args: unknown[]) => {
    writeLog('ERROR', message, ...args);
  },

  warn: (message: string, ...args: unknown[]) => {
    writeLog('WARN', message, ...args);
  },

  debug: (message: string, ...args: unknown[]) => {
    if (process.env.DEBUG) {
      writeLog('DEBUG', message, ...args);
    }
  },
};
