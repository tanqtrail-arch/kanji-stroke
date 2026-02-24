/**
 * bushu-puzzle.js — 部首パズルエンジン v2.0.0
 * 10枚のカード（5漢字×2パーツ）をマッチングするパズル
 */

const BushuPuzzle = (() => {
  'use strict';

  const PAIRS_PER_SET = 5;
  const TIME_LIMITS = { 1: 0, 2: 60, 3: 40 };

  let allPuzzles = [];
  let roundPuzzles = [];   // 今回の5問
  let cards = [];          // シャッフルされた10枚のカード
  let matchedCount = 0;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let earnedAlt = 0;
  let mistakes = [];
  let mistakeCount = 0;
  let difficulty = 1;

  let timerInterval = null;
  let timeLeft = 0;
  let onTimerTick = null;
  let onTimeUp = null;

  /**
   * パズルデータを読み込む（bushu-data.json）
   */
  function loadData(data) {
    // 2パーツのものだけフィルタ（3パーツ以上は除外）
    allPuzzles = data.filter(p => p.parts.length === 2);
  }

  /**
   * パズル開始
   * @param {number} grade - 学年(1-6)、0=全学年
   * @param {number} diff - 難易度(1-3)
   * @param {Object} callbacks - { onTimerTick, onTimeUp }
   * @returns {Object|null} カード配列
   */
  function start(grade, diff, callbacks = {}) {
    difficulty = diff;
    onTimerTick = callbacks.onTimerTick || null;
    onTimeUp = callbacks.onTimeUp || null;

    let pool = allPuzzles;
    if (grade > 0) {
      pool = pool.filter(p => p.grade === grade);
    }
    pool = pool.filter(p => p.difficulty <= diff);

    if (pool.length < PAIRS_PER_SET) return null;

    roundPuzzles = shuffle([...pool]).slice(0, PAIRS_PER_SET);
    matchedCount = 0;
    score = 0;
    combo = 0;
    maxCombo = 0;
    earnedAlt = 0;
    mistakes = [];
    mistakeCount = 0;

    // カード生成: 各パズルの2パーツを個別カードにする
    cards = [];
    roundPuzzles.forEach((p, pairIdx) => {
      cards.push({
        id: pairIdx * 2,
        pairIdx: pairIdx,
        text: p.parts[0],
        answer: p.answer,
        hint: p.hint,
        matched: false
      });
      cards.push({
        id: pairIdx * 2 + 1,
        pairIdx: pairIdx,
        text: p.parts[1],
        answer: p.answer,
        hint: p.hint,
        matched: false
      });
    });
    cards = shuffle(cards);

    return getRoundData();
  }

  /**
   * 現在のラウンドデータ取得
   */
  function getRoundData() {
    return {
      cards: cards.map(c => ({
        id: c.id,
        text: c.text,
        matched: c.matched
      })),
      total: PAIRS_PER_SET,
      matchedCount,
      puzzles: roundPuzzles.map(p => ({
        answer: p.answer,
        parts: p.parts,
        hint: p.hint
      }))
    };
  }

  /**
   * タイマー開始
   */
  function startTimer() {
    stopTimer();
    const limit = TIME_LIMITS[difficulty] || 0;
    if (limit <= 0) return;

    timeLeft = limit;
    if (onTimerTick) onTimerTick(timeLeft);

    timerInterval = setInterval(() => {
      timeLeft--;
      if (onTimerTick) onTimerTick(timeLeft);
      if (timeLeft <= 0) {
        stopTimer();
        if (onTimeUp) onTimeUp();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  /**
   * 2枚のカードをマッチング判定（テキストベース）
   * 同じテキストのカードでも、未完成の漢字のパーツと一致すれば正解
   * @param {number} id1 - 1枚目のカードID
   * @param {number} id2 - 2枚目のカードID
   * @returns {Object} { correct, answer, parts, hint, combo, score, isComplete, matchedPairIdx }
   */
  function tryMatch(id1, id2) {
    const card1 = cards.find(c => c.id === id1);
    const card2 = cards.find(c => c.id === id2);
    if (!card1 || !card2 || card1.id === card2.id) return null;

    // 選ばれた2枚のテキスト
    const texts = [card1.text, card2.text];
    const textsReversed = [card2.text, card1.text];

    // まだ完成していないパズルの中から、テキストの組み合わせが一致するものを探す
    let matchedPuzzle = null;
    let matchedPuzzleIdx = -1;

    for (let i = 0; i < roundPuzzles.length; i++) {
      const p = roundPuzzles[i];
      if (p._matched) continue; // 既に完成済み

      const pParts = p.parts;
      if (
        (pParts[0] === texts[0] && pParts[1] === texts[1]) ||
        (pParts[0] === textsReversed[0] && pParts[1] === textsReversed[1])
      ) {
        matchedPuzzle = p;
        matchedPuzzleIdx = i;
        break;
      }
    }

    const isCorrect = matchedPuzzle !== null;

    if (isCorrect) {
      card1.matched = true;
      card2.matched = true;
      matchedPuzzle._matched = true;
      matchedCount++;
      combo++;
      if (combo > maxCombo) maxCombo = combo;

      score += 100;
      let alt = 15;
      if (combo >= 2) {
        alt += Math.min(5 * combo, 50);
      }
      earnedAlt += alt;
    } else {
      combo = 0;
      mistakeCount++;
    }

    return {
      correct: isCorrect,
      answer: isCorrect ? matchedPuzzle.answer : null,
      parts: isCorrect ? matchedPuzzle.parts : null,
      hint: isCorrect ? matchedPuzzle.hint : null,
      matchedPairIdx: isCorrect ? matchedPuzzleIdx : -1,
      combo,
      score,
      isComplete: matchedCount >= PAIRS_PER_SET
    };
  }

  /**
   * リザルト取得
   */
  function getResult() {
    const total = PAIRS_PER_SET;
    const accuracy = total > 0 ? matchedCount / total : 0;

    let bonusAlt = 0;
    if (matchedCount === total && mistakeCount === 0) {
      bonusAlt = 100;
      earnedAlt += bonusAlt;
    }

    return {
      score,
      total,
      correctCount: matchedCount,
      accuracy,
      maxCombo,
      earnedAlt,
      bonusAlt,
      mistakes,
      mistakeCount,
      isPerfect: matchedCount === total && mistakeCount === 0
    };
  }

  function getState() {
    return {
      matchedCount,
      total: PAIRS_PER_SET,
      score,
      combo,
      maxCombo,
      timeLeft
    };
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  return {
    loadData,
    start,
    getRoundData,
    startTimer,
    stopTimer,
    tryMatch,
    getResult,
    getState,
    PAIRS_PER_SET
  };
})();
