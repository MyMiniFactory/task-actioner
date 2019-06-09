# Consumer example

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

- [ ] Plug the consumer to rabbitMQ
- [ ] Build docker image if it doesn't exist
- [ ] Rebuild in Rust
- [ ] Handle errors nicely and log!
- [ ] Handle progress feedback of tasks
