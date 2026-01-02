FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ARG vncpasswd
ARG username
ENV TZ=America/Sao_Paulo

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y curl openbox tightvncserver firefox xterm curl wget tint2 libnss3 libnspr4 libgbm1 libasound2 tzdata

RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Install NVM
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
RUN . $HOME/.nvm/nvm.sh && nvm install 22

RUN useradd -ms /bin/bash $username
RUN mkdir -p /home/${username}/.nvm
RUN cp -ra /root/.nvm /home/${username}/
RUN chown -R ${username}:${username} /home/${username}/.nvm

USER ${username}
WORKDIR /home/${username}

# VNC and X11 Setup
USER root
COPY resources/entrypoint.sh /opt/entrypoint.sh
RUN chmod +x /opt/entrypoint.sh

COPY resources/xstartup /home/$username/xstartup
RUN chown $username:$username /home/$username/xstartup

USER $username
RUN mkdir ~/.vnc \
    && echo "$vncpasswd" | vncpasswd -f > ~/.vnc/passwd \
    && chmod 600 ~/.vnc/passwd \
    && mv /home/${username}/xstartup ~/.vnc/ \
    && chmod +x ~/.vnc/xstartup

ENV USER=$username
ENV HOME=/home/$username
WORKDIR /home/${username}

# Application
RUN mkdir -p /home/$username/app
RUN mkdir -p /home/$username/app/mini-apps
RUN mkdir -p /home/$username/app/images
COPY --chown=guest:guest images/*.jpeg /home/$username/app/images/
COPY --chown=guest:guest package*.json /home/$username/app/
COPY --chown=guest:guest main.js /home/$username/app/
COPY --chown=guest:guest redis.js /home/$username/app/
COPY --chown=guest:guest mini-apps/scrape.js /home/$username/app/mini-apps/
RUN ls -la /home/$username/app/*

USER ${username}
WORKDIR /home/$username/app/
RUN bash -c '. /home/${username}/.nvm/nvm.sh && nvm install 22 && npm i && npx playwright install'
RUN ls -la /home/${username}/.nvm/

RUN mkdir -p /tmp/whatsapp_userdata
RUN chown guest:guest -R /tmp/whatsapp_userdata
VOLUME [ "/tmp/whatsapp_userdata" ]

EXPOSE 3002 5901

ENTRYPOINT [ "/opt/entrypoint.sh" ]
