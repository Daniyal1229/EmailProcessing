# Email Processing Application

This Node.js application automates email processing for Gmail and Outlook accounts. It uses AI to categorize emails and generate appropriate responses.

## Features

- OAuth2 authentication for Gmail and Outlook
- Automatic email fetching and processing
- AI-powered email categorization
- Automated response generation
- Redis-based job queue for scalable processing

## Video link
https://drive.google.com/file/d/1LjVt_Qy66eRLV-Y3vTD37wiHKGYhyuPS/view?usp=drive_link

## Prerequisites

- Node.js (v14 or later)
- Redis server
- Gmail and Outlook developer accounts with API access

## Installation

1. Clone the repository:
git clone https://github.com/Daniyal1229/emailProcessing.git cd emailProcessing

2. Install dependencies:
npm install


3. Set up environment variables:
Create a `.env` file in the root directory and add the following variables:

GMAIL_CLIENT_ID=your_gmail_client_id GMAIL_CLIENT_SECRET=your_gmail_client_secret 
GMAIL_REDIRECT_URI=http://localhost:3000/auth/gmail/callback
OUTLOOK_CLIENT_ID=your_outlook_client_id 
OUTLOOK_CLIENT_SECRET=your_outlook_client_secret 
OUTLOOK_REDIRECT_URI=http://localhost:3000/auth/outlook/callback 
OUTLOOK_TENANT_ID=your_outlook_tenant_id
OPENAI_API_KEY=your_openai_api_key
REDIS_HOST=localhost REDIS_PORT=6379 PORT=3000


## Usage

1. Start the Redis server.
2. Run the application:
3. Open a web browser and navigate to `http://localhost:3000`.
4. Use the provided links to authenticate with Gmail and Outlook.
5. After authentication, use the "Process Gmail Emails" and "Process Outlook Emails" links to start email processing.

## Project Structure

- `index.ts`: Main application entry point
- `routes/`: Express route handlers
- `services/`: Core business logic and external service integrations
- `controllers/`: Request handlers for authentication
- `utils/`: Utility functions
- `types.ts`: TypeScript type definitions

## Technologies Used

- Express.js
- TypeScript
- Redis
- BullMQ
- OpenAI API
- Google APIs
- Microsoft Graph API

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.


