// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// API route for chat requests
app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY is not defined in the environment variables.');
    return res.status(500).json({
      error: {
        message: 'Gemini API Key is missing on the server. Please add GEMINI_API_KEY to your .env file.'
      }
    });
  }

  const { contents, systemInstruction, generationConfig } = req.body;

  if (!contents) {
    return res.status(400).json({
      error: {
        message: 'Missing "contents" field in the request body.'
      }
    });
  }

  try {
    console.log(`Forwarding query to Gemini API (Model: gemini-2.5-flash)...`);
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents,
        systemInstruction,
        generationConfig: generationConfig || {
          temperature: 0.7,
          maxOutputTokens: 800
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API Error details:', data.error);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Proxy Server Error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to communicate with Google Gemini API: ' + error.message
      }
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`SABA AI Chatbot Proxy Server is running!`);
  console.log(`Accepting requests on: http://localhost:${PORT}`);
  console.log(`Make sure GEMINI_API_KEY is configured in your .env`);
  console.log(`==================================================`);
});
