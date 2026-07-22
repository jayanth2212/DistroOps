FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN node node_modules/prisma/build/index.js generate
RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]
