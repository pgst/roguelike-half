<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  text?: string;
  tag?: string;
}

const props = withDefaults(defineProps<Props>(), {
  text: '',
  tag: 'div'
});

interface TextToken {
  type: 'normal' | 'italic';
  text: string;
}

const tokens = computed<TextToken[]>(() => {
  const content = props.text || '';
  if (!content) return [];

  // Match {斜体}...{/斜体} or {/斜線}
  // Tolerant to missing closing tag at the end of the text
  const regex = /\{斜体\}([\s\S]*?)(?:\{\/(?:斜体|斜線)\}|$)/g;
  const result: TextToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  try {
    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        result.push({
          type: 'normal',
          text: content.slice(lastIndex, match.index)
        });
      }
      if (match[1]) {
        result.push({
          type: 'italic',
          text: match[1].trim()
        });
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
      result.push({
        type: 'normal',
        text: content.slice(lastIndex)
      });
    }
  } catch {
    // Fail-safe: if regex parsing ever throws, fallback to raw text
    return [{ type: 'normal', text: content }];
  }

  return result;
});
</script>

<template>
  <component :is="tag" class="formatted-scenario-text">
    <template v-for="(token, idx) in tokens" :key="idx">
      <blockquote v-if="token.type === 'italic'" class="flavor-quote">
        <span class="flavor-text">{{ token.text }}</span>
      </blockquote>
      <span v-else class="normal-text">{{ token.text }}</span>
    </template>
  </component>
</template>

<style scoped>
.formatted-scenario-text {
  white-space: pre-line;
  line-height: 1.6;
}

.normal-text {
  display: inline;
}

.flavor-quote {
  margin: 10px 0;
  padding: 8px 12px;
  border-left: 3px solid #b08d57;
  background: rgba(176, 141, 87, 0.08);
  border-radius: 0 4px 4px 0;
  font-style: italic;
  font-family: 'Noto Serif JP', serif;
  color: #4a3728;
  font-size: 0.92rem;
  line-height: 1.6;
  white-space: pre-wrap;
}

.flavor-text {
  display: block;
}
</style>
