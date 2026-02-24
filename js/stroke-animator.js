/**
 * stroke-animator.js — 書き順アニメーションエンジン
 * SVG stroke-dasharray/dashoffset テクニックで1画ずつ描画
 * v1.0.0
 */

const StrokeAnimator = (() => {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const ANIM_DURATION = 600;   // 1画のアニメーション時間 (ms)
  const STROKE_GAP    = 750;   // 画間の待機時間 (ms)

  let ghostGroup  = null;
  let strokeGroup = null;
  let numberGroup = null;

  let paths      = [];   // SVGパスデータ文字列の配列
  let strokeNums = [];   // [{x, y}, ...] ストローク番号座標
  let totalStrokes = 0;
  let currentStroke = 0; // 次に描画する画のインデックス
  let isAnimating = false;
  let autoPlayTimer = null;
  let animFrameId = null;

  let onProgress = null; // コールバック: (current, total) => void
  let onComplete = null; // コールバック: () => void

  /**
   * 初期化: SVGグループ要素の参照を取得
   */
  function init(options) {
    ghostGroup  = document.getElementById('ghost-group');
    strokeGroup = document.getElementById('stroke-group');
    numberGroup = document.getElementById('number-group');
    onProgress  = options.onProgress || null;
    onComplete  = options.onComplete || null;
  }

  /**
   * 漢字データをロードし、ゴーストストロークを描画
   * @param {Object} kanjiData - { paths: string[], strokeNums: [{x,y}] }
   */
  function load(kanjiData) {
    stop();
    clear();

    paths = kanjiData.paths || [];
    strokeNums = kanjiData.strokeNums || [];
    totalStrokes = paths.length;
    currentStroke = 0;

    // ゴーストストローク描画
    for (let i = 0; i < totalStrokes; i++) {
      const ghost = document.createElementNS(SVGNS, 'path');
      ghost.setAttribute('d', paths[i]);
      ghost.setAttribute('class', 'stroke-ghost');
      ghostGroup.appendChild(ghost);
    }

    // ストローク番号（最初は非表示）
    for (let i = 0; i < strokeNums.length; i++) {
      const text = document.createElementNS(SVGNS, 'text');
      text.setAttribute('x', strokeNums[i].x);
      text.setAttribute('y', strokeNums[i].y);
      text.setAttribute('class', 'stroke-num');
      text.textContent = String(i + 1);
      numberGroup.appendChild(text);
    }

    fireProgress();
  }

  /**
   * 次の1画を描画
   * @returns {Promise<boolean>} 描画した場合 true
   */
  function drawNext() {
    return new Promise((resolve) => {
      if (currentStroke >= totalStrokes || isAnimating) {
        resolve(false);
        return;
      }

      isAnimating = true;
      const idx = currentStroke;

      // SVGパス要素を作成
      const pathEl = document.createElementNS(SVGNS, 'path');
      pathEl.setAttribute('d', paths[idx]);
      pathEl.setAttribute('class', 'stroke-active');
      strokeGroup.appendChild(pathEl);

      // パス長を計測してdasharray/offsetを設定
      const len = pathEl.getTotalLength();
      pathEl.style.strokeDasharray = len;
      pathEl.style.strokeDashoffset = len;

      // アニメーション開始（リフローを強制）
      pathEl.getBoundingClientRect();
      pathEl.style.strokeDashoffset = len; // 明示的に再設定
      pathEl.style.animation = 'none';
      pathEl.getBoundingClientRect(); // 再リフロー
      pathEl.style.animation = '';
      pathEl.style.strokeDasharray = len;
      pathEl.style.strokeDashoffset = len;

      // CSSアニメーションの代わりにrequestAnimationFrameで制御
      const startTime = performance.now();

      function animate(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / ANIM_DURATION, 1);
        const eased = easeOutCubic(progress);
        pathEl.style.strokeDashoffset = len * (1 - eased);

        if (progress < 1) {
          animFrameId = requestAnimationFrame(animate);
        } else {
          // アニメーション完了 → done状態に切り替え
          pathEl.style.strokeDashoffset = '0';
          pathEl.setAttribute('class', 'stroke-done');
          pathEl.style.strokeDasharray = '';

          // ストローク番号を表示
          const numEl = numberGroup.children[idx];
          if (numEl) numEl.classList.add('visible');

          // 対応するゴーストを非表示
          const ghostEl = ghostGroup.children[idx];
          if (ghostEl) ghostEl.style.display = 'none';

          currentStroke++;
          isAnimating = false;
          fireProgress();

          if (currentStroke >= totalStrokes && onComplete) {
            onComplete();
          }

          resolve(true);
        }
      }

      animFrameId = requestAnimationFrame(animate);
    });
  }

  /**
   * 自動再生: 全画を順番に描画
   */
  async function autoPlay() {
    if (isAnimating) return;

    // 未完了なら最初から or 途中から続行
    while (currentStroke < totalStrokes) {
      const drawn = await drawNext();
      if (!drawn) break;
      if (currentStroke < totalStrokes) {
        await wait(STROKE_GAP);
      }
      // stop() が呼ばれた場合中断
      if (autoPlayTimer === null && !isAnimating && currentStroke < totalStrokes) {
        break;
      }
    }
  }

  /**
   * 自動再生開始（外部から呼ぶ）
   */
  function startAutoPlay() {
    if (currentStroke >= totalStrokes) {
      reset();
    }
    autoPlayTimer = true; // フラグとして使用
    autoPlay().then(() => {
      autoPlayTimer = null;
    });
  }

  /**
   * 停止
   */
  function stop() {
    autoPlayTimer = null;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    isAnimating = false;
  }

  /**
   * リセット: 全ストロークをクリアしてゴーストに戻す
   */
  function reset() {
    stop();

    // ストロークグループをクリア
    while (strokeGroup.firstChild) {
      strokeGroup.removeChild(strokeGroup.firstChild);
    }

    // ゴーストを全て再表示
    for (let i = 0; i < ghostGroup.children.length; i++) {
      ghostGroup.children[i].style.display = '';
    }

    // 番号を非表示に
    for (let i = 0; i < numberGroup.children.length; i++) {
      numberGroup.children[i].classList.remove('visible');
    }

    currentStroke = 0;
    fireProgress();
  }

  /**
   * SVG要素を全クリア
   */
  function clear() {
    [ghostGroup, strokeGroup, numberGroup].forEach(g => {
      if (!g) return;
      while (g.firstChild) g.removeChild(g.firstChild);
    });
    paths = [];
    strokeNums = [];
    totalStrokes = 0;
    currentStroke = 0;
  }

  /**
   * 現在の状態を取得
   */
  function getState() {
    return {
      currentStroke,
      totalStrokes,
      isAnimating,
      isComplete: currentStroke >= totalStrokes && totalStrokes > 0
    };
  }

  // --- ユーティリティ ---

  function fireProgress() {
    if (onProgress) onProgress(currentStroke, totalStrokes);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function wait(ms) {
    return new Promise(resolve => {
      const id = setTimeout(resolve, ms);
      // stop時にクリアできるようautoPlayTimerに保存
      if (autoPlayTimer !== null) autoPlayTimer = id;
    });
  }

  return {
    init,
    load,
    drawNext,
    startAutoPlay,
    stop,
    reset,
    getState
  };
})();
