const actioner = require('../src/actioner');
const appDir = require('../src/ta-util').appDir;
const dotenv = require('dotenv');
const emptyDir = require('empty-dir');
const fs = require('fs');
const minio = require('minio');
const path = require('path');
const rimraf = require('rimraf');

dotenv.config();

const minioClient = new minio.Client({
    endPoint: process.env.FILE_STORAGE_HOST,
    port: Number(process.env.FILE_STORAGE_PORT),
    useSSL: 'true' === process.env.FILE_STORAGE_USE_SSL,
    accessKey: process.env.FILE_STORAGE_ACCESS_KEY,
    secretKey: process.env.FILE_STORAGE_SECRET_KEY
});

afterAll(() => {
    const tmpPath = path.join(appDir, 'tmp/*');
    rimraf(tmpPath, err => {
        if (err) {
            console.log('Rimraf Error: ', err);
        }
        console.log('Clear tmp folder');
    });

    const testDownloadInputPath = path.join(appDir, 'tests/workspaces/testDownload/input/*');
    rimraf(testDownloadInputPath, err => {
        if (err) {
            console.log('Rimraf Error: ', err);
        }
    });

    const testTriggerNativeActionOutputPath = path.join(appDir, 'tests/workspaces/testTriggerNativeAction/output/*');
    rimraf(testTriggerNativeActionOutputPath, err => {
        if (err) {
            console.log('Rimraf Error: ', err);
        }
    });

    const testTriggerDockerActionOutputPath = path.join(appDir, 'tests/workspaces/testTriggerDockerAction/output/*');
    rimraf(testTriggerDockerActionOutputPath, err => {
        if (err) {
            console.log('Rimraf Error: ', err);
        }
    });

    const testUploadPath = path.join(appDir, 'data/object/receiver');
    rimraf(testUploadPath, err => {
        if (err) {
            console.log('Rimraf Error: ', err);
        }
    });
});

test('it creates a workspace with input and output folder and a results.json file', () => {
    const outputFiles = {
        output: {
            location: 'output',
            name: 'result.zip'
        }
    };
    return actioner.createWorkspace(outputFiles).then(workspace => {
        expect(
            fs.lstatSync(workspace + '/input').isDirectory() &&
                fs.lstatSync(workspace + '/output').isDirectory() &&
                fs.lstatSync(workspace + '/results.json').isFile()
        ).toBe(true);
    });
});

test('it gets "docker" as an action type', () => {
    return actioner.getActionType('zip').then(type => {
        expect(type).toBe('docker');
    });
});

test('it downloads object from file storage system', async () => {
    const inputFiles = [
        {
            bucketName: 'object',
            objectName: '17853/tchic.stl'
        },
        {
            bucketName: 'object',
            objectName: '17853/tchac.scad'
        }
    ];
    const workspace = path.join(appDir, 'tests/workspaces/testDownload');
    await actioner.downloadFilesFromS3ToWorkspace(
        minioClient,
        inputFiles,
        workspace
    );
    return emptyDir(workspace + '/input').then(result => {
        expect(result).toBe(false);
    });
});

test('it uploads object to file storage system', async () => {
    const outputFiles = {
        output: {
            location: 'output',
            name: 'result.zip'
        }
    };

    const outputFilesPreDefined =
        0 === Object.keys(outputFiles).length ? false : true;
    const workspace = path.join(appDir, 'tests/workspaces/testUpload');
    console.log(workspace);
    const s3Location = {
        bucketName: 'object',
        keyPrefix: 'receiver'
    };

    await actioner.uploadFilesFromWorkspaceToS3(
        minioClient,
        workspace,
        s3Location,
        outputFilesPreDefined
    );
    expect(
        fs.lstatSync(path.join(appDir, 'tests/data/object/receiver/result.zip')).isFile()
    ).toBe(true);
});

test('it triggers a docker action: zip action', async () => {
    const workspace = path.join(appDir, 'tests/workspaces/testTriggerDockerAction');
    const resultFile = path.join(workspace, 'output/result.zip');

    await actioner.triggerDockerAction('zip', false, [], workspace, 1);
    const file = await fs.promises.stat(resultFile);
    expect(file.isFile()).toBe(true);
});

test('it triggers a native action: unzip action', async () => {
    const workspace = path.join(appDir, 'tests/workspaces/testTriggerNativeAction');
    console.log(workspace);
    await actioner.triggerNativeAction('unzip', [], workspace);
    emptyDir(path.join(workspace, 'output')).then(result => {
        return expect(result).toBe(false);
    });
});
