'use strict';

const { matchCandidateToJD } = require('./jd-matcher');
const { getActiveJD } = require('./jd-fetcher');
const { JDCache } = require('../jd-cache/redis-cache');
const redis = require('../cache/redis-client');

async function runJDMatcher(items) {
  const jdCache = new JDCache(redis.getClient());
  const results = [];

  for (const item of items) {
    try {
      const candidateData = item.json;
      const jobId = candidateData.job_id || candidateData.positionId;

      if (!jobId) {
        results.push({ json: { ...item.json, jdMatchStatus: 'NO_JD_AVAILABLE' } });
        continue;
      }

      let jd = await jdCache.get(jobId);
      if (!jd) {
        jd = await getActiveJD(jobId);
        if (jd.status !== 'NO_JD_AVAILABLE') {
          await jdCache.set(jobId, jd);
        }
      }

      if (jd.status === 'NO_JD_AVAILABLE') {
        results.push({ json: { ...item.json, jdMatchStatus: 'NO_JD_AVAILABLE' } });
        continue;
      }

      const matchResult = await matchCandidateToJD(candidateData, jd);
      results.push({
        json: {
          ...item.json,
          ...matchResult,
          jd,
          jdMatchStatus: 'SUCCESS'
        }
      });
    } catch (error) {
      results.push({
        json: {
          ...item.json,
          jdMatchStatus: 'ERROR',
          jdMatchError: error.message
        }
      });
    }
  }

  return results;
}

module.exports = { runJDMatcher };
