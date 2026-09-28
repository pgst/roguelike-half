import { ref, computed } from 'vue';
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User
} from 'firebase/auth';
import { auth } from '../firebase/config';

const currentUser = ref<User | null>(null);
const authError = ref<string | null>(null);
const isLinking = ref<boolean>(false);
const isInitialized = ref<boolean>(false);

let initPromise: Promise<User | null> | null = null;

export function useAuth() {
  // 未ログインまたは匿名ユーザーはゲスト扱い
  const isLoggedIn = computed(() => currentUser.value !== null && !currentUser.value.isAnonymous);
  const isAnonymous = computed(() => !isLoggedIn.value);
  const userDisplayName = computed(() => {
    if (!currentUser.value || currentUser.value.isAnonymous) {
      return 'ゲスト冒険者 (未ログイン)';
    }
    if (currentUser.value.displayName) {
      return currentUser.value.displayName;
    }
    for (const p of currentUser.value.providerData || []) {
      if (p?.displayName) return p.displayName;
    }
    return currentUser.value.email || '冒険者';
  });
  const userPhotoURL = computed(() => {
    if (!currentUser.value || currentUser.value.isAnonymous) {
      return null;
    }
    if (currentUser.value.photoURL) {
      return currentUser.value.photoURL;
    }
    for (const p of currentUser.value.providerData || []) {
      if (p?.photoURL) {
        return p.photoURL;
      }
    }
    return null;
  });

  let hasBackgroundReloaded = false;

  // 認証の初期化（既存セッションの確認のみ。匿名サインインは行わない）
  function initAuth(): Promise<User | null> {
    const authInstance = auth;
    if (!authInstance) {
      console.warn('[useAuth] Firebase Auth is not available');
      isInitialized.value = true;
      return Promise.resolve(null);
    }
    if (initPromise) return initPromise;

    initPromise = new Promise((resolve) => {
      onAuthStateChanged(authInstance, (user) => {
        isInitialized.value = true;
        // 既存のGoogleアカウント等でログイン済みの場合のみセット
        if (user && !user.isAnonymous) {
          currentUser.value = user;
          resolve(user);

          // セッション復元時に最新プロフィール（画像・表示名）を1回だけ非同期・非ブロッキングで再同期
          if (!hasBackgroundReloaded) {
            hasBackgroundReloaded = true;
            user.reload().then(() => {
              if (authInstance.currentUser) {
                currentUser.value = authInstance.currentUser;
              }
            }).catch((err) => {
              console.warn('[useAuth] Background profile reload failed (ignorable):', err);
            });
          }
        } else {
          currentUser.value = null;
          resolve(null);
        }
      });
    });

    return initPromise;
  }

  // Googleアカウントでログイン（ポップアップ）
  async function signInWithGoogle(): Promise<{ success: boolean; error?: string; cancelled?: boolean }> {
    const authInstance = auth;
    if (!authInstance) return { success: false, error: 'Firebase Auth is disabled' };
    authError.value = null;
    isLinking.value = true;

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      // ポップアップサインインを実行
      const result = await signInWithPopup(authInstance, provider);
      currentUser.value = result.user;
      return { success: true };
    } catch (e: any) {
      // ユーザーによるポップアップ閉じ・キャンセル
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        return { success: false, cancelled: true, error: 'ログインがキャンセルされました。' };
      }
      console.error('[useAuth] Google sign-in failed:', e);
      authError.value = e.message;
      return { success: false, error: e.message };
    } finally {
      isLinking.value = false;
    }
  }

  // ログアウト（Firebaseセッション切断のみ。端末ローカルのセーブデータは保持）
  async function logout(): Promise<{ success: boolean; error?: string }> {
    const authInstance = auth;
    if (!authInstance) return { success: false, error: 'Firebase Auth is disabled' };
    authError.value = null;
    try {
      await signOut(authInstance);
      currentUser.value = null;
      return { success: true };
    } catch (e: any) {
      console.error('[useAuth] Logout failed:', e);
      authError.value = e.message;
      return { success: false, error: e.message };
    }
  }

  return {
    currentUser,
    authError,
    isLinking,
    isInitialized,
    isAnonymous,
    isLoggedIn,
    userDisplayName,
    userPhotoURL,
    initAuth,
    signInWithGoogle,
    logout
  };
}
