import type { QuizResult } from './db';

export interface ConfidenceRecord {
  questionId:   string;
  questionText: string;
  confidence:   number; // 1-5
  wasCorrect:   boolean;
  subjectId:    string;
  quizId:       string;
  quizTitle:    string;
  completedAt:  number;
}

export interface SubjectBlindSpot {
  subjectId:           string;
  subjectTitle:        string;
  totalRated:          number;
  avgConfidence:       number;  // 1-5
  accuracy:            number;  // 0-100
  calibrationScore:    number;  // 0-100
  overconfidenceIndex: number;  // 0-100 % of high-conf that were wrong
  examRiskScore:       number;  // 0-100
  isBlindSpot:         boolean;
}

export interface ReviewQueueItem {
  questionId:          string;
  questionText:        string;
  quizId:              string;
  quizTitle:           string;
  subjectId:           string;
  priority:            number;
  reason:              'blind_spot' | 'high_confidence_wrong' | 'repeated_wrong';
  lastConfidence:      number;
  timesHighConfWrong:  number;
}

export interface OverallStats {
  totalRated:          number;
  overallCalibration:  number;
  overallAccuracy:     number;
  overallExamRisk:     number;
  totalBlindSpots:     number;
  overconfidenceIndex: number;
}

export function extractConfidenceRecords(results: QuizResult[]): ConfidenceRecord[] {
  const records: ConfidenceRecord[] = [];
  for (const result of results) {
    for (const q of result.questions) {
      if (q.confidenceRating !== undefined) {
        records.push({
          questionId:   q.questionId,
          questionText: q.questionText,
          confidence:   q.confidenceRating,
          wasCorrect:   q.wasCorrect,
          subjectId:    result.subjectId,
          quizId:       result.quizId,
          quizTitle:    result.quizTitle,
          completedAt:  result.completedAt,
        });
      }
    }
  }
  return records;
}

// Mean-absolute-error between normalised confidence and binary outcome
export function computeCalibrationScore(records: ConfidenceRecord[]): number {
  if (records.length === 0) return 0;
  const mae = records.reduce((sum, r) => {
    const expected = ((r.confidence - 1) / 4) * 100;
    const actual   = r.wasCorrect ? 100 : 0;
    return sum + Math.abs(expected - actual);
  }, 0) / records.length;
  return Math.max(0, Math.round(100 - mae));
}

// % of high-confidence answers (≥4) that were wrong
export function computeOverconfidenceIndex(records: ConfidenceRecord[]): number {
  const highConf = records.filter(r => r.confidence >= 4);
  if (highConf.length === 0) return 0;
  const wrong = highConf.filter(r => !r.wasCorrect);
  return Math.round((wrong.length / highConf.length) * 100);
}

export function computeExamRiskScore(
  calibration:    number,
  overconfidence: number,
  accuracy:       number,
): number {
  const calRisk  = Math.max(0, 100 - calibration);
  const accRisk  = Math.max(0, 100 - accuracy);
  return Math.round(overconfidence * 0.45 + calRisk * 0.35 + accRisk * 0.20);
}

export function computeSubjectBlindSpots(
  records:       ConfidenceRecord[],
  subjectTitles: Record<string, string>,
): SubjectBlindSpot[] {
  const bySubject: Record<string, ConfidenceRecord[]> = {};
  for (const r of records) {
    (bySubject[r.subjectId] ??= []).push(r);
  }

  return Object.entries(bySubject).map(([subjectId, recs]) => {
    const accuracy      = Math.round((recs.filter(r => r.wasCorrect).length / recs.length) * 100);
    const avgConf       = recs.reduce((a, r) => a + r.confidence, 0) / recs.length;
    const calibration   = computeCalibrationScore(recs);
    const overconfidence = computeOverconfidenceIndex(recs);
    const examRisk      = computeExamRiskScore(calibration, overconfidence, accuracy);
    const isBlindSpot   = avgConf >= 3.5 && accuracy < 55 && recs.length >= 3;
    return {
      subjectId,
      subjectTitle:        subjectTitles[subjectId] ?? subjectId,
      totalRated:          recs.length,
      avgConfidence:       Math.round(avgConf * 10) / 10,
      accuracy,
      calibrationScore:    calibration,
      overconfidenceIndex: overconfidence,
      examRiskScore:       examRisk,
      isBlindSpot,
    };
  }).sort((a, b) => b.examRiskScore - a.examRiskScore);
}

export function buildReviewQueue(records: ConfidenceRecord[]): ReviewQueueItem[] {
  const byQuestion: Record<string, ConfidenceRecord[]> = {};
  for (const r of records) {
    (byQuestion[r.questionId] ??= []).push(r);
  }

  const items: ReviewQueueItem[] = [];
  for (const [questionId, recs] of Object.entries(byQuestion)) {
    const sorted       = recs.sort((a, b) => b.completedAt - a.completedAt);
    const latest       = sorted[0];
    const highConfWrong = recs.filter(r => r.confidence >= 4 && !r.wasCorrect);
    const totalWrong   = recs.filter(r => !r.wasCorrect);

    if (highConfWrong.length === 0 && totalWrong.length < 2) continue;

    let reason: ReviewQueueItem['reason'] = 'high_confidence_wrong';
    let priority = highConfWrong.length * 20;

    if (highConfWrong.length >= 2) {
      reason   = 'blind_spot';
      priority = 80 + highConfWrong.length * 10;
    } else if (totalWrong.length >= 2) {
      reason   = 'repeated_wrong';
      priority = totalWrong.length * 15;
    }

    const daysSince = (Date.now() - latest.completedAt) / 86_400_000;
    if (daysSince < 7) priority += 10;

    items.push({
      questionId,
      questionText:       latest.questionText,
      quizId:             latest.quizId,
      quizTitle:          latest.quizTitle,
      subjectId:          latest.subjectId,
      priority,
      reason,
      lastConfidence:     latest.confidence,
      timesHighConfWrong: highConfWrong.length,
    });
  }

  return items.sort((a, b) => b.priority - a.priority).slice(0, 25);
}

export function computeOverallStats(
  records:         ConfidenceRecord[],
  subjectSpots:    SubjectBlindSpot[],
): OverallStats {
  if (records.length === 0) {
    return { totalRated: 0, overallCalibration: 0, overallAccuracy: 0, overallExamRisk: 0, totalBlindSpots: 0, overconfidenceIndex: 0 };
  }
  const accuracy       = Math.round((records.filter(r => r.wasCorrect).length / records.length) * 100);
  const calibration    = computeCalibrationScore(records);
  const overconfidence = computeOverconfidenceIndex(records);
  const examRisk       = computeExamRiskScore(calibration, overconfidence, accuracy);
  return {
    totalRated:          records.length,
    overallCalibration:  calibration,
    overallAccuracy:     accuracy,
    overallExamRisk:     examRisk,
    totalBlindSpots:     subjectSpots.filter(s => s.isBlindSpot).length,
    overconfidenceIndex: overconfidence,
  };
}
