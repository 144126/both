<svelte:head><title>about · both</title></svelte:head>

<article class="max-w-[68ch] pt-14 text-base leading-relaxed">
	<h1 class="text-4xl font-bold tracking-tight">about both</h1>
	<p class="mt-6 text-lg">
		knowing which medicines don't mix can save a life. the best interaction databases cost tens of thousands of dollars a year, so most people,
		clinics and pharmacies in the world can't use them. both is a free, open alternative: an interaction checker anyone can use, and the data
		behind it, free to download and build on.
	</p>

	<h2 class="mt-12 text-2xl font-bold">where the data comes from</h2>
	<ul class="mt-4 list-disc space-y-3 pl-6">
		<li><strong>US FDA drug labels.</strong> every prescription and over-the-counter label's interaction, contraindication and warning sections, read sentence by sentence.</li>
		<li><strong>Norway's national interaction database</strong> (Norwegian Medical Products Agency, FEST), with clinical consequence, mechanism, handling and evidence grade.</li>
		<li><strong>Denmark's interaction database</strong> (Danish Medicines Agency), professional and patient versions.</li>
		<li><strong>France's interaction thesaurus</strong> (ANSM), with four levels from contraindicated to take into account.</li>
		<li><strong>US Veterans Affairs</strong> national drug file interactions, the ONC high-priority list and the 2023 AGS Beers Criteria for older adults.</li>
		<li><strong>pharmacology rules:</strong> when no source names a pair, we flag combinations that share a risk named in their FDA labels, like two drugs that prolong the QT interval, or a strong enzyme blocker with a drug that depends on that enzyme. these are marked "possible".</li>
	</ul>

	<h2 class="mt-12 text-2xl font-bold">how severities work</h2>
	<p class="mt-4">each source rates in its own words; we map them to one scale and show the source's own words next to ours. when sources disagree, the most cautious rating wins and every source is listed.</p>
	<ul class="mt-4 space-y-2">
		<li><strong>do not take together:</strong> contraindicated by at least one source.</li>
		<li><strong>avoid:</strong> should be avoided, or only used with close medical supervision.</li>
		<li><strong>take care:</strong> can be used with precautions: a dose change, spacing doses apart, or checks.</li>
		<li><strong>minor:</strong> little clinical effect; usually no action.</li>
		<li><strong>no meaningful interaction:</strong> studied, and no relevant effect found.</li>
	</ul>

	<h2 class="mt-12 text-2xl font-bold">how good is it</h2>
	<p class="mt-4">
		we measure ourselves against DDInter 2.0, a large academic database we do not copy from. both flags 74% of the pairs DDInter rates major and 48% of
		those it rates moderate; DDInter in turn misses many pairs the national agencies list. no database is complete. the data has not yet been reviewed
		by an independent pharmacist panel, translations from Norwegian, Danish and French are made by machine, and the rules that read labels can misread a
		sentence. every finding links to its source so you can check it.
	</p>

	<h2 class="mt-12 text-2xl font-bold">offline and private</h2>
	<p class="mt-4">on your first visit both saves the app and all its data on your device (about 13 MB). after that it works with no internet at all, and every check runs on your device: the medicines you type never leave it. there are no accounts, ads or trackers.</p>

	<h2 class="mt-12 text-2xl font-bold">not medical advice</h2>
	<p class="mt-4">both helps you and your care team ask the right questions. it does not replace a doctor or pharmacist. never start, stop or change a medicine without asking them. in an emergency, call your local emergency number.</p>
</article>
