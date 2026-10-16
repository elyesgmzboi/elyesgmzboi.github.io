# Rewrite index.html so every script, module and stylesheet URL carries a content hash (?v=...). Browsers that
# cached an older copy then fetch the new one; run after editing any file under js/, css/ or content.js.
import hashlib, json, os, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
h = lambda p: hashlib.sha1(open(os.path.join(root, p), 'rb').read()).hexdigest()[:10]
imports = {'three': f'./js/lib/three.js?v={h("js/lib/three.js")}'}
for f in sorted(os.listdir(os.path.join(root, 'js'))):
    if f.endswith('.js'): imports[f'./js/{f}'] = f'./js/{f}?v={h("js/" + f)}'
p = os.path.join(root, 'index.html'); s = open(p, encoding='utf-8').read()
s = re.sub(r'<script type="importmap">.*?</script>', '<script type="importmap">' + json.dumps({'imports': imports}) + '</script>', s, flags=re.S)
s = re.sub(r'href="css/osd\.css[^"]*"', f'href="css/osd.css?v={h("css/osd.css")}"', s)
s = re.sub(r'src="content\.js[^"]*"', f'src="content.js?v={h("content.js")}"', s)
s = re.sub(r'src="js/main\.js[^"]*"', f'src="js/main.js?v={h("js/main.js")}"', s)
open(p, 'w', encoding='utf-8').write(s)
print('stamped', len(imports), 'modules')
