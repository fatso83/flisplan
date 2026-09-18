# flisplan

Flisplan plans a precise two-row tile wall locally in the browser. Import a tile list, choose how each tile is oriented along the wall, optimize the pairs, and adjust a plan visually.

## CSV contract

The required header is `id,bredde_mm,hoyde_mm`. Each data row must contain a unique, non-empty tile id and positive finite dimensions in millimetres.

- Comma-delimited CSV uses a decimal point, for example `Tile-01,300.5,100`.
- Semicolon-delimited CSV accepts a decimal comma or decimal point, for example `Tile-01;300,5;100` or `Tile-01;300.5;100`.
- The importer normalizes every tile so its long side is the first dimension. The orientation setting then chooses whether that long or short side runs along the wall.
- A valid plan has an even number of tiles. The optimizer creates exactly two fixed rows and derived pairs; 50 tiles therefore produce 25 positions.

## Reading a plan

`Langside langs vegg` places the normalized long side along the wall, while `Kortside langs vegg` places the short side along the wall. The orange flush seam is the visual seam between the two rows. Pair-width mismatch and cumulative seam drift are visual planning indicators: they describe how much each pair differs and how far the seam has accumulated from flush as positions progress. They are not a structural or installation guarantee.

Projects are saved by name in the browser's local IndexedDB. This is local-only persistence: projects do not sync to a server or other device. Clearing site data removes the saved projects.

## Development and checks

```sh
npm install
npm run dev
npm test -- --run
npm run lint
npm run build
npm run e2e -- --list
npm run e2e
```

The Playwright end-to-end suite starts the configured Vite web server automatically. If the browser executable is not installed, install the browser required by Playwright before running the suite.
