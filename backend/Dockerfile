FROM node:18-alpine

WORKDIR /app

# Install SQLite and other dependencies
RUN apk add --no-cache sqlite

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code and database
COPY . .

# Create database directory and ensure SQLite file exists
RUN mkdir -p /app/data && touch /app/database.sqlite

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]