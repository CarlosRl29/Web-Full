FROM node:20-alpine AS base
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm install

COPY . .
RUN npm run db:generate -w apps/api
RUN npm run build -w packages/shared
RUN npm run build -w apps/api

EXPOSE 3001
CMD ["npm", "run", "start:prod", "-w", "apps/api"]
