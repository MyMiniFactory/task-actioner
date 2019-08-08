const actioner = require('../actioner');
const dotenv = require('dotenv');
const emptyDir = require('empty-dir');
const fs = require('fs');
const minio = require('minio');

dotenv.config();

const minioClient = new minio.Client({
    endPoint: process.env.FILE_STORAGE_HOST,
    port: Number(process.env.FILE_STORAGE_PORT),
    useSSL: 'true' === process.env.FILE_STORAGE_USE_SSL,
    accessKey: process.env.FILE_STORAGE_ACCESS_KEY,
    secretKey: process.env.FILE_STORAGE_SECRET_KEY
});

test('it creates a workspace with input and output folder and a results.json file', () => {
    const outputFiles = {
        output: {
            location: '/',
            name: 'result.zip'
        }
    };
    return actioner.createWorkspace(outputFiles).then(workspace => {
        expect(
            fs.lstatSync(workspace + '/input').isDirectory() &&
                fs.lstatSync(workspace + '/output').isDirectory() && fs.lstatSync(workspace + '/results.json').isFile()
        ).toBe(true);
    });
});

test('it gets "docker" as an action type', () => {
    return actioner.getActionType('zip').then(type => {
        expect(type).toBe('docker');
    });
});

test('it downloads object from file storage system', async () => {
    const outputFiles = {
        output: {
            location: 'output',
            name: 'result.zip'
        }
    };
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
    const workspace = await actioner.createWorkspace(outputFiles);
    await actioner.downloadFilesFromS3ToWorkspace(minioClient, inputFiles, workspace);
    return emptyDir(workspace + '/input').then(result => {
        expect(result).toBe(false);
    });
});

test('it uploads object to file storage system', async (done) => {
    const outputFiles = {
        output: {
            location: 'output',
            name: 'result.zip'
        }
    };

    const outputFilesPreDefined = (0 === Object.keys(outputFiles).length)  ? false : true;
    const workspace = __dirname + '/tmp/from_zip';
    console.log(workspace);
    const s3Location = {
        bucketName: 'object',
        keyPrefix: 'receiver'
    };

    await actioner.uploadFilesFromWorkspaceToS3(minioClient, workspace, s3Location, outputFilesPreDefined);
    fs.stat(__dirname + '/data/object/receiver/result.zip', (err, stats) => {
        expect(stats.isFile()).toBe(true);
    });
    done();
});
