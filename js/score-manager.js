/**
 * score-manager.js — レベル＆統計管理
 * v1.1.0
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

  const MAX_WEAK_KANJI = 50;

  let stats = {
    quizCorrect: 0,
    quizTotal: 0,
    puzzleCorrect: 0,
    puzzleTotal: 0,
    maxCombo: 0,
    totalStudied: 0,
    perGrade: {},  // { [grade]: { quizCorrect, quizTotal } }
  };

  let weakKanji = {}; // { [char]: { grade, types:[], lastMistake } }

  let onLevelUp = null; // callback: (newLevel) => void

  function init(opts = {}) {
    onLevelUp = opts.onLevelUp || null;
  }

  function loadState(saved) {
    if (saved && typeof saved === 'object') {
      // 旧データ後方互換: perGrade/weakKanjiがなくてもエラーにならない
      const { perGrade: pg, weakKanji: wk, ...rest } = saved;
      Object.assign(stats, rest);
      if (pg && typeof pg === 'object') {
        stats.perGrade = pg;
      }
      if (wk && typeof wk === 'object') {
        weakKanji = wk;
      }
    }
  }

  function getState() {
    return { ...stats, perGrade: { ...stats.perGrade }, weakKanji: { ...weakKanji } };
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
   * @param {number} correct
   * @param {number} total
   * @param {number} maxCombo
   * @param {number} [grade] - 学年（オプション）
   */
  function recordQuiz(correct, total, maxCombo, grade) {
    stats.quizCorrect += correct;
    stats.quizTotal += total;
    if (maxCombo > stats.maxCombo) stats.maxCombo = maxCombo;

    if (grade) {
      if (!stats.perGrade[grade]) {
        stats.perGrade[grade] = { quizCorrect: 0, quizTotal: 0 };
      }
      stats.perGrade[grade].quizCorrect += correct;
      stats.perGrade[grade].quizTotal += total;
    }
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

  /**
   * にがてな漢字を記録
   * @param {string} char - 漢字1文字
   * @param {number} grade - 学年
   * @param {string} type - クイズタイプ (reading, strokeCount, etc.)
   */
  function recordMistake(char, grade, type) {
    if (weakKanji[char]) {
      // 既存エントリ更新
      if (!weakKanji[char].types.includes(type)) {
        weakKanji[char].types.push(type);
      }
      weakKanji[char].lastMistake = Date.now();
    } else {
      // 上限チェック: 古い順に削除
      const keys = Object.keys(weakKanji);
      if (keys.length >= MAX_WEAK_KANJI) {
        let oldestKey = keys[0];
        let oldestTime = weakKanji[keys[0]].lastMistake || 0;
        for (const k of keys) {
          const t = weakKanji[k].lastMistake || 0;
          if (t < oldestTime) {
            oldestTime = t;
            oldestKey = k;
          }
        }
        delete weakKanji[oldestKey];
      }
      weakKanji[char] = {
        grade: grade,
        types: [type],
        lastMistake: Date.now(),
      };
    }
  }

  /**
   * 復習で正解したらにがてな漢字から削除
   * @param {string} char
   */
  function removeWeakKanji(char) {
    delete weakKanji[char];
  }

  /**
   * にがてな漢字一覧を取得
   * @returns {Object} { [char]: { grade, types, lastMistake } }
   */
  function getWeakKanji() {
    return { ...weakKanji };
  }

  /**
   * 学年べつ統計を取得
   * @returns {Object} { [grade]: { quizCorrect, quizTotal } }
   */
  function getPerGradeStats() {
    return { ...stats.perGrade };
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
    recordMistake,
    removeWeakKanji,
    getWeakKanji,
    getPerGradeStats,
  };
})();
