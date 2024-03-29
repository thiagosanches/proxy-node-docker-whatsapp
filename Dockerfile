FROM ubuntu:20.04

ENV DEBIAN_FRONTEND=noninteractive
ARG vncpasswd
ARG username

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y openbox tightvncserver firefox xterm curl wget tint2 libnss3 libnspr4 libgbm1

RUN useradd -ms /bin/bash $username
USER ${username}
WORKDIR /home/${username}

# Install NVM
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
RUN bash -i -c 'nvm install 18 && node -v'

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
COPY --chown=guest:guest package*.json /home/$username/app/
COPY --chown=guest:guest main.js /home/$username/app/
COPY --chown=guest:guest redis.js /home/$username/app/
COPY --chown=guest:guest mini-apps/scrape.js /home/$username/app/mini-apps/
RUN ls -la /home/$username/app/*

WORKDIR /home/$username/app/
RUN bash -i -c 'npm i'

RUN mkdir -p /tmp/whatsapp_userdata
RUN chown guest:guest -R /tmp/whatsapp_userdata
VOLUME [ "/tmp/whatsapp_userdata" ]

EXPOSE 3000 5901

ENTRYPOINT [ "/opt/entrypoint.sh" ]
