# Task Actioner
[![Build Status](https://travis-ci.org/MyMiniFactory/task-actioner.svg?branch=master)](https://travis-ci.org/MyMiniFactory/task-actioner)
[![Docker Cloud Build Status](https://img.shields.io/docker/cloud/build/myminifactory/task-actioner)](https://hub.docker.com/repository/docker/myminifactory/task-actioner)

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

## Use Task Actioner Docker image

### Pull image

```
docker pull myminifactory/task-actioner
```

### Environment variable

Here are all the environment variables you need to run the container:

| Variable name | Description | Default value |
|---|---|---|
| MMF\_API\_BASE\_URL  | The base url of your MyMiniFactory instance | null |
| MMF\_API\_SECRET\_KEY | Your access token to use your MyMiniFactory instance | null |
| FILE\_STORAGE\_HOST | The url of your storage service  | null |
| FILE\_STORAGE\_PORT | The port of you storage service | null |
| FILE\_STORAGE\_USE\_SSL | put it to true if you want to use SSL to communicate with your storage service | null |
| FILE\_STORAGE\_ACCESS\_KEY | The login of your storage service  | null |
| FILE\_STORAGE\_SECRET\_KEY | The password of your storage service  | null |
| RABBITMQ\_HOST | The url of your RabbitMQ service | null |
| RABBITMQ\_PORT | The port of your storage service | null |
| RABBITMQ\_USE\_SSL | set true if you want to use AMQPS to communicate with RabbitMQ AMQP otherwise |
| RABBITMQ\_USER | The login of your storage service | null |
| RABBITMQ\_PASSWORD | The password of your storage service | null |
| UID | The user id of the user to manipulate your file in the container launched with docker actions | 1000 |
| GID | The group id of the user to manipulate your file in the container launched with docker actions | 1000 |
| UNAME  | The name of the user to manipulate your file in the container launched with docker actions | worker |
|TASK\_ACTIONER\_PATH | The location of your task actioner application | null |
|SIMULTANEOUS\_TASKS | Number of concurrent tasks | 1 |

## Run the tests suite

### Start the test environment

Go into the tests directory and run docker-compose specifying the environment variable TASK\_ACTIONER\_PATH,
RABBITMQ\_PORT, FILE\_STORAGE\_ACCESS\_KEY and FILE\_STORAGE\_SECRET\_KEY

```
TASK_ACTIONER_PATH=<task_actioner_path> RABBITMQ_PORT=<rabbitmq_port> FILE_STORAGE_ACCESS_KEY=<access_key> FILE_STORAGE_SECRET_KEY=<secret_key> docker-compose up -d
```

Go back tot the root the repository

Install the the test actions with docker and npm:

```
docker build -t zip -f tests/actions/zip/Dockerfile tests/actions/zip/

npm i tests/actions/unzip
```

Now you can run:

```
npm test
```

## TODO

- [x] Plug the consumer to rabbitMQ
- [ ] Build docker image if it doesn't exist
- [ ] Rebuild in Rust
- [ ] Handle errors nicely and log!
- [ ] Handle progress feedback of tasks
