#!/usr/bin/env node

const decompress = require('decompress');
const decompressUnzip = require('decompress-unzip');
const path = require('path');

const appDir = path.dirname(require.main.filename);

const supportedExtensions = ['stl', 'scad', 'blend', 'pdf', 'obj', 'sdf', 'mtl', '3mf', 'jpeg', 'step', 'skp', 'zip', 'thing', 'zup', 'amf', 'fcstd', 'f3d', 'bmp', 'glb', 'gltf', 'jpg', 'png'];

async function main(payload) {
    randomNumber = Math.floor(Math.random() * Math.floor(100000));

    const promises = payload.map(async (file) => {
        // Unizp it
        files = await decompress(file.location, appDir + '/tmp/' + randomNumber + '/', {
            strip: 1,
            filter: file => supportedExtensions.includes((path.extname(file.path).substr(1))),
            plugins: [
                decompressUnzip()
            ]
        });

        decompressedFiles = files.map(file => {
            return {
                location: appDir + '/tmp/' + randomNumber + '/' + file.path,
                name: file.path
            };
        });

        return decompressedFiles;
    });

    const resultingFiles = await Promise.all(promises);

    // Flatten the resultingFiles array
    flattenedFiles = resultingFiles.reduce((acc, current) => acc.concat(current), []);

    return flattenedFiles;
}

module.exports.run = main
