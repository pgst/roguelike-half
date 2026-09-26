<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useCloudSync } from '../composables/useCloudSync';
import { useGameState } from '../composables/useGameState';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { isAnonymous, userDisplayName, isLinking, linkGoogleAccount, signInWithGoogle, logout } = useAuth();
const { syncStatus, syncError, cloudSaveMetadata, saveToCloud, checkCloudSave, loadFromCloud } = useCloudSync();
const { activeSession, saveSession } = useGameState();

const isCheckingCloud = ref(false);
const isLoggingOut = ref(false);
const isSigningInExisting = ref(false);
const hasAccountConflict = ref(false);
const message = ref<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

onMounted(async () => {
  isCheckingCloud.value = true;
  await checkCloudSave();
  isCheckingCloud.value = false;
});

async function handleLinkGoogle() {
  message.value = null;
  hasAccountConflict.value = false;
  const res = await linkGoogleAccount();
  if (res.success) {
    message.value = { text: '✨ Googleアカウントと正常に連携しました！ データが永続化されます。', type: 'success' };
    await handleBackupNow();
  } else {
    if (res.code === 'credential-already-in-use') {
      hasAccountConflict.value = true;
      message.value = { 
        text: '⚠️ このGoogleアカウントは既に別の冒険者データとして登録されています。既存アカウントでログインすると、クラウド上の冒険データを読み込むことができます。', 
        type: 'error' 
      };
    } else {
      message.value = { text: `⚠️ 連携に失敗しました: ${res.error || '不明なエラー'}`, type: 'error' };
    }
  }
}

async function handleSignInExisting() {
  if (!confirm('既存のGoogleアカウントに切り替えてログインしますか？\n\n※ログイン後、クラウドに保存されている冒険データを復元できるようになります。\n※現在のゲスト進行データで上書きしたい場合は、別のアカウントと連携してください。')) {
    return;
  }
  isSigningInExisting.value = true;
  message.value = null;
  const res = await signInWithGoogle();
  isSigningInExisting.value = false;
  if (res.success) {
    hasAccountConflict.value = false;
    message.value = { text: '🔑 既存のGoogleアカウントでログインしました！ クラウドセーブデータを確認してください。', type: 'success' };
    await checkCloudSave();
  } else {
    message.value = { text: `⚠️ ログインに失敗しました: ${res.error || '不明なエラー'}`, type: 'error' };
  }
}

async function handleLogout() {
  if (!confirm('Googleアカウントからログアウトしますか？\n\n※現在のローカル冒険データは保持されたまま、ゲスト状態に戻ります。\n※最新のプレイ進行度をクラウドに残したい場合は、事前に［今すぐバックアップ］を行ってください。')) {
    return;
  }
  isLoggingOut.value = true;
  message.value = null;
  const res = await logout();
  isLoggingOut.value = false;
  if (res.success) {
    message.value = { text: '🚪 ログアウトしました。ゲスト冒険者としてプレイを継続できます。', type: 'info' };
    await checkCloudSave();
  } else {
    message.value = { text: `⚠️ ログアウトに失敗しました: ${res.error || '不明なエラー'}`, type: 'error' };
  }
}

async function handleBackupNow() {
  message.value = null;
  const ok = await saveToCloud(activeSession.value, true);
  if (ok) {
    message.value = { text: '☁️ クラウドへ最新データをバックアップしました！', type: 'success' };
    await checkCloudSave();
  } else {
    message.value = { text: `⚠️ バックアップ失敗: ${syncError.value || '通信エラー'}`, type: 'error' };
  }
}

async function handleRestoreFromCloud() {
  if (!confirm('クラウドのセーブデータで現在のローカルデータを上書き復元しますか？（現在の未保存の進行度は失われます）')) {
    return;
  }
  message.value = null;
  const restored = await loadFromCloud();
  if (restored) {
    activeSession.value = restored;
    saveSession();
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
            ※現在はゲスト（匿名）利用のため、ブラウザのキャッシュ消去や別端末への移行でデータが失われる可能性があります。<br/>
            Googleアカウントと連携すると、同じキャラで別端末からでもプレイ可能になります。
          </p>
          <p v-else class="linked-desc">
            Googleアカウントと連携済みです。データは安全にクラウドへ同期されます。
          </p>

          <div v-if="isAnonymous" class="action-row" style="display: flex; flex-direction: column; gap: 8px;">
            <button 
              @click="handleLinkGoogle" 
              class="btn-ink btn-google" 
              :disabled="isLinking || isSigningInExisting"
            >
              <span v-if="isLinking">連携処理中...</span>
              <span v-else>🔗 Googleアカウントと連携してデータを保存</span>
            </button>

            <!-- 既存アカウント登録済みの場合のログイン切り替えボタン -->
            <button 
              v-if="hasAccountConflict"
              @click="handleSignInExisting"
              class="btn-ink btn-signin-existing animate-fade-in"
              :disabled="isLinking || isSigningInExisting"
            >
              <span v-if="isSigningInExisting">ログイン中...</span>
              <span v-else>🔑 既存のGoogleアカウントでログインする</span>
            </button>
          </div>
          <div v-else class="action-row">
            <button 
              @click="handleLogout" 
              class="btn-ink btn-logout" 
              :disabled="isLoggingOut"
            >
              <span v-if="isLoggingOut">ログアウト中...</span>
              <span v-else>🚪 Googleアカウントからログアウト（ゲストに戻る）</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Cloud Backup Status Section -->
      <div class="sync-section">
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
  max-width: 520px;
  width: 100%;
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
  background: transparent;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: var(--ink-dark);
}

.sync-section {
  margin-bottom: 20px;
}

.section-title {
  font-family: 'Noto Serif JP', serif;
  font-size: 0.95rem;
  font-weight: bold;
  color: var(--ink-dark);
  border-bottom: 1px dashed #c2b09a;
  margin-bottom: 10px;
  padding-bottom: 3px;
}

.status-card, .cloud-info-card {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid #c2b09a;
  border-radius: 6px;
  padding: 12px 15px;
}

.user-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.user-name {
  font-size: 1.05rem;
  color: var(--ink-dark);
}

.badge-guest {
  font-size: 0.75rem;
  background: #e8e0d4;
  color: #705844;
  padding: 2px 6px;
  border-radius: 4px;
}

.badge-linked {
  font-size: 0.75rem;
  background: #e0f2f1;
  color: #00796b;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
}

.guest-desc, .linked-desc {
  font-size: 0.8rem;
  color: #555;
  line-height: 1.4;
  margin: 0 0 10px 0;
}

.btn-google {
  width: 100%;
  background: #ffffff;
  border-color: #4285f4;
  color: #1a73e8;
  font-weight: bold;
  padding: 8px 12px;
}

.alert-box {
  padding: 10px 12px;
  border-radius: 4px;
  font-size: 0.85rem;
  margin-bottom: 15px;
  line-height: 1.4;
}

.alert-box.success {
  background: #e8f5e9;
  border: 1px solid #a5d6a7;
  color: #1b5e20;
}

.alert-box.error {
  background: #ffebee;
  border: 1px solid #ef9a9a;
  color: #c62828;
}

.alert-box.info {
  background: #e3f2fd;
  border: 1px solid #90caf9;
  color: #0d47a1;
}

.btn-logout {
  width: 100%;
  background: #faf8f5;
  border-color: #c2b09a;
  color: #705844;
  font-weight: bold;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-logout:hover:not(:disabled) {
  background: #f4ede2;
  border-color: #8c1c1c;
  color: #8c1c1c;
}

.btn-logout:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-signin-existing {
  width: 100%;
  background: #fdf5e6;
  border: 1px solid #8c6d46;
  color: #3b2c1a;
  font-weight: bold;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-signin-existing:hover:not(:disabled) {
  background: #f5e8d0;
  border-color: #5c4327;
}

.btn-signin-existing:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
