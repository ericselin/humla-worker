deno bundle client\sw.ts client\sw.js
deno run -A server\kv-sites\cmd.ts client a5407b781bec5a58294d3dcaa2c18806 5708240827844761a93e82f00abec273
deno bundle --no-check server\sw.ts server\wrangler\sw.js
cd server\wrangler
wrangler publish
cd ..\..
