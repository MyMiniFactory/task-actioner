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

async function createWorkspace(outputFiles) {
    const randomString = uniqueString();
    const workspace = path.join(appDir, 'tmp', randomString);
    await fs.promises.mkdir(path.join(workspace, 'input'), { recursive: true });
    await fs.promises.mkdir(path.join(workspace, 'output'), {});
    await fs.promises.writeFile(
        path.join(workspace, 'results.json'),
        JSON.stringify(outputFiles)
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
            resolve(actionListParsed[action].type);
        });
    });
}

function downloadFilesFromS3ToWorkspace(client, files, workspace) {
    const downloads = files.map(
        file =>
            new Promise((resolve, reject) => {
                const ext =
                    file.objectName.substring(
                        file.objectName.lastIndexOf('.') + 1,
                        file.objectName.length
                    ) || file.objectName;
                const filePath = path.join(
                    workspace,
                    'input',
                    uniqueString() + '.' + ext
                );
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
        console.error(err);
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
                sendTaskProgres(actionId, JSON.parse(data));
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
                const ext =
                    filename.substring(
                        filename.lastIndexOf('.') + 1,
                        filename.length
                    ) || filename;
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
    } catch (e) {
        console.log(e);
        return done();
    }

    const actionName = taskPayload.action;

    let actionType;
    try {
        actionType = await getActionType(actionName);
    } catch (err) {
        console.error(err);
        console.log('Reporting error to MMF api');
        return done();
    }

    // Get files from file storage service
    try {
        await downloadFilesFromS3ToWorkspace(
            minioClient,
            taskPayload.inputFiles,
            workspace
        );
    } catch (err) {
        console.log('Error downloading files from S3');
        console.error(err);
        return done();
    }

    if ('native' === actionType) {
        try {
            await triggerNativeAction(actionName, taskPayload.args, workspace);
        } catch (err) {
            console.error(err);
            console.log('Reporting error to MMF api');
            return done();
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
            console.error(err);
            return done();
        }
    }

    const outputFilesPreDefined =
        0 === Object.keys(taskPayload.outputFiles).length ? false : true;

    try {
        await uploadFilesFromWorkspaceToS3(
            minioClient,
            workspace,
            taskPayload.s3Location,
            outputFilesPreDefined
        );
    } catch (err) {
        console.log('Error uploading files to S3');
        console.error(err);
        return done();
    }


    /* istanbul ignore next */
    fs.readFile(path.join(workspace, 'output/status.json'), (err, data) => {
        if (err) {
            console.log('Can\'t read status file, while checking it (might not exist yet)');
        } else {
            console.log('Sending final progress to mmf');
            sendTaskProgres(taskPayload.id, JSON.parse(data));

            rimraf(workspace, err => {
                if (err) {
                    console.error('Error deleting the workspace folder');
                    console.error(err);
                }
                console.log('done');
                return done();
            });
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
