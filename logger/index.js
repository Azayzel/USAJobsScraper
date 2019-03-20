const log4js = require('log4js');
var logger;

/**
* Creates a new instance of Logger
* @description Pass Logger Level 'trace' || 'debug' || 'info' || 'warn' || 'error' || 'fatal' || 'All'
* @param {String} lvl 
*/
class Logger {
    constructor(lvl = 'trace'){
        log4js.configure({
            appenders: { 
                app: { type: 'file', filename: 'app.log' } ,
                appConsole: { type: 'console', colorize: true } 
            },
            categories: { default: { appenders: ['app','appConsole'], level: lvl } }
          });
          
          this.level = lvl;
          this.logger = new log4js.getLogger('app');
          this.logger.level = this.level;
    }

    /**
     * Writes Message to log file
     * @param {String} message 
     */
    WriteLog(message){
        switch(this.level){
            case "trace":
                this.logger.trace(message);
                break;
            case "debug":
                this.logger.debug(message);
                break;
            case "info":
                this.logger.info(message);
                break;
            case "warn":
                this.logger.warn(message);
                break;
            case "error":
                this.logger.error(message);
                break;
            case "fatal":
                this.logger.fatal(message);
                break;
        }
    }
}

module.exports = Logger;