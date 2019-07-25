#!/usr/bin/env node

'use strict';

const amqp = require('amqplib/callback_api');

const zipPayload = {
    action: 'zip',
    files: [
        {
            bucketName: 'object',
            objectName: '17853/tchic.stl'
        },
        {
            bucketName: 'object',
            objectName: '17853/tchac.scad'
        }
    ],
    args: ['-rj', '/app/files/output/result.zip', '/app/files/input'],
    s3Location: {
        bucketName: 'object',
        keyPrefix: 'receiver'
    }
};

const unzipPayload = {
    action: 'unzip',
    files: [
        {
            bucketName: 'object',
            objectName: 'receiver/8858b5a8a7a49b0d6e29be919051e916.zip'
        }
    ],
    args: [],
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
        const msg = JSON.stringify(zipPayload);

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
