<script lang='ts'>
  import NavItem from './NavItem.svelte'

  interface Props {
    href?: string
    text?: string
    icon?: string | null
    class?: string
    [key: string]: any
  }

  const {
    href = '#',
    text,
    icon = null,
    class: className = '',
    ...restProps
  }: Props = $props()

  const iconClasses = $derived(icon ? `${icon} icon-nav text-xl vertical-text-bottom inline-block` : '')
  const mergedClass = $derived([className].filter(Boolean).join(' '))
</script>

<NavItem class={mergedClass} {...restProps}>
  <a href={href}>
    {#if icon}
      <div class={iconClasses}></div>
    {/if}
    {text}
  </a>
</NavItem>
