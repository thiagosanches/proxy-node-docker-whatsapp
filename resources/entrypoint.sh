#!/bin/bash

vncserver -kill :1
rm -rf /tmp/.X11-unix/X0
rm -rf /tmp/.X0-lock
rm -rf /tmp/.X11-unix/X1
rm -rf /tmp/.X1-lock

PATH=$PATH:"/home/whatsapp/.nvm/versions/node/v14.19.1/bin"

# I know, it's not a good practice to run two entrypoint process on the same container,
# but my node application needs to interact with sikulixide that lives on the same container and has a X session.
DISPLAY=:1 node ~/app/main.js &
vncserver -geometry 1024x768 :1

while true
do
    echo "Running VNC and node application..."
    sleep 60
done
