// --- 定数 --- 
const DEFAULT_MEMO_PATTERNS: string[] = ["チャプター1", "面白かったところ", "重要なポイント", "質問"];
const LOGS_STORAGE_KEY = 'timestampLogs';
const API_KEY_STORAGE_KEY = 'youtubeApiKey';
const MEMO_PATTERNS_STORAGE_KEY = 'memoPatterns';

// --- DOM要素の取得 ---
const memoPatternsList = document.getElementById('memo-patterns-list')!;
const newMemoPatternInput = document.getElementById('new-memo-pattern-input') as HTMLInputElement;
const addMemoPatternButton = document.getElementById('add-memo-pattern-button')!;
const memoButtonsContainer = document.getElementById('memo-buttons-container')!;
const logOutput = document.getElementById('log-output') as HTMLTextAreaElement;
const resetButton = document.getElementById('reset-button')!;
const youtubeUrlInput = document.getElementById('youtube-url') as HTMLInputElement;
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const convertButton = document.getElementById('convert-button')!;
const youtubeTimestamps = document.getElementById('youtube-timestamps') as HTMLTextAreaElement;
const copyButton = document.getElementById('copy-button')!;

// --- データ管理 ---
interface LogEntry {
  timestamp: number; // UNIXタイムスタンプ (ミリ秒)
  memo: string;
}
let logs: LogEntry[] = [];
let memoPatterns: string[] = [];

// --- メモパターン管理機能 ---

/**
 * メモパターンを画面に描画し、削除ボタンのイベントリスナーを設定する
 */
const renderMemoPatterns = () => {
  memoPatternsList.innerHTML = ''; // リストをクリア
  memoPatterns.forEach((pattern, index) => {
    const item = document.createElement('div');
    item.className = 'memo-pattern-item';
    item.textContent = pattern;

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '×';
    deleteButton.addEventListener('click', () => {
      deleteMemoPattern(index);
    });

    item.appendChild(deleteButton);
    memoPatternsList.appendChild(item);
  });
};

/**
 * メモパターンをlocalStorageに保存する
 */
const saveMemoPatterns = () => {
  localStorage.setItem(MEMO_PATTERNS_STORAGE_KEY, JSON.stringify(memoPatterns));
};

/**
 * 新しいメモパターンを追加する
 */
const addMemoPattern = () => {
  const newPattern = newMemoPatternInput.value.trim();
  if (newPattern && !memoPatterns.includes(newPattern)) {
    memoPatterns.push(newPattern);
    saveMemoPatterns();
    renderMemoPatterns();
    createMemoButtons(); // 記録ボタンも更新
    newMemoPatternInput.value = '';
  }
};

/**
 * 指定されたインデックスのメモパターンを削除する
 * @param index 削除するパターンのインデックス
 */
const deleteMemoPattern = (index: number) => {
  memoPatterns.splice(index, 1);
  saveMemoPatterns();
  renderMemoPatterns();
  createMemoButtons(); // 記録ボタンも更新
};


// --- タイムスタンプ記録機能 ---

/**
 * ログを画面とlocalStorageに保存する
 */
const saveAndRenderLogs = () => {
  const formatDateTime = (ts: number) => new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Tokyo'
  }).format(new Date(ts));

  const logText = logs
    .map(log => `[${formatDateTime(log.timestamp)}] ${log.memo}`)
    .join('\n');
  logOutput.value = logText;

  localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
};

/**
 * タイムスタンプとメモを記録する
 * @param memo 記録するメモ文字列
 */
const recordTimestamp = (memo: string) => {
  const newLog: LogEntry = {
    timestamp: Date.now(),
    memo: memo,
  };
  logs.push(newLog);
  logs.sort((a, b) => a.timestamp - b.timestamp);
  saveAndRenderLogs();
};

/**
 * メモ選択ボタンを動的に生成する
 */
const createMemoButtons = () => {
  memoButtonsContainer.innerHTML = ''; // ボタンをクリア
  memoPatterns.forEach(memo => {
    const button = document.createElement('button');
    button.textContent = memo;
    button.addEventListener('click', () => recordTimestamp(memo));
    memoButtonsContainer.appendChild(button);
  });
};

// --- YouTubeタイムスタンプ変換機能 ---

const getVideoIdFromUrl = (url: string): string | null => {
  // Supports:
  // - youtube.com/watch?v=VIDEO_ID
  // - youtu.be/VIDEO_ID
  // - youtube.com/embed/VIDEO_ID
  // - youtube.com/live/VIDEO_ID
  const regex = /(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

const formatSeconds = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const paddedHours = String(hours).padStart(2, '0');
  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(seconds).padStart(2, '0');

  return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
};

const handleConvert = async () => {
  const videoUrl = youtubeUrlInput.value;
  const apiKey = apiKeyInput.value;
  const videoId = getVideoIdFromUrl(videoUrl);

  if (!videoId) {
    alert("有効なYouTubeのURLを入力してください。");
    return;
  }
  if (!apiKey) {
    alert("YouTube Data APIキーを入力してください。");
    return;
  }

  // ログがなくても0秒の「配信開始」は表示するため、ここではチェックしない

  try {
    convertButton.textContent = '変換中...';
    convertButton.disabled = true;

    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=liveStreamingDetails&key=${apiKey}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!response.ok || data.items.length === 0) {
      throw new Error(data.error?.message || '動画情報の取得に失敗しました。');
    }

    const liveDetails = data.items[0].liveStreamingDetails;
    const startTimeString = liveDetails?.actualStartTime;

    if (!startTimeString) {
      throw new Error('ライブ配信の開始時刻が取得できませんでした。アーカイブ動画ではない可能性があります。');
    }

    const startTime = new Date(startTimeString).getTime();

    // 変換処理
    const convertedLines = logs.map(log => {
      const elapsedTimeInSeconds = (log.timestamp - startTime) / 1000;
      // 配信開始より前のログは 0秒 とする
      const formattedTime = elapsedTimeInSeconds > 0 ? formatSeconds(elapsedTimeInSeconds) : formatSeconds(0);
      return `${formattedTime} ${log.memo}`;
    });

    // 0秒に「配信開始」を追加
    convertedLines.unshift(`${formatSeconds(0)} 配信開始`);

    youtubeTimestamps.value = convertedLines.join('\n');

  } catch (error) {
    alert(`エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    convertButton.textContent = '変換実行';
    convertButton.disabled = false;
  }
};


// --- 初期化処理 ---

const initialize = () => {
  // 1. localStorageから各種データを読み込む
  const savedLogs = localStorage.getItem(LOGS_STORAGE_KEY);
  if (savedLogs) {
    logs = JSON.parse(savedLogs);
    saveAndRenderLogs();
  }

  const savedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
  if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
  }

  const savedMemoPatterns = localStorage.getItem(MEMO_PATTERNS_STORAGE_KEY);
  if (savedMemoPatterns) {
    memoPatterns = JSON.parse(savedMemoPatterns);
  } else {
    memoPatterns = [...DEFAULT_MEMO_PATTERNS]; // 保存されたものがなければデフォルト値を使う
  }

  // 2. UIを初期描画
  renderMemoPatterns();
  createMemoButtons();

  // 3. イベントリスナーを設定
  addMemoPatternButton.addEventListener('click', addMemoPattern);

  resetButton.addEventListener('click', () => {
    if (confirm('本当にすべてのログをリセットしますか？')) {
      logs = [];
      saveAndRenderLogs();
    }
  });

  convertButton.addEventListener('click', handleConvert);

  copyButton.addEventListener('click', () => {
    if (youtubeTimestamps.value) {
      navigator.clipboard.writeText(youtubeTimestamps.value);
      alert('クリップボードにコピーしました。');
    }
  });

  apiKeyInput.addEventListener('change', () => {
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKeyInput.value);
  });
};

// アプリケーション実行
initialize();