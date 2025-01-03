require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');

const app = express();
const port = 3001;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(express.json());

app.post('/api/tailor', async (req, res) => {
  try {
    const { jobDescription, userCV } = req.body;

    // TODO: Add proper prompt engineering
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a professional CV tailoring assistant."
        },
        {
          role: "user",
          content: `Please tailor this CV:\n${userCV}\n\nTo match this job description:\n${jobDescription}`
        }
      ]
    });

    res.json({ tailoredCV: completion.choices[0].message.content });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to tailor CV' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 