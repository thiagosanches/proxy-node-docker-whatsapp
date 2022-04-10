FROM ubuntu:20.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y openbox tightvncserver firefox xterm openjdk-17-jre curl

RUN useradd -ms /bin/bash whatsapp
COPY resources/entrypoint.sh /opt/entrypoint.sh
RUN chmod +x /opt/entrypoint.sh

COPY resources/xstartup /home/whatsapp/xstartup
RUN chown whatsapp:whatsapp /home/whatsapp/xstartup

RUN apt-get install -y wget tint2

USER whatsapp
RUN mkdir ~/.vnc \
    && echo "forabozo" | vncpasswd -f > ~/.vnc/passwd \
    && chmod 600 ~/.vnc/passwd \
    && mv /home/whatsapp/xstartup ~/.vnc/ \
    && chmod +x ~/.vnc/xstartup

ENV USER=whatsapp
ENV HOME=/home/whatsapp
WORKDIR /home/whatsapp

# Install NVM
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
RUN bash -i -c 'nvm install 14 && node -v'

# Install sikulixide
RUN wget https://launchpad.net/sikuli/sikulix/2.0.5/+download/sikulixide-2.0.5.jar

# Application
RUN mkdir -p /home/whatsapp/app
COPY package*.json /home/whatsapp/app/
COPY main.js /home/whatsapp/app/
COPY resources/sikulixide.template.py /home/whatsapp/app/sikulixide.template.py

WORKDIR /home/whatsapp/app/
RUN bash -i -c 'npm i'

EXPOSE 3000 5901

ENTRYPOINT [ "/opt/entrypoint.sh" ]