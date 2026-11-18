<script lang="ts">
	import { onMount } from 'svelte';
	import { load_drug, load_index, plain, ready, ORDER, type Drug, type Finding, type Index } from '#lib/data.ts';
	import FindingCard from '#lib/FindingCard.svelte';
	import Mark from '#lib/Mark.svelte';

	// one page for every drug (/drug?d=warfarin), so it is cached once and opens offline
	let ix = $state<Index | null>(null);
	let drug = $state<Drug | null>(null);
	let me = $state(-1);
	let filter = $state('');
	let show = $state(30);
	let failed = $state('');

	onMount(async () => {
		const slug = new URL(location.href).searchParams.get('d') ?? '';
		try {
			await ready();
			const loaded = await load_index();
			me = loaded.c.findIndex(([, s]: [string, string]) => s === slug);
			ix = loaded;
			if (me < 0) return void (failed = `no medicine called “${slug}”.`);
			drug = await load_drug(loaded, me);
		} catch {
			failed = "the medicine data isn't on this device yet. connect to the internet once, then reload.";
		}
	});

	const name = $derived(ix && me >= 0 ? ix.c[me][0] : '');
	const findings = $derived<Finding[]>(
		ix && drug
			? drug.p
					.filter(([b]) => !filter || plain(ix!.c[b][0]).includes(plain(filter)))
					.map(([b, s, r, ev]) => ({ a: { t: name, ids: [me] }, b: { t: ix!.c[b][0], ids: [b] }, x: me, y: b, s, r: r.split(','), ev: ev.map(e => drug!.v[e]) }))
			: []
	);
	const counts = $derived(drug ? Object.fromEntries([...ORDER].map(s => [s, drug!.p.filter(p => p[1] === s).length])) : {});
</script>

<svelte:head><title>{name ? `${name} interactions · both` : 'interactions · both'}</title></svelte:head>

<section class="pt-14">
	<p class="text-sm font-semibold tracking-wide text-quiet">interactions of</p>
	<h1 class="mt-1 text-4xl font-bold tracking-tight">{name || '…'}</h1>
	{#if failed}
		<p class="chamfer mt-6 bg-x-bg p-5 text-x-fg">{failed}</p>
	{:else if !drug}
		<p class="mt-6 text-quiet">loading…</p>
	{:else}
		{#if drug.k.length}
			<p class="mt-3 max-w-[65ch] text-base text-quiet">{drug.k.map(k => ix!.k[k].replace(/ \(.*\)$/, '')).join(' · ')}</p>
		{/if}
		<ul class="mt-6 flex flex-wrap gap-2" aria-label="summary">
			{#each [...ORDER] as s (s)}{#if counts[s]}<li><Mark {s} label={`${counts[s]} · ${s === 'n' ? 'no interaction' : { x: 'do not take together', a: 'avoid', c: 'take care', m: 'minor' }[s]}`} /></li>{/if}{/each}
		</ul>
		<label class="mt-8 block text-base font-semibold" for="filter">find a medicine in this list</label>
		<input id="filter" bind:value={filter} placeholder="type a name" class="chamfer-sm mt-2 min-h-12 w-full max-w-md border-2 border-ink bg-paper px-4 text-lg" />
		<div class="mt-8 space-y-6">
			{#each findings.slice(0, show) as f (f.y)}
				<FindingCard ix={ix!} {f} />
			{/each}
		</div>
		{#if findings.length > show}
			<button type="button" class="slant mt-8 min-h-12 bg-ink px-6 text-base font-semibold text-paper active:scale-[0.97]" onclick={() => (show += 60)}>
				show more ({findings.length - show} left)
			</button>
		{/if}
	{/if}
</section>
