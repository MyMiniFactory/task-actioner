#!/usr/bin/env node

const path = require('path');
const rimraf = require("rimraf");
const minio = require('minio');
const mime = require('mime');

require('dotenv').config();

const appDir = path.dirname(require.main.filename);

const minioClient = new minio.Client({
    endPoint: process.env.FILE_STORAGE_HOST,
    port: Number(process.env.FILE_STORAGE_PORT),
    useSSL: (process.env.FILE_STORAGE_USE_SSL === 'true'),
    accessKey: process.env.FILE_STORAGE_ACCESS_KEY,
    secretKey: process.env.FILE_STORAGE_SECRET_KEY
});

function getFile(bucketName, objectName) {
    const randomNumber = Math.floor(Math.random() * Math.floor(100000));
    const filePath = appDir + '/tmp/' + randomNumber.toString() + objectName;

    return new Promise((resolve, reject) => {
        minioClient.fGetObject(bucketName, objectName, filePath, (err) => {
            if (err) {
                console.error(err);
                reject(err);
            }
            resolve(filePath);
        });

    });
}

function putFile(bucketName, objectName, filePath) {
    const metaData = {
        'Content-Type': mime.getType((path.extname(filePath).substr(1))),
        'Content-Language': 'en-US',
        'X-Amz-Meta-Testing': 1234,
        'example': 5678
    };
    return new Promise((resolve, reject) => {
        minioClient.fPutObject(bucketName, objectName, filePath, metaData, (err, etag) => {
            if (err) {
                reject(err);
            }

            resolve(etag);
        })
    });
}

async function triggerAction (actionName, files) {
    const action = require(appDir + '/actions/' + actionName + '/main');
    const resultingFiles = await action.run(files);

    return resultingFiles;
}

async function main(taskPayload){
    let actionPayload = [];

    const promises = taskPayload.files.map(async (file) => {
        const fileLocation = await getFile(file.bucketName, file.objectName);
        actionPayload.push({location: fileLocation});
    });

    await Promise.all(promises);

    const resultingFiles = await triggerAction(taskPayload.action, actionPayload);

    const randomNumber = Math.floor(Math.random() * Math.floor(100000));

    const promisesBis = resultingFiles.map(async (file) => {
        const filename = `${randomNumber}/${file.name}`;
        console.log(filename);
        putFile('object', filename, file.location);
    });

    await Promise.all(promisesBis);

    rimraf(appDir + '/tmp/*', (err) => {
        if (err) {
            console.error("Error: ", err);
        }
        console.log("done");
    });

}

module.exports.run = main
