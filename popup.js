document.addEventListener('DOMContentLoaded', function() {
  // デフォルト値を設定
  const defaultBlockWords = 'しばらく観察していると';
  const defaultShowConfirmDialog = true;
  const defaultShowExplosionEffect = false;
  
  // UI要素
  const blockWordsTextarea = document.getElementById('blockWords');
  const showConfirmDialogCheckbox = document.getElementById('showConfirmDialog');
  const showExplosionEffectCheckbox = document.getElementById('showExplosionEffect');
  const saveButton = document.getElementById('saveButton');
  const statusMessage = document.getElementById('status');
  const formGroups = document.querySelectorAll('.form-group');
  const toggleInputs = document.querySelectorAll('.toggle input[type=checkbox]');
  
  // フォームグループにアニメーション効果を追加
  formGroups.forEach((group, index) => {
    group.style.opacity = '0';
    group.style.transform = 'translateY(10px)';
    
    setTimeout(() => {
      group.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      group.style.opacity = '1';
      group.style.transform = 'translateY(0)';
    }, 100 * (index + 1));
  });
  
  // キーボードナビゲーションのサポートを追加
  toggleInputs.forEach(checkbox => {
    checkbox.addEventListener('keydown', function(e) {
      // スペースキーまたはEnterキーでトグルを切り替え
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.checked = !this.checked;
        // 変更イベントを発火させて、リスナーに通知
        this.dispatchEvent(new Event('change'));
      }
    });
  });
  
  // 保存されている設定を読み込む
  chrome.storage.sync.get(['blockWords', 'showConfirmDialog', 'showExplosionEffect'], function(result) {
    const blockWords = result.blockWords || defaultBlockWords;
    blockWordsTextarea.value = blockWords;
    
    const showConfirmDialog = result.showConfirmDialog !== undefined ? result.showConfirmDialog : defaultShowConfirmDialog;
    showConfirmDialogCheckbox.checked = showConfirmDialog;
    
    const showExplosionEffect = result.showExplosionEffect !== undefined ? result.showExplosionEffect : defaultShowExplosionEffect;
    showExplosionEffectCheckbox.checked = showExplosionEffect;
    
    // テキストエリアにフォーカスアニメーション
    blockWordsTextarea.addEventListener('focus', function() {
      this.parentElement.style.transform = 'scale(1.01)';
    });
    
    blockWordsTextarea.addEventListener('blur', function() {
      this.parentElement.style.transform = 'scale(1)';
    });
  });
  
  // 保存ボタンのクリックイベント
  saveButton.addEventListener('click', saveSettings);
  
  // Enterキーでも保存できるようにする
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.ctrlKey) {
      saveSettings();
    }
  });
  
  // 設定を保存する関数
  function saveSettings() {
    // ボタンにクリックエフェクト
    saveButton.classList.add('clicked');
    
    // ボタンのテキストを変更
    const originalText = saveButton.textContent;
    saveButton.textContent = '保存中...';
    
    const blockWords = blockWordsTextarea.value;
    const showConfirmDialog = showConfirmDialogCheckbox.checked;
    const showExplosionEffect = showExplosionEffectCheckbox.checked;
    
    // 設定を保存
    chrome.storage.sync.set({
      blockWords: blockWords,
      showConfirmDialog: showConfirmDialog,
      showExplosionEffect: showExplosionEffect
    }, function() {
      // 保存完了メッセージを表示
      statusMessage.style.display = 'block';
      statusMessage.style.opacity = '0';
      statusMessage.style.transform = 'translateY(10px)';
      
      setTimeout(() => {
        statusMessage.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        statusMessage.style.opacity = '1';
        statusMessage.style.transform = 'translateY(0)';
      }, 10);
      
      // ボタンのテキストを元に戻す
      saveButton.textContent = '保存完了！';
      
      setTimeout(function() {
        saveButton.textContent = originalText;
        saveButton.classList.remove('clicked');
        statusMessage.style.opacity = '0';
        statusMessage.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
          statusMessage.style.display = 'none';
        }, 300);
      }, 2000);
    });
  }
  
  // バージョン情報を表示
  const manifestData = chrome.runtime.getManifest();
  const footerVersion = document.querySelector('.footer p');
  if (footerVersion && manifestData.version) {
    footerVersion.textContent = `XKusoRepFilter v${manifestData.version}`;
  }
});
