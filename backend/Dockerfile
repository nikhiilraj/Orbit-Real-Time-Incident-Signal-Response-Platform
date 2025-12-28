# 1. Use a slim version of Node for faster deployments
FROM node:18-slim

# 2. Set the working directory inside the container
WORKDIR /backend

# 3. Copy package files first to leverage Docker's cache
COPY package*.json ./

# 4. Install production dependencies only
RUN npm install --production

# 5. Copy the rest of your application code
COPY . .

# 6. Set the environment to production
ENV NODE_ENV=production

# 7. Match the port your app listens on
EXPOSE 3000

# 8. Start the application
CMD ["node", "index.ts"]