#!/usr/bin/env node

'use strict';

const amqp = require('amqplib/callback_api');

const zipPayload = {
    action: 'zip',
    inputFiles: [
        {
            bucketName: 'object',
            objectName: '17853/tchic.stl'
        },
        {
            bucketName: 'object',
            objectName: '17853/tchac.scad'
        }
    ],
    gpu: false,
    args: [],
    outputFiles: {
        output: {
            location: 'output',
            name: 'result.zip'
        }
    },
    s3Location: {
        bucketName: 'object',
        keyPrefix: 'receiver'
    }
};

const unzipPayload = {
    action: 'unzip',
    inputFiles: [
        {
            bucketName: 'object',
            objectName: '25875/tchoc.zip'
        }
    ],
    gpu: false,
    args: [],
    outputFiles: {},
    s3Location: {
        bucketName: 'object',
        keyPrefix: 'receiver'
    }
};

amqp.connect('amqp://localhost', function(error0, connection) {
    if (error0) {
        throw error0;
    }
    connection.createChannel(function(error1, channel) {
        if (error1) {
            throw error1;
        }

        var queue = 'hello';
        const msg = JSON.stringify(unzipPayload);

        channel.assertQueue(queue, {
            durable: false
        });
        channel.sendToQueue(queue, Buffer.from(msg));

        console.log(' [x] Sent %s', msg);
    });
    setTimeout(function() {
        connection.close();
        process.exit(0);
    }, 500);
});
