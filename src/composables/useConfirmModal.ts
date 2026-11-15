import { ref } from 'vue';

export interface ConfirmModalOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

const isVisible = ref(false);
const modalTitle = ref('確認');
const modalMessage = ref('');
const confirmLabel = ref('はい');
const cancelLabel = ref('キャンセル');
const isDanger = ref(false);

let resolveFn: ((result: boolean) => void) | null = null;

export function useConfirmModal() {
  function requestConfirm(options: ConfirmModalOptions): Promise<boolean> {
    if (resolveFn) {
      resolveFn(false);
      resolveFn = null;
    }

    modalTitle.value = options.title || '⚠️ 確認';
    modalMessage.value = options.message;
    confirmLabel.value = options.confirmText || 'はい';
    cancelLabel.value = options.cancelText || 'キャンセル';
    isDanger.value = Boolean(options.danger);
    isVisible.value = true;

    return new Promise<boolean>((resolve) => {
      resolveFn = resolve;
    });
  }

  function handleConfirm() {
    if (!isVisible.value) return;
    isVisible.value = false;
    if (resolveFn) {
      const fn = resolveFn;
      resolveFn = null;
      fn(true);
    }
  }

  function handleCancel() {
    if (!isVisible.value) return;
    isVisible.value = false;
    if (resolveFn) {
      const fn = resolveFn;
      resolveFn = null;
      fn(false);
    }
  }

  return {
    isVisible,
    modalTitle,
    modalMessage,
    confirmLabel,
    cancelLabel,
    isDanger,
    requestConfirm,
    handleConfirm,
    handleCancel,
  };
}
