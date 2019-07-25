FROM alpine:latest

RUN apk add zip

ARG UNAME=worker
ARG UID=1000
ARG GID=1000

RUN addgroup -g $GID -S $UNAME && adduser -u $UID -S $UNAME -G $UNAME

WORKDIR /app

RUN chown -R $UNAME:$UNAME /app

USER $UNAME

ENTRYPOINT ["zip"]
