/**
 * app.js — 漢字の成り立ち (kanji-stroke) メインアプリ
 * Vanilla JS SPA
 * v1.0.0
 */

(function () {
  'use strict';

  // ============================================================
  // ゲーム状態
  // ============================================================
  const STORAGE_KEY = 'kanji-stroke-progress';

  const state = {
    currentScreen: 'home',
    selectedGrade: null,
    selectedKanjiIndex: null,
    totalAlt: 0,
    studiedKanji: {},  // { "日": true, "月": true, ... }
  };

  let altEarned = 0; // 🆕 TrailNav ALT獲得トラッカー

  // 学年データキャッシュ
  const gradeCache = {};

  // 学年ごとの漢字数
  const GRADE_COUNTS = { 1: 80, 2: 160, 3: 200, 4: 202, 5: 193, 6: 191 };

  // ============================================================
  // DOM参照
  // ============================================================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const screens = {
    home:        $('#screen-home'),
    gradeSelect: $('#screen-grade-select'),
    kanjiList:   $('#screen-kanji-list'),
    kanjiDetail: $('#screen-kanji-detail'),
    quizMenu:    $('#screen-quiz-menu'),
    quizGrade:   $('#screen-quiz-grade'),
    quizPlay:    $('#screen-quiz-play'),
    quizResult:  $('#screen-quiz-result'),
    puzzleMenu:  $('#screen-puzzle-menu'),
    puzzlePlay:  $('#screen-puzzle-play'),
    puzzleResult:$('#screen-puzzle-result'),
    mypage:      $('#screen-mypage'),
  };

  const els = {
    btnBack:         $('#btn-back'),
    headerTitle:     $('#header-title'),
    altCount:        $('#alt-count'),
    kanjiGrid:       $('#kanji-grid'),
    gridSkeleton:    $('#kanji-grid-skeleton'),
    listGradeLabel:  $('#list-grade-label'),
    listStudiedCount:$('#list-studied-count'),
    detailChar:      $('#detail-char'),
    detailStrokeCount: $('#detail-stroke-count'),
    detailReading:   $('#detail-reading'),
    progressFill:    $('#stroke-progress-fill'),
    progressText:    $('#stroke-progress-text'),
    btnAuto:         $('#btn-auto'),
    btnNext:         $('#btn-next'),
    btnReset:        $('#btn-reset'),
    btnPrevKanji:    $('#btn-prev-kanji'),
    btnNextKanji:    $('#btn-next-kanji'),
    formationContent:$('#formation-content'),
  };

  // ============================================================
  // 画面遷移
  // ============================================================
  function navigateTo(screenName, opts = {}) {
    // 前の画面を非表示
    Object.values(screens).forEach(s => s.classList.remove('active'));

    // 新しい画面を表示
    const screen = screens[screenName];
    if (screen) screen.classList.add('active');

    state.currentScreen = screenName;

    // 🆕 TrailNav: ゲームプレイ画面ではナビ非表示
    if (typeof TrailNav !== 'undefined') {
      if (['quizPlay', 'puzzlePlay'].includes(screenName)) {
        TrailNav.hideNav();
      } else {
        TrailNav.showNav();
      }
    }

    // 戻るボタン制御
    const showBack = screenName !== 'home';
    els.btnBack.style.display = showBack ? 'flex' : 'none';

    // ヘッダータイトル
    const titles = {
      home: '漢字の成り立ち',
      gradeSelect: '学年をえらぶ',
      kanjiList: `小${state.selectedGrade}の漢字`,
      kanjiDetail: '',
      quizGrade: 'クイズ',
      quizMenu: 'クイズのしゅるい',
      quizPlay: 'クイズ',
      quizResult: 'リザルト',
      puzzleMenu: '部首パズル',
      puzzlePlay: '部首パズル',
      puzzleResult: 'リザルト',
      mypage: 'マイページ',
    };
    els.headerTitle.textContent = titles[screenName] || '漢字の成り立ち';

    // 画面固有の初期化
    if (screenName === 'gradeSelect') {
      updateGradeProgress();
    }
  }

  function goBack() {
    StrokeAnimator.stop();
    if (reviewActive) {
      StrokeReviewer.destroy();
      reviewActive = false;
    }
    const backMap = {
      gradeSelect: 'home',
      kanjiList: 'gradeSelect',
      kanjiDetail: 'kanjiList',
      quizGrade: 'home',
      quizMenu: 'quizGrade',
      quizPlay: 'quizMenu',
      quizResult: 'quizMenu',
      puzzleMenu: 'home',
      puzzlePlay: 'puzzleMenu',
      puzzleResult: 'puzzleMenu',
      mypage: 'home',
    };
    navigateTo(backMap[state.currentScreen] || 'home');
  }

  // 🆕 TrailNav: ゲームホームに戻る関数
  window.showGameHome = function() {
    StrokeAnimator.stop();
    if (typeof BushuPuzzle !== 'undefined') BushuPuzzle.stopTimer();
    if (reviewActive) { StrokeReviewer.destroy(); reviewActive = false; }
    altEarned = 0;
    navigateTo('home');
    if (typeof TrailNav !== 'undefined') TrailNav.showNav();
  };

  // ============================================================
  // 学年選択
  // ============================================================
  function updateGradeProgress() {
    for (let g = 1; g <= 6; g++) {
      const el = $(`[data-grade-progress="${g}"]`);
      if (!el) continue;
      const studied = countStudiedForGrade(g);
      const total = GRADE_COUNTS[g];
      const pct = total > 0 ? Math.round((studied / total) * 100) : 0;
      el.textContent = `${pct}%`;
    }
  }

  function countStudiedForGrade(grade) {
    const data = gradeCache[grade];
    if (!data) return 0;
    return data.filter(k => state.studiedKanji[k.char]).length;
  }

  async function selectGrade(grade) {
    state.selectedGrade = grade;
    navigateTo('kanjiList');

    // データがキャッシュにあるか確認
    if (gradeCache[grade]) {
      renderKanjiGrid(gradeCache[grade]);
      return;
    }

    // スケルトン表示
    els.kanjiGrid.style.display = 'none';
    els.gridSkeleton.style.display = 'grid';

    try {
      const resp = await fetch(`data/kanji-grade${grade}.json`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      gradeCache[grade] = data;
      renderKanjiGrid(data);
    } catch (err) {
      console.error('データ読み込みエラー:', err);
      els.kanjiGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#999;padding:32px;">データを読み込めませんでした</p>';
      els.kanjiGrid.style.display = 'grid';
      els.gridSkeleton.style.display = 'none';
    }
  }

  // ============================================================
  // 漢字一覧
  // ============================================================
  function renderKanjiGrid(data) {
    els.kanjiGrid.innerHTML = '';
    els.listGradeLabel.textContent = `小${state.selectedGrade}の漢字`;

    const studied = data.filter(k => state.studiedKanji[k.char]).length;
    els.listStudiedCount.textContent = `${studied} / ${data.length}`;

    for (let i = 0; i < data.length; i++) {
      const btn = document.createElement('button');
      btn.className = 'kanji-cell';
      if (state.studiedKanji[data[i].char]) {
        btn.classList.add('studied');
      }
      btn.textContent = data[i].char;
      btn.setAttribute('aria-label', data[i].char);
      btn.addEventListener('click', () => openKanjiDetail(i));
      els.kanjiGrid.appendChild(btn);
    }

    els.kanjiGrid.style.display = 'grid';
    els.gridSkeleton.style.display = 'none';
  }

  // ============================================================
  // 漢字詳細
  // ============================================================
  function openKanjiDetail(index) {
    const data = gradeCache[state.selectedGrade];
    if (!data || !data[index]) return;

    state.selectedKanjiIndex = index;
    const kanji = data[index];

    navigateTo('kanjiDetail');
    els.headerTitle.textContent = kanji.char;

    // 基本情報
    els.detailChar.textContent = kanji.char;
    els.detailStrokeCount.textContent = `${kanji.strokeCount}画`;

    // 読み
    const readings = [];
    if (kanji.readings) {
      if (kanji.readings.on && kanji.readings.on.length) readings.push(kanji.readings.on.join('・'));
      if (kanji.readings.kun && kanji.readings.kun.length) readings.push(kanji.readings.kun.join('・'));
    }
    els.detailReading.textContent = readings.join(' / ');

    // タブを書き順にリセット
    activateTab('stroke');

    // ストロークアニメーター初期化
    StrokeAnimator.load(kanji);
    updateStrokeControls();

    // 成り立ちタブ
    renderFormation(kanji);

    // 前後ボタン
    els.btnPrevKanji.disabled = index === 0;
    els.btnNextKanji.disabled = index >= data.length - 1;

    // 学習済みマーク（書き順画面を開いた = 見た）
    if (!state.studiedKanji[kanji.char]) {
      state.studiedKanji[kanji.char] = true;
      addAlt(5, '書き順を確認 +5 ALT');
      saveProgress();
    }
  }

  function renderFormation(kanji) {
    const f = kanji.formation;
    if (!f || !f.type) {
      els.formationContent.innerHTML = '<p class="formation-placeholder">このかんじの成り立ちデータはまだありません。</p>';
      return;
    }

    let html = `<span class="formation-type ${f.type}">${f.type}</span>`;
    if (f.description) {
      html += `<p class="formation-desc">${f.description}</p>`;
    }
    els.formationContent.innerHTML = html;
  }

  // ============================================================
  // タブ
  // ============================================================
  function activateTab(tabName) {
    $$('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    $$('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
  }

  // ============================================================
  // ストローク操作
  // ============================================================
  function updateStrokeControls() {
    const s = StrokeAnimator.getState();
    els.btnNext.disabled = s.isAnimating || s.isComplete;
    els.btnAuto.disabled = s.isAnimating;

    // プログレス
    const pct = s.totalStrokes > 0 ? (s.currentStroke / s.totalStrokes) * 100 : 0;
    els.progressFill.style.width = `${pct}%`;
    els.progressText.textContent = `${s.currentStroke} / ${s.totalStrokes}`;

    if (s.isComplete) {
      els.btnAuto.textContent = '↻ もう一度';
    } else {
      els.btnAuto.textContent = '▶ 自動再生';
    }
  }

  async function handleNext() {
    await StrokeAnimator.drawNext();
    updateStrokeControls();
  }

  function handleAutoPlay() {
    const s = StrokeAnimator.getState();
    if (s.isComplete) {
      StrokeAnimator.reset();
      updateStrokeControls();
      return;
    }
    StrokeAnimator.startAutoPlay();
  }

  function handleReset() {
    StrokeAnimator.reset();
    updateStrokeControls();
  }

  // ============================================================
  // ALTポイント
  // ============================================================
  function addAlt(amount, message) {
    const prevAlt = state.totalAlt;
    state.totalAlt += amount;
    els.altCount.textContent = state.totalAlt;
    if (message) showToast(message, 'alt');
    ScoreManager.checkLevelUp(prevAlt, state.totalAlt);
    triggerBadgeCheck();
    // 🆕 TrailNav: サーバーALT連携
    altEarned += amount;
    if (typeof TrailNav !== 'undefined') TrailNav.earnAlt(amount, message || '');
  }

  // ============================================================
  // トースト通知
  // ============================================================
  function showToast(message, type) {
    // 既存トーストを削除
    const old = document.querySelector('.toast');
    if (old) old.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type || ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // ============================================================
  // localStorage 保存/読み込み
  // ============================================================
  function saveProgress() {
    try {
      const data = {
        studiedKanji: state.studiedKanji,
        totalAlt: state.totalAlt,
        badges: BadgeManager.getState(),
        stats: ScoreManager.getState(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // localStorage使用不可の場合は無視
    }
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.studiedKanji) state.studiedKanji = data.studiedKanji;
      if (typeof data.totalAlt === 'number') state.totalAlt = data.totalAlt;
      if (data.badges) BadgeManager.loadState(data.badges);
      if (data.stats) ScoreManager.loadState(data.stats);
      els.altCount.textContent = state.totalAlt;
    } catch (e) {
      // パースエラー等は無視
    }
  }

  // ============================================================
  // TRAIL Game Pro 連携（スタンドアロン対応）
  // ============================================================
  function sendGameState(gameState) {
    try {
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'GAME_STATE',
          payload: { state: gameState }
        }, '*');
      }
    } catch (e) {
      // iframe外では無視
    }
  }

  // ============================================================
  // イベント登録
  // ============================================================
  function bindEvents() {
    // 戻るボタン
    els.btnBack.addEventListener('click', goBack);

    // ホームメニュー
    $$('.menu-btn[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'grade-select') navigateTo('gradeSelect');
        if (action === 'quiz') navigateTo('quizGrade');
        if (action === 'puzzle') navigateTo('puzzleMenu');
        if (action === 'mypage') { renderMypage(); navigateTo('mypage'); }
      });
    });

    // 学年カード
    $$('.grade-card[data-grade]').forEach(card => {
      card.addEventListener('click', () => {
        selectGrade(parseInt(card.dataset.grade, 10));
      });
    });

    // タブ切り替え
    $$('.tab-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => activateTab(btn.dataset.tab));
    });

    // ストローク操作
    els.btnAuto.addEventListener('click', handleAutoPlay);
    els.btnNext.addEventListener('click', handleNext);
    els.btnReset.addEventListener('click', handleReset);

    // 前後の漢字
    els.btnPrevKanji.addEventListener('click', () => {
      if (state.selectedKanjiIndex > 0) {
        openKanjiDetail(state.selectedKanjiIndex - 1);
      }
    });
    els.btnNextKanji.addEventListener('click', () => {
      const data = gradeCache[state.selectedGrade];
      if (data && state.selectedKanjiIndex < data.length - 1) {
        openKanjiDetail(state.selectedKanjiIndex + 1);
      }
    });
  }

  // ============================================================
  // クイズ機能
  // ============================================================
  let quizSelectedType = '';
  let quizSelectedGrade = null;
  let reviewActive = false;

  const SVGNS = 'http://www.w3.org/2000/svg';

  function bindQuizEvents() {
    // クイズタイプ選択
    $$('.quiz-type-card[data-quiz-type]').forEach(card => {
      card.addEventListener('click', () => {
        quizSelectedType = card.dataset.quizType;
        startQuiz();
      });
    });

    // クイズ用学年選択
    $$('[data-quiz-grade]').forEach(card => {
      card.addEventListener('click', () => {
        quizSelectedGrade = parseInt(card.dataset.quizGrade, 10);
        navigateTo('quizMenu');
      });
    });

    // 次の問題ボタン
    $('#quiz-next-btn').addEventListener('click', () => {
      if (reviewActive) return;
      const q = QuizEngine.next();
      if (q) {
        renderQuestion(q);
      } else {
        showQuizResult();
      }
    });

    // リザルト画面ボタン
    $('#result-retry').addEventListener('click', () => startQuiz());
    $('#result-home').addEventListener('click', () => navigateTo('home'));
  }

  async function startQuiz() {
    altEarned = 0; // 🆕 ALTリセット
    // データ読み込み
    if (!gradeCache[quizSelectedGrade]) {
      try {
        const resp = await fetch(`data/kanji-grade${quizSelectedGrade}.json`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        gradeCache[quizSelectedGrade] = await resp.json();
      } catch (err) {
        showToast('データを読み込めませんでした', '');
        return;
      }
    }

    const pool = gradeCache[quizSelectedGrade];
    const firstQ = QuizEngine.start(quizSelectedType, pool);

    if (!firstQ) {
      showToast('この学年ではまだ出題できません', '');
      return;
    }

    navigateTo('quizPlay');
    renderQuestion(firstQ);
  }

  function renderQuestion(q) {
    const questionArea = $('#quiz-question-area');
    const choicesArea = $('#quiz-choices');
    const feedback = $('#quiz-feedback');

    feedback.style.display = 'none';
    choicesArea.style.display = 'grid';

    const s = QuizEngine.getState();
    $('#quiz-progress').textContent = `${s.currentIdx + 1} / ${s.total}`;
    $('#quiz-score-display').textContent = `${s.score} pt`;
    const comboEl = $('#quiz-combo');
    if (s.combo >= 2) {
      comboEl.style.display = '';
      comboEl.textContent = `${s.combo}コンボ!`;
    } else {
      comboEl.style.display = 'none';
    }

    // 問題表示
    if (q.type === 'strokeOrder') {
      renderStrokeOrderQuestion(q, questionArea, choicesArea);
    } else {
      questionArea.innerHTML = `
        <div class="quiz-question-char">${q.kanji}</div>
        <div class="quiz-question-text">${q.questionText}</div>
      `;

      choicesArea.innerHTML = '';
      q.choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = choice;
        btn.addEventListener('click', () => handleQuizAnswer(choice, btn));
        choicesArea.appendChild(btn);
      });
    }
  }

  function renderStrokeOrderQuestion(q, questionArea, choicesArea) {
    // SVGで全ストロークを表示し、タップで選択
    const svgSize = 220;
    questionArea.innerHTML = `
      <div class="quiz-question-text">${q.kanji}「${q.questionText}」</div>
      <svg class="quiz-stroke-svg" xmlns="http://www.w3.org/2000/svg"
           viewBox="0 0 109 109" width="${svgSize}" height="${svgSize}">
        <line class="guide" x1="54.5" y1="0" x2="54.5" y2="109"/>
        <line class="guide" x1="0" y1="54.5" x2="109" y2="54.5"/>
        ${q.paths.map((d, i) => `<path class="stroke-choice" data-idx="${i}" d="${d}"/>`).join('')}
      </svg>
    `;

    choicesArea.innerHTML = '';
    choicesArea.style.display = 'none';

    // ストロークにクリックイベント
    questionArea.querySelectorAll('.stroke-choice').forEach(path => {
      path.addEventListener('click', () => {
        const idx = parseInt(path.dataset.idx, 10);
        handleStrokeOrderAnswer(idx, questionArea);
      });
    });
  }

  function handleStrokeOrderAnswer(selectedIdx, questionArea) {
    const result = QuizEngine.answer(selectedIdx);
    if (!result) return;

    // 正解/不正解のハイライト
    questionArea.querySelectorAll('.stroke-choice').forEach(path => {
      const idx = parseInt(path.dataset.idx, 10);
      if (idx === result.correctAnswer) {
        path.classList.add('correct');
      } else if (idx === selectedIdx && !result.correct) {
        path.classList.add('wrong');
      }
      path.style.pointerEvents = 'none';
    });

    showFeedback(result);
  }

  function handleQuizAnswer(choice, btnEl) {
    const result = QuizEngine.answer(choice);
    if (!result) return;

    // 全ボタンにansweredクラス
    $$('.choice-btn').forEach(b => b.classList.add('answered'));

    // 正解/不正解表示
    if (result.correct) {
      btnEl.classList.add('correct');
    } else {
      btnEl.classList.add('wrong');
      // 正解ボタンをハイライト
      $$('.choice-btn').forEach(b => {
        if (b.textContent === result.correctAnswer) b.classList.add('correct');
      });
    }

    showFeedback(result);
  }

  function showFeedback(result) {
    const feedback = $('#quiz-feedback');
    const icon = $('#quiz-feedback-icon');
    const text = $('#quiz-feedback-text');
    const nextBtn = $('#quiz-next-btn');

    icon.textContent = result.correct ? '⭕' : '❌';
    text.innerHTML = result.correct
      ? (result.combo >= 2 ? `${result.combo}連続正解！` : 'せいかい！')
      : `<strong>こたえ:</strong> ${result.explanation}`;

    nextBtn.textContent = result.isLast ? '結果を見る' : '次の問題 →';

    feedback.style.display = 'block';

    // コンボ更新
    const s = QuizEngine.getState();
    const comboEl = $('#quiz-combo');
    if (s.combo >= 2) {
      comboEl.style.display = '';
      comboEl.textContent = `${s.combo}コンボ!`;
    } else {
      comboEl.style.display = 'none';
    }
    $('#quiz-score-display').textContent = `${s.score} pt`;

    // 不正解 + 画数/書き順クイズ → ❌を見せてから書き順レビュー発動
    if (!result.correct && (quizSelectedType === 'strokeCount' || quizSelectedType === 'strokeOrder')) {
      const q = QuizEngine.getCurrentQuestion();
      if (q && q.paths && q.paths.length > 0) {
        // ❌を1秒見せてからアニメーション開始
        const nextBtn = $('#quiz-next-btn');
        nextBtn.style.display = 'none';
        setTimeout(() => {
          startStrokeReview(q);
        }, 1000);
      }
    }
  }

  // レビュー中の再出題カウンター
  let retestCorrectCount = 0;
  const RETEST_REQUIRED = 3;
  let retestUsedIndices = []; // 出題済みの画インデックス

  /**
   * 書き順レビューを開始（❌表示の後、問題エリアをその場で書き換え）
   */
  function startStrokeReview(question) {
    reviewActive = true;
    retestCorrectCount = 0;
    retestUsedIndices = [];
    if (question.targetStrokeIndex != null) {
      retestUsedIndices.push(question.targetStrokeIndex);
    }

    const questionArea = $('#quiz-question-area');
    const choicesArea = $('#quiz-choices');
    const feedback = $('#quiz-feedback');

    // フィードバック・選択肢を非表示
    feedback.style.display = 'none';
    choicesArea.style.display = 'none';

    // 正解の画インデックスを特定
    let highlightIdx = -1;
    if (question.type === 'strokeOrder') {
      highlightIdx = question.correctAnswer;
    }

    // 問題エリアをレビューコンテナに変換
    questionArea.innerHTML = '';
    questionArea.className = 'quiz-question-area stroke-review-area';

    // スキップボタン
    let skipBtn = document.getElementById('review-skip-btn');
    if (!skipBtn) {
      skipBtn = document.createElement('button');
      skipBtn.id = 'review-skip-btn';
      skipBtn.className = 'review-skip-btn';
      skipBtn.textContent = '次に進む →';
      skipBtn.addEventListener('click', () => endStrokeReview());
      document.body.appendChild(skipBtn);
    }

    // レビュー開始
    StrokeReviewer.start(questionArea, {
      paths: question.paths,
      strokeNums: question.strokeNums || [],
      kanjiChar: question.kanji,
      highlightIdx: highlightIdx,
      onMemorized: () => {
        StrokeReviewer.destroy();
        showRetestQuestion(question, 1);
      },
      onSkip: () => endStrokeReview()
    });
  }

  /**
   * レビュー中にアニメを再生して再スタート（正解数リセット）
   */
  function restartStrokeReview(question, highlightIdx) {
    retestCorrectCount = 0;
    retestUsedIndices = [];
    if (highlightIdx >= 0) retestUsedIndices.push(highlightIdx);

    const questionArea = $('#quiz-question-area');
    questionArea.innerHTML = '';
    questionArea.className = 'quiz-question-area stroke-review-area';

    StrokeReviewer.start(questionArea, {
      paths: question.paths,
      strokeNums: question.strokeNums || [],
      kanjiChar: question.kanji,
      highlightIdx: highlightIdx,
      onMemorized: () => {
        StrokeReviewer.destroy();
        showRetestQuestion(question, 1);
      },
      onSkip: () => endStrokeReview()
    });
  }

  /**
   * 再出題: 同じ漢字の別の画数で書き順クイズを出す
   * @param {number} round - 現在のラウンド（1〜3）
   */
  function showRetestQuestion(question, round) {
    const questionArea = $('#quiz-question-area');
    const total = question.paths.length;

    if (total < 2) {
      endStrokeReview();
      return;
    }

    // 出題済みを除外して違う画を出す
    const candidates = [];
    for (let i = 0; i < total; i++) {
      if (!retestUsedIndices.includes(i)) candidates.push(i);
    }
    // 候補がなくなったらリセット
    if (candidates.length === 0) {
      retestUsedIndices = [];
      for (let i = 0; i < total; i++) candidates.push(i);
    }

    const targetIdx = candidates[Math.floor(Math.random() * candidates.length)];
    retestUsedIndices.push(targetIdx);
    const targetNum = targetIdx + 1;

    questionArea.className = 'quiz-question-area';
    questionArea.innerHTML = '';

    // ラウンド表示
    const roundEl = document.createElement('div');
    roundEl.className = 'retest-round';
    roundEl.innerHTML = `<span class="retest-round-text">${round} / ${RETEST_REQUIRED} 問目</span>`;
    // 進捗ドット
    const dotsEl = document.createElement('div');
    dotsEl.className = 'retest-dots';
    for (let i = 0; i < RETEST_REQUIRED; i++) {
      const dot = document.createElement('span');
      dot.className = 'retest-dot' + (i < retestCorrectCount ? ' done' : '');
      dotsEl.appendChild(dot);
    }
    roundEl.appendChild(dotsEl);
    questionArea.appendChild(roundEl);

    // 問題文
    const qText = document.createElement('div');
    qText.className = 'quiz-question-text';
    qText.innerHTML = `「${question.kanji}」の<strong>${targetNum}画目</strong>はどれ？`;
    questionArea.appendChild(qText);

    // SVG
    const svgSize = 220;
    const svgWrap = document.createElement('div');
    svgWrap.innerHTML = `
      <svg class="quiz-stroke-svg" xmlns="http://www.w3.org/2000/svg"
           viewBox="0 0 109 109" width="${svgSize}" height="${svgSize}">
        <line class="guide" x1="54.5" y1="0" x2="54.5" y2="109"/>
        <line class="guide" x1="0" y1="54.5" x2="109" y2="54.5"/>
        ${question.paths.map((d, i) => `<path class="stroke-choice" data-idx="${i}" d="${d}"/>`).join('')}
      </svg>
    `;
    questionArea.appendChild(svgWrap.firstElementChild);

    // ストロークにクリックイベント
    questionArea.querySelectorAll('.stroke-choice').forEach(path => {
      path.addEventListener('click', () => {
        const idx = parseInt(path.dataset.idx, 10);
        handleRetestAnswer(idx, targetIdx, question, questionArea, round);
      });
    });
  }

  /**
   * 再出題の回答処理
   */
  function handleRetestAnswer(selectedIdx, correctIdx, question, questionArea, round) {
    // クリック無効化
    questionArea.querySelectorAll('.stroke-choice').forEach(p => {
      p.style.pointerEvents = 'none';
    });

    if (selectedIdx === correctIdx) {
      // ⭕ 正解
      questionArea.querySelectorAll('.stroke-choice').forEach(p => {
        const idx = parseInt(p.dataset.idx, 10);
        if (idx === correctIdx) p.classList.add('correct');
      });

      retestCorrectCount++;

      const msgEl = document.createElement('div');
      msgEl.className = 'review-instruction';
      msgEl.style.color = '#27AE60';
      msgEl.style.marginTop = '10px';

      if (retestCorrectCount >= RETEST_REQUIRED) {
        // 3問正解 → 完了
        msgEl.textContent = 'かんぺき！書き順マスター！';
        questionArea.appendChild(msgEl);
        setTimeout(() => {
          if (reviewActive) endStrokeReview();
        }, 1000);
      } else {
        msgEl.textContent = `⭕ せいかい！（${retestCorrectCount}/${RETEST_REQUIRED}）`;
        questionArea.appendChild(msgEl);
        setTimeout(() => {
          if (!reviewActive) return;
          showRetestQuestion(question, round + 1);
        }, 800);
      }
    } else {
      // ❌ 不正解 → 正解を緑、不正解を赤で表示
      questionArea.querySelectorAll('.stroke-choice').forEach(p => {
        const idx = parseInt(p.dataset.idx, 10);
        if (idx === correctIdx) p.classList.add('correct');
        if (idx === selectedIdx) p.classList.add('wrong');
      });

      const msgEl = document.createElement('div');
      msgEl.className = 'review-instruction';
      msgEl.style.marginTop = '10px';
      msgEl.textContent = '❌ ちがうよ！もう一度見てみよう';
      questionArea.appendChild(msgEl);

      setTimeout(() => {
        if (!reviewActive) return;
        // 正解数リセット、再びアニメーションから
        restartStrokeReview(question, correctIdx);
      }, 1200);
    }
  }

  /**
   * レビュー終了 → 通常クイズフローに復帰
   */
  function endStrokeReview() {
    reviewActive = false;
    StrokeReviewer.destroy();

    const skipBtn = document.getElementById('review-skip-btn');
    if (skipBtn) skipBtn.remove();

    const questionArea = $('#quiz-question-area');
    questionArea.className = 'quiz-question-area';
    questionArea.innerHTML = '';

    // フィードバックエリアに「次の問題」を表示
    const feedback = $('#quiz-feedback');
    const nextBtn = $('#quiz-next-btn');
    const icon = $('#quiz-feedback-icon');
    const text = $('#quiz-feedback-text');

    icon.textContent = '✏️';
    text.textContent = '書き順の復習が終わったよ！';
    nextBtn.style.display = '';

    const s = QuizEngine.getState();
    nextBtn.textContent = (s.currentIdx >= s.total - 1) ? '結果を見る' : '次の問題 →';

    feedback.style.display = 'block';
  }

  async function showQuizResult() { // 🆕 async化
    // 🆕 ALTをサーバーに送信
    if (typeof TrailNav !== 'undefined') await TrailNav.flushAltWithRetry();
    navigateTo('quizResult');
    const r = QuizEngine.getResult();

    $('#result-icon').textContent = r.isPerfect ? '🏆' : (r.accuracy >= 0.7 ? '🎉' : '📖');
    $('#result-title').textContent = r.isPerfect ? 'パーフェクト！' : (r.accuracy >= 0.7 ? 'よくできました！' : 'もうちょっと！');
    $('#result-score').textContent = r.score;
    $('#result-accuracy').textContent = `${Math.round(r.accuracy * 100)}%`;
    $('#result-combo').textContent = r.maxCombo;
    $('#result-alt').textContent = `+${r.earnedAlt}`;

    // 統計記録
    ScoreManager.recordQuiz(r.correctCount, r.total, r.maxCombo, quizSelectedGrade);

    // にがてな漢字を記録
    if (r.mistakes && r.mistakes.length > 0) {
      r.mistakes.forEach(m => {
        if (m.kanji) {
          ScoreManager.recordMistake(m.kanji, quizSelectedGrade, quizSelectedType);
        }
      });
    }

    // ALT加算
    if (r.earnedAlt > 0) {
      addAlt(r.earnedAlt, `クイズ完了 +${r.earnedAlt} ALT`);
    }
    saveProgress();

    // 🆕 ALT獲得表示
    const altDisplay = document.getElementById('altEarnedDisplay');
    if (altDisplay) { altDisplay.style.display = altEarned > 0 ? 'block' : 'none'; if (altEarned > 0) document.getElementById('altEarnedVal').textContent = altEarned; }
    altEarned = 0; // 🆕 リセット

    // まちがえた問題
    const mistakesDiv = $('#result-mistakes');
    const mistakesList = $('#result-mistakes-list');
    if (r.mistakes.length > 0) {
      mistakesDiv.style.display = '';
      mistakesList.innerHTML = r.mistakes.map(m =>
        `<li>「${m.kanji}」${m.question} → ${m.explanation}</li>`
      ).join('');
    } else {
      mistakesDiv.style.display = 'none';
    }
  }

  // ============================================================
  // 部首パズル機能（カードマッチング方式）
  // ============================================================
  let puzzleSelectedDiff = 1;
  let bushuDataLoaded = false;
  let puzzleSelectedCard = null; // 選択中のカードID

  function bindPuzzleEvents() {
    // 難易度選択
    $$('.puzzle-diff-card[data-puzzle-diff]').forEach(card => {
      card.addEventListener('click', () => {
        puzzleSelectedDiff = parseInt(card.dataset.puzzleDiff, 10);
        $$('.puzzle-diff-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });

    // 学年選択 → パズル開始
    $$('.puzzle-grade-btn[data-puzzle-grade]').forEach(card => {
      card.addEventListener('click', () => {
        const grade = parseInt(card.dataset.puzzleGrade, 10);
        startPuzzle(grade);
      });
    });

    // リザルト
    $('#puzzle-result-retry').addEventListener('click', () => {
      navigateTo('puzzleMenu');
    });
    $('#puzzle-result-home').addEventListener('click', () => navigateTo('home'));

    // デフォルト難易度を選択状態に
    const defaultCard = $('.puzzle-diff-card[data-puzzle-diff="1"]');
    if (defaultCard) defaultCard.classList.add('selected');
  }

  async function loadBushuData() {
    if (bushuDataLoaded) return true;
    try {
      const resp = await fetch('data/bushu-data.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      BushuPuzzle.loadData(data);
      bushuDataLoaded = true;
      return true;
    } catch (err) {
      console.error('部首データ読み込みエラー:', err);
      showToast('データを読み込めませんでした', '');
      return false;
    }
  }

  async function startPuzzle(grade) {
    const loaded = await loadBushuData();
    if (!loaded) return;

    const roundData = BushuPuzzle.start(grade, puzzleSelectedDiff, {
      onTimerTick: (t) => {
        const el = $('#puzzle-timer');
        el.textContent = `${t}s`;
        el.classList.toggle('urgent', t <= 5);
      },
      onTimeUp: () => {
        // 時間切れ → リザルトへ
        BushuPuzzle.stopTimer();
        showPuzzleResult();
      }
    });

    if (!roundData) {
      showToast('この条件では出題できません', '');
      return;
    }

    puzzleSelectedCard = null;
    navigateTo('puzzlePlay');
    renderPuzzleBoard(roundData);

    // タイマー
    if (puzzleSelectedDiff >= 2) {
      $('#puzzle-timer').style.display = '';
      BushuPuzzle.startTimer();
    } else {
      $('#puzzle-timer').style.display = 'none';
    }
  }

  function renderPuzzleBoard(roundData) {
    const cardsArea = $('#puzzle-cards');
    const completedArea = $('#puzzle-completed');
    const msg = $('#puzzle-match-msg');

    cardsArea.innerHTML = '';
    completedArea.innerHTML = '';
    msg.style.display = 'none';

    // HUD
    const s = BushuPuzzle.getState();
    $('#puzzle-progress').textContent = `${s.matchedCount} / ${s.total}`;
    $('#puzzle-score-display').textContent = `${s.score} pt`;

    // 完成エリアのプレースホルダー
    roundData.puzzles.forEach((p, i) => {
      const slot = document.createElement('div');
      slot.className = 'completed-slot';
      slot.dataset.pairIdx = i;  // data-pair-idx
      slot.innerHTML = `<span class="completed-hint">${p.hint}</span>`;
      completedArea.appendChild(slot);
    });

    // カード生成
    roundData.cards.forEach(card => {
      const el = document.createElement('button');
      el.className = 'puzzle-card';
      el.dataset.cardId = card.id;
      el.textContent = card.text;
      el.addEventListener('click', () => handleCardClick(card.id, el));
      cardsArea.appendChild(el);
    });
  }

  function handleCardClick(cardId, el) {
    // 既にマッチ済みや処理中は無視
    if (el.classList.contains('matched') || el.classList.contains('wrong-flash')) return;

    if (puzzleSelectedCard === null) {
      // 1枚目選択
      puzzleSelectedCard = { id: cardId, el: el };
      el.classList.add('selected');
    } else if (puzzleSelectedCard.id === cardId) {
      // 同じカードをもう一度タップ → 選択解除
      el.classList.remove('selected');
      puzzleSelectedCard = null;
    } else {
      // 2枚目選択 → マッチ判定
      const firstEl = puzzleSelectedCard.el;
      const firstId = puzzleSelectedCard.id;
      puzzleSelectedCard = null;

      el.classList.add('selected');

      const result = BushuPuzzle.tryMatch(firstId, cardId);
      if (!result) return;

      if (result.correct) {
        // 正解 → カードをマッチ済みに
        firstEl.classList.remove('selected');
        firstEl.classList.add('matched');
        el.classList.remove('selected');
        el.classList.add('matched');

        // HUD更新
        const s = BushuPuzzle.getState();
        $('#puzzle-progress').textContent = `${s.matchedCount} / ${s.total}`;
        $('#puzzle-score-display').textContent = `${s.score} pt`;

        // 完成エリアに漢字を追加
        showMatchedKanji(result.answer, result.parts, result.matchedPairIdx);

        // マッチメッセージ
        const msg = $('#puzzle-match-msg');
        msg.textContent = result.combo >= 2 ? `${result.combo}連続！「${result.answer}」= ${result.parts.join(' + ')}` : `「${result.answer}」= ${result.parts.join(' + ')}`;
        msg.className = 'puzzle-match-msg correct';
        msg.style.display = 'block';
        setTimeout(() => { msg.style.display = 'none'; }, 1500);

        // 完了チェック
        if (result.isComplete) {
          BushuPuzzle.stopTimer();
          setTimeout(() => showPuzzleResult(), 1200);
        }
      } else {
        // 不正解 → 赤フラッシュして戻す
        firstEl.classList.remove('selected');
        firstEl.classList.add('wrong-flash');
        el.classList.remove('selected');
        el.classList.add('wrong-flash');

        const msg = $('#puzzle-match-msg');
        msg.textContent = 'ちがうよ！';
        msg.className = 'puzzle-match-msg wrong';
        msg.style.display = 'block';

        setTimeout(() => {
          firstEl.classList.remove('wrong-flash');
          el.classList.remove('wrong-flash');
          msg.style.display = 'none';
        }, 600);
      }
    }
  }

  function showMatchedKanji(answer, parts, pairIdx) {
    const completedArea = $('#puzzle-completed');
    const slot = completedArea.querySelector(`.completed-slot[data-pair-idx="${pairIdx}"]`);
    if (slot && !slot.classList.contains('filled')) {
      slot.classList.add('filled');
      slot.innerHTML = `<span class="completed-kanji">${answer}</span><span class="completed-parts">${parts.join(' + ')}</span>`;
    }
  }

  async function showPuzzleResult() { // 🆕 async化
    // 🆕 ALTをサーバーに送信
    if (typeof TrailNav !== 'undefined') await TrailNav.flushAltWithRetry();
    navigateTo('puzzleResult');
    const r = BushuPuzzle.getResult();

    $('#puzzle-result-icon').textContent = r.isPerfect ? '🏆' : (r.accuracy >= 0.7 ? '🧩' : '📖');
    $('#puzzle-result-title').textContent = r.isPerfect ? 'パーフェクト！' : (r.accuracy >= 0.7 ? 'よくできました！' : 'もうちょっと！');
    $('#puzzle-result-score').textContent = r.score;
    $('#puzzle-result-accuracy').textContent = `${Math.round(r.accuracy * 100)}%`;
    $('#puzzle-result-combo').textContent = r.maxCombo;
    $('#puzzle-result-alt').textContent = `+${r.earnedAlt}`;

    // 統計記録
    ScoreManager.recordPuzzle(r.correctCount, r.total, r.maxCombo);

    if (r.earnedAlt > 0) {
      addAlt(r.earnedAlt, `パズル完了 +${r.earnedAlt} ALT`);
      saveProgress();
    }

    // 🆕 ALT獲得表示（パズル）
    const puzzleAltDisplay = document.getElementById('puzzleAltEarnedDisplay');
    if (puzzleAltDisplay) { puzzleAltDisplay.style.display = altEarned > 0 ? 'block' : 'none'; if (altEarned > 0) document.getElementById('puzzleAltEarnedVal').textContent = altEarned; }
    altEarned = 0; // 🆕 リセット

    const mistakesDiv = $('#puzzle-result-mistakes');
    const mistakesList = $('#puzzle-result-mistakes-list');
    if (r.mistakes.length > 0) {
      mistakesDiv.style.display = '';
      mistakesList.innerHTML = r.mistakes.map(m =>
        `<li>${m.parts} → <strong>${m.answer}</strong>（${m.hint}）</li>`
      ).join('');
    } else {
      mistakesDiv.style.display = 'none';
    }
  }

  // ============================================================
  // マイページ
  // ============================================================
  const QUIZ_TYPE_LABELS = {
    reading: '読み',
    strokeCount: '画数',
    strokeOrder: '書き順',
    meaning: '意味',
  };

  const GRADE_COLORS = {
    1: '#FF6B6B', 2: '#FF9F43', 3: '#FECA57',
    4: '#48DBFB', 5: '#0ABDE3', 6: '#8E44AD',
  };

  function renderMypage() {
    const studiedCount = Object.keys(state.studiedKanji).length;
    ScoreManager.updateStudied(studiedCount);
    const stats = ScoreManager.getState();
    const lp = ScoreManager.getLevelProgress(state.totalAlt);

    $('#mypage-level').textContent = `Lv.${lp.level}`;
    $('#mypage-alt').textContent = state.totalAlt;
    $('#mypage-level-fill').style.width = `${Math.round(lp.progress * 100)}%`;
    $('#mypage-level-next').textContent = lp.next
      ? `次のレベルまで ${lp.remaining} ALT`
      : '最大レベル！';

    $('#mypage-studied').textContent = studiedCount;
    $('#mypage-quiz-correct').textContent = stats.quizCorrect;
    $('#mypage-puzzle-correct').textContent = stats.puzzleCorrect;
    $('#mypage-max-combo').textContent = stats.maxCombo;

    // 学年べつ進捗グリッド
    const gradeGrid = $('#mypage-grade-grid');
    gradeGrid.innerHTML = '';
    const perGrade = ScoreManager.getPerGradeStats();

    for (let g = 1; g <= 6; g++) {
      const studied = countStudiedForGrade(g);
      const total = GRADE_COUNTS[g];
      const studiedPct = total > 0 ? Math.round((studied / total) * 100) : 0;

      const pg = perGrade[g];
      let accuracyText = '---';
      if (pg && pg.quizTotal > 0) {
        const acc = Math.round((pg.quizCorrect / pg.quizTotal) * 100);
        accuracyText = `正答率 ${acc}%`;
      }

      const card = document.createElement('button');
      card.className = 'mypage-grade-card';
      card.style.setProperty('--grade-color', GRADE_COLORS[g]);
      card.innerHTML = `
        <span class="grade-num">小${g}</span>
        <span class="grade-studied">${studied} / ${total} (${studiedPct}%)</span>
        <span class="grade-accuracy">${accuracyText}</span>
      `;
      card.addEventListener('click', () => selectGrade(g));
      gradeGrid.appendChild(card);
    }

    // にがてな漢字セクション
    const wk = ScoreManager.getWeakKanji();
    const weakEntries = Object.entries(wk);
    const weakSection = $('#mypage-weak-section');
    const weakList = $('#mypage-weak-list');

    if (weakEntries.length === 0) {
      weakSection.style.display = 'none';
    } else {
      weakSection.style.display = '';
      $('#mypage-weak-count').textContent = weakEntries.length;
      weakList.innerHTML = '';

      // 最新の間違い順にソート
      weakEntries.sort((a, b) => (b[1].lastMistake || 0) - (a[1].lastMistake || 0));

      weakEntries.forEach(([char, info]) => {
        const typeLabels = info.types.map(t => QUIZ_TYPE_LABELS[t] || t).join('・');
        const item = document.createElement('div');
        item.className = 'weak-kanji-item';
        item.innerHTML = `
          <span class="weak-kanji-char">${char}</span>
          <div class="weak-kanji-info">
            <span class="weak-kanji-grade">小${info.grade}</span>
            <span class="weak-kanji-types">${typeLabels}をまちがえた</span>
          </div>
        `;
        weakList.appendChild(item);
      });

      // 復習クイズボタンのイベント
      const reviewBtn = $('#mypage-review-btn');
      reviewBtn.onclick = () => startReviewQuiz();
    }

    // バッジグリッド
    const badges = BadgeManager.getAllBadges();
    const badgeGrid = $('#badge-grid');
    badgeGrid.innerHTML = '';
    $('#mypage-badge-count').textContent = `${BadgeManager.getUnlockedCount()} / ${badges.length}`;

    badges.forEach(b => {
      const div = document.createElement('div');
      div.className = `badge-item${b.unlocked ? '' : ' locked'}`;
      div.innerHTML = `
        <span class="badge-icon">${b.icon}</span>
        <span class="badge-name">${b.unlocked ? b.name : '???'}</span>
      `;
      div.title = b.unlocked ? b.desc : '';
      badgeGrid.appendChild(div);
    });
  }

  // ============================================================
  // 復習クイズ
  // ============================================================
  async function startReviewQuiz() {
    const wk = ScoreManager.getWeakKanji();
    const entries = Object.entries(wk);

    if (entries.length < 4) {
      showToast('にがてな漢字が4つ以上たまったら復習できます', '');
      return;
    }

    // 最頻出タイプを特定
    const typeCounts = {};
    entries.forEach(([, info]) => {
      info.types.forEach(t => {
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      });
    });
    let bestType = 'reading';
    let bestCount = 0;
    for (const [t, c] of Object.entries(typeCounts)) {
      if (c > bestCount) {
        bestCount = c;
        bestType = t;
      }
    }

    // 出題プールを構築: 必要な学年データを読み込み
    const neededGrades = new Set(entries.map(([, info]) => info.grade));
    for (const g of neededGrades) {
      if (!gradeCache[g]) {
        try {
          const resp = await fetch(`data/kanji-grade${g}.json`);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          gradeCache[g] = await resp.json();
        } catch (err) {
          console.error('データ読み込みエラー:', err);
        }
      }
    }

    // weakKanjiの漢字をプールに集める
    const pool = [];
    entries.forEach(([char, info]) => {
      const gd = gradeCache[info.grade];
      if (!gd) return;
      const found = gd.find(k => k.char === char);
      if (found) pool.push(found);
    });

    if (pool.length < 4) {
      showToast('復習データが足りません', '');
      return;
    }

    quizSelectedType = bestType;
    quizSelectedGrade = null; // 復習モードでは学年混合

    const firstQ = QuizEngine.start(bestType, pool);
    if (!firstQ) {
      showToast('復習クイズを開始できません', '');
      return;
    }

    navigateTo('quizPlay');
    renderQuestion(firstQ);
  }

  // ============================================================
  // バッジチェック（各アクション後に呼ぶ）
  // ============================================================
  function triggerBadgeCheck() {
    const stats = ScoreManager.getState();
    BadgeManager.checkAll({
      studiedKanji: state.studiedKanji,
      gradeData: gradeCache,
      quizCorrect: stats.quizCorrect,
      puzzleCorrect: stats.puzzleCorrect,
      maxCombo: stats.maxCombo,
    });
  }

  // ============================================================
  // レベルアップ & バッジモーダル
  // ============================================================
  let badgeQueue = [];
  let showingModal = false;

  function showLevelUpModal(level) {
    $('#levelup-level').textContent = `Lv.${level}`;
    $('#levelup-modal').style.display = 'flex';
  }

  function showBadgeModal(badge) {
    badgeQueue.push(badge);
    if (!showingModal) showNextBadge();
  }

  function showNextBadge() {
    if (badgeQueue.length === 0) { showingModal = false; return; }
    showingModal = true;
    const b = badgeQueue.shift();
    $('#badge-modal-icon').textContent = b.icon;
    $('#badge-modal-name').textContent = b.name;
    $('#badge-modal-desc').textContent = b.desc;
    $('#badge-modal').style.display = 'flex';
  }

  function bindModalEvents() {
    $('#levelup-close').addEventListener('click', () => {
      $('#levelup-modal').style.display = 'none';
    });
    $('#badge-modal-close').addEventListener('click', () => {
      $('#badge-modal').style.display = 'none';
      saveProgress();
      setTimeout(showNextBadge, 300);
    });
  }

  // ============================================================
  // 初期化
  // ============================================================
  function init() {
    // Badge & Score 初期化（loadProgress より先に初期化）
    BadgeManager.init({
      onBadgeUnlock: (badge) => showBadgeModal(badge),
    });
    ScoreManager.init({
      onLevelUp: (level) => showLevelUpModal(level),
    });

    loadProgress();

    StrokeAnimator.init({
      onProgress: (current, total) => {
        updateStrokeControls();
      },
      onComplete: () => {
        updateStrokeControls();
        const kanji = gradeCache[state.selectedGrade]?.[state.selectedKanjiIndex];
        if (kanji) {
          addAlt(5, '書き順アニメ完走 +5 ALT');
          saveProgress();
        }
      }
    });

    bindEvents();
    bindQuizEvents();
    bindPuzzleEvents();
    bindModalEvents();
    navigateTo('home');
    sendGameState('started');
  }

  // DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
