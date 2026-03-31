podman run -it --rm -p 5061:5061 -v $(pwd):/app -w /app node:20-bullseye npm run start:server
