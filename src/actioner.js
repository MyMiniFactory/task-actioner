#!/usr/bin/env node

const appDir = require('./ta-util').appDir;
const fs = require('fs');
const mime = require('mime');
const minio = require('minio');
const onExit = require('./ta-util');
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
    const workspace = appDir + '/tmp/' + randomString;
    await fs.promises.mkdir(workspace + '/input', { recursive: true });
    await fs.promises.mkdir(workspace + '/output', {});
    await fs.promises.writeFile(
        workspace + '/results.json',
        JSON.stringify(outputFiles)
    );

    return workspace;
}

function getActionType(action) {
    console.log(appDir + '/actions.json');
    return new Promise((resolve, reject) => {
        fs.readFile(appDir + '/actions.json', (err, data) => {
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
                const filePath =
                    workspace + '/input/' + uniqueString() + '.' + ext;
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

async function triggerDockerAction(actionName, actionGpu, args, workspace) {
    let commandBase = ['run', '--rm', '-v', workspace + ':/app/files'];

    if (true === actionGpu) {
        commandBase = commandBase.concat(['--gpus', 'all']);
    }

    commandBase.push(actionName);

    const commandArgs = commandBase.concat(args);

    const docker = spawn('docker', commandArgs, {
        stdio: [process.stdin, process.stdout, process.stderr]
    });

    await onExit(docker);
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
        fs.readFile(workspace + '/results.json', 'utf8', (err, data) => {
            if (err) reject(err);

            resolve(data);
        });
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
                const filePath =
                    workspace + '/' + file.location + '/' + filename;
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

async function main(taskPayload) {
    // Create temporary work folder
    let workspace;
    try {
        workspace = await createWorkspace(taskPayload.outputFiles);
    } catch (e) {
        console.log(e);
    }

    const actionName = taskPayload.action;

    let actionType = await getActionType(actionName);
    try {
        actionType = await getActionType(actionName);
    } catch (err) {
        console.error(err);
        console.log('Reporting error to MMF api');
        throw err;
    }

    // Get files from file storage service
    await downloadFilesFromS3ToWorkspace(
        minioClient,
        taskPayload.inputFiles,
        workspace
    );

    if ('native' === actionType) {
        try {
            await triggerNativeAction(actionName, taskPayload.args, workspace);
        } catch (err) {
            console.error(err);
            console.log('Reporting error to MMF api');
            throw err;
        }
    } else {
        await triggerDockerAction(
            actionName,
            taskPayload.gpu,
            taskPayload.args,
            workspace
        );
    }

    const outputFilesPreDefined =
        0 === Object.keys(taskPayload.outputFiles).length ? false : true;

    await uploadFilesFromWorkspaceToS3(
        minioClient,
        workspace,
        taskPayload.s3Location,
        outputFilesPreDefined
    );

    /* istanbul ignore next */
    rimraf(workspace, err => {
        if (err) {
            console.error('Error: ', err);
        }
        console.log('done');
    });
}

module.exports.run = main;
module.exports.createWorkspace = createWorkspace;
module.exports.getActionType = getActionType;
module.exports.downloadFilesFromS3ToWorkspace = downloadFilesFromS3ToWorkspace;
module.exports.uploadFilesFromWorkspaceToS3 = uploadFilesFromWorkspaceToS3;
