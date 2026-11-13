# Mark Six results

A small static page that shows the latest five Hong Kong Mark Six (六合彩) draws. It is a results viewer only: no accounts, no payments, and no betting.

Results are not stored in this repository. The page stays empty until you click **Fetch latest 5 draws**, then it requests the live feed.

## Run locally

No install and no build step.

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080) and click **Fetch latest 5 draws**.

Use a local server. Opening `index.html` as a file (`file://`) is unreliable because browsers often block that page from calling the results API.

## Data source

The page reads the public GraphQL endpoint that powers the Hong Kong Jockey Club Mark Six results on [bet.hkjc.com](https://bet.hkjc.com/en/marksix/results):

`POST https://info.cld.hkjc.com/graphql/base/`

Operation `marksixResult`, variables `lastNDraw: 5`, `drawType: "All"`. Each draw includes the draw date, issue number (`year` / `no`, shown as `YY/NNN`), the six winning numbers (`drawnNo`), and the extra number (`xDrawnNo`).

HKJC allowlists the operation text. The query in `app.js` has to stay byte-for-byte the same as the `marksixResult` document in the bet.hkjc.com bundle. Reformatting it makes the API return `WHITELIST_ERROR`.

As checked on 13 November 2026:

- The endpoint returned five completed draws, newest first, with date, issue, six numbers, and the extra number.
- Responses include `Access-Control-Allow-Origin: *`, and the preflight allows `POST` with `Content-Type: application/json`, so the browser can call it directly.

Ball colours follow the Hong Kong Jockey Club number colours (red, blue, and green). They are drawn with CSS, not with HKJC image files.

This project is not affiliated with the Hong Kong Jockey Club.

## Cloudflare Pages

The site is static HTML, CSS, and JavaScript. No build is required.

1. Create a Pages project from this repository.
2. Framework preset: **None**.
3. Build command: leave empty.
4. Build output directory: `/` (the repository root).
5. No environment variables.

The visitor's browser calls the HKJC endpoint, so Pages does not need a server while that CORS policy stays open.

If HKJC later blocks browser origins, add a Pages Function that proxies the same POST and point `ENDPOINT` in `app.js` at that function. For example, `functions/api/draws.js` can forward the JSON body to `https://info.cld.hkjc.com/graphql/base/` and return the JSON response. Keep the query text unchanged.
