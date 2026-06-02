import Anthropic from '@anthropic-ai/sdk';

function extractJson(text) {
  const trimmed = String(text || '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('Claude response did not contain JSON');
  return JSON.parse(trimmed.slice(start, end + 1));
}

export async function reviewJobWithClaude(job, candidateProfile) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const profile = candidateProfile.compressed_profile || '';
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

  const message = await client.messages.create({
    model,
    max_tokens: 500,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: `Given my fixed resume profile and this job description, return JSON only.

Candidate profile:
${profile}

Job:
Company: ${job.company}
Title: ${job.title}
Location: ${job.location}
Description:
${String(job.description || '').slice(0, 6000)}

Return exactly:
{
  "decision": "apply" | "skip" | "maybe",
  "score": 0-100,
  "reason": "...",
  "risk": "...",
  "custom_answer_needed": true/false
}`,
      },
    ],
  });

  const text = message.content
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('\n');

  return extractJson(text);
}
