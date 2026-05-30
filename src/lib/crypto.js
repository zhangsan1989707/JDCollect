function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function generateJobId(job) {
  const raw = `${job.url || ''}_${job.title || ''}_${job.company || ''}`;
  return simpleHash(raw);
}

export { simpleHash, generateJobId };
