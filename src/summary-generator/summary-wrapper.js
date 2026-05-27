'use strict';

const { generateSummary } = require('./summary-generator');

async function runSummaryGenerator(items) {
  const results = [];

  for (const item of items) {
    try {
      const candidateData = item.json;
      if (candidateData.scoringStatus !== 'SUCCESS') {
        results.push({ json: { ...item.json, summaryStatus: 'SKIPPED' } });
        continue;
      }

      const jobTitle = candidateData.jd ? candidateData.jd.title : 'Posisi Tidak Diketahui';

      const { summary } = await generateSummary({
        candidateName: candidateData.name || 'Kandidat',
        jobTitle,
        score: candidateData.score,
        recommendation: candidateData.recommendation,
        candidateProfile: candidateData,
        jdMatchDetails: candidateData,
      });

      results.push({
        json: {
          ...item.json,
          summary,
          summaryStatus: 'SUCCESS'
        }
      });
    } catch (error) {
      results.push({
        json: {
          ...item.json,
          summary: 'GENERATION_FAILED',
          summaryStatus: 'ERROR',
          summaryError: error.message
        }
      });
    }
  }

  return results;
}

module.exports = { runSummaryGenerator };
