FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 UPLOAD_DIR=/app/uploads
COPY --from=build /app ./
RUN mkdir -p /app/uploads
EXPOSE 3000
# migrations + base data (safe to run on every start), then the server
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && npm start"]
