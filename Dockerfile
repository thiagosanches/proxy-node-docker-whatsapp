FROM ubuntu:20.04

ENV DEBIAN_FRONTEND=noninteractive
ARG vncpasswd
ARG username

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y openbox tightvncserver firefox xterm openjdk-17-jre curl wget tint2

RUN useradd -ms /bin/bash $username
USER ${username}
WORKDIR /home/${username}

# Install NVM
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
RUN bash -i -c 'nvm install 14 && node -v'

# Install sikulixide
RUN wget https://launchpad.net/sikuli/sikulix/2.0.5/+download/sikulixide-2.0.5.jar

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
COPY package*.json /home/$username/app/
COPY main.js /home/$username/app/
COPY resources/sikulixide.template.py /home/$username/app/sikulixide.template.py

WORKDIR /home/$username/app/
RUN bash -i -c 'npm i'

EXPOSE 3000 5901

ENTRYPOINT [ "/opt/entrypoint.sh" ]