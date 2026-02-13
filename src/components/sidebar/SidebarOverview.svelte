<script lang="ts">
  import type { NavItemType } from "../navbar/NavTypes";
  import type { SidebarConfig } from "./SidebarTypes";
  import type { Snippet } from "svelte";
  import SidebarAuthor from "./SidebarAuthor.svelte";
  import SidebarMenu from "./SidebarMenu.svelte";
  import SidebarSocial from "./SidebarSocial.svelte";
  import SidebarState from "./SidebarState.svelte";

  interface Props {
    config: SidebarConfig;
    siteState: {
      categories: number;
      posts: number;
      tags: number;
    };
    menuSource: NavItemType[] | any;
    avatarImage?: Snippet;
  }

  const { config, menuSource, siteState, avatarImage }: Props = $props();
</script>

<div class="overview">
  <SidebarAuthor
    author={config.author || ""}
    description={config.description || ""}
    {avatarImage}
  />

  <SidebarState state={siteState} />

  <SidebarSocial social={config.social || {}} />

  <SidebarMenu menu={menuSource} />
</div>

<style>
  .overview {
    width: 100%;
  }
</style>
