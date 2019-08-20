#!/usr/bin/env node

const { Command, flags } = require('@oclif/command');
const fs = require('fs');
const path = require('path');
const appDir = require('../../ta-util').appDir;
const onExit = require('../../ta-util').onExit;
const spawn = require('child_process').spawn;

class AddCommand extends Command {
    async isActionValid(action, type, pathToActionsFile) {
        let data;
        try {
            data = await fs.promises.readFile(pathToActionsFile);
        } catch (err) {
            console.error(err);
            throw err;
        }
        const actions = JSON.parse(data);
        if (action in actions && actions[action][type] !== type) {
            return false;
        } else {
            return true;
        }
    }

    async isPathValid(actionPath) {
        if (true === path.isAbsolute(actionPath)) {
            let pathIsValid;
            try {
                pathIsValid = await fs.promises.stat(actionPath);
                return pathIsValid.isDirectory();
            } catch (err) {
                console.error(err);
                throw err;
            }
        } else {
            const actionAbsolutePath = path.join(appDir, actionPath);
            let pathIsValid;
            try {
                pathIsValid = await fs.promises.stat(actionAbsolutePath);
                return pathIsValid.isDirectory();
            } catch (err) {
                console.error(err);
                throw err;
            }
        }
    }

    async addActionToActionsList(name, type, pathToActionsFile) {
        const data = await fs.promises.readFile(pathToActionsFile);
        const actions = JSON.parse(data);
        actions[name] = {
            type: type
        };
        fs.writeFile(pathToActionsFile, JSON.stringify(actions), err => {
            if (err) {
                console.error(err);
            }
            console.log('action added to actions list');
        });
    }

    async run() {
        const { flags } = this.parse(AddCommand);
        const { args } = this.parse(AddCommand);
        const action = args.action;
        const type = flags.type;
        let actionIsValid;
        try {
            actionIsValid = await this.isActionValid(
                action,
                type,
                appDir + '/actions.json'
            );
        } catch (err) {
            this.error(err);
        }
        if (false === actionIsValid) {
            this.error(
                'Another action with the same name but a different type is already installed'
            );
        }
        const actionPath = flags.path;
        let pathIsValid;
        try {
            pathIsValid = await this.isPathValid(actionPath);
        } catch (err) {
            this.error(err);
        }
        if (false === pathIsValid) {
            this.error('The path you\'ve chosen is not valid');
        }
        if ('docker' === type) {
            if (actionPath) {
                // We install a local docker action: docker build
                const commandArgs = ['build', '-t', action, actionPath];
                const dockerBuild = spawn('docker', commandArgs, {
                    stdio: [process.stdin, process.stdout, process.stderr]
                });
                try {
                    await onExit(dockerBuild, {isFinished: false});
                } catch (err) {
                    this.error();
                }
            } else {
                // We install a remote docker action: docker pull
                const commandArgs = ['pull', action];
                const dockerPull = spawn('docker', commandArgs, {
                    stdio: [process.stdin, process.stdout, process.stderr]
                });
                try {
                    await onExit(dockerPull, {isFinished: false});
                } catch (err) {
                    this.error(err);
                }
            }

            this.addActionToActionsList(action, type, appDir + '/actions.json');
        }

        if ('native' === type) {
            if (actionPath) {
                const commandArgs = ['install', actionPath];
                const npmInstall = spawn('npm', commandArgs, {
                    stdio: [process.stdin, process.stdout, process.stderr]
                });
                // We install a local native action: npm install
                try {
                    await onExit(npmInstall, {isFinished: false});
                } catch (err) {
                    this.error(err);
                }
            } else {
                // We install a remote native action: npm install
                const commandArgs = ['install', action];
                const npmInstall = spawn('npm', commandArgs, {
                    stdio: [process.stdin, process.stdout, process.stderr]
                });
                try {
                    await onExit(npmInstall, {isFinished: false});
                } catch (err) {
                    this.error(err);
                }
            }

            this.addActionToActionsList(action, type, appDir + '/actions.json');
        }
    }
}

AddCommand.description = 'Add an action to the task-actioner';

AddCommand.args = [
    {
        name: 'action',
        required: true,
        description: 'The action you want to add',
        hidden: false
    }
];

AddCommand.flags = {
    type: flags.string({
        char: 't',
        description: 'The type (`native` or `docker`) of the action to add',
        options: ['docker', 'native'],
        required: true
    }),
    path: flags.string({
        char: 'p',
        description: 'The path of the local action you add'
    })
};

module.exports = AddCommand;
