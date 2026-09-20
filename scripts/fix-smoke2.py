import subprocess, os

os.chdir(r'C:\Users\Aditya\code_hub\Projects\jeevandata')

msg1 = """fix(backend): don't abort Nest startup when Qdrant is down at boot

ensureCollection rethrew Qdrant connection errors from onModuleInit, killing
the whole API when the vector DB is unavailable (the readiness probe already
reports Qdrant health separately). Log a warning and defer instead.
"""
msg2 = """test(backend): face.service boot must not fail when Qdrant is down

The previous test asserted the old rethrow behavior. onModuleInit should now
resolve and defer collection creation so the API boots without Qdrant.
"""

cmds = [
    ['git', 'add', 'apps/backend/src/modules/face/face.service.ts'],
    ['git', 'commit', '-q', '-m', msg1],
    ['git', 'add', 'apps/backend/src/modules/face/face.service.spec.ts'],
    ['git', 'commit', '-q', '-m', msg2],
    ['git', 'push', 'origin', 'main'],
    ['git', 'log', '--oneline', '-2'],
]

for c in cmds:
    r = subprocess.run(c, capture_output=True, text=True)
    print('>>>', ' '.join(c[:2]), 'EXIT', r.returncode)
    if r.stdout.strip():
        print(r.stdout.strip()[:400])
    if r.stderr.strip():
        print('STDERR:', r.stderr.strip()[:300])
