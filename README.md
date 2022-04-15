# proxy-node-docker-whatzapp
That's a Frankenstein application that tries to sends message to Whatsapp contacts through a node application that calls sikulixide behind the scenes.

Note: At the first run, you **must** open a VNC connection with the host and perform the sign-in on Whatsapp Web. But only the first time or when the session got expired.

# Tooling
- TightVNC Server
- NodeJS 14
- SikuliXIDE 2.0.5
- Firefox
- Openbox
- Xterm
- Tint2
- OpenJDK 17

## In Action
![Example](example-proxy-node-docker-whatz.gif)

## Request
```bash
curl localhost:3000/sendMessages -X POST \
-H "Content-Type: application/json" \
--data "[{\"name\":\"BotNode\", \"body\":\"Hello World 1\"},{\"name\":\"BotNode\", \"body\":\"Hello World 2\"}]"
```
