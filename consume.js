#!/usr/bin/env node

const amqp = require('amqplib/callback_api');
const dotenv = require('dotenv');

const actioner = require('./actioner');

dotenv.config();

const rabbitMQ = {
    host: process.env.RABBITMQ_HOST,
    port: process.env.RABBITMQ_PORT,
    user: process.env.RABBITMQ_USER,
    password: process.env.RABBITMQ_PASSWORD
};

amqp.connect(
    `amqp://${rabbitMQ.user}:${rabbitMQ.password}@${rabbitMQ.host}:${rabbitMQ.port}`,
    function(error0, connection) {
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
    }
);
