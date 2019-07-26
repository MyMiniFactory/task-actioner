# Task Actioner
[![Build Status](https://travis-ci.org/MyMiniFactory/task-actioner.svg?branch=master)](https://travis-ci.org/MyMiniFactory/task-actioner)

Task Actioner is a RabbitMQ comsumer that receives task messages and runs them as native or docker actions

## Consumer role

- Always on - never crash or restart on crash
- Consumes rabbitMQ
- Read the message (i.e. payload-example.json)
- Download the required files
- Read the type of task to call the right action
if it's a docker container:
- mount the right volumes
- convert the params as args

## Two types of actions:
- Built in code (faster/reliable)
- call of Docker image (GitHub actions-like)

## TODO

- [x] Plug the consumer to rabbitMQ
- [ ] Build docker image if it doesn't exist
- [ ] Rebuild in Rust
- [ ] Handle errors nicely and log!
- [ ] Handle progress feedback of tasks
