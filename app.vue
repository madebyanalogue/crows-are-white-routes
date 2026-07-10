<script setup lang="ts">
type TabMediaItem = {
  id: string
  type: 'image' | 'video'
  src: string
  rolloverSrc?: string
  href?: string
  caption?: string
  fullWidth: boolean
  mediaWidth?: number
  mediaHeight?: number
  width: number
  height: number
}

type Tab = {
  slug: string
  title: string
  infoTitle?: string
  infoDescription?: string
  gridColumns: 3 | 4
  items: TabMediaItem[]
}

const STORAGE_KEY = 'caw-active-tab'
const THEME_KEY = 'caw-theme'
const INFO_OPEN_KEY = 'caw-info-open'

type Theme = 'dark' | 'light'
type GridCols = 3 | 4

const { data: tabs } = await useFetch<Tab[]>('/api/tabs')

const active = useCookie<string | null>(STORAGE_KEY, {
  default: () => null,
  watch: true,
})

const tabList = computed(() => tabs.value ?? [])
const bootstrapped = ref(false)

function pickDefaultTab(list: Tab[]) {
  return list.find((tab) => tab.items.length > 0)?.slug ?? list[0].slug
}

watch(
  tabList,
  (list) => {
    if (!list.length) {
      active.value = null
      bootstrapped.value = false
      return
    }

    if (!list.some((tab) => tab.slug === active.value)) {
      active.value = pickDefaultTab(list)
      bootstrapped.value = true
      return
    }

    if (!bootstrapped.value) {
      bootstrapped.value = true
      const current = list.find((tab) => tab.slug === active.value)
      if (current && current.items.length === 0) {
        const withItems = list.find((tab) => tab.items.length > 0)
        if (withItems) active.value = withItems.slug
      }
    }
  },
  { immediate: true }
)

const currentTab = computed(
  () => tabList.value.find((tab) => tab.slug === active.value) ?? null
)

const items = computed(() => currentTab.value?.items ?? [])

const theme = useCookie<Theme>(THEME_KEY, {
  default: () => 'dark',
  watch: true,
})

const infoOpenCookie = useCookie<'0' | '1'>(INFO_OPEN_KEY, {
  default: () => '1',
})

const infoOpen = ref(infoOpenCookie.value === '1')

watch(infoOpen, (open) => {
  infoOpenCookie.value = open ? '1' : '0'
})

const isLight = computed(() => theme.value === 'light')
const infoPanelTitle = computed(() => currentTab.value?.infoTitle?.trim() || '')
const infoPanelDescription = computed(
  () => currentTab.value?.infoDescription?.trim() || ''
)
const hasInfoContent = computed(
  () => Boolean(infoPanelTitle.value || infoPanelDescription.value)
)

function toggleInfo() {
  infoOpen.value = !infoOpen.value
}

const tabDropdownOpen = ref(false)

function selectTab(slug: string) {
  active.value = slug
  tabDropdownOpen.value = false
}

function toggleTabDropdown() {
  tabDropdownOpen.value = !tabDropdownOpen.value
}

watch(active, () => {
  tabDropdownOpen.value = false
})

onMounted(() => {
  if (typeof window === 'undefined') return
  document.addEventListener('pointerdown', onTabDropdownPointerDown)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onTabDropdownPointerDown)
})

function onTabDropdownPointerDown(event: PointerEvent) {
  const target = event.target
  if (!(target instanceof Node)) return
  if (!document.querySelector('.tab-dropdown')?.contains(target)) {
    tabDropdownOpen.value = false
  }
}

const selectedGridCols = ref<GridCols>(3)
const lightboxVisible = ref(false)
const lightboxSourceRect = ref<DOMRect | null>(null)
const lightboxMediaEl = ref<HTMLImageElement | HTMLVideoElement | null>(null)

watch(
  currentTab,
  (tab) => {
    selectedGridCols.value = tab?.gridColumns === 4 ? 4 : 3
  },
  { immediate: true }
)

const lightboxItem = ref<TabMediaItem | null>(null)
const fullWidthAspect = ref<Record<string, string>>({})

watch([active, selectedGridCols], () => {
  fullWidthAspect.value = {}
})

function fullWidthAspectRatio(item: TabMediaItem) {
  return (
    fullWidthAspect.value[item.id] ??
    (item.mediaWidth && item.mediaHeight
      ? `${item.mediaWidth} / ${item.mediaHeight}`
      : undefined)
  )
}

function tileWrapStyle(item: TabMediaItem) {
  if (item.fullWidth) {
    const aspectRatio = fullWidthAspectRatio(item)
    return aspectRatio ? { aspectRatio } : undefined
  }

  const style: Record<string, string | number> = {
    '--w': item.width,
    '--h': item.height,
  }
  const aspectRatio = fullWidthAspectRatio(item)
  if (aspectRatio) style['--media-aspect'] = aspectRatio

  return style
}

function onFullWidthMediaMeta(
  mediaEl: HTMLImageElement | HTMLVideoElement,
  itemId: string
) {
  const naturalWidth =
    mediaEl instanceof HTMLVideoElement ? mediaEl.videoWidth : mediaEl.naturalWidth
  const naturalHeight =
    mediaEl instanceof HTMLVideoElement ? mediaEl.videoHeight : mediaEl.naturalHeight

  if (!naturalWidth || !naturalHeight) return

  fullWidthAspect.value = {
    ...fullWidthAspect.value,
    [itemId]: `${naturalWidth} / ${naturalHeight}`,
  }
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
}

function openLightbox(item: TabMediaItem, event: MouseEvent) {
  const trigger = event.currentTarget as HTMLElement | null
  lightboxSourceRect.value = trigger?.getBoundingClientRect() ?? null
  lightboxItem.value = item
}

function closeLightbox() {
  lightboxVisible.value = false
  lightboxItem.value = null
  lightboxSourceRect.value = null
}

watch(lightboxItem, (item, _, onCleanup) => {
  if (typeof window === 'undefined') return

  document.body.style.overflow = item ? 'hidden' : ''

  if (item) {
    requestAnimationFrame(() => {
      lightboxVisible.value = true
      runFlipAnimation()
    })

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLightbox()
    }
    window.addEventListener('keydown', onKeydown)
    onCleanup(() => {
      window.removeEventListener('keydown', onKeydown)
      document.body.style.overflow = ''
    })
  }
})

function runFlipAnimation() {
  if (!lightboxSourceRect.value || !lightboxMediaEl.value) return
  const targetRect = lightboxMediaEl.value.getBoundingClientRect()
  if (!targetRect.width || !targetRect.height) return

  const scaleX = lightboxSourceRect.value.width / targetRect.width
  const scaleY = lightboxSourceRect.value.height / targetRect.height
  const translateX = lightboxSourceRect.value.left - targetRect.left
  const translateY = lightboxSourceRect.value.top - targetRect.top

  lightboxMediaEl.value.animate(
    [
      {
        transformOrigin: 'top left',
        transform: `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`,
      },
      { transformOrigin: 'top left', transform: 'translate(0, 0) scale(1, 1)' },
    ],
    {
      duration: 340,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      fill: 'both',
    }
  )
}

useHead({
  htmlAttrs: {
    class: computed(() => (isLight.value ? 'light' : '')),
  },
})
</script>

<template>
  <ClientOnly>
    <div
      class="app"
      :class="{ 'app--light': isLight }"
      :style="{ '--cols': selectedGridCols }"
    >
      <header class="header">
        <button
          v-if="hasInfoContent"
          type="button"
          class="info-toggle"
          :aria-expanded="infoOpen"
          aria-controls="tab-info-panel"
          aria-label="Toggle tab info"
          @click.stop.prevent="toggleInfo"
        >
          <svg
            class="info-toggle__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5" stroke-linecap="round" />
            <circle cx="12" cy="8" r="0.75" fill="currentColor" stroke="none" />
          </svg>
        </button>

        <nav v-if="tabList.length" class="toggle toggle--desktop">
          <button
            v-for="tab in tabList"
            :key="tab.slug"
            class="toggle__btn"
            :class="{ 'toggle__btn--active': active === tab.slug }"
            @click="active = tab.slug"
          >
            {{ tab.title }}
          </button>
        </nav>

        <div v-if="tabList.length" class="tab-dropdown">
          <button
            type="button"
            class="tab-dropdown__trigger"
            :aria-expanded="tabDropdownOpen"
            aria-haspopup="listbox"
            @click.stop="toggleTabDropdown"
          >
            <span class="tab-dropdown__label">{{ currentTab?.title ?? 'Select tab' }}</span>
            <svg
              class="tab-dropdown__chevron"
              :class="{ 'tab-dropdown__chevron--open': tabDropdownOpen }"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <path d="M3 4.5 6 7.5 9 4.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <div
            v-show="tabDropdownOpen"
            class="tab-dropdown__menu"
            role="listbox"
            :aria-activedescendant="active ? `tab-option-${active}` : undefined"
          >
            <button
              v-for="tab in tabList"
              :id="`tab-option-${tab.slug}`"
              :key="tab.slug"
              type="button"
              class="tab-dropdown__option"
              :class="{ 'tab-dropdown__option--active': active === tab.slug }"
              role="option"
              :aria-selected="active === tab.slug"
              @click="selectTab(tab.slug)"
            >
              {{ tab.title }}
            </button>
          </div>
        </div>

        <div class="header-controls">
          <div v-if="currentTab" class="grid-toggle" role="group" aria-label="Grid size">
            <button
              type="button"
              class="grid-toggle__btn"
              :class="{ 'grid-toggle__btn--active': selectedGridCols === 3 }"
              aria-label="3 columns"
              @click="selectedGridCols = 3"
            >
              <svg class="grid-toggle__icon" viewBox="0 0 16 16" aria-hidden="true">
                <rect x="1" y="1" width="4" height="4" rx="0.5" fill="currentColor" />
                <rect x="6" y="1" width="4" height="4" rx="0.5" fill="currentColor" />
                <rect x="11" y="1" width="4" height="4" rx="0.5" fill="currentColor" />
                <rect x="1" y="6" width="4" height="4" rx="0.5" fill="currentColor" />
                <rect x="6" y="6" width="4" height="4" rx="0.5" fill="currentColor" />
                <rect x="11" y="6" width="4" height="4" rx="0.5" fill="currentColor" />
                <rect x="1" y="11" width="4" height="4" rx="0.5" fill="currentColor" />
                <rect x="6" y="11" width="4" height="4" rx="0.5" fill="currentColor" />
                <rect x="11" y="11" width="4" height="4" rx="0.5" fill="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              class="grid-toggle__btn"
              :class="{ 'grid-toggle__btn--active': selectedGridCols === 4 }"
              aria-label="4 columns"
              @click="selectedGridCols = 4"
            >
              <svg class="grid-toggle__icon" viewBox="0 0 16 16" aria-hidden="true">
                <rect x="0.5" y="0.5" width="3" height="3" rx="0.4" fill="currentColor" />
                <rect x="4.5" y="0.5" width="3" height="3" rx="0.4" fill="currentColor" />
                <rect x="8.5" y="0.5" width="3" height="3" rx="0.4" fill="currentColor" />
                <rect x="12.5" y="0.5" width="3" height="3" rx="0.4" fill="currentColor" />
                <rect x="0.5" y="4.5" width="3" height="3" rx="0.4" fill="currentColor" />
                <rect x="4.5" y="4.5" width="3" height="3" rx="0.4" fill="currentColor" />
                <rect x="8.5" y="4.5" width="3" height="3" rx="0.4" fill="currentColor" />
                <rect x="12.5" y="4.5" width="3" height="3" rx="0.4" fill="currentColor" />
                <rect x="0.5" y="8.5" width="3" height="3" rx="0.4" fill="currentColor" />
                <rect x="4.5" y="8.5" width="3" height="3" rx="0.4" fill="currentColor" />
                <rect x="8.5" y="8.5" width="3" height="3" rx="0.4" fill="currentColor" />
                <rect x="12.5" y="8.5" width="3" height="3" rx="0.4" fill="currentColor" />
                <rect x="0.5" y="12.5" width="3" height="3" rx="0.4" fill="currentColor" />
                <rect x="4.5" y="12.5" width="3" height="3" rx="0.4" fill="currentColor" />
                <rect x="8.5" y="12.5" width="3" height="3" rx="0.4" fill="currentColor" />
                <rect x="12.5" y="12.5" width="3" height="3" rx="0.4" fill="currentColor" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            class="theme-toggle"
            :aria-label="isLight ? 'Switch to dark mode' : 'Switch to light mode'"
            @click="toggleTheme"
          >
            <svg
              v-if="isLight"
              class="theme-toggle__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              aria-hidden="true"
            >
              <path
                d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <svg
              v-else
              class="theme-toggle__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4" />
              <path
                d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <main class="page">
        <div
          v-if="hasInfoContent"
          id="tab-info-panel"
          class="info-panel"
          :class="{ 'info-panel--open': infoOpen }"
        >
          <div class="info-panel__inner">
            <div class="info-panel__content">
              <div class="info-panel__body">
                <p v-if="infoPanelTitle" class="info-panel__title">
                  {{ infoPanelTitle }}
                </p>
                <p v-if="infoPanelDescription" class="info-panel__description">
                  {{ infoPanelDescription }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div v-if="items.length" :key="active ?? 'empty'" class="grid">
          <article
            v-for="item in items"
            :key="item.id"
            class="tile-wrap"
            :class="{ 'tile-wrap--full': item.fullWidth }"
            :style="tileWrapStyle(item)"
          >
            <component
              :is="item.href ? 'a' : 'button'"
              v-bind="
                item.href
                  ? {
                      href: item.href,
                      target: '_blank',
                      rel: 'noopener noreferrer',
                    }
                  : { type: 'button' }
              "
              class="tile"
              :class="{ 'tile--link': item.href }"
              :aria-label="
                item.href
                  ? `Visit ${item.caption || 'site'}`
                  : `View ${item.caption || 'item'}`
              "
              @click="!item.href && openLightbox(item, $event)"
            >
              <video
                v-if="item.type === 'video'"
                :src="item.src"
                class="media"
                autoplay
                loop
                muted
                playsinline
                preload="auto"
                @loadedmetadata="
                  onFullWidthMediaMeta($event.target as HTMLVideoElement, item.id)
                "
              />
              <div v-else class="tile__media">
                <img
                  :src="item.src"
                  class="media"
                  loading="lazy"
                  alt=""
                  @load="
                    onFullWidthMediaMeta($event.target as HTMLImageElement, item.id)
                  "
                />
                <img
                  v-if="item.rolloverSrc"
                  :src="item.rolloverSrc"
                  class="media media--rollover"
                  loading="lazy"
                  alt=""
                />
              </div>
              <div
                v-if="item.caption || item.href"
                class="tile__overlay"
              >
                <span v-if="item.caption" class="tile__caption">{{
                  item.caption
                }}</span>
                <span
                  v-if="item.href"
                  class="tile__link"
                  :class="{ 'tile__link--solo': !item.caption }"
                >
                  Visit site
                  <svg
                    class="tile__link-arrow"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 9L9 3M9 3H4M9 3V8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </component>
          </article>
        </div>

        <p v-else class="empty">
          {{
            tabList.length
              ? `No media in “${currentTab?.title}” yet.`
              : 'Add tabs in Sanity Studio to get started.'
          }}
        </p>
      </main>

      <Teleport to="body">
        <div
          v-if="lightboxItem"
          class="lightbox"
          :class="{ 'lightbox--visible': lightboxVisible }"
          role="dialog"
          aria-modal="true"
          @click.self="closeLightbox"
        >
          <button
            type="button"
            class="lightbox__close"
            aria-label="Close"
            @click="closeLightbox"
          >
            ×
          </button>

          <div class="lightbox__content">
            <video
              v-if="lightboxItem.type === 'video'"
              ref="lightboxMediaEl"
              :src="lightboxItem.src"
              class="lightbox__media"
              controls
              autoplay
              playsinline
            />
            <img
              v-else
              ref="lightboxMediaEl"
              :src="lightboxItem.src"
              class="lightbox__media"
              alt=""
            />
          </div>
        </div>
      </Teleport>
    </div>
  </ClientOnly>
</template>

<style>
:root {
  --gap: 16px;
  --font-mono: Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  --radius: clamp(10px, 1.5vw, 30px);
  --header-h: 88px;
  --page-pad: 24px;
  --cols: 3;
  --unit: calc(
    (100vw - (var(--page-pad) * 2) - (var(--gap) * (var(--cols) - 1))) /
      var(--cols)
  );
  --bg: #000;
  --text: #fff;
  --text-muted: rgba(255, 255, 255, 0.4);
  --toggle-bg: rgba(28, 28, 30, 0.72);
  --toggle-border: rgba(255, 255, 255, 0.08);
  --toggle-shadow: 0 1px 0px rgba(0, 0, 0, 0.03);
  --toggle-btn: rgba(255, 255, 255, 0.6);
  --toggle-btn-hover: rgba(255, 255, 255, 0.9);
  --toggle-btn-active-bg: #fff;
  --toggle-btn-active-text: #000;
  --tile-bg: #0c0c0c;
  --caption-bg: rgba(28, 28, 30, 0.78);
  --caption-text: rgba(255, 255, 255, 0.92);
  --theme-toggle-bg: rgba(28, 28, 30, 0.72);
  --theme-toggle-border: rgba(255, 255, 255, 0.08);
  --theme-toggle-color: rgba(255, 255, 255, 0.85);
}

:root.light,
.app--light {
  --bg: #f0f0f2;
  --text: #111;
  --text-muted: rgba(0, 0, 0, 0.45);
  --toggle-bg: rgba(255, 255, 255, 0.82);
  --toggle-border: rgba(0, 0, 0, 0.08);
  --toggle-shadow: 0 1px 0px rgba(0, 0, 0, 0.03);
  --toggle-btn: rgba(0, 0, 0, 0.5);
  --toggle-btn-hover: rgba(0, 0, 0, 0.85);
  --toggle-btn-active-bg: #111;
  --toggle-btn-active-text: #fff;
  --tile-bg: #e4e4e8;
  --caption-bg: rgba(255, 255, 255, 0.88);
  --caption-text: rgba(0, 0, 0, 0.88);
  --theme-toggle-bg: rgba(255, 255, 255, 0.82);
  --theme-toggle-border: rgba(0, 0, 0, 0.08);
  --theme-toggle-color: rgba(0, 0, 0, 0.75);
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica,
    Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  transition: background 0.25s ease, color 0.25s ease;
}

.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px 16px;
  pointer-events: none;
}

.info-toggle {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  appearance: none;
  border: 1px solid var(--theme-toggle-border);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 999px;
  background: var(--theme-toggle-bg);
  color: var(--theme-toggle-color);
  opacity: 1;
  pointer-events: auto;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.2s ease;
}

.info-toggle:hover {
  opacity: 0.75;
}

.info-toggle__icon {
  width: 18px;
  height: 18px;
}

.header-controls {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
}

.grid-toggle {
  display: inline-flex;
  gap: 4px;
  padding: 0;
}

.grid-toggle__btn {
  appearance: none;
  border: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  color: var(--theme-toggle-color);
  opacity: 0.45;
  transition: opacity 0.2s ease;
}

.grid-toggle__btn--active {
  opacity: 1;
}

.grid-toggle__btn:hover {
  opacity: 0.75;
}

.grid-toggle__icon {
  width: 14px;
  height: 14px;
}

.theme-toggle {
  appearance: none;
  border: 1px solid var(--theme-toggle-border);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 999px;
  background: var(--theme-toggle-bg);
  color: var(--theme-toggle-color);
}

.theme-toggle__icon {
  width: 18px;
  height: 18px;
}

.toggle {
  pointer-events: auto;
  display: inline-flex;
  gap: 4px;
  padding: 5px;
  border-radius: 999px;
  background: var(--toggle-bg);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid var(--toggle-border);
  box-shadow: var(--toggle-shadow);
}

.toggle__btn {
  appearance: none;
  border: 0;
  cursor: pointer;
  background: transparent;
  color: var(--toggle-btn);
  font-size: 13px;
  font-weight: 400;
  font-family: var(--font-mono);
  text-transform: capitalize;
  letter-spacing: 0.01em;
  padding: 9px 22px;
  border-radius: 999px;
}

.toggle__btn--active {
  background: var(--toggle-btn-active-bg);
  color: var(--toggle-btn-active-text);
}

.tab-dropdown {
  display: none;
  position: relative;
  pointer-events: auto;
}

.tab-dropdown__trigger {
  appearance: none;
  border: 1px solid var(--toggle-border);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px 9px 18px;
  border-radius: 999px;
  background: var(--toggle-btn-active-bg);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: var(--toggle-shadow);
  color: var(--toggle-btn-active-text);
  font-size: 13px;
  font-weight: 400;
  font-family: var(--font-mono);
  text-transform: capitalize;
  letter-spacing: 0.01em;
}

.tab-dropdown__label {
  line-height: 1;
}

.tab-dropdown__chevron {
  width: 12px;
  height: 12px;
  transition: transform 0.2s ease;
}

.tab-dropdown__chevron--open {
  transform: rotate(180deg);
}

.tab-dropdown__menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  min-width: calc(100% + 24px);
  padding: 5px;
  border-radius: 16px;
  background: var(--toggle-bg);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid var(--toggle-border);
  box-shadow: var(--toggle-shadow);
  z-index: 2;
}

.tab-dropdown__option {
  appearance: none;
  border: 0;
  cursor: pointer;
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  color: var(--toggle-btn);
  font-size: 13px;
  font-weight: 400;
  font-family: var(--font-mono);
  text-transform: capitalize;
  letter-spacing: 0.01em;
  padding: 9px 18px;
  border-radius: 999px;
}

.tab-dropdown__option--active {
  background: var(--toggle-btn-active-bg);
  color: var(--toggle-btn-active-text);
}

.page {
  padding: calc(var(--header-h) + 12px) var(--page-pad) 48px;
}

.info-panel {
  overflow: hidden;
}

.info-panel__inner {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.info-panel--open .info-panel__inner {
  grid-template-rows: 1fr;
}

.info-panel__content {
  min-height: 0;
  overflow: hidden;
  max-width: 420px;
}

.info-panel__body {
  padding-bottom: 30px;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0.01em;
  line-height: 1.5;
}

.info-panel__title {
  margin: 0 0 8px;
  text-transform: capitalize;
  color: var(--text);
}

.info-panel__description {
  margin: 0;
  color: var(--text);
  opacity: 0.7;
  white-space: pre-line;
}

.grid {
  container-type: inline-size;
  --unit: calc((100cqw - (var(--gap) * (var(--cols) - 1))) / var(--cols));
  display: grid;
  grid-template-columns: repeat(var(--cols), minmax(0, var(--unit)));
  grid-auto-flow: dense;
  grid-auto-rows: auto;
  gap: var(--gap);
  width: 100%;
}

.tile-wrap:not(.tile-wrap--full) {
  grid-column: span var(--w, 1);
  grid-row: span var(--h, 1);
  height: calc(var(--h) * var(--unit) + (var(--h) - 1) * var(--gap));
  min-height: 0;
  min-width: 0;
}

.tile-wrap--full {
  grid-column: 1 / -1;
  align-self: start;
  width: 100%;
}

.tile-wrap:not(.tile-wrap--full) .tile {
  height: 100%;
}

.tile__media {
  display: block;
  width: 100%;
  height: 100%;
  position: relative;
}

.tile {
  border: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--tile-bg);
  cursor: pointer;
  position: relative;
  text-decoration: none;
  color: inherit;
}

.tile--link {
  display: block;
}

.tile__overlay {
  position: absolute;
  bottom: 14px;
  left: 14px;
  right: 14px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.2s ease, transform 0.2s ease;
  pointer-events: none;
}

.tile:hover .tile__overlay {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.tile__caption {
  flex-shrink: 1;
  min-width: 0;
  padding: 7px 12px;
  border-radius: 999px;
  background: var(--caption-bg);
  color: var(--caption-text);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tile__link {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 999px;
  background: var(--caption-bg);
  color: var(--caption-text);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  letter-spacing: 0.01em;
  text-decoration: none;
  white-space: nowrap;
  transition: opacity 0.2s ease;
}

.tile__link:hover {
  opacity: 0.88;
}

.tile__link--solo {
  margin-left: auto;
}

.tile__link-arrow {
  width: 11px;
  height: 11px;
}

.media {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.media--rollover {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.tile:hover .media--rollover {
  opacity: 1;
}

.tile-wrap--full .tile {
  height: 100%;
  display: block;
}

.tile-wrap--full .tile__media {
  position: relative;
  width: 100%;
  height: 100%;
}

.tile-wrap--full .media {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.tile-wrap--full .media--rollover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.empty {
  text-align: center;
  color: var(--text-muted);
  font-size: 15px;
  margin-top: 40px;
}

.lightbox {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.62);
  opacity: 0;
  transition: opacity 0.25s ease;
}

.lightbox--visible {
  opacity: 1;
}

.lightbox__close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 28px;
  font-weight: 300;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lightbox__media {
  display: block;
  max-width: 95vw;
  max-height: 95vh;
  width: auto;
  height: auto;
  object-fit: contain;
}

@media (max-width: 750px) {
  .toggle--desktop {
    display: none;
  }

  .tab-dropdown {
    display: block;
  }

  .grid-toggle {
    display: none;
  }
}

@media (max-width: 900px) {
  .app {
    --cols: 2 !important;
  }
}

@media (max-width: 560px) {
  .app {
    --cols: 1 !important;
  }

  .tile-wrap:not(.tile-wrap--full) {
    grid-column: span 1 !important;
    grid-row: span 1 !important;
    height: auto !important;
    aspect-ratio: var(--media-aspect, auto);
  }

  .tile-wrap:not(.tile-wrap--full) .tile,
  .tile-wrap:not(.tile-wrap--full) .tile__media {
    height: auto;
  }

  .tile-wrap:not(.tile-wrap--full) .media {
    height: auto;
    object-fit: contain;
  }
}
</style>
