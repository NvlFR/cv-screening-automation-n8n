'use strict';

const { calculateScore } = require('./calculator');
const { calculateEducationScore } = require('./education-scorer');
const { calculateCertificationScore } = require('./certification-scorer');

function runScoringEngine(items) {
  const results = [];

  for (const item of items) {
    try {
      const candidateData = item.json;
      const matchResult = item.json;

      if (matchResult.jdMatchStatus !== 'SUCCESS') {
        results.push({ json: { ...item.json, scoringStatus: 'SKIPPED' } });
        continue;
      }

      const educationScore = calculateEducationScore(candidateData.education || []);
      const certScore = calculateCertificationScore(
        candidateData.certifications || [],
        matchResult.jd ? matchResult.jd.mandatory_skills : []
      );

      const { score, recommendation } = calculateScore({
        skillMatch: matchResult.skill_match.score,
        experience: matchResult.experience_relevance.score,
        education: educationScore,
        industry: matchResult.industry_relevance.score,
        certification: certScore,
      });

      results.push({
        json: {
          ...item.json,
          score,
          recommendation,
          dimension_scores: {
            skill_match: matchResult.skill_match.score,
            experience: matchResult.experience_relevance.score,
            education: educationScore,
            industry: matchResult.industry_relevance.score,
            certification: certScore,
          },
          scoringStatus: 'SUCCESS'
        }
      });
    } catch (error) {
      results.push({
        json: {
          ...item.json,
          scoringStatus: 'ERROR',
          scoringError: error.message
        }
      });
    }
  }

  return results;
}

module.exports = { runScoringEngine };
