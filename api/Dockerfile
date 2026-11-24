FROM node:24-alpine

WORKDIR /api

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 5000

CMD ["npm","run", "dev"]


