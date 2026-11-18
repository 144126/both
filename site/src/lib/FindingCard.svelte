<script lang="ts">
	import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@ui-sdk/svelte/collapsible';
	import { ADVICE, load_texts, only_mechanism, what_happens, type Finding, type Index, type Text } from './data';
	import Mark from './Mark.svelte';

	interface Props {
		ix: Index;
		f: Finding;
	}
	let { ix, f }: Props = $props();

	const edge: Record<string, string> = { x: 'bg-x-edge', a: 'bg-a-edge', c: 'bg-c-edge', m: 'bg-m-edge', n: 'bg-n-edge' };
	const name = (n: number) => ix.c[n][0];
	const product = (t: string, n: number) => (t === name(n) ? t : `${t} (${name(n)})`);
	const happens = $derived(what_happens(ix, f));
	let texts = $state(new Map<number, Text>());
	$effect(() => {
		load_texts(f.ev.map(e => e[7])).then(t => (texts = t));
	});
	const plain_words = $derived(f.ev.map(e => texts.get(e[7])?.[1]).find(Boolean) ?? '');
	const LANG: Record<string, string> = { no: 'norwegian', dk: 'danish', fr: 'french' };
</script>

<article class="chamfer {edge[f.s]} p-[3px]">
	<div class="chamfer bg-paper p-6">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h3 class="text-lg font-semibold text-balance">{product(f.a.t, f.x)} + {product(f.b.t, f.y)}</h3>
			<Mark s={f.s} label={only_mechanism(f) ? `possible: ${f.s === 'a' ? 'avoid' : f.s === 'm' ? 'minor' : 'take care'}` : undefined} />
		</div>

		{#if f.same}
			<p class="mt-4 max-w-[65ch] text-base leading-relaxed">
				both contain <strong>{name(f.x)}</strong>. taking them together means a double dose of {name(f.x)}, which can be dangerous.
			</p>
			<p class="mt-3 max-w-[65ch] text-base leading-relaxed">check with your pharmacist before taking both, and keep to the total daily limit on the label.</p>
		{:else}
			{#if only_mechanism(f)}
				<p class="mt-4 max-w-[65ch] text-sm text-quiet">no source names this exact pair. we flag it because of how the two medicines work.</p>
			{/if}
			{#each happens as line (line)}
				<p class="mt-4 max-w-[65ch] text-base leading-relaxed">{line}</p>
			{/each}
			{#if plain_words}
				<p class="mt-3 max-w-[65ch] text-base leading-relaxed">{plain_words}</p>
			{/if}
			<p class="mt-4 max-w-[65ch] text-base leading-relaxed"><strong>what to do:</strong> {ADVICE[f.s]}</p>

			<Collapsible class="mt-5">
				<CollapsibleTrigger class="min-h-11 border-b-2 border-ink text-sm font-semibold">why we say this: {f.ev.length} {f.ev.length === 1 ? 'source' : 'sources'}</CollapsibleTrigger>
				<CollapsiblePanel>
					<ul class="mt-4 space-y-5">
						{#each f.ev as e, i (i)}
							<li class="border-l-4 border-ink pl-4">
								<p class="text-sm font-semibold">{ix.s[e[0]]?.[0] ?? e[0]} <span class="font-normal text-quiet">· says: {e[2]}</span></p>
								{#if e[3]}<p class="mt-1 text-sm text-quiet">about the group: {e[3]}</p>{/if}
								<p class="mt-2 max-w-[65ch] text-sm leading-relaxed break-words">{texts.get(e[7])?.[0] ?? '…'}</p>
								<p class="mt-2 text-sm">
									<a class="underline underline-offset-4" href={texts.get(e[7])?.[2]} target="_blank" rel="noopener noreferrer">{texts.get(e[7])?.[3] ?? 'source'}</a>
									{#if LANG[e[0]]}<span class="text-quiet"> · machine-translated from {LANG[e[0]]}</span>{/if}
								</p>
							</li>
						{/each}
					</ul>
				</CollapsiblePanel>
			</Collapsible>
		{/if}
	</div>
</article>
