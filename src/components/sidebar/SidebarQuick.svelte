<script lang="ts">
  import type { QuickNavigation } from "./SidebarTypes";
  import { onMount } from "svelte";
  import { t } from "@/i18n";

  interface Props {
    navigation?: QuickNavigation;
    isVisible?: boolean;
  }

  const { navigation = {}, isVisible = false }: Props = $props();

  let scrollPercent = $state(0);

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function scrollToBottom() {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
  }

  onMount(() => {
    if (typeof window === "undefined") return;

    const updateScrollPercent = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      scrollPercent = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    };

    window.addEventListener("scroll", updateScrollPercent, { passive: true });
    updateScrollPercent();

    return () => {
      window.removeEventListener("scroll", updateScrollPercent);
    };
  });
</script>

<ul id="quick" class:visible={isVisible}>
  <li class="prev pjax">
    {#if navigation.prevUrl}
      <a
        href={navigation.prevUrl}
        rel="prev"
        title={navigation.prevTitle || t("pagination.prev")}
      >
        <i class="ic i-ri-arrow-left-s-line"></i>
      </a>
    {/if}
  </li>
  <li class="up">
    <button
      type="button"
      onclick={scrollToTop}
      aria-label={t("sidebar.scrollTop")}
    >
      <i class="ic i-ri-arrow-up-line"></i>
    </button>
  </li>
  <li class="down">
    <button
      type="button"
      onclick={scrollToBottom}
      aria-label={t("sidebar.scrollBottom")}
    >
      <i class="ic i-ri-arrow-down-line"></i>
    </button>
  </li>
  <li class="next pjax">
    {#if navigation.nextUrl}
      <a
        href={navigation.nextUrl}
        rel="next"
        title={navigation.nextTitle || t("pagination.next")}
      >
        <i class="ic i-ri-arrow-right-s-line"></i>
      </a>
    {/if}
  </li>
  <li class="percent" style={`width: ${scrollPercent}%`}></li>
</ul>

<style>
  #quick {
    display: none;
    align-items: center;
    flex-wrap: wrap;
    width: 100%;
    margin: 0;
    padding: 0;
    position: sticky;
    bottom: 0.125rem;
    list-style: none;
    background: transparent;
  }

  #quick.visible {
    display: flex;
  }

  #quick li {
    width: 25%;
    min-height: 1.875rem;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  #quick li i {
    cursor: pointer;
    font-size: 1.25rem;
  }

  #quick li a,
  #quick li button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: inherit;
    text-decoration: none;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem 0;
  }

  #quick li:hover {
    color: var(--primary-color);
  }

  #quick li.percent {
    display: block;
    background: var(--primary-color);
    width: 0;
    min-height: 0.125rem;
    position: absolute;
    bottom: 0;
    left: 0;
    transition: width 0.1s ease;
  }

  /* iPad landscape mode */
  @media screen and (min-width: 768px) and (max-width: 1024px) and (orientation: landscape),
    screen and (min-width: 768px) and (max-width: 1366px) and (orientation: landscape) and (-webkit-min-device-pixel-ratio: 2),
    screen and (min-width: 768px) and (max-width: 1440px) and (-webkit-min-device-pixel-ratio: 1) {
    #quick {
      bottom: 0;
      left: 0;
      right: 0;
    }
  }
</style>
