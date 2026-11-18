<script lang="ts">
	import { HEADLINE } from './data';

	interface Props {
		s: string;
		label?: string;
	}
	let { s, label = HEADLINE[s] }: Props = $props();

	const tone: Record<string, string> = {
		x: 'bg-x-bg text-x-fg',
		a: 'bg-a-bg text-a-fg',
		c: 'bg-c-bg text-c-fg',
		m: 'bg-m-bg text-m-fg',
		n: 'bg-n-bg text-n-fg'
	};
</script>

<span class="slant inline-flex items-center gap-2 px-4 py-1 text-sm font-semibold tracking-wide {tone[s]}">
	<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter" stroke-linecap="butt">
		{#if s === 'x'}
			<path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z" /><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" />
		{:else if s === 'a'}
			<path d="M12 2l11 20H1z" /><path d="M12 9v6M12 17v2.5" />
		{:else if s === 'c'}
			<path d="M12 1l11 11-11 11L1 12z" /><path d="M12 7v6M12 15v2.5" />
		{:else if s === 'm'}
			<path d="M3 3h18v18H3z" /><path d="M12 10v8M12 6v2.5" />
		{:else}
			<path d="M3 12l6 6L21 6" />
		{/if}
	</svg>
	{label}
</span>
