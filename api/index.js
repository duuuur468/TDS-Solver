const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { OpenAI } = require('openai');
const extract = require('extract-zip');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const os = require('os');
require('dotenv').config();

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Set up storage for uploaded files - use memory storage for serverless
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Initialize OpenAI client with AIProxy configuration
const openai = new OpenAI({
  apiKey: process.env.AIPROXY_TOKEN || "default_token_placeholder", // Will be overridden in Vercel
  baseURL: "https://aiproxy.sanand.workers.dev/openai",
});

// Process CSV data from buffer
async function processCsvBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    
    const bufferStream = require('stream').Readable.from(buffer);
    
    bufferStream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

// Process ZIP buffer in memory
async function processZipBuffer(buffer) {
  // Create temp directory for extraction
  const tempDir = path.join(os.tmpdir(), 'extract-' + Date.now());
  
  try {
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Write buffer to temp file
    const zipPath = path.join(tempDir, 'archive.zip');
    fs.writeFileSync(zipPath, buffer);
    
    // Extract zip
    const extractDir = path.join(tempDir, 'extracted');
    fs.mkdirSync(extractDir, { recursive: true });
    
    await extract(zipPath, { dir: extractDir });
    
    // Get list of extracted files
    const files = fs.readdirSync(extractDir);
    
    return {
      extractDir,
      files,
      cleanup: () => {
        // Function to clean up temp directory
        try {
          if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
        } catch (err) {
          console.error('Cleanup error:', err);
        }
      }
    };
  } catch (error) {
    // Clean up on error
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.error('Cleanup error:', err);
    }
    throw error;
  }
}

// Function to determine which assignment the question belongs to
function identifyAssignment(question) {
  const keywords = {
    1: ['assignment 1', 'graded assignment 1', 'pandas', 'dataframe', 'series', 'data manipulation'],
    2: ['assignment 2', 'graded assignment 2', 'matplotlib', 'visualization', 'plot', 'chart', 'graph'],
    3: ['assignment 3', 'graded assignment 3', 'sklearn', 'machine learning', 'regression', 'classification'],
    4: ['assignment 4', 'graded assignment 4', 'natural language processing', 'nlp', 'text analysis', 'tokenization'],
    5: ['assignment 5', 'graded assignment 5', 'deep learning', 'neural networks', 'tensorflow', 'pytorch']
  };
  
  const lowerQuestion = question.toLowerCase();
  
  // Check for explicit mention of assignment number
  for (const [assignmentNum, terms] of Object.entries(keywords)) {
    if (terms.some(term => lowerQuestion.includes(term))) {
      return parseInt(assignmentNum);
    }
  }
  
  // Default to analyzing as a general question if we can't determine the assignment
  return 0;
}

// Get answer from LLM based on assignment type
async function getAnswerFromLLM(question, assignmentNum, data = null) {
  let systemPrompt = "You are a helpful assistant that answers data science assignment questions. Provide only the exact answer without explanations.";
  
  // Customize system prompt based on assignment type
  if (assignmentNum > 0) {
    systemPrompt = `You are an expert in data science specializing in graded assignment ${assignmentNum} for IIT Madras' Online Degree in Data Science. 
    Your task is to provide accurate and concise answers to questions from this assignment.
    Only provide the answer value and nothing else - no explanations, no workings, just the final answer that would be submitted in the assignment.
    If the answer is a numerical value, double-check your calculations.
    If the answer is a code snippet, ensure it works correctly.
    If the answer is a textual response, keep it as concise as possible.`;
  }
  
  let userPrompt = `Question: ${question}`;
  
  if (data) {
    // For assignment 1 (data manipulation), provide more context about the CSV data
    if (assignmentNum === 1) {
      // Show sample of the data and columns
      const sampleData = data.slice(0, 5);
      const columns = Object.keys(data[0] || {}).join(', ');
      userPrompt += `\n\nData contains ${data.length} rows with columns: ${columns}\n\nSample data: ${JSON.stringify(sampleData)}`;
    } 
    // For assignment 2 (visualization), describe the data more concisely
    else if (assignmentNum === 2) {
      const columns = Object.keys(data[0] || {}).join(', ');
      userPrompt += `\n\nData contains ${data.length} rows with columns: ${columns}`;
    }
    // For other assignments, provide the full data if it's not too large
    else {
      if (data.length <= 100) {
        userPrompt += `\n\nData: ${JSON.stringify(data)}`;
      } else {
        // For larger datasets, just provide a summary
        const columns = Object.keys(data[0] || {}).join(', ');
        userPrompt += `\n\nData contains ${data.length} rows with columns: ${columns}\n\nSample data: ${JSON.stringify(data.slice(0, 5))}`;
      }
    }
  }
  
  try {
    // AIProxy only supports gpt-4o-mini model
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 500
    });
    
    // Log usage info from AIProxy
    console.log(`Request cost: ${response.headers?.get('cost') || 'unknown'}`);
    console.log(`Monthly cost: ${response.headers?.get('monthlyCost') || 'unknown'}`);
    console.log(`Monthly requests: ${response.headers?.get('monthlyRequests') || 'unknown'}`);
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('AI API error:', error);
    throw new Error('Failed to get answer from AI service: ' + error.message);
  }
}

// Main API endpoint
app.post('/api', upload.single('file'), async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    // Identify which assignment the question is from
    const assignmentNum = identifyAssignment(question);
    
    let data = null;
    let extractedFiles = [];
    let cleanup = null;
    
    // Process file if uploaded
    if (req.file) {
      try {
        const fileBuffer = req.file.buffer;
        const fileType = req.file.mimetype;
        
        if (fileType === 'application/zip' || req.file.originalname.endsWith('.zip')) {
          // Process zip file using the buffer
          const extractResult = await processZipBuffer(fileBuffer);
          cleanup = extractResult.cleanup;
          extractedFiles = extractResult.files;
          
          // Check for CSV files
          const csvFiles = extractedFiles.filter(file => file.endsWith('.csv'));
          if (csvFiles.length > 0) {
            // Process the first CSV file found
            const csvPath = path.join(extractResult.extractDir, csvFiles[0]);
            if (fs.existsSync(csvPath)) {
              const csvBuffer = fs.readFileSync(csvPath);
              data = await processCsvBuffer(csvBuffer);
            }
          }
          
          // Check for specific file types based on assignment
          if (assignmentNum === 4) {
            // For NLP assignment, look for text files
            const textFiles = extractedFiles.filter(file => file.endsWith('.txt'));
            if (textFiles.length > 0) {
              const textPath = path.join(extractResult.extractDir, textFiles[0]);
              if (fs.existsSync(textPath)) {
                data = fs.readFileSync(textPath, 'utf-8');
              }
            }
          }
        } else if (fileType === 'text/csv' || req.file.originalname.endsWith('.csv')) {
          // Process CSV file directly from buffer
          data = await processCsvBuffer(fileBuffer);
        } else if (fileType === 'text/plain' || fileType === 'application/json' || 
                  req.file.originalname.endsWith('.txt') || req.file.originalname.endsWith('.json')) {
          // Read text or JSON file from buffer
          const fileContent = fileBuffer.toString('utf-8');
          if (req.file.originalname.endsWith('.json') || fileType === 'application/json') {
            try {
              data = JSON.parse(fileContent);
            } catch (e) {
              data = fileContent;
            }
          } else {
            data = fileContent;
          }
        }
      } catch (fileError) {
        console.error('File processing error:', fileError);
        return res.status(500).json({ error: 'Error processing uploaded file: ' + fileError.message });
      }
    }
    
    // Get answer from LLM
    const answer = await getAnswerFromLLM(question, assignmentNum, data);
    
    // Cleanup temporary files if necessary
    if (cleanup) {
      cleanup();
    }
    
    res.json({ answer });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'Error processing your request: ' + error.message });
  }
});

// Add a GET handler for the root path
app.get('/', (req, res) => {
  res.json({
    message: "Assignment Helper API",
    documentation: "Send POST requests to /api with 'question' parameter and optional file attachments",
    example: "POST /api with multipart/form-data including 'question' field and optional 'file' field",
    healthCheck: "GET /api/health for API status"
  });
});

// Add a GET handler for the /api path
app.get('/api', (req, res) => {
  res.json({
    message: "This endpoint requires a POST request",
    usage: "Send a POST request with 'question' as a parameter and optional file attachments",
    example: {
      curl: "curl -X POST 'https://your-app.vercel.app/api/' -H 'Content-Type: multipart/form-data' -F 'question=Your question here' -F 'file=@yourfile.zip'",
      response: {
        answer: "The answer to your question"
      }
    }
  });
});

// Default route for health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Determine port
const PORT = process.env.PORT || 3000;

// Start server if not being imported (for serverless)
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Try these options:`);
      console.error(`1. Kill the process using port ${PORT}`);
      console.error(`2. Use a different port: PORT=3001 node api/index.js`);
    } else {
      console.error('Server error:', err);
    }
  });
}

// Export for serverless functions
module.exports = app; 