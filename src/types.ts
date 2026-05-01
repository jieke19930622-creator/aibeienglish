/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WordDefinition {
  word: string;
  phonetic?: string;
  meaning: string;
  example: string;
  mnemonic?: string;
}

export interface UserWord extends WordDefinition {
  id: string;
  status: 'new' | 'learning' | 'mastered';
  lastReviewed?: number;
  nextReview?: number;
  easeFactor: number;
  interval: number;
  addedAt: number;
}

export interface LearningStats {
  total: number;
  learning: number;
  mastered: number;
}
