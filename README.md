# proxy-node-docker-whatzapp
That's a Frankenstein application that tries to sends message to Whatsapp contacts through a node application that calls [sikulixide](http://sikulix.com/quickstart/) behind the scenes.

Note: At the first run, you **must** open a VNC connection with the docker container (5901 port) and perform the sign-in on Whatsapp Web. But only the first time or when the session got expired.

## Tooling
- TightVNC Server
- NodeJS 14
- SikuliXIDE 2.0.5
- Firefox
- Openbox
- Xterm
- Tint2
- OpenJDK 17

## See in Action
![Example](example-proxy-node-docker-whatz.gif)

## Send messages
```bash
curl localhost:3000/sendMessages -X POST \
-H "Content-Type: application/json" \
--data "[{\"name\":\"BotNode\", \"body\":\"Hello World 1\"},{\"name\":\"BotNode\", \"body\":\"Hello World 2\"}]"
```

## Tips
You might want to configure Firefox to do not present the restore session after the container restarts.
On Firefox type: `about:config` and search for: `browser.sessionstore.resume_session_once` and `browser.sessionstore.resume_from_crash`, mark them as `false`.
