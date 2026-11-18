<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Combobox,
		ComboboxChip,
		ComboboxChipRemove,
		ComboboxChips,
		ComboboxContent,
		ComboboxEmpty,
		ComboboxInput,
		ComboboxItem,
		ComboboxLabel,
		ComboboxList,
		ComboboxValue
	} from '@ui-sdk/svelte/combobox';
	import { check, load_index, plain, search, ORDER, type Finding, type Index, type Medicine } from '#lib/data.ts';
	import FindingCard from '#lib/FindingCard.svelte';
	import Mark from '#lib/Mark.svelte';

	let ix = $state<Index | null>(null);
	let terms = new Map<string, number[]>();
	let value = $state<string[]>([]);
	let query = $state('');
	let findings = $state<Finding[]>([]);
	let unknown = $state<Medicine[]>([]);
	let busy = $state(false);
	let failed = $state(false);

	const matches = $derived(ix && query ? search(ix, query) : []);
	const meds = $derived(value.map(t => ({ t, ids: terms.get(t) ?? [] })).filter(m => m.ids.length));
	const counts = $derived(Object.fromEntries([...ORDER].map(s => [s, findings.filter(f => f.s === s).length])));
	const EXAMPLES = [['warfarin', 'aspirin'], ['sertraline', 'tramadol'], ['simvastatin', 'clarithromycin'], ['tylenol', 'percocet']];

	onMount(async () => {
		let loaded: Index;
		try {
			loaded = await load_index();
		} catch {
			failed = true;
			return;
		}
		terms = new Map((loaded.t as [string, ...number[]][]).map(([t, ...ids]) => [t, ids]));
		const from_link = () => {
			const shared = new URLSearchParams(location.hash.slice(1)).get('m');
			const next = (shared ?? '').split(',').map(plain).filter(t => terms.has(t));
			if (next.join() !== value.join()) value = next;
		};
		from_link();
		addEventListener('hashchange', from_link);
		ix = loaded;
	});

	$effect(() => {
		const list = meds;
		if (!ix) return;
		history.replaceState(history.state, '', list.length ? `#m=${list.map(m => encodeURIComponent(m.t)).join(',')}` : location.pathname);
		if (list.length < 2) {
			findings = [];
			unknown = [];
			return;
		}
		busy = true;
		check(ix, list).then(r => {
			if (list !== meds) return;
			findings = r.findings;
			unknown = r.unknown;
			busy = false;
		});
	});
</script>

<svelte:head><title>both · free drug interaction checker</title></svelte:head>

<section class="pt-14 sm:pt-20">
	<h1 class="max-w-[18ch] text-4xl leading-tight font-bold tracking-tight text-balance sm:text-5xl">can i take these together?</h1>
	<p class="mt-4 max-w-[60ch] text-lg leading-relaxed text-quiet">
		add your medicines by brand or generic name. you'll see right away which ones don't mix, why, and what to do. free, for everyone.
	</p>

	<div class="mt-10">
		{#if failed}
			<p class="chamfer bg-x-bg p-5 text-x-fg">couldn't load the medicine list. check your connection and reload the page.</p>
		{:else}
			<Combobox multiple bind:value bind:query filter={false} itemToLabel={(t: string) => t} autoHighlight>
				<ComboboxLabel class="text-base font-semibold">your medicines</ComboboxLabel>
				<div class="chamfer mt-2 bg-ink p-[3px] has-[input:focus-visible]:p-[5px]">
					<ComboboxChips class="chamfer flex min-h-16 flex-wrap items-center gap-2 bg-paper p-3">
						<ComboboxValue>
							{#snippet children(state)}
								{#each state.value as string[] as t, i (t)}
									<ComboboxChip value={t} class="slant flex min-h-11 items-center gap-2 bg-ink py-1 pr-2 pl-4 text-base font-medium text-paper">
										{state.labels[i]}
										<ComboboxChipRemove aria-label={`remove ${state.labels[i]}`} class="flex h-9 w-9 items-center justify-center hover:bg-quiet">
											<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="butt"><path d="M5 5l14 14M19 5L5 19" /></svg>
										</ComboboxChipRemove>
									</ComboboxChip>
								{/each}
							{/snippet}
						</ComboboxValue>
						<ComboboxInput placeholder={value.length ? 'add another medicine' : 'type a medicine, like warfarin or advil'} disabled={!ix}
							class="min-h-11 min-w-[14ch] flex-1 bg-transparent px-2 text-lg placeholder:text-quiet focus-visible:outline-none" />
					</ComboboxChips>
				</div>
				<ComboboxContent class="{query.trim() ? '' : 'hidden'} chamfer-sm z-10 max-h-[min(24rem,var(--available-height))] w-[var(--anchor-width)] overflow-auto border-2 border-ink bg-paper py-2 shadow-xl">
					<ComboboxEmpty class="px-4 py-3 text-base text-quiet">
						{#snippet children(state)}
							{#if state.empty && state.query}no medicine called “{state.query}”. check the spelling, or try the generic name.{/if}
						{/snippet}
					</ComboboxEmpty>
					<ComboboxList>
						{#each matches as m (m.value)}
							<ComboboxItem value={m.value} label={m.label} class="flex min-h-11 cursor-pointer flex-col justify-center px-4 py-2 data-highlighted:bg-ink data-highlighted:text-paper">
								<span class="text-base font-medium">{m.label}</span>
								{#if m.hint}<span class="text-sm opacity-80">{m.hint}</span>{/if}
							</ComboboxItem>
						{/each}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		{/if}
	</div>
</section>

<section class="mt-12" aria-live="polite">
	{#if meds.length < 2}
		<div class="border-t-2 border-ink pt-8">
			<p class="text-base">{meds.length ? 'add one more medicine to check them together.' : 'add two or more medicines to check them. or try one of these:'}</p>
			<div class="mt-4 flex flex-wrap gap-3">
				{#each EXAMPLES as pair (pair.join())}
					<button type="button" class="slant min-h-11 bg-soft px-5 text-base font-medium hover:bg-ink hover:text-paper active:scale-[0.97]"
						onclick={() => (value = pair.filter(t => terms.has(t)))}>{pair.join(' + ')}</button>
				{/each}
			</div>
		</div>
	{:else if busy && !findings.length}
		<p class="text-base text-quiet">checking…</p>
	{:else}
		<h2 class="text-2xl font-bold">
			{findings.filter(f => f.s !== 'n').length
				? `${findings.filter(f => f.s !== 'n').length} ${findings.filter(f => f.s !== 'n').length === 1 ? 'thing' : 'things'} to know`
				: 'no interactions found'}
		</h2>
		{#if findings.length}
			<ul class="mt-4 flex flex-wrap gap-2" aria-label="summary">
				{#each [...ORDER] as s (s)}{#if counts[s]}<li><Mark {s} label={`${counts[s]} · ${s === 'n' ? 'no interaction' : { x: 'do not take together', a: 'avoid', c: 'take care', m: 'minor' }[s]}`} /></li>{/if}{/each}
			</ul>
		{:else}
			<p class="mt-3 max-w-[65ch] text-base leading-relaxed">
				we found no interactions between these medicines. that doesn't prove they're safe together: ask a pharmacist, especially for new or uncommon medicines.
			</p>
		{/if}
		<div class="mt-8 space-y-6">
			{#each findings as f (`${f.x}-${f.y}-${f.a.t}-${f.b.t}`)}
				<FindingCard ix={ix!} {f} />
			{/each}
		</div>
		{#if unknown.length}
			<p class="mt-8 max-w-[65ch] text-base">we have no interaction data for {unknown.map(m => m.t).join(', ')}. check these with your pharmacist.</p>
		{/if}
	{/if}
</section>
