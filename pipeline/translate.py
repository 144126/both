# Offline machine translation to English with Argos/OPUS-MT CTranslate2 models in ~/models/argos.
# Usage: uv run --no-project --with ctranslate2 --with sentencepiece --with subword-nmt --with sacremoses python pipeline/translate.py <lang> < texts.json > english.json
# Input: JSON list of source strings. Output: JSON object {source: english}. Sentences are translated one by one and joined.
# An optional second argument names a JSON {name: English name} file: those drug names are swapped for placeholders before
# translation and restored after, because the model misspells names it does not know (sulindac -> sucindac).
import json, os, re, sys
import ctranslate2

lang = sys.argv[1]
root = os.path.expanduser(f'~/models/argos/translate-{lang}_en-1_9')
if os.path.exists(f'{root}/sentencepiece.model'):
    import sentencepiece
    sp = sentencepiece.SentencePieceProcessor(model_file=f'{root}/sentencepiece.model')
    encode = lambda s: sp.encode(s, out_type=str)
    decode = lambda tokens: ''.join(tokens).replace('▁', ' ').strip()
else:  # Danish ships a subword-nmt BPE model over Moses tokens
    from subword_nmt.apply_bpe import BPE
    from sacremoses import MosesTokenizer, MosesDetokenizer
    with open(f'{root}/bpe.model', encoding='utf-8') as f:
        bpe = BPE(f)
    tok, detok = MosesTokenizer(lang), MosesDetokenizer('en')
    encode = lambda s: bpe.process_line(tok.tokenize(s, return_str=True, escape=False)).split()
    decode = lambda tokens: detok.detokenize(' '.join(tokens).replace('@@ ', '').split())
model = ctranslate2.Translator(f'{root}/model', device='cpu', inter_threads=1, intra_threads=os.cpu_count())

SPLIT = r'(?<=[.!?])\s+(?=[A-ZÆØÅÉ])|\n+'
texts = json.load(sys.stdin)
names = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else {}
lookup = {k.lower(): v for k, v in names.items()}
pattern = re.compile(r'(?<![\w-])(' + '|'.join(re.escape(k) for k in sorted(names, key=len, reverse=True)) + r')(?![\w-])', re.I) if names else None
def protect(s):
    found = []
    def sub(m):
        found.append(lookup[m.group(1).lower()])
        return f'Xq{len(found)}'
    return (pattern.sub(sub, s) if pattern else s).replace('"', "'"), found
def restore(s, found):
    for i in range(len(found), 0, -1):
        s = re.sub(rf'\bXq{i}\b', found[i - 1], s, flags=re.I)
    return s
pieces = sorted({s.strip() for t in texts for s in re.split(SPLIT, t) if s.strip()})
done = {}
for i in range(0, len(pieces), 64):
    batch = pieces[i:i + 64]
    guarded = [protect(s) for s in batch]
    out = model.translate_batch([encode(g) for g, _ in guarded], beam_size=2, max_decoding_length=300)
    for s, (_, found), r in zip(batch, guarded, out):
        done[s] = restore(decode(r.hypotheses[0]), found)
    print(f'{i + len(batch)}/{len(pieces)}', file=sys.stderr, flush=True)
json.dump({t: ' '.join(done[s.strip()] for s in re.split(SPLIT, t) if s.strip()) for t in texts}, sys.stdout, ensure_ascii=False)
