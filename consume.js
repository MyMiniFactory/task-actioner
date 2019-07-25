#!/usr/bin/env node

'use strict';

const amqp = require('amqplib/callback_api');

const actioner = require('./actioner');

amqp.connect('amqp://localhost', function(error0, connection) {
    if (error0) {
        throw error0;
    }
    connection.createChannel(function(error1, channel) {
        if (error1) {
            throw error1;
        }

        var queue = 'hello';

        channel.assertQueue(queue, {
            durable: false
        });

        console.log(
            ' [*] Waiting for messages in %s. To exit press CTRL+C',
            queue
        );

        channel.consume(
            queue,
            function(msg) {
                console.log(' [x] Received %s', msg.content);
                const payload = JSON.parse(msg.content);
                actioner.run(payload, () => {
                    console.log('action done');
                });
            },
            {
                noAck: true
            }
        );
    });
});
