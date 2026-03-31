#!/bin/bash

podman run -it --rm -p 5060:5060 -v $(pwd)/dist:/app -w /app python:3-alpine sh -c "python -m http.server 5060"
