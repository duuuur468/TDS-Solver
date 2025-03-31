# Assignment Helper API

An LLM-based API that automatically answers questions from IIT Madras' Online Degree in Data Science graded assignments.

## Features

- Accepts questions from 5 different graded assignments
- Handles file attachments when needed
- Processes CSV files from uploaded zip archives
- Returns answers in a simple JSON format
- Specialized handling for different assignment types
- Uses AIProxy service instead of direct OpenAI API access

## API Usage

The API endpoint accepts POST requests at `/api` with multipart/form-data:

```bash
curl -X POST "https://your-app.vercel.app/api/" \
  -H "Content-Type: multipart/form-data" \
  -F "question=Download and unzip file abcd.zip which has a single extract.csv file inside. What is the value in the 'answer' column of the CSV file?" \
  -F "file=@abcd.zip"
```

Response format:

```json
{
  "answer": "1234567890"
}
```

## Local Development

1. Clone this repository
2. Install dependencies with `npm install`
3. Create a `.env` file with the following:
   ```
   AIPROXY_TOKEN=your_aiproxy_token_here
   PORT=3000
   ```
4. Run the development server with `npm run dev`
5. Use the test client by opening `test-client.html` in your browser
6. Run automated tests with `npm test`

## AIProxy Service

This application uses the AIProxy service (https://aiproxy.sanand.workers.dev/) instead of connecting directly to OpenAI. This eliminates the need for your own OpenAI API key.

To get an AIProxy token:
1. Visit https://aiproxy.sanand.workers.dev/
2. Login with your IITM email ID
3. Copy your token to use in the application

The application uses the `gpt-4o-mini` model through the AIProxy service.

## Deployment Options

### Vercel Deployment

This application is optimized for Vercel serverless deployment:

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Configure environment variables:
   - AIPROXY_TOKEN: Your AIProxy token from https://aiproxy.sanand.workers.dev/
4. Deploy!

### Heroku Deployment

You can also deploy to Heroku:

1. Create a Heroku account and install the Heroku CLI
2. Login and create a new app:
   ```
   heroku login
   heroku create your-app-name
   ```
3. Set up environment variables:
   ```
   heroku config:set AIPROXY_TOKEN=your_aiproxy_token_here
   ```
4. Deploy the application:
   ```
   git push heroku main
   ```

## Assignment Handling

The API is designed to handle 5 different graded assignments:

1. **Graded Assignment 1**: Data manipulation with Pandas
2. **Graded Assignment 2**: Data visualization with Matplotlib
3. **Graded Assignment 3**: Machine learning with scikit-learn
4. **Graded Assignment 4**: Natural Language Processing
5. **Graded Assignment 5**: Deep Learning

The API automatically detects which assignment a question belongs to and provides specialized handling.

## Project Structure

- `api/index.js`: Main API implementation
- `test-client.html`: Simple web interface for testing
- `test-api.js`: Automated test script
- `.env`: Environment variables configuration
- `vercel.json`: Vercel deployment configuration
- `Procfile`: Heroku deployment configuration

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 