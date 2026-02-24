/**
 * extract-kanjivg.js
 * KanjiVG ZIPから小学校配当漢字1,026字のストロークデータを抽出し、
 * 学年別JSONファイルを生成する
 *
 * Usage: node scripts/extract-kanjivg.js
 * v1.0.0
 */

const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

// ============================================================
// 2020年新学習指導要領 小学校配当漢字 1,026字
// 小1:80 小2:160 小3:200 小4:202 小5:193 小6:191
// ============================================================

const GRADE_STRINGS = {
  1: '一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六',
  2: '刀丸弓工才万引牛元戸午公今止少心切太内父分方毛友外兄古広市矢台冬半母北用羽回会交光考行合寺自色西多地池当同肉米毎何角汽近形言谷作社図声走体弟売麦来里画岩京国姉知長直店東歩妹明門夜科海活計後思室首秋春食星前茶昼点南風夏家記帰原高紙時弱書通馬魚強教黄黒細週雪船組鳥野理雲絵間場晴朝答道買番園遠楽新数電話歌語算読聞鳴線親頭顔曜',
  3: '丁化区反予央去号皿仕写主申世他打代皮氷平由礼安曲血向死次式守州全有羊両列医究局君決住助身対投豆坂返役委育泳岸苦具幸使始事実者取受所昔注定波板表服物放味命油和屋界客急級係研県指持拾重昭乗神相送待炭柱追度畑発美秒品負面洋員院荷起宮庫根酒消真息速庭島配倍病勉流旅悪球祭終習宿商章深進族第帳笛転都動部問飲運温開階寒期軽湖港歯集暑勝植短着湯登等童悲筆遊葉陽落暗意感漢業詩想鉄農福路駅銀鼻様緑練横談調箱館橋整薬題',
  4: '欠氏井不夫以加功札司失必付辺包末未民令衣印各共好成争仲兆伝灯老位改完岐希求芸佐材児初臣折束沖低努阪兵別利良冷労英岡果芽官季泣協径固刷参治周松卒底的典奈念府阜法牧例茨栄軍建香昨祝城信省浅単栃飛変便約勇要案害挙訓郡候差残借笑席倉孫帯徒特梅浴料連貨械健康菜埼崎産鹿唱清巣側梨敗票副望陸媛賀街覚給極景結最散滋順焼然隊達博飯富満無量愛塩群試辞照節戦続置働管関旗漁熊察種静説徳億課潟器縄選熱標養輪機積録観験類願鏡議競',
  5: '圧囲移因永営衛易益液演応往桜可仮価河過快解格確額刊幹慣眼紀基寄規喜技義逆久旧救居許境均禁句型経潔件険検限現減故個護効厚耕航鉱構興講告混査再災妻採際在財罪殺雑酸賛士支史志枝師資飼示似識質舎謝授修述術準序招証象賞条状常情織職制性政勢精製税責績接設絶祖素総造像増則測属率損貸態団断築貯張停提程適統堂銅導得毒独任燃能破犯判版比肥非費備評貧布婦武復複仏粉編弁保墓報豊防貿暴脈務夢迷綿輸余容略留領歴',
  6: '胃異遺域宇映延沿恩我灰拡革閣割株干巻看簡危机揮貴疑吸供胸郷勤筋系敬警劇激穴券絹権憲源厳己呼誤后孝皇紅降鋼刻穀骨困砂座済裁策冊蚕至私姿視詞誌磁射捨尺若樹収宗就衆従縦縮熟純処署諸除承将傷障蒸針仁垂推寸盛聖誠舌宣専泉洗染銭善奏窓創装層操蔵臓存尊退宅担探誕段暖値宙忠著庁頂腸潮賃痛敵展討党糖届難乳認納脳派拝背肺俳班晩否批秘俵腹奮並陛閉片補暮宝訪亡忘棒枚幕密盟模訳郵優預幼欲翌乱卵覧裏律臨朗論'
};

// ============================================================
// SVG解析
// ============================================================

/**
 * SVGテキストからストロークパスとストローク番号座標を抽出
 * @param {string} svgText - SVGファイルの内容
 * @returns {{ paths: string[], strokeNums: Array<{x: number, y: number}> }}
 */
function parseSVG(svgText) {
  const paths = [];
  const strokeNums = [];

  // <path ... d="..." ...> からd属性を抽出（書き順順に並んでいる）
  const pathRegex = /<path[^>]+id="kvg:[^"]*-s\d+"[^>]*d="([^"]+)"[^>]*>/g;
  let match;
  while ((match = pathRegex.exec(svgText)) !== null) {
    paths.push(match[1]);
  }

  // もしid順で取れなかった場合のフォールバック：全pathのd属性を取得
  if (paths.length === 0) {
    const fallbackRegex = /<path[^>]+d="([^"]+)"[^>]*/g;
    while ((match = fallbackRegex.exec(svgText)) !== null) {
      paths.push(match[1]);
    }
  }

  // <text transform="matrix(1 0 0 1 X Y)">N</text> からX,Y座標を抽出
  const textRegex = /<text\s+transform="matrix\(1\s+0\s+0\s+1\s+([\d.]+)\s+([\d.]+)\)"[^>]*>\d+<\/text>/g;
  while ((match = textRegex.exec(svgText)) !== null) {
    strokeNums.push({
      x: parseFloat(match[1]),
      y: parseFloat(match[2])
    });
  }

  return { paths, strokeNums };
}

/**
 * 漢字1文字のUnicodeコードポイントを5桁16進数に変換
 * @param {string} char - 漢字1文字
 * @returns {string} 5桁の16進数文字列（例: "065e5"）
 */
function charToHex(char) {
  return char.codePointAt(0).toString(16).padStart(5, '0');
}

// ============================================================
// メイン処理
// ============================================================

function main() {
  const zipPath = path.join(__dirname, '..', 'kanjivg-20250816-main.zip');
  const dataDir = path.join(__dirname, '..', 'data');

  // dataディレクトリ作成
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  console.log('KanjiVG ZIPを読み込み中...');
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  // ZIPエントリをファイル名でインデックス化
  const svgMap = {};
  for (const entry of entries) {
    if (entry.entryName.endsWith('.svg')) {
      const basename = path.basename(entry.entryName, '.svg');
      svgMap[basename] = entry;
    }
  }
  console.log(`SVGファイル数: ${Object.keys(svgMap).length}`);

  let totalExtracted = 0;
  let totalMissing = 0;

  for (const grade of [1, 2, 3, 4, 5, 6]) {
    const kanjiList = [...GRADE_STRINGS[grade]];
    const results = [];
    const missing = [];

    console.log(`\n--- 小${grade} (${kanjiList.length}字) ---`);

    for (const char of kanjiList) {
      const unicode = charToHex(char);
      const entry = svgMap[unicode];

      if (!entry) {
        missing.push(char);
        continue;
      }

      const svgText = entry.getData().toString('utf8');
      const { paths, strokeNums } = parseSVG(svgText);

      results.push({
        char,
        unicode,
        grade,
        strokeCount: paths.length,
        paths,
        strokeNums,
        readings: { on: [], kun: [] },
        meaning: '',
        bushu: '',
        bushuName: '',
        formation: {
          type: '',
          description: '',
          components: [],
          meaningPart: '',
          soundPart: ''
        }
      });
    }

    totalExtracted += results.length;
    totalMissing += missing.length;

    // JSON出力
    const outPath = path.join(dataDir, `kanji-grade${grade}.json`);
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`  抽出: ${results.length}字 → ${outPath}`);

    if (missing.length > 0) {
      console.log(`  未発見: ${missing.length}字 [${missing.join('')}]`);
    }
  }

  console.log(`\n========================================`);
  console.log(`合計抽出: ${totalExtracted} / 1026`);
  if (totalMissing > 0) {
    console.log(`未発見: ${totalMissing}字`);
  }
  console.log(`出力先: ${dataDir}/kanji-grade{1-6}.json`);
  console.log(`========================================`);
}

main();
