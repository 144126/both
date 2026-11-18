<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	const links = [
		['/', 'check'],
		['/data', 'data'],
		['/developers', 'api'],
		['/about', 'about']
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="description" content="free drug interaction checker: see if your medicines are safe to take together. open data from US, Norwegian, Danish and French drug agencies." />
</svelte:head>

<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:p-3">skip to content</a>
<header class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 pt-6 sm:px-8">
	<a href="/" class="flex min-h-11 items-center gap-3 text-2xl font-bold tracking-tight">
		<span class="hatch block h-6 w-6" aria-hidden="true"></span>both
	</a>
	<nav aria-label="main">
		<ul class="flex gap-1">
			{#each links as [href, label] (href)}
				<li>
					<a {href} class="slant flex min-h-11 items-center px-4 text-base font-medium {page.url.pathname === href ? 'bg-ink text-paper' : 'hover:bg-soft'}"
						aria-current={page.url.pathname === href ? 'page' : undefined}>{label}</a>
				</li>
			{/each}
		</ul>
	</nav>
</header>

<main id="main" class="mx-auto max-w-5xl px-4 pb-24 sm:px-8">
	{@render children()}
</main>

<footer class="mx-auto max-w-5xl border-t-2 border-ink px-4 py-8 text-sm text-quiet sm:px-8">
	<p class="max-w-[65ch]">
		both helps you ask the right questions. it does not replace your doctor or pharmacist: never start, stop or change a medicine without asking them.
		free and open data · runs in your browser, nothing you type leaves your device.
	</p>
</footer>
