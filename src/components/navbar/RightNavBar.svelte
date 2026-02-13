<script lang='ts'>
  import type { Snippet } from 'svelte'

  interface Props {
    class?: string
    children?: Snippet
    [key: string]: any
  }

  const {
    class: className = '',
    children,
    ...restProps
  }: Props = $props()

  const mergedClass = $derived([className].filter(Boolean).join(' '))
</script>
<ul class={`inline-flex cursor-pointer items-center justify-center ${mergedClass}`.trim()} {...restProps}>
  {#if children}
    {@render children()}
  {/if}
</ul>
