<script lang="ts">
  import { getT } from "@/i18n";
  import themeConfig from "@/theme.config";
  import type { RelatedPost } from "./SidebarTypes";

  interface Props {
    posts?: RelatedPost[];
    currentSlug?: string;
  }

  const { posts = [], currentSlug = "" }: Props = $props();
  const t = getT((themeConfig.locale as "zh-CN" | "en") || "zh-CN");
</script>

<div class="related">
  {#if posts.length > 0}
    <ul>
      {#each posts as post (post.slug)}
        <li class={post.slug === currentSlug ? "active" : ""}>
          <a href={`/posts/${post.slug}/`} title={post.title}>
            {post.title}
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="no-related">{t("sidebar.related.noContent")}</p>
  {/if}
</div>

<style>
  .related {
    font-size: 0.8125rem;
  }

  .related ul {
    padding: 0 0.125rem 0.3125rem 1.25rem;
    text-align: left;
    list-style: none;
    margin: 0;
  }

  .related ul li {
    position: relative;
    line-height: 1.8;
    padding-bottom: 0.625rem;
  }

  .related ul li a {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    width: 100%;
    display: inline-block;
    color: inherit;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .related ul li a:hover {
    color: var(--primary-color);
  }

  .related ul li.active a {
    color: var(--primary-color);
  }

  .related ul li::before {
    content: "";
    width: 0.5rem;
    height: 0.5rem;
    background: var(--primary-color);
    box-sizing: unset;
    left: -1.25rem;
    top: 0.3125rem;
    border-radius: 100%;
    position: absolute;
    border: 0.1875rem solid var(--grey-1);
    z-index: 1;
    transition: all 0.2s ease;
  }

  .related ul li:hover::before {
    background: var(--color-blue);
  }

  .related ul li:not(:last-child)::after {
    content: "";
    height: 100%;
    width: 0.125rem;
    background: var(--color-red-a3);
    position: absolute;
    left: -0.875rem;
    top: 0.5rem;
  }

  .no-related {
    color: var(--grey-5);
    text-align: center;
    font-size: 0.875rem;
  }
</style>
