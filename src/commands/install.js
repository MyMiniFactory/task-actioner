#!/usr/bin/env node

const { Command } = require('@oclif/command');
const appDir = require('../ta-util').appDir;
const fs = require('fs');
const onExit = require('../ta-util').onExit;
const spawn = require('child_process').spawn;

class InstallCommand extends Command {
    async run() {
        let data;
        try {
            data = await fs.promises.readFile(appDir + '/actions.json');
        } catch (err) {
            this.error(err);
        }

        const actions = JSON.parse(data);
        Object.keys(actions).forEach(async action => {
            if ('docker' === actions[action].type) {
                // Add docker action
                if (actions[action].url) {
                    // Install a local docker action: docker build
                    const commandArgs = [
                        'build',
                        '-t',
                        action,
                        actions[action].url
                    ];
                    const dockerBuild = spawn('docker', commandArgs, {
                        stdio: [process.stdin, process.stdout, process.stderr]
                    });
                    try {
                        await onExit(dockerBuild, { isFinished: false });
                    } catch (err) {
                        this.error();
                    }
                } else {
                    // Install a remote docker action: docker pull
                    const commandArgs = ['pull', action];
                    const dockerPull = spawn('docker', commandArgs, {
                        stdio: [process.stdin, process.stdout, process.stderr]
                    });
                    try {
                        await onExit(dockerPull, { isFinished: false });
                    } catch (err) {
                        this.error(err);
                    }
                }
            } else if ('native' === actions[action].type) {
                // Add native action
                if (actions[action].url) {
                    // Install a local native action: docker build
                    const commandArgs = ['install', actions[action].url];
                    const npmInstall = spawn('npm', commandArgs, {
                        stdio: [process.stdin, process.stdout, process.stderr]
                    });

                    try {
                        await onExit(npmInstall, { isFinished: false });
                    } catch (err) {
                        this.error(err);
                    }
                } else {
                    const commandArgs = ['install', action];
                    const npmInstall = spawn('npm', commandArgs, {
                        stdio: [process.stdin, process.stdout, process.stderr]
                    });
                    try {
                        await onExit(npmInstall, { isFinished: false });
                    } catch (err) {
                        this.error(err);
                    }
                }
            } else {
                console.error('Your action ', action, ' is not valid');
            }
        });
    }
}

InstallCommand.description =
    'Install the actions written in the actions list file';

module.exports = InstallCommand;
