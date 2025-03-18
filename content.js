// ブロックする文字列のリスト
let blockWordsList = ['しばらく観察していると', '紹介したこのブロガー', '彼の指導のもと'];
// 確認ダイアログを表示するかどうか
let showConfirmDialog = true;
// 確認済みのツイートIDを保存するセット
let confirmedTweetIds = new Set();
// 自分のIDとフォロワーのIDを保存するセット
let myAndFollowersIds = new Set();


// 設定を読み込む
function loadSettings() {
  chrome.storage.sync.get(['blockWords', 'showConfirmDialog'], function(result) {
    if (result.blockWords) {
      // 改行で分割して配列に変換
      blockWordsList = result.blockWords.split('\n').filter(word => word.trim() !== '');
      console.log('XKusoRepFilter: 設定を読み込みました', blockWordsList);
    }
    
    if (result.showConfirmDialog !== undefined) {
      showConfirmDialog = result.showConfirmDialog;
      console.log('XKusoRepFilter: 確認ダイアログ設定を読み込みました', showConfirmDialog);
    }
  });
}

// 自分のIDとフォロワーのIDを取得する関数
function fetchMyAndFollowersIds() {
  // 自分のプロフィールリンクを探す
  const profileLinks = document.querySelectorAll('a[href^="/"][role="link"][aria-label]');
  
  profileLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.startsWith('/') && !href.includes('/status/')) {
      // 自分のIDを取得
      const myId = href.replace('/', '');
      if (myId && !myAndFollowersIds.has(myId)) {
        myAndFollowersIds.add(myId);
        console.log('XKusoRepFilter: 自分のIDを登録しました', myId);
      }
    }
  });
  
  // フォロワーリストはページから直接取得するのは難しいため、
  // タイムライン上でフォロー中のアカウントを検出します
  const followingIndicators = document.querySelectorAll('span[data-testid="userFollowing"]');
  
  followingIndicators.forEach(indicator => {
    // フォロー中のアカウントのツイート要素を探す
    const tweet = indicator.closest('article[data-testid="tweet"]');
    if (tweet) {
      // ツイートからユーザーIDを取得
      const userLinks = tweet.querySelectorAll('a[role="link"][href^="/"]');
      userLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('/') && !href.includes('/status/')) {
          const userId = href.replace('/', '');
          if (userId && !myAndFollowersIds.has(userId)) {
            myAndFollowersIds.add(userId);
            console.log('XKusoRepFilter: フォロワーIDを登録しました', userId);
          }
        }
      });
    }
  });
}

// 初期設定の読み込み
loadSettings();

// ストレージの変更を監視
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'sync' && (changes.blockWords || changes.showConfirmDialog)) {
    loadSettings();
  }
});

// 確認ダイアログ用のCSSスタイルを追加
function addConfirmDialogStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .xkuso-confirm-dialog {
      position: absolute;
      bottom: 10px;
      right: 10px;
      background-color: white;
      border: 1px solid #ccc;
      border-radius: 8px;
      padding: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      z-index: 9999;
      font-size: 14px;
      max-width: 300px;
    }
    
    .xkuso-confirm-dialog-buttons {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
    }
    
    .xkuso-confirm-dialog-button {
      margin-left: 8px;
      padding: 4px 8px;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      font-weight: bold;
    }
    
    .xkuso-confirm-dialog-block {
      background-color: #f44336;
      color: white;
    }
    
    .xkuso-confirm-dialog-cancel {
      background-color: #e0e0e0;
    }
  `;
  document.head.appendChild(style);
  console.log('XKusoRepFilter: 確認ダイアログスタイルを追加しました');
}

// スタイルを追加
addConfirmDialogStyles();

// 定期的に自分とフォロワーのIDを取得
setInterval(fetchMyAndFollowersIds, 10000);
// 初回実行
fetchMyAndFollowersIds();

// ツイートIDを取得する関数
function getTweetId(tweet) {
  // すでにIDが設定されている場合はそれを返す
  if (tweet.dataset.tweetId) {
    return tweet.dataset.tweetId;
  }
  
  // ツイート要素からリンクを探す
  const links = tweet.querySelectorAll('a[href*="/status/"]');
  for (const link of links) {
    const href = link.getAttribute('href');
    const match = href.match(/\/status\/(\d+)/);
    if (match && match[1]) {
      // IDをデータ属性に保存
      tweet.dataset.tweetId = match[1];
      return match[1];
    }
  }
  
  // IDが見つからない場合はユニークな文字列を生成して保存
  const uniqueId = 'tweet-' + Math.random().toString(36).substring(2, 15);
  tweet.dataset.tweetId = uniqueId;
  return uniqueId;
}

// ツイートを確認前に50%暗くする関数
function dimTweetBeforeConfirmation(tweet) {
  try {
    // すでに暗くなっている場合は何もしない
    if (tweet.classList.contains('xkuso-dimmed-tweet') || tweet.dataset.dimmed === 'true') {
      return;
    }
    
    // クラスを追加して明るさを50%に設定
    tweet.classList.add('xkuso-dimmed-tweet');
    
    // 処理済みとしてマーク
    tweet.dataset.dimmed = 'true';
    
    console.log('XKusoRepFilter: ツイートを50%暗くしました');
  } catch (error) {
    console.error('XKusoRepFilter: ツイートのスタイル変更中にエラーが発生しました', error);
  }
}

// 確認ダイアログを表示する関数
function showBlockConfirmation(tweet, tweetText, matchedWord) {
  // すでに確認ダイアログが表示されている場合は何もしない
  if (tweet.querySelector('.xkuso-confirm-dialog')) return;
  
  // ツイートIDを取得
  const tweetId = getTweetId(tweet);
  
  // すでに確認済みの場合はブロックする
  if (confirmedTweetIds.has(tweetId)) {
    blockTweet(tweet, tweetText);
    return;
  }

  // 自分またはフォロワーのツイートの場合は何もしない
  if (isMyOrFollowersTweet(tweet)) return;
  
  // ツイートを50%暗くする
  dimTweetBeforeConfirmation(tweet);
  
  // 確認ダイアログを作成
  const dialog = document.createElement('div');
  dialog.className = 'xkuso-confirm-dialog';
  dialog.style.cssText = 'position: absolute; bottom: 5px; right: 5px; background-color: rgba(29, 161, 242, 0.9); color: white; padding: 5px; z-index: 9999; display: flex; border-radius: 4px;';
  
  // ブロックボタン
  const blockButton = document.createElement('button');
  blockButton.textContent = 'Block';
  blockButton.style.cssText = 'margin-right: 5px; padding: 12px 24px; background-color: #e0245e; border: none; color: white; border-radius: 9999px; cursor: pointer; font-size: 14px; font-weight: bold;';
  blockButton.onclick = function(e) {
    e.stopPropagation(); // イベントの伝播を停止
    confirmedTweetIds.add(tweetId);
    blockTweet(tweet, tweetText);
    if (tweet.contains(dialog)) {
      tweet.removeChild(dialog);
    }
  };
  dialog.appendChild(blockButton);
  
  // ツイートにダイアログを追加
  tweet.style.position = 'relative';
  tweet.appendChild(dialog);
}

// アニメーション用のスタイルを追加
function addAnimationStyles() {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    /* キーワード含有時のスタイル (50%明るさ) */
    .xkuso-dimmed-tweet {
      filter: brightness(0.5) !important;
      transition: filter 0.3s ease;
    }
    
    /* ブロック後のアニメーション (20%明るさ) */
    @keyframes xkuso-fade-out {
      0% { opacity: 1; transform: scale(1); filter: brightness(0.5); }
      50% { opacity: 0.7; transform: scale(0.98); filter: brightness(0.3); }
      100% { opacity: 0.5; transform: scale(0.95); filter: brightness(0.2); }
    }
    
    @keyframes xkuso-shrink {
      0% { max-height: 1000px; }
      100% { max-height: 100px; }
    }
    
    @keyframes xkuso-blur {
      0% { filter: blur(0); }
      100% { filter: blur(2px); }
    }
    
    @keyframes xkuso-label-appear {
      0% { transform: translateY(-20px); opacity: 0; }
      100% { transform: translateY(0); opacity: 1; }
    }
    
    @keyframes xkuso-pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    
    .xkuso-blocked-tweet {
      animation: xkuso-fade-out 0.8s ease forwards, xkuso-shrink 1s ease forwards;
      overflow: hidden;
      position: relative;
      pointer-events: none;
      border: 1px solid rgba(0, 0, 0, 0.05);
      background-color: rgba(0, 0, 0, 0.02);
      transition: all 0.5s ease;
    }
    
    .xkuso-blocked-tweet * {
      animation: xkuso-blur 0.8s ease forwards;
      transition: all 0.5s ease;
      filter: grayscale(100%);
    }
    
    .xkuso-block-label {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 2px 5px;
      font-size: 10px;
      text-align: center;
      z-index: 999;
      animation: xkuso-label-appear 0.5s ease 0.3s both, xkuso-pulse 2s ease infinite 1s;
    }
  `;
  document.head.appendChild(styleElement);
  console.log('XKusoRepFilter: アニメーションスタイルを追加しました');
}

// ページ読み込み時にアニメーションスタイルを追加
addAnimationStyles();

// ツイートをブロックする関数
function blockTweet(tweet, tweetText) {
  try {
    // すでにブロック済みの場合は何もしない
    if (tweet.classList.contains('xkuso-blocked-tweet') || tweet.dataset.filtered === 'true') {
      return;
    }
    
    // ツイートの内容を保存
    const tweetContent = tweet.innerHTML;
    
    // ツイートの元の高さを保存
    const originalHeight = tweet.offsetHeight;
    
    // 相対配置のための設定
    if (getComputedStyle(tweet).position === 'static') {
      tweet.style.position = 'relative';
    }
    
    // 確認前に追加されたクラスを削除
    tweet.classList.remove('xkuso-dimmed-tweet');
    
    // ブロック時のアニメーションクラスを追加
    tweet.classList.add('xkuso-blocked-tweet');
    
    // ブロックラベルを追加
    const blockLabel = document.createElement('div');
    blockLabel.innerHTML = 'ブロックされたツイート';
    blockLabel.className = 'xkuso-block-label';
    tweet.appendChild(blockLabel);
    
    // クリックイベントを無効化
    const disableClicks = (e) => {
      e.stopPropagation();
      e.preventDefault();
      return false;
    };
    
    tweet.addEventListener('click', disableClicks, true);
    tweet.addEventListener('mousedown', disableClicks, true);
    tweet.addEventListener('mouseup', disableClicks, true);
    
    // エフェクト音を再生
    playBlockSound();
    
    // 処理済みとしてマーク
    tweet.dataset.filtered = 'true';
    tweet.dataset.originalContent = encodeURIComponent(tweetContent);
    
    console.log('XKusoRepFilter: ツイートをブロックし、アニメーションを適用しました', tweetText);
  } catch (error) {
    console.error('XKusoRepFilter: ツイートのスタイル変更中にエラーが発生しました', error);
    
    // エラーが発生した場合は当初の方法で非表示にする
    tweet.style.display = 'none';
    tweet.dataset.filtered = 'true';
  }
}

// ブロック時のエフェクト音を再生する関数
function playBlockSound() {
  try {
    // AudioContextを作成
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // オシレーターを作成
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // オシレーターの設定
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
    oscillator.frequency.exponentialRampToValueAtTime(220, audioContext.currentTime + 0.2); // A3
    
    // 音量の設定
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    // 接続
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // 再生
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (error) {
    console.error('XKusoRepFilter: エフェクト音の再生中にエラーが発生しました', error);
  }
}

// ツイートが自分またはフォロワーのものかチェックする関数
function isMyOrFollowersTweet(tweet) {
  // ツイートからユーザーIDを取得
  const userLinks = tweet.querySelectorAll('a[role="link"][href^="/"]');
  for (const link of userLinks) {
    const href = link.getAttribute('href');
    if (href && href.startsWith('/') && !href.includes('/status/')) {
      const userId = href.replace('/', '');
      // 自分またはフォロワーのIDかチェック
      if (myAndFollowersIds.has(userId)) {
        return true;
      }
    }
  }
  return false;
}

// 認証済みアカウントかチェックする関数
function isVerifiedAccount(tweet) {
  try {
    // 認証済みアカウントのマークを探す
    // 認証済みアカウントは青いチェックマークアイコンが表示される
    const verifiedBadge = tweet.querySelector('svg[aria-label="認証済みアカウント"]');
    if (verifiedBadge) {
      return true;
    }
    
    // 英語表記の場合もチェック
    const verifiedBadgeEn = tweet.querySelector('svg[aria-label="Verified Account"]');
    if (verifiedBadgeEn) {
      return true;
    }
    
    // その他の言語の場合もチェックするため、チェックマークの色で判定
    const svgElements = tweet.querySelectorAll('svg');
    for (const svg of svgElements) {
      // 青いチェックマークを探す
      const paths = svg.querySelectorAll('path[fill="rgb(29, 155, 240)"]');
      if (paths.length > 0) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('XKusoRepFilter: 認証済みアカウントチェック中にエラーが発生しました', error);
    return false;
  }
}


// ツイートをフィルタリングする関数
function filterTweets() {
  // タイムラインの各ツイート要素を取得
  const tweets = document.querySelectorAll('article[data-testid="tweet"]');
  
  tweets.forEach(tweet => {
    // すでに処理済みの場合はスキップ
    if (tweet.dataset.filtered) return;
    
    // ツイートのテキスト内容を取得
    const tweetText = tweet.textContent || '';
    
    // ブロックワードが含まれているかチェック
    let matchedWord = null;
    for (const word of blockWordsList) {
      if (tweetText.includes(word)) {
        matchedWord = word;
        break;
      }
    }
    
    if (matchedWord) {
      // 自分、フォロワー、または認証済みアカウントのツイートはブロックしない
      if (isMyOrFollowersTweet(tweet) || isVerifiedAccount(tweet)) {
        tweet.dataset.filtered = 'skipped';
        if (isVerifiedAccount(tweet)) {
          console.log('XKusoRepFilter: 認証済みアカウントのツイートをスキップしました');
        }
      } else {
        // 自分、フォロワー、認証済みアカウント以外のツイートはブロック対象
        if (showConfirmDialog) {
          // 確認ダイアログを表示
          showBlockConfirmation(tweet, tweetText, matchedWord);
        } else {
          // 確認なしでブロック
          blockTweet(tweet, tweetText);
        }
      }
    }

  });
}

// MutationObserverを使用してDOMの変更を監視
const observer = new MutationObserver(function(mutations) {
  filterTweets();
});

// 監視の開始
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// 初回実行
filterTweets();

// 定期的にフィルタリングを実行（スクロール時などの対策）
setInterval(filterTweets, 2000);
