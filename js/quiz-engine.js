/**
 * quiz-engine.js — クイズ出題・採点エンジン
 * 4種類: reading(読み), meaning(意味), strokeCount(画数), strokeOrder(書き順)
 * v1.0.0
 */

const QuizEngine = (() => {
  'use strict';

  const QUESTIONS_PER_SET = 10;

  let kanjiPool = [];     // 出題対象の漢字データ配列
  let quizType  = '';     // 'reading' | 'meaning' | 'strokeCount' | 'strokeOrder'
  let questions = [];     // 生成された問題配列
  let currentIdx = 0;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let correctCount = 0;
  let earnedAlt = 0;
  let mistakes = [];      // { question, yourAnswer, correctAnswer }

  /**
   * クイズを開始
   * @param {string} type - クイズタイプ
   * @param {Object[]} pool - 漢字データ配列
   * @returns {Object} 最初の問題
   */
  function start(type, pool) {
    quizType = type;
    kanjiPool = pool;
    questions = generateQuestions(type, pool);
    currentIdx = 0;
    score = 0;
    combo = 0;
    maxCombo = 0;
    correctCount = 0;
    earnedAlt = 0;
    mistakes = [];
    return questions[0] || null;
  }

  /**
   * 問題を生成
   */
  function generateQuestions(type, pool) {
    let eligible;

    switch (type) {
      case 'reading':
        eligible = pool.filter(k => k.readings && (k.readings.on.length > 0 || k.readings.kun.length > 0));
        break;
      case 'meaning':
        eligible = pool.filter(k => k.meaning && k.meaning.length > 0);
        break;
      case 'strokeCount':
      case 'strokeOrder':
        eligible = pool.filter(k => k.paths && k.paths.length > 0);
        break;
      default:
        eligible = pool;
    }

    if (eligible.length < 4) return [];

    // シャッフルして出題数分取得
    const shuffled = shuffle([...eligible]);
    const selected = shuffled.slice(0, Math.min(QUESTIONS_PER_SET, shuffled.length));

    return selected.map(kanji => buildQuestion(type, kanji, eligible));
  }

  /**
   * 1問の問題オブジェクトを構築
   */
  function buildQuestion(type, kanji, pool) {
    switch (type) {
      case 'reading':
        return buildReadingQuestion(kanji, pool);
      case 'meaning':
        return buildMeaningQuestion(kanji, pool);
      case 'strokeCount':
        return buildStrokeCountQuestion(kanji, pool);
      case 'strokeOrder':
        return buildStrokeOrderQuestion(kanji);
      default:
        return null;
    }
  }

  /**
   * 読みクイズ: 漢字 → 正しい読みを選ぶ
   */
  function buildReadingQuestion(kanji, pool) {
    // 正解: on読みまたはkun読みからランダムに1つ
    const allReadings = [...(kanji.readings.on || []), ...(kanji.readings.kun || [])];
    const correct = allReadings[Math.floor(Math.random() * allReadings.length)];

    // ダミー選択肢: 他の漢字の読みから3つ
    const distractors = [];
    const others = pool.filter(k => k.char !== kanji.char && k.readings && (k.readings.on.length > 0 || k.readings.kun.length > 0));
    const shuffledOthers = shuffle([...others]);

    for (const other of shuffledOthers) {
      if (distractors.length >= 3) break;
      const otherReadings = [...(other.readings.on || []), ...(other.readings.kun || [])];
      if (otherReadings.length === 0) continue;
      const pick = otherReadings[Math.floor(Math.random() * otherReadings.length)];
      if (pick !== correct && !distractors.includes(pick)) {
        distractors.push(pick);
      }
    }

    const choices = shuffle([correct, ...distractors]);

    return {
      type: 'reading',
      kanji: kanji.char,
      questionText: 'この漢字の読みは？',
      choices,
      correctAnswer: correct,
      explanation: `「${kanji.char}」の読み: ${allReadings.join('、')}`
    };
  }

  /**
   * 意味クイズ: 漢字 → 正しい意味を選ぶ
   */
  function buildMeaningQuestion(kanji, pool) {
    const correct = kanji.meaning;

    const distractors = [];
    const others = pool.filter(k => k.char !== kanji.char && k.meaning && k.meaning.length > 0);
    const shuffledOthers = shuffle([...others]);

    for (const other of shuffledOthers) {
      if (distractors.length >= 3) break;
      if (other.meaning !== correct && !distractors.includes(other.meaning)) {
        distractors.push(other.meaning);
      }
    }

    const choices = shuffle([correct, ...distractors]);

    return {
      type: 'meaning',
      kanji: kanji.char,
      questionText: 'この漢字の意味は？',
      choices,
      correctAnswer: correct,
      explanation: `「${kanji.char}」の意味: ${correct}`
    };
  }

  /**
   * 画数クイズ: 漢字 → 正しい画数を選ぶ
   */
  function buildStrokeCountQuestion(kanji, pool) {
    const correct = kanji.strokeCount;
    const correctStr = `${correct}画`;

    // ダミー: 正解±1〜3の範囲でランダム
    const distractorNums = new Set();
    const offsets = [-2, -1, 1, 2, -3, 3];
    for (const off of offsets) {
      const n = correct + off;
      if (n > 0 && n !== correct) distractorNums.add(n);
      if (distractorNums.size >= 3) break;
    }

    const choices = shuffle([correctStr, ...[...distractorNums].slice(0, 3).map(n => `${n}画`)]);

    return {
      type: 'strokeCount',
      kanji: kanji.char,
      questionText: 'この漢字は何画？',
      choices,
      correctAnswer: correctStr,
      explanation: `「${kanji.char}」は ${correct}画 です`,
      paths: kanji.paths,
      strokeNums: kanji.strokeNums
    };
  }

  /**
   * 書き順クイズ: N画目のストロークを当てる
   */
  function buildStrokeOrderQuestion(kanji) {
    const total = kanji.paths.length;
    if (total < 2) return null;

    // 何画目を聞くか（2画目〜最終画からランダム）
    const targetIdx = 1 + Math.floor(Math.random() * (total - 1)); // 0-indexed, skip 1st
    const targetNum = targetIdx + 1;

    return {
      type: 'strokeOrder',
      kanji: kanji.char,
      questionText: `${targetNum}画目はどれ？`,
      paths: kanji.paths,
      strokeNums: kanji.strokeNums,
      targetStrokeIndex: targetIdx,
      correctAnswer: targetIdx,
      explanation: `「${kanji.char}」の ${targetNum}画目 はハイライトされた線です`
    };
  }

  /**
   * 回答を処理
   * @param {string|number} answer - ユーザーの回答
   * @returns {Object} { correct, correctAnswer, explanation, combo, score, earnedAlt, isLast }
   */
  function answer(userAnswer) {
    const q = questions[currentIdx];
    if (!q) return null;

    const isCorrect = userAnswer === q.correctAnswer;

    if (isCorrect) {
      correctCount++;
      combo++;
      if (combo > maxCombo) maxCombo = combo;

      // スコア計算
      const baseScore = 100;
      score += baseScore;

      // ALT計算
      let alt = 10; // 基本
      if (combo >= 2) {
        alt += Math.min(5 * combo, 50); // コンボボーナス上限50
      }
      earnedAlt += alt;
    } else {
      combo = 0;
      mistakes.push({
        kanji: q.kanji,
        question: q.questionText,
        yourAnswer: userAnswer,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation
      });
    }

    const isLast = currentIdx >= questions.length - 1;

    return {
      correct: isCorrect,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      combo,
      score,
      earnedAlt,
      isLast
    };
  }

  /**
   * 次の問題へ
   * @returns {Object|null} 次の問題 or null(終了)
   */
  function next() {
    currentIdx++;
    if (currentIdx >= questions.length) return null;
    return questions[currentIdx];
  }

  /**
   * リザルトを取得
   */
  function getResult() {
    const total = questions.length;
    const accuracy = total > 0 ? correctCount / total : 0;

    // パーフェクトボーナス
    let bonusAlt = 0;
    if (correctCount === total && total > 0) {
      bonusAlt = 100;
      earnedAlt += bonusAlt;
    }

    return {
      score,
      total,
      correctCount,
      accuracy,
      maxCombo,
      earnedAlt,
      bonusAlt,
      mistakes,
      isPerfect: correctCount === total && total > 0
    };
  }

  /**
   * 現在の状態
   */
  function getState() {
    return {
      currentIdx,
      total: questions.length,
      score,
      combo,
      maxCombo,
      correctCount
    };
  }

  // --- ユーティリティ ---
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function getCurrentQuestion() {
    return questions[currentIdx] || null;
  }

  return {
    start,
    answer,
    next,
    getCurrentQuestion,
    getResult,
    getState,
    QUESTIONS_PER_SET
  };
})();
