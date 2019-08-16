#!/usr/bin/env node

const dotenv = require('dotenv');
const util = require('util');

dotenv.config();

const appDir = process.env.TASK_ACTIONER_PATH;
const exec = util.promisify(require('child_process').exec);

async function shell(command) {
    const { stdout, stderr } = await exec(command);
    console.log('stdout:', stdout);
    console.error('stderr:', stderr);
}

function onExit(childProcess) {
    return new Promise((resolve, reject) => {
        childProcess.once('exit', code => {
            if (0 === code) {
                resolve(undefined);
            } else {
                reject(new Error('Exit with error code: ' + code));
            }
        });
        childProcess.once('error', err => {
            reject(err);
        });
    });
}

module.exports.shell = shell;
module.exports.appDir = appDir;
module.exports.onExit = onExit;
