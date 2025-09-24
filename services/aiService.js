import { getGroq } from '../config/groq.js';

export async function generateDualPost(params) {
  const { prompt, context, profileData, documentContext, trendingContext, includeTrends } = params;
  
  const groq = getGroq();
  if (!groq) {
    throw new Error('AI service not configured');
  }

  if (!process.env.GROQ_API_KEY) {
    throw new Error('AI service configuration error');
  }

  const dualPostPrompt = createDualPostPrompt(params);
  
  console.log('Generating dual posts...');
  
  const completion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: "You are a professional LinkedIn content creator. Always follow the exact format requested." },
      { role: "user", content: dualPostPrompt }
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.7,
    max_tokens: 2000,
    stream: false
  });

  const generatedContent = completion.choices[0]?.message?.content;
  
  if (!generatedContent) {
    throw new Error('No content generated from AI service');
  }

  return parseGeneratedContent(generatedContent);
}

function createDualPostPrompt(params) {
  const { prompt, context, profileData, documentContext, trendingContext, includeTrends } = params;
  
  return `You are a LinkedIn content creator. Create TWO separate posts based on the same topic but with different lengths and approaches.

User's Profile:
- Goals: ${profileData.goals || 'Not specified'}
- Voice Style: ${profileData.voiceStyle || 'Professional'}
- Topics: ${Array.isArray(profileData.topics) ? profileData.topics.join(', ') : 'General business'}

${documentContext ? `Context: ${String(documentContext).substring(0, 1000)}` : ''}
${trendingContext}

Topic/Prompt: ${prompt}
${context ? `Additional context: ${context}` : ''}

Please create:

1. SHORT POST (600-900 characters, approximately 100-150 words):
- Quick, punchy insight
- One clear takeaway
- 2-3 relevant hashtags
- Direct and concise
- Attention-grabbing opening

2. LONG POST (1200-2000 characters, approximately 200-350 words):
- Detailed story or analysis
- Multiple insights or lessons
- 4-5 relevant hashtags
- Include personal anecdote or case study if relevant
- More comprehensive exploration of the topic

${includeTrends ? 'Incorporate the trending topics naturally where relevant.' : ''}

Format your response EXACTLY like this:
[SHORT POST]
(your short post content here)

[LONG POST]
(your long post content here)`;
}

function parseGeneratedContent(generatedContent) {
  const shortPostMatch = generatedContent.match(/\[SHORT POST\]\n([\s\S]*?)(?=\[LONG POST\]|$)/);
  const longPostMatch = generatedContent.match(/\[LONG POST\]\n([\s\S]*?)$/);

  const shortPost = shortPostMatch ? shortPostMatch[1].trim() : '';
  const longPost = longPostMatch ? longPostMatch[1].trim() : '';

  if (!shortPost || !longPost) {
    console.error('Failed to parse dual posts, using fallback...');
    const fallbackLong = generatedContent;
    const fallbackShort = generatedContent.substring(0, 900) + '...';
    
    return {
      shortPost: fallbackShort,
      longPost: fallbackLong,
      metadata: {
        model: "llama-3.3-70b-versatile",
        timestamp: new Date().toISOString(),
        usedTrends: false,
        trendsUsed: 0
      }
    };
  }

  return {
    shortPost,
    longPost,
    metadata: {
      model: "llama-3.3-70b-versatile",
      timestamp: new Date().toISOString(),
      shortPostLength: shortPost.length,
      longPostLength: longPost.length
    }
  };
}
