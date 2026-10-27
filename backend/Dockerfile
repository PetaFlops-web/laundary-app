# It will be updated to the latest version soon 
FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "npm run db:push && npm run generate && npm run build && npm run start:dev"]