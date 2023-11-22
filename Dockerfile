FROM node:lts
# RUN apk add --no-cache git tzdata ; mkdir -p /usr/node_app
RUN mkdir -p /usr/node_app

COPY . /usr/app
WORKDIR /usr/app

RUN npm install --omit=dev

CMD ["npm", "start"]
