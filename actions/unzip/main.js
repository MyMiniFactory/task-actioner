#!/usr/bin/env node

'use strict';

const decompress = require('decompress');
const decompressUnzip = require('decompress-unzip');
const path = require('path');
const fs = require('fs');

const supportedExtensions = [
    'stl',
    'scad',
    'blend',
    'pdf',
    'obj',
    'sdf',
    'mtl',
    '3mf',
    'jpeg',
    'step',
    'skp',
    'zip',
    'thing',
    'zup',
    'amf',
    'fcstd',
    'f3d',
    'bmp',
    'glb',
    'gltf',
    'jpg',
    'png'
];

async function main(args, workspace) {
    const files = await new Promise((resolve, reject) => {
        fs.readdir(workspace + '/input', {}, (err, files) => {
            if (err) reject(err);

            resolve(files);
        });
    });

    const promises = files.map(file => {
        return decompress(workspace + '/input/' + file, workspace + '/output', {
            strip: 1,
            filter: file =>
                supportedExtensions.includes(path.extname(file.path).substr(1)),
            plugins: [decompressUnzip()]
        });
    });

    await Promise.all(promises);
}

module.exports.run = main;
