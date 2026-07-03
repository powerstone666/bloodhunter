FROM alpine:3.19

ARG TARGETARCH=amd64

RUN apk add --no-cache \
    bash \
    curl \
    wget \
    git \
    python3 \
    py3-pip \
    nodejs \
    npm \
    go \
    chromium \
    chromium-chromedriver \
    ca-certificates \
    openssl \
    jq \
    unzip \
    build-base \
    && rm -rf /var/cache/apk/*

RUN adduser -D -s /bin/bash pentester \
    && echo "pentester ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

ENV HOME=/home/pentester
ENV PATH="/home/pentester/.local/bin:/home/pentester/go/bin:/usr/local/go/bin:${PATH}"
ENV AGENT_BROWSER_ENGINE=chromium
ENV AGENT_BROWSER_HEADLESS=true
ENV AGENT_BROWSER_EXECUTABLE=/usr/bin/chromium-browser

USER pentester
WORKDIR /home/pentester

RUN mkdir -p /home/pentester/.local/bin /home/pentester/go/bin /home/pentester/scans /home/pentester/reports /home/pentester/tmp /home/pentester/tools /home/pentester/tools/wordlists

CMD ["bash"]
