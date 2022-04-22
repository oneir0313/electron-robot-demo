FROM circleci/node:14.17.1-browsers

# Create Directory for the Container
WORKDIR /usr/src/app

# Copy files
COPY . .

USER root
# Install Packages
RUN apt-get update
RUN apt-get -y install libgtkextra-dev libgconf2-dev libnss3 libasound2 libxtst-dev libxss1 libatk-bridge2.0-0 libx11-xcb1 libgtk-3-0

# Set Time zone
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends tzdata
    RUN TZ=Asia/Taipei \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone \
    && dpkg-reconfigure -f noninteractive tzdata 


# Install node module
RUN npm install
EXPOSE 3005
# Run electron
CMD ./node_modules/.bin/electron . --no-sandbox --disable-gpu --mute-audio --disable-software-rasterizer \
                                    --disable-dev-shm-usage --disable-extensions --headless --disable-web-security \
                                    --disable-webgl --disable-features=TranslateUI --disable-sync \
                                    --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding \
                                    --enable-automation --disable-default-apps --no-first-run --metrics-recording-only \
                                    --disable-client-side-phishing-detection --no-default-browser-check --disable-prompt-on-repost \
                                    --js-flags="--expose_gc"





