// ブロックする文字列のリスト
let blockWordsList = ['しばらく観察していると'];
// 確認ダイアログを表示するかどうか
let showConfirmDialog = true;
// 爆発エフェクトを表示するかどうか
let showExplosionEffect = false;
// 確認済みのツイートIDを保存するセット
let confirmedTweetIds = new Set();
// 自分のIDとフォロワーのIDを保存するセット
let myAndFollowersIds = new Set();

// ハイライト済みのツイートIDを保存するセット
let highlightedTweetIds = new Set();

// 設定を読み込む
function loadSettings() {
  chrome.storage.sync.get(['blockWords', 'showConfirmDialog', 'showExplosionEffect'], function(result) {
    if (result.blockWords) {
      // 改行で分割して配列に変換
      blockWordsList = result.blockWords.split('\n').filter(word => word.trim() !== '');
      console.log('XKusoRepFilter: 設定を読み込みました', blockWordsList);
    }
    
    if (result.showConfirmDialog !== undefined) {
      showConfirmDialog = result.showConfirmDialog;
      console.log('XKusoRepFilter: 確認ダイアログ設定を読み込みました', showConfirmDialog);
    }
    
    if (result.showExplosionEffect !== undefined) {
      showExplosionEffect = result.showExplosionEffect;
      console.log('XKusoRepFilter: 爆発エフェクト設定を読み込みました', showExplosionEffect);
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
  if (namespace === 'sync' && (changes.blockWords || changes.showConfirmDialog || changes.showExplosionEffect)) {
    loadSettings();
  }
});

// ハイライト用のCSSスタイルを追加
function addHighlightStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .xkuso-highlighted-tweet {
      background-color: rgba(255, 0, 0, 0.1) !important;
      border-left: 3px solid red !important;
    }
    .xkuso-highlight {
      background-color: yellow !important;
      color: red !important;
      font-weight: bold !important;
    }
  `;
  document.head.appendChild(style);
}

// スタイルを追加
addHighlightStyles();

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
  
  // 確認ダイアログを作成
  const dialog = document.createElement('div');
  dialog.className = 'xkuso-confirm-dialog';
  dialog.style.cssText = 'position: absolute; bottom: 5px; right: 5px; background-color: rgba(29, 161, 242, 0.9); color: white; padding: 5px; z-index: 9999; display: flex; border-radius: 4px;';
  
  // ブロックボタン
  const blockButton = document.createElement('button');
  blockButton.textContent = 'Block';
  blockButton.style.cssText = 'margin-right: 5px; padding: 3px 8px; background-color: #e0245e; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;';
  blockButton.onclick = function(e) {
    e.stopPropagation(); // イベントの伝播を停止
    confirmedTweetIds.add(tweetId);
    blockTweet(tweet, tweetText);
    if (tweet.contains(dialog)) {
      tweet.removeChild(dialog);
    }
  };
  dialog.appendChild(blockButton);
  
  // キャンセルボタン
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.style.cssText = 'padding: 3px 8px; background-color: #657786; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;';
  cancelButton.onclick = function(e) {
    e.stopPropagation(); // イベントの伝播を停止
    if (tweet.contains(dialog)) {
      tweet.removeChild(dialog);
    }
    tweet.dataset.filtered = 'ignored';
  };
  dialog.appendChild(cancelButton);
  
  // ツイートにダイアログを追加
  tweet.style.position = 'relative';
  tweet.appendChild(dialog);
}

// 爆発エフェクトを表示する関数
function createExplosionEffect(tweet) {
  // ツイートの位置とサイズを取得
  const rect = tweet.getBoundingClientRect();
  
  // エフェクトコンテナを作成
  const container = document.createElement('div');
  container.className = 'xkuso-explosion-container';
  container.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top: ${rect.top}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    z-index: 10000;
    overflow: hidden;
    pointer-events: none;
  `;
  
  // 破片の数を減らし、軽量化
  const fragmentCount = 10; // 20から10に削減
  const colors = ['#ff0000', '#ff7700', '#ffff00', '#ff9900', '#ff5500'];
  
  // CSSアニメーションを使用してパフォーマンスを改善
  for (let i = 0; i < fragmentCount; i++) {
    const fragment = document.createElement('div');
    const size = Math.random() * 15 + 5; // サイズを小さく
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // ランダムな初期位置
    const startX = rect.width / 2;
    const startY = rect.height / 2;
    
    // ランダムな終了位置
    const endX = startX + (Math.random() - 0.5) * rect.width * 1.5;
    const endY = startY + (Math.random() - 0.5) * rect.height * 1.5;
    
    // CSSアニメーションを適用
    fragment.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      background-color: ${color};
      left: ${startX}px;
      top: ${startY}px;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      animation: explosion-particle 600ms ease-out forwards;
    `;
    
    // インラインスタイルでアニメーションを定義
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      @keyframes explosion-particle {
        0% {
          transform: translate(-50%, -50%);
          opacity: 1;
        }
        100% {
          transform: translate(${endX - startX}px, ${endY - startY}px);
          opacity: 0;
        }
      }
    `;
    
    // スタイルと破片を追加
    container.appendChild(styleSheet);
    container.appendChild(fragment);
  }
  
  // コンテナをページに追加
  document.body.appendChild(container);
  
  // アニメーション終了後にコンテナを削除
  setTimeout(() => {
    container.remove();
  }, 600); // 0.6秒後に削除
}

// ツイートをブロックする関数
function blockTweet(tweet, tweetText) {
  // 爆発エフェクトが有効な場合は表示
  if (showExplosionEffect) {
    try {
      createExplosionEffect(tweet);
      
      // ツイートを非表示にする（エフェクト後に少し遅延）
      setTimeout(() => {
        tweet.style.display = 'none';
        // 処理済みとしてマーク
        tweet.dataset.filtered = 'true';
        console.log('XKusoRepFilter: ツイートをブロックしました', tweetText);
      }, 600); // 0.6秒後に非表示（エフェクトの時間に合わせて短縮）
    } catch (error) {
      // エフェクトに失敗した場合は通常の非表示処理
      console.error('XKusoRepFilter: 爆発エフェクトの表示に失敗しました', error);
      tweet.style.display = 'none';
      tweet.dataset.filtered = 'true';
    }
  } else {
    // エフェクトなしですぐに非表示
    tweet.style.display = 'none';
    // 処理済みとしてマーク
    tweet.dataset.filtered = 'true';
    console.log('XKusoRepFilter: ツイートをブロックしました', tweetText);
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

// ツイート内の特定の文字列をハイライトする関数
function highlightBlockWords(tweet, matchedWord) {
  try {
    // すでにハイライト済みの場合はスキップ
    const tweetId = getTweetId(tweet);
    if (highlightedTweetIds.has(tweetId)) return;
    
    // 先にハイライト済みとしてマークしておく（重複処理防止）
    highlightedTweetIds.add(tweetId);
    
    // ツイートの背景色を薄い赤色に変更（全体をハイライト）
    tweet.style.setProperty('background-color', 'rgba(255, 0, 0, 0.1)', 'important');
    tweet.style.setProperty('border-left', '3px solid red', 'important');
    // ハイライト用のクラスも追加
    tweet.classList.add('xkuso-highlighted-tweet');
    
    // テキストノードを探す
    const textNodes = [];
    const walker = document.createTreeWalker(tweet, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent && node.textContent.includes(matchedWord)) {
        textNodes.push(node);
      }
    }
    
    // テキストノードが見つからない場合は、全体を再スキャン
    if (textNodes.length === 0) {
      // ツイートの内容が変わった可能性があるため、少し待ってから再試行
      setTimeout(() => {
        const walker = document.createTreeWalker(tweet, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
          if (node.textContent && node.textContent.includes(matchedWord)) {
            textNodes.push(node);
          }
        }
        processTextNodes(textNodes, matchedWord);
      }, 500);
    } else {
      processTextNodes(textNodes, matchedWord);
    }
  } catch (error) {
    console.error('XKusoRepFilter: ハイライト処理中にエラーが発生しました', error);
  }
}
  
// テキストノードを処理する関数
function processTextNodes(textNodes, matchedWord) {
  if (!textNodes || textNodes.length === 0) return;
  
  textNodes.forEach(textNode => {
    try {
      // テキストノードがドキュメントに存在しない場合はスキップ
      if (!textNode.parentNode) return;
      
      const text = textNode.textContent;
      if (!text || !text.includes(matchedWord)) return;
      
      const parts = text.split(matchedWord);
      
      if (parts.length > 1) {
        const fragment = document.createDocumentFragment();
        
        for (let i = 0; i < parts.length; i++) {
          // 通常のテキスト部分を追加
          if (parts[i]) {
            fragment.appendChild(document.createTextNode(parts[i]));
          }
          
          // マッチした文字列をハイライトして追加
          if (i < parts.length - 1) {
            const highlight = document.createElement('span');
            highlight.textContent = matchedWord;
            highlight.style.backgroundColor = 'yellow';
            highlight.style.color = 'red';
            highlight.style.fontWeight = 'bold';
            highlight.className = 'xkuso-highlight';
            fragment.appendChild(highlight);
          }
        }
        
        // 元のテキストノードをハイライト付きのフラグメントで置き換え
        textNode.parentNode.replaceChild(fragment, textNode);
      }
    } catch (error) {
      console.error('XKusoRepFilter: テキストノード処理中にエラーが発生しました', error);
    }
  });
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
      // 自分またはフォロワーのツイートはブロックせずにハイライトする
      if (isMyOrFollowersTweet(tweet)) {
        highlightBlockWords(tweet, matchedWord);
        tweet.dataset.filtered = 'highlighted';
      } else {
        // 自分とフォロワー以外のツイートはブロック対象
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
