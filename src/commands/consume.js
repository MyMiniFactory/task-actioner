#!/usr/bin/env node

const { Command, flags } = require('@oclif/command');
const amqp = require('amqplib/callback_api');
const dotenv = require('dotenv');

const actioner = require('../actioner');

dotenv.config();

const rabbitMQ = {
    host: process.env.RABBITMQ_HOST,
    port: process.env.RABBITMQ_PORT,
    user: process.env.RABBITMQ_USER,
    protocol: process.env.RABBITMQ_USE_SSL == 'true' ? 'amqps' : 'amqp',
    password: process.env.RABBITMQ_PASSWORD
};

class ConsumeCommand extends Command {
    async run() {
        const { flags } = this.parse(ConsumeCommand);
        const queue = flags.queue;

        amqp.connect(
            {
                protocol: rabbitMQ.protocol,
                hostname: rabbitMQ.host,
                port: rabbitMQ.port,
                username: rabbitMQ.user,
                password: rabbitMQ.password,
                locale: 'en_US',
                frameMax: 0,
                heartbeat: 60,
                vhost: '/',
            },
            function(error0, connection) {
                if (error0) {
                    throw error0;
                }
                connection.createChannel(function(error1, channel) {
                    if (error1) {
                        throw error1;
                    }

                    // channel.assertQueue(queue, {
                    //     durable: true
                    // });

                    console.log(
                        ' [*] Waiting for messages in %s. To exit press CTRL+C',
                        queue
                    );

                    channel.prefetch(parseInt(process.env.SIMULTANEOUS_TASKS));
                    channel.consume(
                        queue,
                        function(msg) {
                            console.log(' [x] Received %s', msg.content);
                            const payload = JSON.parse(msg.content);
                            actioner.run(payload, () => {
                                console.log('action done');
                                channel.ack(msg);
                            });
                        },
                        {
                            noAck: false
                        }
                    );
                });
            }
        );
    }
}

ConsumeCommand.description = 'Start a RabbitMQ consumer on a given channel';

ConsumeCommand.flags = {
    queue: flags.string({
        char: 'q',
        description: 'queue the consumer must consume',
        required: true
    })
};

module.exports = ConsumeCommand;
