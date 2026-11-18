<script lang="ts">
	const base = 'https://both.apexlinks.org';
	const index = `{
  "i": "2026-11-18",                  // data version
  "c": [["warfarin", "warfarin"], …], // ingredients: [name, file slug]; slug "" = no known interactions
  "t": [["coumadin", 6512], …],       // search names (brands, other languages) -> ingredient indexes
  "k": { "nsaid": "NSAID pain reliever …" }, // class names
  "s": { "us": ["US FDA drug labels …", url, licence] }, // sources
  "f": { "bleed": "more risk of bleeding" }               // effect words
}`;
	const drug = `{
  "i": "warfarin", "a": ["B01AA03"], "x": ["11289"], "u": [], "e": ["Vitamin K Antagonist [EPC]"],
  "k": ["anticoagulant"],                          // classes it belongs to
  "p": [[193, "a", "us,no,va", [0, 4]], …],        // [partner index, severity, sources, evidence]
  "v": [["us", "a", "avoid", "text…", "plain text for patients", url, title, "via class", ["bleed"], [raises], [lowers]], …]
}`;
</script>

<svelte:head><title>api · both</title></svelte:head>

<article class="max-w-[72ch] pt-14 text-base leading-relaxed">
	<h1 class="text-4xl font-bold tracking-tight">free api</h1>
	<p class="mt-6 text-lg">no key, no sign-up, no limits. the api is a set of static JSON files, so it is fast everywhere and can't go down under load. use it in apps, clinics, pharmacies and research.</p>

	<h2 class="mt-12 text-2xl font-bold">1. find an ingredient</h2>
	<p class="mt-3">GET <code class="bg-soft px-1 font-mono">{base}/api/v1/index.json</code>: all names, once. look up a brand or generic name (lowercase, no accents) in <code class="font-mono">t</code> to get ingredient indexes into <code class="font-mono">c</code>.</p>
	<pre class="chamfer-sm mt-4 overflow-x-auto bg-soft p-4 font-mono text-sm">{index}</pre>

	<h2 class="mt-12 text-2xl font-bold">2. get its interactions</h2>
	<p class="mt-3">GET <code class="bg-soft px-1 font-mono">{base}/api/v1/drug/&lt;slug&gt;.json</code>: every known interaction of one ingredient with its evidence.</p>
	<pre class="chamfer-sm mt-4 overflow-x-auto bg-soft p-4 font-mono text-sm">{drug}</pre>
	<p class="mt-4">severity: <code class="font-mono">x</code> contraindicated, <code class="font-mono">a</code> avoid, <code class="font-mono">c</code> use with care, <code class="font-mono">m</code> minor, <code class="font-mono">n</code> no meaningful interaction. source <code class="font-mono">mech</code> means inferred from mechanism, not stated by a source.</p>

	<h2 class="mt-12 text-2xl font-bold">3. check a list</h2>
	<p class="mt-3">load the file of each ingredient, then for every pair look up the partner's index in <code class="font-mono">p</code>.</p>
	<pre class="chamfer-sm mt-4 overflow-x-auto bg-soft p-4 font-mono text-sm">{`const ix = await (await fetch('${base}/api/v1/index.json')).json()
const id = name => ix.t.find(([t]) => t === name)?.[1]
const file = async n => (await fetch(\`${base}/api/v1/drug/\${ix.c[n][1]}.json\`)).json()
const [a, b] = [id('warfarin'), id('aspirin')]
const hit = (await file(a)).p.find(([p]) => p === b) // [partner, severity, sources, evidence]`}</pre>

	<h2 class="mt-12 text-2xl font-bold">licence</h2>
	<p class="mt-3">CC BY 4.0. credit "both" and its sources (see <a href="/data" class="underline underline-offset-4">data</a>). the whole dataset is also downloadable as CSV and JSON.</p>
</article>
