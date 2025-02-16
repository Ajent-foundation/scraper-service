FROM node:18

# Everything will be inside this directory
WORKDIR /app

# Copy all src files to the build directory
COPY . .

# Update npm globally to the latest version
RUN npm install -g npm@latest

# Install dependencies (use --omit=dev to exclude devDependencies)
RUN npm install --omit=dev

# Define the ports exposed from the built container
EXPOSE 8080

# Define the default start command
CMD ["npm", "run", "start"]