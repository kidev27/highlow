# HIGH▲LOW▼

A daily browser game. Every day has one theme, like world populations or mountain heights, and ten
pairs. Tap the one with the higher number; the real values show after each pick, and a wrong pick
doesn't end the game. Score out of 10, share a spoiler-free result, and come back tomorrow.

Works on phones (primary) and desktop browsers. No account: players are anonymous guests.

```
HIGH▲LOW▼ #12
🟩🟩🟥🟩🟩
🟩🟩🟩🟥🟩
8/10
```

## Run it

Needs Node.js 22.18 or newer. The server runs TypeScript directly and SQLite is built into Node,
so `npm install` compiles nothing.

```bash
npm install
npm run dev      # API on :8788 with auto-restart, app on http://localhost:5173
npm test         # Vitest
npm run check    # type-check everything
```

Production:

```bash
npm ci
npm run build    # client -> dist/
npm start        # one process serves the app and the API on :8788
```

Environment variables: `PORT` (default 8788), `HOST` (default 127.0.0.1), `DB_PATH` (default
`data/highlow.db`). In production the guest cookie is `Secure`, so serve it over HTTPS.

## Writing daily puzzles

One file per day: `content/highlow/YYYY-MM-DD.json`.

```json
{
  "rounds": [
    {
      "theme": "World populations",
      "question": "Which has more people?",
      "unit": "million",
      "source": "UN World Population Prospects 2024",
      "pairs": [
        [{ "name": "Nigeria", "emoji": "🇳🇬", "note": "Country", "value": 232.7 },
         { "name": "Brazil", "emoji": "🇧🇷", "note": "Country", "value": 211.9 }]
      ]
    }
  ]
}
```

- Exactly **10 pairs**. The two values in a pair must differ.
- `unit` is printed after the number (`"million"`, `"m"`, `"km²"`). Use `"year"` to print years
  without a thousands separator.
- **Mix which side wins.** Pairs are shown in file order and left/top first.
- Always fill in `source`; it is shown on the results screen.
- Content is checked when the server starts and by `npm test`; a bad file stops both.

## Deploying next to Blinker on one VM

The same VM can run both games: Blinker on port 8787 and this one on 8788, with Caddy in front.

1. **DNS.** Point a domain or subdomain at the VM with an A record (for example host `highlow`
   on an existing domain, which costs nothing).
2. **App.** On the VM:
   ```bash
   sudo adduser --system --group --home /opt/highlow highlow && sudo -u highlow git clone https://github.com/kidev27/highlow.git /opt/highlow/app && sudo -u highlow bash -c 'cd /opt/highlow/app && npm ci && npm run build'
   ```
3. **Service.** Create `/etc/systemd/system/highlow.service`:
   ```ini
   [Unit]
   Description=HIGH LOW
   After=network.target

   [Service]
   User=highlow
   WorkingDirectory=/opt/highlow/app
   Environment=NODE_ENV=production
   Environment=PORT=8788
   ExecStart=/usr/bin/node server/index.ts
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```
   Then `sudo systemctl daemon-reload && sudo systemctl enable --now highlow`.
4. **HTTPS.** Add a block to `/etc/caddy/Caddyfile` and `sudo systemctl reload caddy`:
   ```
   highlow.example.com {
   	reverse_proxy 127.0.0.1:8788
   }
   ```

Updating after a merge:

```bash
sudo -u highlow bash -c 'cd /opt/highlow/app && git pull && npm ci && npm run build' && sudo systemctl restart highlow
```

Back up `data/highlow.db` (with its `-wal` file).

## How it fits together

- `src/shared/` – types and rules shared by client and server.
- `server/` – Fastify app. It owns every puzzle: values reach the browser only after the player
  picks, and a pick is accepted only for the next unanswered pair.
- `src/client/` – Preact app. `core/` is mode-agnostic (API, streaks, share, settings); each game
  mode has its own folder.
- `content/<mode>/YYYY-MM-DD.json` – daily puzzles.
- `migrations/NNNN_*.sql` – applied in order on start, tracked with `PRAGMA user_version`.

The game is built as a mode (`ServerMode` in `server/mode.ts`, `ClientMode` in
`src/client/mode.ts`), so more daily games can be added later without touching the core:
`test/layering.test.ts` fails if core code imports a specific mode.

Players are guests identified by an HttpOnly cookie. Only `server/player.ts` reads it, which is
where accounts would plug in.

## Contributing

Commit messages and branches follow [COMMIT_FORMAT.md](COMMIT_FORMAT.md): one branch per change,
a pull request into `main`, squash merge.
