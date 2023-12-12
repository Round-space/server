# Round.space Server

This project provides a Parse Server backend setup for supporting your round installation.
## Getting Started Locally
### Prerequisites
- Node.js (v12 or newer)
- npm (Node.js package manager)
- MongoDB (v4.0 or newer)
- Redis Server
### Initial Setup
1. Clone or download this project to your local machine.
2. Ensure `npm` is installed on your system.
3. Set up MongoDB and Redis locally (instructions provided below).
4. Install all dependencies using `npm install`.
5. Copy `.env.example` to `.env` and update it with your specific values (refer to the provided `.env`
content for required variables).
### Run Your DApp
- Execute `npm run dev` to start the server locally.
- Your application will be available at `http://localhost:1337/server` or the endpoint you've set in your
`.env` file.
> **Note**: By default, the cloud code is referenced in `build/cloud`. Ensure you run `npm run build` before starting the server, or update the `CLOUD_PATH` in your `.env` file to the
correct location.
## Setting Up Dependencies
### MongoDB
For local development, you can use `mongo-db-runner` for ease of use:
```
npm run dev:db-start # To start MongoDB locally
npm run dev:db-stop # To stop the local MongoDB instance
```
**Important**: Use `mongo-db-runner` only for local development. Set the `DATABASE_URI` in your
`.env` file to your local MongoDB URI.
For production environments, follow the official [MongoDB installation
guide](https://www.mongodb.com/docs/manual/installation/).
### Redis
Redis is used for rate-limiting. Set up a local Redis instance by following the [Redis getting started
guide](https://redis.io/docs/getting-started/). Once installed and running:
- Set the `REDIS_CONNECTION_STRING` in your `.env` file to your Redis server's URI.

## Setting Up Moralis Streams

To listen to on-chain events, you'll need to set up a Moralis Stream. Moralis Streams allow you to receive real-time notifications about blockchain events.

### Steps to Set Up a Moralis Stream

1. **Create a Moralis Account:** If you haven't already, sign up for Moralis at [moralis.io](https://moralis.io/).

2. **Create a New Stream:** In the Moralis admin dashboard, navigate to the Streams section and create a new stream. Select the appropriate blockchain network, address, and events you want to listen to.

3. **Configure Webhook URL:** When configuring your stream, set the webhook URL to the endpoint where your Parse Server is listening. If you're running the Parse Server locally, the URL will be: http://localhost:1337/streams-webhook. The parse server also exposes an ngrok proxy when running locally, so you can use the ngrok URL instead if you prefer. Make sure this matches the `STREAMS_WEBHOOK_URL` in your `.env` file.

4. **Moralis API Key:** Ensure that your Moralis API Key is correctly set in the `.env` file as `MORALIS_API_KEY`. This key is required for your Parse Server to authenticate with Moralis services.

5. **Start the Parse Server:** Run your Parse Server with the `npm run dev` command. It will now listen for incoming POST requests from Moralis at the `/streams-webhook` endpoint.

6. **Verify Operation:** To verify that the Moralis Streams are properly set up, trigger a blockchain event that your stream is configured to listen to. Check the logs of your Parse Server to see if the event is received at the `/streams-webhook` endpoint.

### Important Considerations

- **Security:** Do not expose your Moralis API Key publicly. Keep it secure and private.
- **Firewall Settings:** If you're deploying your Parse Server, ensure your server's firewall allows incoming requests on the port you've configured (default is 1337).
- **Endpoint Accessibility:** The `/streams-webhook` endpoint should be accessible by Moralis servers. If you're testing locally, you might need to use services like [ngrok](https://ngrok.com/) to expose your local server to the internet.

By following these steps, your Parse Server will be set up to listen to on-chain events via Moralis Streams. For more detailed instructions and configuration options, refer to the [Moralis documentation](https://docs.moralis.io/).


## Environment Variables
Update your `.env` file with the following keys:
```
MORALIS_API_KEY='your-moralis-api-key'
PORT = 1337
MASTER_KEY = 'your-master-key'
APPLICATION_ID = 'your-application-id'
SERVER_URL = 'http://localhost:1337/server'
PUBLIC_SERVER_URL = 'http://localhost:1337/server'
APP_URL = 'http://localhost:3000'
CLOUD_PATH = './build/cloud/main.js'
DATABASE_URI = 'mongodb://localhost:27017/your-db-name'
REDIS_CONNECTION_STRING = 'redis://127.0.0.1:6379'
RATE_LIMIT_TTL = 30
RATE_LIMIT_AUTHENTICATED = 50
RATE_LIMIT_ANONYMOUS = 20
USE_STREAMS = true
STREAMS_WEBHOOK_URL = '/streams-webhook'
SENDGRID_API_KEY='your-sendgrid-api-key'
FROM_ADDRESS='notifications@yourdomain.com'
VERIFICATION_EMAIL_TEMPLATE='your-verification-email-template-id'
PASSWORD_RESET_TEMPLATE='your-password-reset-template-id'
```
> **Important**: Replace placeholder values with your actual configuration details.
