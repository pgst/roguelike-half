import { ref, computed } from 'vue';
import {
  onAuthStateChanged,
  signInAnonymously,
  linkWithPopup,
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
  const isAnonymous = computed(() => currentUser.value?.isAnonymous ?? true);
  const isLoggedIn = computed(() => currentUser.value !== null);
  const userDisplayName = computed(() => {
    if (!currentUser.value) return '未接続';
    if (currentUser.value.isAnonymous) return 'ゲスト冒険者 (匿名)';
    return currentUser.value.displayName || currentUser.value.email || '冒険者';
  });

  // 認証の自動初期化（匿名サインイン）
  function initAuth(): Promise<User | null> {
    const authInstance = auth;
    if (!authInstance) {
      console.warn('[useAuth] Firebase Auth is not available');
      return Promise.resolve(null);
    }
    if (initPromise) return initPromise;

    initPromise = new Promise((resolve) => {
      onAuthStateChanged(authInstance, async (user) => {
        isInitialized.value = true;
        if (user) {
          currentUser.value = user;
          resolve(user);
        } else {
          try {
            const credential = await signInAnonymously(authInstance);
            currentUser.value = credential.user;
            resolve(credential.user);
          } catch (e: any) {
            console.error('[useAuth] Anonymous sign-in failed:', e);
            authError.value = e.message;
            currentUser.value = null;
            resolve(null);
          }
        }
      });
    });

    return initPromise;
  }

  // Googleアカウントとの連携（匿名アカウントからの昇格）
  async function linkGoogleAccount(): Promise<{ success: boolean; error?: string }> {
    const authInstance = auth;
    if (!authInstance) return { success: false, error: 'Firebase Auth is disabled' };
    authError.value = null;
    isLinking.value = true;

    try {
      const provider = new GoogleAuthProvider();
      if (currentUser.value && currentUser.value.isAnonymous) {
        // 既存の匿名アカウントにGoogle資格情報をリンク
        const result = await linkWithPopup(currentUser.value, provider);
        currentUser.value = result.user;
        return { success: true };
      } else {
        // すでに連携済み、または未ログインの場合は通常のポップアップサインイン
        const result = await signInWithPopup(authInstance, provider);
        currentUser.value = result.user;
        return { success: true };
      }
    } catch (e: any) {
      console.error('[useAuth] Google account linking failed:', e);
      authError.value = e.message;
      return { success: false, error: e.message };
    } finally {
      isLinking.value = false;
    }
  }

  async function logout(): Promise<void> {
    const authInstance = auth;
    if (!authInstance) return;
    await signOut(authInstance);
    currentUser.value = null;
    // ログアウト後は再度匿名サインインで新しい冒険者として開始
    await signInAnonymously(authInstance);
  }

  return {
    currentUser,
    authError,
    isLinking,
    isInitialized,
    isAnonymous,
    isLoggedIn,
    userDisplayName,
    initAuth,
    linkGoogleAccount,
    logout
  };
}
