FROM python:3-alpine

ARG UNAME=worker
ARG UID=1000
ARG GID=1000

RUN addgroup -g $GID -S $UNAME && adduser -u $UID -S $UNAME -G $UNAME

WORKDIR /app

COPY zip.py zip.py

RUN chown -R $UNAME:$UNAME /app

USER $UNAME

ENTRYPOINT ["sh", "-c", "python3 zip.py"]
