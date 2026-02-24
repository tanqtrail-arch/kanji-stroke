/**
 * score-manager.js — レベル＆統計管理
 * v1.0.0
 */

const ScoreManager = (() => {
  'use strict';

  // レベルアップに必要な累計ALT（段階的に増加）
  const LEVEL_THRESHOLDS = [
    0,     // Lv1
    50,    // Lv2
    150,   // Lv3
    300,   // Lv4
    500,   // Lv5
    800,   // Lv6
    1200,  // Lv7
    1700,  // Lv8
    2300,  // Lv9
    3000,  // Lv10
    4000,  // Lv11
    5000,  // Lv12
    6500,  // Lv13
    8000,  // Lv14
    10000, // Lv15
    13000, // Lv16
    16000, // Lv17
    20000, // Lv18
    25000, // Lv19
    30000, // Lv20
  ];

  let stats = {
    quizCorrect: 0,
    quizTotal: 0,
    puzzleCorrect: 0,
    puzzleTotal: 0,
    maxCombo: 0,
    totalStudied: 0,
  };

  let onLevelUp = null; // callback: (newLevel) => void

  function init(opts = {}) {
    onLevelUp = opts.onLevelUp || null;
  }

  function loadState(saved) {
    if (saved && typeof saved === 'object') {
      Object.assign(stats, saved);
    }
  }

  function getState() {
    return { ...stats };
  }

  /**
   * 累計ALTからレベルを計算
   * @param {number} totalAlt
   * @returns {number} レベル (1〜)
   */
  function calcLevel(totalAlt) {
    let level = 1;
    for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
      if (totalAlt >= LEVEL_THRESHOLDS[i]) {
        level = i + 1;
      } else {
        break;
      }
    }
    // 上限超えた場合
    if (totalAlt >= LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]) {
      level = LEVEL_THRESHOLDS.length;
    }
    return level;
  }

  /**
   * 次のレベルまでの残りALTと進捗率を取得
   */
  function getLevelProgress(totalAlt) {
    const level = calcLevel(totalAlt);
    const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
    const nextThreshold = LEVEL_THRESHOLDS[level] || null;

    if (!nextThreshold) {
      return { level, progress: 1, remaining: 0, current: totalAlt, next: null };
    }

    const range = nextThreshold - currentThreshold;
    const progress = range > 0 ? (totalAlt - currentThreshold) / range : 1;

    return {
      level,
      progress: Math.min(progress, 1),
      remaining: nextThreshold - totalAlt,
      current: totalAlt,
      next: nextThreshold,
    };
  }

  /**
   * ALT追加時にレベルアップ判定
   * @param {number} prevAlt - 追加前のALT
   * @param {number} newAlt - 追加後のALT
   */
  function checkLevelUp(prevAlt, newAlt) {
    const prevLevel = calcLevel(prevAlt);
    const newLevel = calcLevel(newAlt);
    if (newLevel > prevLevel && onLevelUp) {
      onLevelUp(newLevel);
    }
  }

  /**
   * クイズ結果を記録
   */
  function recordQuiz(correct, total, maxCombo) {
    stats.quizCorrect += correct;
    stats.quizTotal += total;
    if (maxCombo > stats.maxCombo) stats.maxCombo = maxCombo;
  }

  /**
   * パズル結果を記録
   */
  function recordPuzzle(correct, total, maxCombo) {
    stats.puzzleCorrect += correct;
    stats.puzzleTotal += total;
    if (maxCombo > stats.maxCombo) stats.maxCombo = maxCombo;
  }

  /**
   * 学習済み数を更新
   */
  function updateStudied(count) {
    stats.totalStudied = count;
  }

  return {
    init,
    loadState,
    getState,
    calcLevel,
    getLevelProgress,
    checkLevelUp,
    recordQuiz,
    recordPuzzle,
    updateStudied,
  };
})();
