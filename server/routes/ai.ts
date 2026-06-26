import { Router } from 'express';

const router = Router();

router.post('/generate', async (req, res) => {
  try {
    const { model, payload, clientApiKey } = req.body;
    
    // Use server side env variable or fallback to manually inputted client key
    const apiKey = process.env.GEMINI_API_KEY || clientApiKey;
    if (!apiKey) {
      return res.status(400).json({ error: 'Gemini API Key missing. Please add GEMINI_API_KEY inside the Secrets panel of AI Studio.' });
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
    const apiRes = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey 
      },
      body: JSON.stringify(payload)
    });
    
    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return res.status(apiRes.status).json({ error: `Gemini API Error: ${errText}` });
    }
    
    const data = await apiRes.json();
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
