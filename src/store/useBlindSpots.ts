import { create } from 'zustand';
import { getAllQuizResults } from '../lib/db';
import {
  extractConfidenceRecords,
  computeSubjectBlindSpots,
  buildReviewQueue,
  computeOverallStats,
  type ConfidenceRecord,
  type SubjectBlindSpot,
  type ReviewQueueItem,
  type OverallStats,
} from '../lib/blindSpot';

interface BlindSpotState {
  loaded:            boolean;
  records:           ConfidenceRecord[];
  subjectBlindSpots: SubjectBlindSpot[];
  reviewQueue:       ReviewQueueItem[];
  overallStats:      OverallStats;
  load: (subjectTitles: Record<string, string>) => Promise<void>;
}

const EMPTY_STATS: OverallStats = {
  totalRated: 0, overallCalibration: 0, overallAccuracy: 0,
  overallExamRisk: 0, totalBlindSpots: 0, overconfidenceIndex: 0,
};

export const useBlindSpots = create<BlindSpotState>((set) => ({
  loaded:            false,
  records:           [],
  subjectBlindSpots: [],
  reviewQueue:       [],
  overallStats:      EMPTY_STATS,

  load: async (subjectTitles: Record<string, string>) => {
    try {
      const results         = await getAllQuizResults();
      const records         = extractConfidenceRecords(results);
      const subjectSpots    = computeSubjectBlindSpots(records, subjectTitles);
      const reviewQueue     = buildReviewQueue(records);
      const overallStats    = computeOverallStats(records, subjectSpots);
      set({ loaded: true, records, subjectBlindSpots: subjectSpots, reviewQueue, overallStats });
    } catch {
      set({ loaded: true });
    }
  },
}));
