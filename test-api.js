const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

// Set the API endpoint
const API_ENDPOINT = process.env.API_ENDPOINT || 'http://localhost:3000/api';
console.log(`Testing API at: ${API_ENDPOINT}`);

// Sample questions to test
const TEST_QUESTIONS = [
  {
    description: 'Simple question without file',
    question: 'What is the difference between pandas Series and DataFrame?',
    file: null
  },
  {
    description: 'Question with sample CSV file',
    question: 'What is the mean value of the "score" column in the attached CSV file?',
    file: {
      path: path.join(__dirname, 'sample-files', 'test-data.csv'),
      createContent: () => {
        const dir = path.join(__dirname, 'sample-files');
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        const csvContent = 'id,name,score\n1,Alice,95\n2,Bob,87\n3,Charlie,92\n4,David,78\n5,Eve,91';
        fs.writeFileSync(path.join(dir, 'test-data.csv'), csvContent);
      }
    }
  }
  // Add more test cases here
];

// Function to test a question
async function testQuestion(testCase) {
  console.log(`\nTesting: ${testCase.description}`);
  console.log(`Question: ${testCase.question}`);
  
  // Create form data
  const formData = new FormData();
  formData.append('question', testCase.question);
  
  // Handle file if present
  if (testCase.file) {
    // Create sample file if it doesn't exist
    if (!fs.existsSync(testCase.file.path) && testCase.file.createContent) {
      testCase.file.createContent();
    }
    
    if (fs.existsSync(testCase.file.path)) {
      const fileStream = fs.createReadStream(testCase.file.path);
      formData.append('file', fileStream, path.basename(testCase.file.path));
      console.log(`Attached file: ${path.basename(testCase.file.path)}`);
    } else {
      console.log(`Warning: File ${testCase.file.path} doesn't exist, sending request without file`);
    }
  }
  
  try {
    // Send request to API
    const startTime = Date.now();
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      body: formData
    });
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Process response
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ Success (${elapsedTime}s):`);
      console.log(`Answer: ${result.answer}`);
    } else {
      console.log(`❌ Error (${elapsedTime}s):`);
      console.log(result);
    }
  } catch (error) {
    console.log('❌ Failed to connect to API:');
    console.error(error.message);
  }
}

// Main function to run all tests
async function runTests() {
  console.log('Starting API tests...');
  
  for (const testCase of TEST_QUESTIONS) {
    await testQuestion(testCase);
  }
  
  console.log('\nAll tests completed!');
}

// Run the tests
runTests(); 