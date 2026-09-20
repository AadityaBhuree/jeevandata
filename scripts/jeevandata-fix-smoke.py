import re

p = '.github/workflows/deploy.yml'
s = open(p, encoding='utf-8').read()

old = """      - name: Start Redis (BullMQ dependency)
        run: docker run -d --name smoke-redis -p 6379:6379 redis:7-alpine

      - name: Run backend container
        run: |
          docker run -d --name smoke-backend -p 4000:4000 \\
            -e DATABASE_URL="$DATABASE_URL" \\
            -e REDIS_URL="$REDIS_URL" \\
            -e JWT_SECRET="$JWT_SECRET" \\
            -e NODE_ENV=test \\
            ${{ env.IMAGE_BACKEND }}:${{ github.sha }}
"""

new = """      - name: Create shared network + start Redis (BullMQ dependency)
        run: |
          docker network create smoke-net
          docker run -d --network smoke-net --name smoke-redis redis:7-alpine

      - name: Run backend container (on smoke-net so REDIS_URL resolves)
        run: |
          docker run -d --network smoke-net --name smoke-backend -p 4000:4000 \\
            -e DATABASE_URL="$DATABASE_URL" \\
            -e REDIS_URL="redis://smoke-redis:6379" \\
            -e JWT_SECRET="$JWT_SECRET" \\
            -e NODE_ENV=test \\
            ${{ env.IMAGE_BACKEND }}:${{ github.sha }}
"""

assert old in s, 'ANCHOR1 NOT FOUND'
s = s.replace(old, new, 1)

old2 = """        run: docker rm -f smoke-backend smoke-redis || true"""
new2 = """        run: docker rm -f smoke-backend smoke-redis || true; docker network rm smoke-net || true"""
assert old2 in s, 'ANCHOR2 NOT FOUND'
s = s.replace(old2, new2, 1)

open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('OK')
