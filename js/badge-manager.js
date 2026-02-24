/**
 * badge-manager.js — バッジシステム
 * v1.0.0
 */

const BadgeManager = (() => {
  'use strict';

  const GRADE_COUNTS = { 1: 80, 2: 160, 3: 200, 4: 202, 5: 193, 6: 191 };

  const BADGES = [
    { id: 'first_step',      name: 'はじめの一歩',     icon: '🐣', desc: '初めて書き順アニメを見た' },
    { id: 'explorer',        name: '漢字たんけん家',   icon: '🔍', desc: '10文字の書き順を見た' },
    { id: 'grade1_master',   name: '一年生マスター',   icon: '⭐',  desc: '小1全80字クリア' },
    { id: 'grade2_master',   name: '二年生マスター',   icon: '⭐⭐', desc: '小2全160字クリア' },
    { id: 'grade3_master',   name: '三年生マスター',   icon: '⭐⭐⭐', desc: '小3全200字クリア' },
    { id: 'grade4_master',   name: '四年生マスター',   icon: '⭐⭐⭐⭐', desc: '小4全202字クリア' },
    { id: 'grade5_master',   name: '五年生マスター',   icon: '⭐⭐⭐⭐⭐', desc: '小5全193字クリア' },
    { id: 'grade6_master',   name: '六年生マスター',   icon: '⭐⭐⭐⭐⭐⭐', desc: '小6全191字クリア' },
    { id: 'bushu_expert',    name: '部首はかせ',       icon: '🧩', desc: '部首パズル50問正解' },
    { id: 'combo_king',      name: 'コンボキング',     icon: '🔥', desc: '10連続正解' },
    { id: 'quiz_champion',   name: 'クイズチャンピオン', icon: '🏆', desc: 'クイズ100問正解' },
    { id: 'all_kanji',       name: '全漢字制覇',       icon: '👑', desc: '1,026字全完了' },
  ];

  let unlockedBadges = {};  // { badgeId: timestamp }
  let onBadgeUnlock = null; // callback: (badge) => void

  function init(opts = {}) {
    onBadgeUnlock = opts.onBadgeUnlock || null;
  }

  function loadState(saved) {
    if (saved && typeof saved === 'object') {
      unlockedBadges = saved;
    }
  }

  function getState() {
    return { ...unlockedBadges };
  }

  function getAllBadges() {
    return BADGES.map(b => ({
      ...b,
      unlocked: !!unlockedBadges[b.id],
      unlockedAt: unlockedBadges[b.id] || null,
    }));
  }

  function getUnlockedCount() {
    return Object.keys(unlockedBadges).length;
  }

  /**
   * 現在の統計情報からバッジ条件をチェックし、新規獲得があれば通知
   * @param {Object} stats - { studiedKanji, gradeData, quizCorrect, puzzleCorrect, maxCombo }
   */
  function checkAll(stats) {
    const studiedCount = Object.keys(stats.studiedKanji || {}).length;

    // はじめの一歩
    if (studiedCount >= 1) tryUnlock('first_step');

    // 漢字たんけん家
    if (studiedCount >= 10) tryUnlock('explorer');

    // 学年マスター
    for (let g = 1; g <= 6; g++) {
      const gradeKanji = stats.gradeData?.[g];
      if (!gradeKanji) continue;
      const total = GRADE_COUNTS[g];
      const studied = gradeKanji.filter(k => stats.studiedKanji[k.char]).length;
      if (studied >= total) {
        tryUnlock(`grade${g}_master`);
      }
    }

    // 全漢字制覇
    if (studiedCount >= 1026) tryUnlock('all_kanji');

    // 部首はかせ
    if ((stats.puzzleCorrect || 0) >= 50) tryUnlock('bushu_expert');

    // コンボキング
    if ((stats.maxCombo || 0) >= 10) tryUnlock('combo_king');

    // クイズチャンピオン
    if ((stats.quizCorrect || 0) >= 100) tryUnlock('quiz_champion');
  }

  function tryUnlock(badgeId) {
    if (unlockedBadges[badgeId]) return; // 既に獲得済み
    unlockedBadges[badgeId] = Date.now();
    const badge = BADGES.find(b => b.id === badgeId);
    if (badge && onBadgeUnlock) {
      onBadgeUnlock(badge);
    }
  }

  return {
    init,
    loadState,
    getState,
    getAllBadges,
    getUnlockedCount,
    checkAll,
    BADGES,
  };
})();
