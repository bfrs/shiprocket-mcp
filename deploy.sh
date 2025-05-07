#!/bin/bash

PROJECT_DIR="/home/ubuntu/shiprocket-mcp"

if [ ! -d "$PROJECT_DIR" ]; then
    git clone git@github.com:bfrs/shiprocket-mcp.git
fi

cd "$PROJECT_DIR"
git reset --hard && git clean -fd && git checkout main
git pull

docker compose up -d --build

docker system prune -f