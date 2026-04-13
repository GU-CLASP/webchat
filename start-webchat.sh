#!/bin/bash

podman run -it --rm -v $(pwd):/app -w /app node:20-bullseye npm run build
sleep 1
podman-compose up -d
