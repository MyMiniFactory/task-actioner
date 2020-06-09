#!/usr/bin/env node

const appDir = require('./ta-util').appDir;
const axios = require('axios');
const fs = require('fs');
const mime = require('mime');
const minio = require('minio');
const onExit = require('./ta-util').onExit;
const path = require('path');
const rimraf = require('rimraf');
const uniqueString = require('unique-string');

const spawn = require('child_process').spawn;

const minioClient = new minio.Client({
    endPoint: process.env.FILE_STORAGE_HOST,
    port: Number(process.env.FILE_STORAGE_PORT),
    useSSL: 'true' === process.env.FILE_STORAGE_USE_SSL,
    accessKey: process.env.FILE_STORAGE_ACCESS_KEY,
    secretKey: process.env.FILE_STORAGE_SECRET_KEY
});
const minioClient2 = new minio.Client({
    endPoint: process.env.FILE_STORAGE2_HOST,
    port: Number(process.env.FILE_STORAGE2_PORT),
    useSSL: 'true' === process.env.FILE_STORAGE2_USE_SSL,
    accessKey: process.env.FILE_STORAGE2_ACCESS_KEY,
    secretKey: process.env.FILE_STORAGE2_SECRET_KEY
});

async function createWorkspace(outputFiles) {
    const randomString = uniqueString();
    const workspace = path.join(appDir, 'tmp', randomString);
    await fs.promises.mkdir(path.join(workspace, 'input'), { recursive: true });
    await fs.promises.mkdir(path.join(workspace, 'output'), {});
    await fs.promises.writeFile(
        path.join(workspace, 'results.json'),
        JSON.stringify(outputFiles)
    );
    await fs.promises.writeFile(
        path.join(workspace+'/output', 'status.json'),
        JSON.stringify([])
    );

    return workspace;
}

function getActionType(action) {
    return new Promise((resolve, reject) => {
        fs.readFile(path.join(appDir, 'actions.json'), (err, data) => {
            if (err) {
                reject(err);
            }
            const actionListParsed = JSON.parse(data);
            if (actionListParsed[action] == undefined){
                reject('Action not supported');
                return;
            }
            resolve(actionListParsed[action].type);
        });
    });
}

function downloadFilesFromS3ToWorkspace(client, files, workspace, actionRename) {
    const downloads = files.map(
        file =>
            new Promise((resolve, reject) => {
                let ext =
                    file.objectName.substring(
                        file.objectName.lastIndexOf('.') + 1,
                        file.objectName.length
                    ) || file.objectName;
                ext = ext.toLowerCase();
                var filePath = path.join(
                    workspace,
                    'input',
                    uniqueString() + '.' + ext
                );
                if(false === actionRename) {
                    filePath = path.join(
                        workspace,
                        'input',
                        file.objectName.substring(file.objectName.lastIndexOf('/') + 1)
                    );
                }
                client.fGetObject(
                    file.bucketName,
                    file.objectName,
                    filePath,
                    err => {
                        if (err) {
                            console.log('Error while downloading a file');
                            reject(err);
                        }
                        console.log(
                            'download ',
                            file.bucketName,
                            file.objectName,
                            ' into ',
                            filePath
                        );
                        resolve();
                    }
                );
            })
    );

    return Promise.all(downloads);
}

async function sendTaskProgres(taskId, progress) {
    const endpoint = process.env.MMF_API_BASE_URL + '/tasks/' + taskId;
    const requestConfig = {
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + process.env.MMF_API_SECRET_KEY
        }
    };
    const requestData = { progress: JSON.stringify(progress) };
    try {
        axios.patch(endpoint, requestData, requestConfig);
    } catch (err) {
        console.error('Error Patching Task: ', err);
        throw err;
    }
}

async function triggerDockerAction(
    actionName,
    actionGpu,
    args,
    workspace,
    actionId
) {
    let commandBase = ['run', '--rm', '-v', workspace + ':/app/files'];

    if (true === actionGpu) {
        commandBase = commandBase.concat(['--gpus', 'all']);
    }

    commandBase.push(actionName);

    const commandArgs = commandBase.concat(args);

    const docker = spawn('docker', commandArgs, {
        stdio: [process.stdin, process.stdout, process.stderr]
    });

    let actionFinishedObject = {
        isFinished: false
    };

    function checkfile(file, actionId) {
        fs.readFile(file, (err, data) => {
            if (err) {
                console.log('Can\'t read file, while checking it');
            } else {
                console.log('Sending progress to mmf');
                try {
                    let parsedStatusFile = JSON.parse(data);
                    sendTaskProgres(actionId, parsedStatusFile);
                } catch (e){
                    console.log('Can\'t parse the status file, while checking it', e);
                }
            }
        });

        if (!actionFinishedObject.isFinished) {
            setTimeout(() => {
                checkfile(file, actionId);
            }, 5000);
        }
    }

    checkfile(path.join(workspace, 'output/status.json'), actionId);

    await onExit(docker, actionFinishedObject);
}

async function triggerNativeAction(actionName, args, workspace) {
    console.log(actionName);
    const action = require(actionName);
    await action.run(args, workspace);
}

function cleanExit(workspace, err, done){
    rimraf(workspace, rmErr => {
        console.log('removing the workspace');
        if (rmErr) {
            console.error('Error deleting the workspace folder');
            console.error(rmErr);
        }
        return done(err);
    });
}

async function uploadFilesFromWorkspaceToS3(
    client,
    workspace,
    s3Location,
    outputFilesPreDefined
) {
    const resultsFile = await new Promise((resolve, reject) => {
        fs.readFile(
            path.join(workspace + '/results.json'),
            'utf8',
            (err, data) => {
                if (err) reject(err);

                resolve(data);
            }
        );
    });

    const files = Object.values(JSON.parse(resultsFile));
    console.log(files);

    const uploads = files.map(
        file =>
            new Promise((resolve, reject) => {
                const filename = file.name;
                let ext =
                    filename.substring(
                        filename.lastIndexOf('.') + 1,
                        filename.length
                    ) || filename;
                ext = ext.toLowerCase();
                let objectName;
                if (true === outputFilesPreDefined) {
                    objectName = s3Location.keyPrefix + '/' + filename;
                } else {
                    objectName =
                        s3Location.keyPrefix + '/' + uniqueString() + '.' + ext;
                }
                const filePath = path.join(workspace, file.location, filename);
                const metaData = {
                    'Content-Type': mime.getType(ext),
                    'Content-Language': 'en-US',
                    'X-Amz-Meta-Testing': 1234,
                    example: 5678
                };
                client.fPutObject(
                    s3Location.bucketName,
                    objectName,
                    filePath,
                    metaData,
                    (fileErr, etag) => {
                        if (fileErr) reject(fileErr);
                        console.log(
                            'upload ',
                            filePath,
                            ' to ',
                            objectName,
                            ' etag: ',
                            etag
                        );
                        resolve(etag);
                    }
                );
            })
    );

    return await Promise.all(uploads);
}

async function main(taskPayload, done) {

    // Create temporary work folder
    let workspace;
    try {
        workspace = await createWorkspace(taskPayload.outputFiles);
    } catch (err) {
        console.log(err);
        return done(err);
    }

    const actionName = taskPayload.action;

    let actionType;
    try {
        actionType = await getActionType(actionName);
    } catch (err) {
        return cleanExit(workspace, err, done);
    }

    // Get files from file storage service
    let client2Url = minioClient2.protocol + '//' + minioClient2.host;
    let storageClient = minioClient;
    if (taskPayload.s3Location.host !== undefined &&
        taskPayload.s3Location.host == client2Url){
        storageClient = minioClient2;
    }

    try {
        await downloadFilesFromS3ToWorkspace(
            storageClient,
            taskPayload.inputFiles,
            workspace,
            taskPayload.rename
        );
    } catch (err) {
        console.log('Error downloading files from S3');
        return cleanExit(workspace, err, done);
    }

    if ('native' === actionType) {
        try {
            await triggerNativeAction(actionName, taskPayload.args, workspace);
        } catch (err) {
            return cleanExit(workspace, err, done);
        }
    } else {
        try {
            await triggerDockerAction(
                actionName,
                taskPayload.gpu,
                taskPayload.args,
                workspace,
                taskPayload.id
            );
        } catch (err) {
            console.log('Reporting docker action error to MMF api');
            return cleanExit(workspace, err, done);
        }
    }

    const outputFilesPreDefined =
        0 === Object.keys(taskPayload.outputFiles).length ? false : true;

    try {
        await uploadFilesFromWorkspaceToS3(
            storageClient,
            workspace,
            taskPayload.s3Location,
            outputFilesPreDefined
        );
    } catch (err) {
        console.log('Error uploading files to S3');
    }


    /* istanbul ignore next */
    fs.readFile(path.join(workspace, 'output/status.json'), (err, data) => {
        if (err) {
            console.log('Can\'t read status file, while checking it (might not exist yet)');
        } else {
            console.log('Sending final progress to mmf');
            sendTaskProgres(taskPayload.id, JSON.parse(data));

            // Successfully ack the task and remove the folder
            return cleanExit(workspace, undefined, done);
        }
    });

}

module.exports.run = main;
module.exports.createWorkspace = createWorkspace;
module.exports.getActionType = getActionType;
module.exports.downloadFilesFromS3ToWorkspace = downloadFilesFromS3ToWorkspace;
module.exports.triggerNativeAction = triggerNativeAction;
module.exports.triggerDockerAction = triggerDockerAction;
module.exports.uploadFilesFromWorkspaceToS3 = uploadFilesFromWorkspaceToS3;
