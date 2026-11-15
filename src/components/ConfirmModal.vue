<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useConfirmModal } from '../composables/useConfirmModal';

const {
  isVisible,
  modalTitle,
  modalMessage,
  confirmLabel,
  cancelLabel,
  isDanger,
  handleConfirm,
  handleCancel,
} = useConfirmModal();

function onKeydown(e: KeyboardEvent) {
  if (!isVisible.value) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    handleCancel();
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      class="confirm-modal-overlay"
      data-testid="confirm-modal"
      @click.self="handleCancel"
    >
      <div class="confirm-modal-card paper-sheet" role="dialog" aria-modal="true">
        <h3 class="confirm-modal-title">{{ modalTitle }}</h3>
        <p class="confirm-modal-message">{{ modalMessage }}</p>
        <div class="confirm-modal-actions">
          <button
            type="button"
            class="btn-ink btn-cancel"
            data-testid="confirm-modal-cancel"
            @click="handleCancel"
          >
            {{ cancelLabel }}
          </button>
          <button
            type="button"
            class="btn-ink btn-confirm"
            :class="{ 'btn-danger-ink': isDanger }"
            data-testid="confirm-modal-ok"
            @click="handleConfirm"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.confirm-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 12000;
  background: rgba(20, 15, 10, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.confirm-modal-card {
  width: 100%;
  max-width: 460px;
  padding: 24px;
  border: 2px solid var(--ink-dark, #2c1e16);
  border-radius: 8px;
  background: #fdfbf7;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  font-family: 'Noto Serif JP', serif;
}

.confirm-modal-title {
  margin: 0 0 12px 0;
  font-size: 1.2rem;
  color: var(--ink-dark, #2c1e16);
  border-bottom: 1px solid rgba(44, 30, 22, 0.25);
  padding-bottom: 8px;
}

.confirm-modal-message {
  margin: 0 0 20px 0;
  font-size: 0.98rem;
  line-height: 1.6;
  color: var(--ink-dark, #2c1e16);
  white-space: pre-line;
}

.confirm-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-cancel {
  background: rgba(255, 255, 255, 0.6);
  color: #5a4636;
  border-color: #8c735b;
}

.btn-confirm {
  font-weight: bold;
}

.btn-danger-ink {
  background: #8c1c1c;
  color: #fff;
  border-color: #5e1111;
}
</style>
