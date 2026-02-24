/**
 * stroke-reviewer.js — 書き順レビューモジュール v2.0.0
 * クイズ不正解時にその場でアニメ再生 → 「覚えた」→ 別の画数で再出題
 */
const StrokeReviewer = (() => {
  const SVGNS = 'http://www.w3.org/2000/svg';

  // 速度プリセット: [アニメ時間, 画間]
  const SPEEDS = {
    slow:   { duration: 800, gap: 900, label: 'ゆっくり' },
    normal: { duration: 500, gap: 600, label: 'ふつう' },
    fast:   { duration: 250, gap: 300, label: 'はやい' }
  };

  let containerEl = null;
  let svgEl = null;
  let ghostGroup = null;
  let strokeGroup = null;
  let numberGroup = null;
  let instructionEl = null;
  let speedBarEl = null;
  let actionBarEl = null;

  let paths = [];
  let strokeNums = [];
  let kanjiChar = '';
  let totalStrokes = 0;
  let highlightIdx = -1; // 赤でハイライトする画のインデックス
  let currentSpeed = 'normal';
  let phase = 'idle';
  let onMemorized = null;  // 「覚えた」押下時コールバック
  let onSkip = null;
  let animFrameId = null;
  let timeoutIds = [];
  let destroyed = false;

  /**
   * レビューを開始（問題エリアを書き換える）
   * @param {HTMLElement} container - 問題エリアDOM
   * @param {Object} opts
   *   paths: string[] ストロークパス
   *   strokeNums: {x,y}[] ストローク番号座標
   *   kanjiChar: string 漢字1文字
   *   highlightIdx: number 正解だった画のインデックス（赤表示）
   *   onMemorized: Function 「覚えた」押下時
   *   onSkip: Function スキップ時
   */
  function start(container, opts) {
    destroy();
    destroyed = false;

    containerEl = container;
    paths = opts.paths || [];
    strokeNums = opts.strokeNums || [];
    kanjiChar = opts.kanjiChar || '';
    totalStrokes = paths.length;
    highlightIdx = opts.highlightIdx != null ? opts.highlightIdx : -1;
    onMemorized = opts.onMemorized || null;
    onSkip = opts.onSkip || null;
    currentSpeed = 'normal';

    buildUI();
    playAnimation();
  }

  function buildUI() {
    containerEl.innerHTML = '';

    // 速度切り替えバー
    speedBarEl = document.createElement('div');
    speedBarEl.className = 'review-speed-bar';
    Object.entries(SPEEDS).forEach(([key, val]) => {
      const btn = document.createElement('button');
      btn.className = 'review-speed-btn' + (key === currentSpeed ? ' active' : '');
      btn.textContent = val.label;
      btn.dataset.speed = key;
      btn.addEventListener('click', () => {
        if (phase !== 'animating' || destroyed) return;
        currentSpeed = key;
        // ボタン状態更新
        speedBarEl.querySelectorAll('.review-speed-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.speed === key)
        );
        // アニメーション再スタート
        cancelPending();
        playAnimation();
      });
      speedBarEl.appendChild(btn);
    });
    containerEl.appendChild(speedBarEl);

    // 指示テキスト
    instructionEl = document.createElement('div');
    instructionEl.className = 'review-instruction';
    instructionEl.textContent = '書き順を確認しよう';
    containerEl.appendChild(instructionEl);

    // SVG
    svgEl = document.createElementNS(SVGNS, 'svg');
    svgEl.setAttribute('class', 'review-svg');
    svgEl.setAttribute('xmlns', SVGNS);
    svgEl.setAttribute('viewBox', '0 0 109 109');
    svgEl.setAttribute('width', '220');
    svgEl.setAttribute('height', '220');

    // 十字ガイド
    [
      { x1: '54.5', y1: '0', x2: '54.5', y2: '109' },
      { x1: '0', y1: '54.5', x2: '109', y2: '54.5' }
    ].forEach(a => {
      const line = document.createElementNS(SVGNS, 'line');
      line.setAttribute('class', 'guide');
      for (const [k, v] of Object.entries(a)) line.setAttribute(k, v);
      svgEl.appendChild(line);
    });

    ghostGroup = document.createElementNS(SVGNS, 'g');
    strokeGroup = document.createElementNS(SVGNS, 'g');
    numberGroup = document.createElementNS(SVGNS, 'g');
    svgEl.appendChild(ghostGroup);
    svgEl.appendChild(strokeGroup);
    svgEl.appendChild(numberGroup);

    containerEl.appendChild(svgEl);

    // アクションバー（「覚えた」ボタン用、最初は非表示）
    actionBarEl = document.createElement('div');
    actionBarEl.className = 'review-action-bar';
    actionBarEl.style.display = 'none';
    containerEl.appendChild(actionBarEl);
  }

  function renderGhosts() {
    while (ghostGroup.firstChild) ghostGroup.removeChild(ghostGroup.firstChild);
    while (strokeGroup.firstChild) strokeGroup.removeChild(strokeGroup.firstChild);
    while (numberGroup.firstChild) numberGroup.removeChild(numberGroup.firstChild);

    for (let i = 0; i < totalStrokes; i++) {
      const ghost = document.createElementNS(SVGNS, 'path');
      ghost.setAttribute('d', paths[i]);
      ghost.setAttribute('class', 'review-ghost');
      ghostGroup.appendChild(ghost);
    }

    for (let i = 0; i < strokeNums.length && i < totalStrokes; i++) {
      const text = document.createElementNS(SVGNS, 'text');
      text.setAttribute('x', strokeNums[i].x);
      text.setAttribute('y', strokeNums[i].y);
      text.setAttribute('class', 'review-num');
      text.textContent = String(i + 1);
      numberGroup.appendChild(text);
    }
  }

  async function playAnimation() {
    if (destroyed) return;
    phase = 'animating';
    actionBarEl.style.display = 'none';

    const speed = SPEEDS[currentSpeed];
    instructionEl.textContent = `「${kanjiChar}」の書き順を見てね`;
    renderGhosts();

    for (let i = 0; i < totalStrokes; i++) {
      if (destroyed) return;
      const isHighlight = (i === highlightIdx);
      await animateStroke(i, speed.duration, isHighlight);
      if (i < totalStrokes - 1) {
        await wait(speed.gap);
      }
    }

    if (destroyed) return;
    await wait(400);
    showMemorizedAction();
  }

  function animateStroke(idx, duration, isHighlight) {
    return new Promise(resolve => {
      if (destroyed) { resolve(); return; }

      const pathEl = document.createElementNS(SVGNS, 'path');
      pathEl.setAttribute('d', paths[idx]);
      pathEl.setAttribute('class', isHighlight ? 'review-stroke-highlight' : 'review-stroke-active');
      strokeGroup.appendChild(pathEl);

      const len = pathEl.getTotalLength();
      pathEl.style.strokeDasharray = len;
      pathEl.style.strokeDashoffset = len;
      pathEl.getBoundingClientRect();

      const startTime = performance.now();

      function animate(now) {
        if (destroyed) { resolve(); return; }
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutCubic(progress);
        pathEl.style.strokeDashoffset = len * (1 - eased);

        if (progress < 1) {
          animFrameId = requestAnimationFrame(animate);
        } else {
          pathEl.style.strokeDashoffset = '0';
          pathEl.style.strokeDasharray = '';

          // ハイライト画はアニメ後も赤のまま
          if (!isHighlight) {
            pathEl.setAttribute('class', 'review-stroke-done');
          }

          const numEl = numberGroup.children[idx];
          if (numEl) numEl.classList.add('visible');

          const ghostEl = ghostGroup.children[idx];
          if (ghostEl) ghostEl.style.display = 'none';

          resolve();
        }
      }

      animFrameId = requestAnimationFrame(animate);
    });
  }

  function showMemorizedAction() {
    if (destroyed) return;
    phase = 'waiting';

    if (highlightIdx >= 0) {
      instructionEl.innerHTML = `<strong>${highlightIdx + 1}画目</strong>が正解だったよ！`;
    } else {
      instructionEl.textContent = '書き順を確認できたかな？';
    }

    actionBarEl.innerHTML = '';
    actionBarEl.style.display = '';

    const memorizedBtn = document.createElement('button');
    memorizedBtn.className = 'review-memorized-btn';
    memorizedBtn.textContent = '3回なぞってみよう';
    memorizedBtn.addEventListener('click', () => {
      if (destroyed) return;
      if (onMemorized) onMemorized();
    });
    actionBarEl.appendChild(memorizedBtn);
  }

  function cancelPending() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    timeoutIds.forEach(id => clearTimeout(id));
    timeoutIds = [];
  }

  function destroy() {
    destroyed = true;
    phase = 'idle';
    cancelPending();

    if (containerEl) {
      containerEl.innerHTML = '';
    }

    containerEl = null;
    svgEl = null;
    ghostGroup = null;
    strokeGroup = null;
    numberGroup = null;
    instructionEl = null;
    speedBarEl = null;
    actionBarEl = null;
    paths = [];
    strokeNums = [];
    kanjiChar = '';
    totalStrokes = 0;
    highlightIdx = -1;
    onMemorized = null;
    onSkip = null;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function wait(ms) {
    return new Promise(resolve => {
      const id = setTimeout(resolve, ms);
      timeoutIds.push(id);
    });
  }

  return { start, destroy };
})();
