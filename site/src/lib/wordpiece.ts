// BERT WordPiece tokenizer (lowercase; with lowercase on, BERT also strips accents) and static embedding, matching blink-8M's tokenizer.json, in plain code so the
// browser needs no ML library. Shared by the build (target vectors) and the app (query vectors), so both embed text identically.

export type Table = { vocab: Map<string, number>; q: Int8Array; s: Float32Array; dim: number };

const is_punct = (c: string) => {
	const cp = c.codePointAt(0)!;
	return (cp >= 33 && cp <= 47) || (cp >= 58 && cp <= 64) || (cp >= 91 && cp <= 96) || (cp >= 123 && cp <= 126) || /\p{P}/u.test(c);
};
const is_cjk = (cp: number) => (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x20000 && cp <= 0x2a6df) || (cp >= 0xf900 && cp <= 0xfaff);

/** Token ids without special tokens, as tokenizer(text, { add_special_tokens: false }) gives. */
export function tokenize(text: string, vocab: Map<string, number>): number[] {
	let clean = '';
	for (const c of text) {
		const cp = c.codePointAt(0)!;
		if (cp === 0 || cp === 0xfffd || (/[\p{Cc}\p{Cf}]/u.test(c) && !/[\t\n\r]/.test(c))) continue;
		clean += /\s/.test(c) ? ' ' : is_cjk(cp) ? ` ${c} ` : c;
	}
	const ids: number[] = [];
	const unk = vocab.get('[UNK]')!;
	for (const raw of clean.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '').split(' ')) {
		const words: string[] = [];
		let cur = '';
		for (const c of raw) {
			if (is_punct(c)) { if (cur) words.push(cur); words.push(c); cur = ''; } else cur += c;
		}
		if (cur) words.push(cur);
		for (const w of words) {
			const chars = [...w];
			if (chars.length > 100) { ids.push(unk); continue; }
			const pieces: number[] = [];
			let start = 0, bad = false;
			while (start < chars.length) {
				let end = chars.length, found = -1;
				while (start < end) {
					const sub = (start > 0 ? '##' : '') + chars.slice(start, end).join('');
					const id = vocab.get(sub);
					if (id !== undefined) { found = id; break; }
					end--;
				}
				if (found < 0) { bad = true; break; }
				pieces.push(found);
				start = end;
			}
			ids.push(...(bad ? [unk] : pieces));
		}
	}
	return ids;
}

/** Mean of the tokens' rows, L2-normalized: model2vec's static embedding. */
export function embed(text: string, t: Table): Float32Array {
	const acc = new Float64Array(t.dim), ids = tokenize(text, t.vocab);
	for (const id of ids) {
		const o = id * t.dim, s = t.s[id];
		for (let d = 0; d < t.dim; d++) acc[d] += t.q[o + d] * s;
	}
	let norm = 0;
	for (const x of acc) norm += x * x;
	norm = Math.sqrt(norm) || 1;
	return Float32Array.from(acc, x => x / norm);
}
