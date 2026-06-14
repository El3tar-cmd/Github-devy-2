import { Router } from 'express';
import * as cheerio from 'cheerio';

const router = Router();

router.post('/search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'query required' });

    let results: { title: string; snippet: string; url?: string }[] = [];

    // Fallback 1: DuckDuckGo HTML selector parsing
    try {
      const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (resp.ok) {
        const html = await resp.text();
        const $ = cheerio.load(html);

        $('.web-result, .result, .result__body').each((i, el) => {
          const titleEl = $(el).find('.result__title, .result-link, a');
          const title = titleEl.text().trim();
          const href = titleEl.attr('href');
          const snippet = $(el).find('.result__snippet, .result-snippet, .result__body').text().trim();
          if (title && snippet) {
            results.push({ title, snippet, url: href });
          }
        });
      }
    } catch (e) {
      console.error('DDG HTML search error:', e);
    }

    // Fallback 2: DuckDuckGo Lite version
    if (results.length === 0) {
      try {
        const resp = await fetch('https://lite.duckduckgo.com/lite/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: `q=${encodeURIComponent(query)}`
        });
        if (resp.ok) {
          const html = await resp.text();
          const $ = cheerio.load(html);
          
          $('td.result-snippet').each((i, el) => {
            const table = $(el).closest('table');
            const titleEl = table.find('.result-link');
            const title = titleEl.text().trim();
            const href = titleEl.attr('href');
            const snippet = $(el).text().trim();
            if (title && snippet) {
              results.push({ title, snippet, url: href });
            }
          });
        }
      } catch (e) {
        console.error('DDG Lite search error:', e);
      }
    }

    // Format the results
    const formatted = results.map(r => {
      let segment = `### ${r.title}\n${r.snippet}`;
      if (r.url) segment += `\n*Source: ${r.url}*`;
      return segment;
    }).slice(0, 10).join('\n\n');

    res.json({ results: formatted.substring(0, 4000) || 'No results found. Please try a different query or use Google Search grounding.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/browse', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });

    let targetUrl = url;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    const resp = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!resp.ok) {
      throw new Error(`Failed to fetch web page: HTTP status ${resp.status}`);
    }

    const html = await resp.text();
    const $ = cheerio.load(html);

    // Remove scripts, styles, layouts, sidebars
    $('script, style, nav, footer, header, iframe, link, meta, noscript, aside').remove();

    const textBlocks: string[] = [];
    $('h1, h2, h3, h4, h5, h6, p, ul li, ol li, article').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10) {
        textBlocks.push(text);
      }
    });

    let mainText = textBlocks.join('\n\n');
    if (mainText.length < 50) {
      // Fallback to plain body
      mainText = $('body').text().replace(/\s+/g, ' ').trim();
    }

    res.json({ content: mainText.substring(0, 5000) || 'No readable text content found on the page.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
