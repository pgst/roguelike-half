<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useCloudSync } from '../composables/useCloudSync';
import { useGameState } from '../composables/useGameState';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { isAnonymous, isLoggedIn, userDisplayName, isLinking, signInWithGoogle, logout } = useAuth();
const { syncStatus, syncError, cloudSaveMetadata, saveToCloud, checkCloudSave, loadFromCloud } = useCloudSync();
const { activeSession, saveSession } = useGameState();

const isCheckingCloud = ref(false);
const isLoggingOut = ref(false);
const hasConflict = ref(false);
const message = ref<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

onMounted(async () => {
  if (isLoggedIn.value) {
    isCheckingCloud.value = true;
    await checkCloudSave();
    isCheckingCloud.value = false;
  }
});

// Googleアカウントでログイン
async function handleLoginGoogle() {
  message.value = null;
  hasConflict.value = false;
  const res = await signInWithGoogle();

  if (res.success) {
    isCheckingCloud.value = true;
    const hasExistingCloud = await checkCloudSave();
    isCheckingCloud.value = false;

    if (hasExistingCloud && cloudSaveMetadata.value) {
      // クラウド側に既存セーブがある場合は競合解決を選択させる
      hasConflict.value = true;
      message.value = {
        text: '⚠️ クラウド上に既存の冒険データが見つかりました。「クラウドから復元」するか「現在のローカルデータで上書き」するか選択してください。',
        type: 'info'
      };
    } else {
      // クラウド側にセーブがない場合はローカル進行データを初回自動アップロード
      message.value = { text: '✨ Googleアカウントでログインしました！ ローカルデータをクラウドへ同期します。', type: 'success' };
      await handleBackupNow();
    }
  } else {
    if (res.cancelled) {
      message.value = { text: 'ℹ️ ログインがキャンセルされました。', type: 'info' };
    } else {
      message.value = { text: `⚠️ ログインに失敗しました: ${res.error || '不明なエラー'}`, type: 'error' };
    }
  }
}

// ログアウト（ローカルデータは保持してゲストに戻る）
async function handleLogout() {
  if (!confirm('Googleアカウントからログアウトしますか？\n\n※現在のローカル冒険データはそのまま保持され、ゲスト状態に戻ります。')) {
    return;
  }
  isLoggingOut.value = true;
  message.value = null;
  hasConflict.value = false;
  const res = await logout();
  isLoggingOut.value = false;
  if (res.success) {
    message.value = { text: '🚪 ログアウトしました。ゲスト冒険者としてプレイを継続できます。', type: 'info' };
    await checkCloudSave();
  } else {
    message.value = { text: `⚠️ ログアウトに失敗しました: ${res.error || '不明なエラー'}`, type: 'error' };
  }
}

// 現在のローカルデータをクラウドへ保存
async function handleBackupNow() {
  message.value = null;
  const ok = await saveToCloud(activeSession.value, true);
  if (ok) {
    hasConflict.value = false;
    message.value = { text: '☁️ クラウドへ最新データをバックアップしました！', type: 'success' };
    await checkCloudSave();
  } else {
    message.value = { text: `⚠️ バックアップ失敗: ${syncError.value || '未ログインまたは通信エラー'}`, type: 'error' };
  }
}

// クラウドのデータでローカルを上書き復元
async function handleRestoreFromCloud() {
  if (!confirm('クラウドのセーブデータで現在のローカルデータを上書き復元しますか？（現在のローカルの進行度は失われます）')) {
    return;
  }
  message.value = null;
  const restored = await loadFromCloud();
  if (restored) {
    activeSession.value = restored;
    saveSession();
    hasConflict.value = false;
    message.value = { text: '🚪 クラウドから冒険データを正常に復元しました！', type: 'success' };
    setTimeout(() => {
      emit('close');
    }, 1500);
  } else {
    message.value = { text: `⚠️ 復元失敗: ${syncError.value || 'データが見つかりません'}`, type: 'error' };
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="sync-modal paper-sheet">
      <div class="modal-header">
        <h2>☁️ クラウド同期 ＆ アカウント連携</h2>
        <button @click="emit('close')" class="btn-close">✕</button>
      </div>

      <div v-if="message" class="alert-box" :class="message.type">
        {{ message.text }}
      </div>

      <!-- Account Info Section -->
      <div class="sync-section">
        <h3 class="section-title">👤 アカウント状況</h3>
        <div class="status-card">
          <div class="user-row">
            <span class="user-name"><b>{{ userDisplayName }}</b></span>
            <span v-if="isAnonymous" class="badge-guest">ゲスト</span>
            <span v-else class="badge-linked">連携済み</span>
          </div>

          <p v-if="isAnonymous" class="guest-desc">
            ※現在はゲスト利用のため、データはこの端末のブラウザ内のみに保存されています。<br/>
            Googleアカウントでログインすると、クラウドへ安全にバックアップされ、複数端末で続きをプレイ可能になります。
          </p>
          <p v-else class="linked-desc">
            Googleアカウントと連携済みです。データは安全にクラウドへ同期されます。
          </p>

          <div v-if="isAnonymous" class="action-row">
            <button 
              @click="handleLoginGoogle" 
              class="btn-ink btn-google" 
              :disabled="isLinking"
            >
              <span v-if="isLinking">ログイン中...</span>
              <span v-else>🔗 Googleアカウントでログインしてクラウド同期</span>
            </button>
          </div>
          <div v-else class="action-row">
            <button 
              @click="handleLogout" 
              class="btn-ink btn-logout" 
              :disabled="isLoggingOut"
            >
              <span v-if="isLoggingOut">ログアウト中...</span>
              <span v-else>🚪 ログアウト（ゲストに戻る）</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Save Data Conflict Section (競合発生時に強調表示) -->
      <div v-if="hasConflict && cloudSaveMetadata" class="sync-section conflict-section animate-fade-in">
        <h3 class="section-title conflict-title">⚠️ セーブデータの選択</h3>
        <div class="conflict-card">
          <p class="conflict-desc">
            クラウド上に既存の冒険データが保存されています。どちらのデータを使用するか選択してください：
          </p>
          <div class="conflict-choices">
            <div class="choice-box cloud-choice">
              <h4>☁️ クラウド側のデータ</h4>
              <p><b>冒険者:</b> {{ cloudSaveMetadata.heroName }} (Lv.{{ cloudSaveMetadata.heroLevel }})</p>
              <p><b>シナリオ:</b> {{ cloudSaveMetadata.scenarioTitle }} (第 {{ cloudSaveMetadata.depth }} 部屋)</p>
              <button @click="handleRestoreFromCloud" class="btn-ink btn-choice btn-secondary">
                📥 このクラウドデータを復元
              </button>
            </div>
            <div class="choice-box local-choice">
              <h4>💻 現在のローカルデータ</h4>
              <p><b>冒険者:</b> {{ activeSession.character?.name || '無名' }} (Lv.{{ activeSession.character?.level || 1 }})</p>
              <p><b>シナリオ:</b> {{ activeSession.activeScenario?.title || '未選択' }} (第 {{ activeSession.dungeonDepth || 1 }} 部屋)</p>
              <button @click="handleBackupNow" class="btn-ink btn-choice">
                📤 このローカルデータで上書き保存
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Cloud Backup Status Section (ログイン中のみ操作可能) -->
      <div v-if="isLoggedIn && !hasConflict" class="sync-section">
        <h3 class="section-title">💾 クラウドセーブデータ</h3>
        
        <div class="cloud-info-card">
          <div v-if="cloudSaveMetadata">
            <p><b>冒険者:</b> {{ cloudSaveMetadata.heroName }} (Lv.{{ cloudSaveMetadata.heroLevel }})</p>
            <p><b>進行中シナリオ:</b> {{ cloudSaveMetadata.scenarioTitle }} (第 {{ cloudSaveMetadata.depth }} 部屋)</p>
            <p style="font-size: 0.85rem; color: var(--ink-light);">
              最終更新: {{ cloudSaveMetadata.updatedAt ? cloudSaveMetadata.updatedAt.toLocaleString('ja-JP') : '不明' }}
            </p>
          </div>
          <div v-else-if="isCheckingCloud" style="color: var(--ink-light); font-style: italic;">
            クラウドのセーブデータを確認中...
          </div>
          <div v-else style="color: var(--ink-light); font-style: italic;">
            クラウド上に保存されたデータはありません。
          </div>

          <div class="sync-buttons" style="display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap;">
            <button 
              @click="handleBackupNow" 
              class="btn-ink btn-mini" 
              style="flex: 1; min-width: 140px;"
              :disabled="syncStatus === 'syncing'"
            >
              📤 今すぐバックアップ
            </button>
            <button 
              v-if="cloudSaveMetadata"
              @click="handleRestoreFromCloud" 
              class="btn-ink btn-mini btn-secondary" 
              style="flex: 1; min-width: 140px;"
              :disabled="syncStatus === 'syncing'"
            >
              📥 クラウドから復元
            </button>
          </div>
        </div>
      </div>

      <div class="modal-footer" style="margin-top: 20px; display: flex; justify-content: flex-end;">
        <button @click="emit('close')" class="btn-ink">閉じる</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  padding: 15px;
}

.sync-modal {
  max-width: 540px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  border: 3px double var(--ink-dark);
  border-radius: 8px;
  padding: 25px;
  background: #fffcf5;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid var(--ink-dark);
  padding-bottom: 8px;
  margin-bottom: 15px;
}

.modal-header h2 {
  font-family: 'Noto Serif JP', serif;
  font-size: 1.25rem;
  margin: 0;
  color: var(--ink-dark);
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: var(--ink-dark);
}

.alert-box {
  padding: 10px 14px;
  border-radius: 4px;
  margin-bottom: 15px;
  font-size: 0.9rem;
  line-height: 1.4;
}

.alert-box.success {
  background: #e8f5e9;
  border: 1px solid #4caf50;
  color: #2e7d32;
}

.alert-box.error {
  background: #ffebee;
  border: 1px solid #ef5350;
  color: #c62828;
}

.alert-box.info {
  background: #e3f2fd;
  border: 1px solid #42a5f5;
  color: #1565c0;
}

.sync-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 1rem;
  margin-bottom: 8px;
  color: var(--ink-dark);
  border-bottom: 1px dashed var(--ink-light);
  padding-bottom: 4px;
}

.status-card, .cloud-info-card, .conflict-card {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  padding: 12px 16px;
}

.user-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.user-name {
  font-size: 1.05rem;
}

.badge-guest {
  background: #78909c;
  color: #fff;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
}

.badge-linked {
  background: #2e7d32;
  color: #fff;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
}

.guest-desc, .linked-desc {
  font-size: 0.85rem;
  color: var(--ink-light);
  line-height: 1.5;
  margin-bottom: 12px;
}

.btn-ink {
  background: var(--paper-bg);
  border: 2px solid var(--ink-dark);
  color: var(--ink-dark);
  padding: 8px 16px;
  font-weight: bold;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.btn-ink:hover:not(:disabled) {
  background: var(--ink-dark);
  color: var(--paper-bg);
}

.btn-ink:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-google {
  width: 100%;
  background: #fff;
  border-color: #4285f4;
  color: #4285f4;
}

.btn-google:hover:not(:disabled) {
  background: #4285f4;
  color: #fff;
}

.btn-logout {
  width: 100%;
  background: #fdf2f2;
  border-color: #c62828;
  color: #c62828;
}

.btn-logout:hover:not(:disabled) {
  background: #c62828;
  color: #fff;
}

.btn-mini {
  padding: 6px 12px;
  font-size: 0.85rem;
}

.btn-secondary {
  border-color: #5c4b3d;
  color: #5c4b3d;
}

/* Conflict Styles */
.conflict-section {
  border: 2px solid #f57c00;
  border-radius: 8px;
  padding: 12px;
  background: #fff8e1;
}

.conflict-title {
  color: #e65100;
  border-bottom-color: #ffe082;
}

.conflict-desc {
  font-size: 0.85rem;
  color: #e65100;
  margin-bottom: 12px;
  font-weight: bold;
}

.conflict-choices {
  display: flex;
  gap: 12px;
  flex-direction: column;
}

.choice-box {
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 10px 12px;
}

.choice-box h4 {
  margin: 0 0 6px 0;
  font-size: 0.95rem;
}

.choice-box p {
  margin: 3px 0;
  font-size: 0.85rem;
  color: var(--ink-light);
}

.btn-choice {
  width: 100%;
  margin-top: 8px;
  padding: 6px 10px;
  font-size: 0.85rem;
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
