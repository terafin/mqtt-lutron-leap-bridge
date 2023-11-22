FROM node:lts-alpine3.17
RUN apk add --no-cache git tzdata ; mkdir -p /usr/node_app

COPY . /usr/app
WORKDIR /usr/app

RUN npm install --omit=dev

CMD ["npm", "start"]
