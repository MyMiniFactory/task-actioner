#!/usr/bin/env node

const util = require('util');
const dotenv = require('dotenv');
const fs = require('fs');
const mime = require('mime');
const minio = require('minio');
const path = require('path');
const rimraf = require('rimraf');
const uniqueString = require('unique-string');

dotenv.config();

const appDir = path.dirname(require.main.filename);
const exec = util.promisify(require('child_process').exec);

const minioClient = new minio.Client({
    endPoint: process.env.FILE_STORAGE_HOST,
    port: Number(process.env.FILE_STORAGE_PORT),
    useSSL: 'true' === process.env.FILE_STORAGE_USE_SSL,
    accessKey: process.env.FILE_STORAGE_ACCESS_KEY,
    secretKey: process.env.FILE_STORAGE_SECRET_KEY
});

async function createWorkspace(randomString) {
    const workspace = appDir + '/tmp/' + randomString;
    await fs.promises.mkdir(workspace + '/input', { recursive: true });
    await fs.promises.mkdir(workspace + '/output', {});

    return workspace;
}

function getActionType(action) {
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

async function shell(command) {
    const { stdout, stderr } = await exec(command);
    console.log('stdout:', stdout);
    console.error('stderr:', stderr);
}

async function triggerDockerAction(actionName, args, workspace) {
    await shell(
        'docker run --rm -v ' +
            workspace +
            ':/app/files ' +
            actionName +
            ' ' +
            args.join(' ')
    );
}

async function triggerNativeAction(actionName, args, workspace) {
    console.log(actionName);
    const action = require(actionName);
    await action.run(args, workspace);
}

function uploadFilesFromWorkspaceToS3(client, workspace, s3Location) {
    return new Promise((resolve, reject) => {
        fs.readdir(workspace + '/output', {}, (err, files) => {
            if (err) reject(err);

            files.map(file => {
                const ext =
                    file.substring(file.lastIndexOf('.') + 1, file.length) ||
                    file;
                const objectName =
                    s3Location.keyPrefix + '/' + uniqueString() + '.' + ext;
                const filePath = workspace + '/output/' + file;
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
                    }
                );
            });
            resolve();
        });
    });
}

async function main(taskPayload) {
    // Create temporary work folder
    const randomString = uniqueString();
    let workspace;
    try {
        workspace = await createWorkspace(randomString);
    } catch (e) {
        console.log(e);
    }

    const actionName = taskPayload.action;

    const actionType = await getActionType(actionName);

    // Get files from file storage service
    await downloadFilesFromS3ToWorkspace(
        minioClient,
        taskPayload.files,
        workspace
    );

    if ('native' === actionType) {
        await triggerNativeAction(actionName, taskPayload.args, workspace);
    } else {
        await triggerDockerAction(actionName, taskPayload.args, workspace);
    }

    await uploadFilesFromWorkspaceToS3(
        minioClient,
        workspace,
        taskPayload.s3Location
    );

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
