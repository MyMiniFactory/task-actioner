FROM node:lts-alpine

RUN apk add docker

COPY . /app/

WORKDIR /app

RUN npm ci \
    && npm link

ENTRYPOINT ["task-actioner"]

CMD ["--help"]
