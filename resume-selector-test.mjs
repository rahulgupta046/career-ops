#!/usr/bin/env node

import { selectResumeProfile } from './resume-selector.mjs';

const fixtures = [
  {
    name: 'GenAI title',
    title: 'Senior GenAI / LLM Engineer',
    jdText: 'Build agentic RAG systems and prompt pipelines.',
    expected: 'genai',
  },
  {
    name: 'ML infra title',
    title: 'Machine Learning Infrastructure Engineer',
    jdText: 'Improve model training pipelines and serving reliability.',
    expected: 'ml',
  },
  {
    name: 'Software backend title',
    title: 'Senior Backend Software Engineer',
    jdText: 'Design distributed services and APIs.',
    expected: 'software',
  },
  {
    name: 'Ambiguous fallback',
    title: 'Technical Program Specialist',
    jdText: 'Coordinate cross-functional workstreams.',
    expected: 'ml',
  },
];

let failed = 0;
for (const f of fixtures) {
  const result = selectResumeProfile({ title: f.title, jdText: f.jdText });
  const pass = result.selected_profile === f.expected;
  const exists = result.resume.exists;
  if (!pass || !exists) {
    failed += 1;
    console.error(
      `FAIL: ${f.name} | expected=${f.expected} got=${result.selected_profile} exists=${exists}`,
    );
  } else {
    console.log(`PASS: ${f.name} -> ${result.selected_profile}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} fixture(s) failed.`);
  process.exit(1);
}

console.log('\nAll resume selector fixtures passed.');
