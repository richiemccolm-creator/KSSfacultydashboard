# Faculty Hub connection

StageFeed is registered in the Classroom Toolkit catalogue as a Drama tool. It opens in its own tab at `toolkit/stagefeed/index.html`. The catalogue's existing search, favourites, recent launches and custom quick launch controls include it automatically. No changes to Hub authentication, staff data or database tables are required.

StageFeed runs as a standalone app, like Sound Designer: it has no link back to the Classroom Toolkit. It has its own web app manifest and icon (so pupils can use Add to Home Screen) and a service worker scoped to `toolkit/stagefeed/` that keeps it working offline. Runtime sample-image and folio-font paths are relative, so the app runs beneath the Hub's existing URL.

The toolkit card has a QR button. Because StageFeed is hosted inside the Hub, the QR code and the printable A4 poster are drawn from the Hub's own address at the moment they're opened (`qr:"live"`), so they follow whichever domain the Hub is deployed on.

The export dialog builds a designed A4 folio PDF (cover, profile grid, contents, posts grouped by process stage for designers, stories, messages, back cover) using Instrument Serif and Instrument Sans, both under the SIL Open Font License.

## Update the toolkit copy

The Faculty Hub repository includes the editable application at `apps/stagefeed`. In that directory run:

```sh
npm ci
npm run build:toolkit
```

The build updates only the generated `toolkit/stagefeed` directory. Both source changes and the refreshed built files must be included in the Hub deployment. The Hub remains a buildless static site; its root Vercel configuration is unchanged.

## Pupil access and saving

The StageFeed path has no staff sign-in dependency. A teacher can share the full deployed `toolkit/stagefeed/index.html` link with pupils. The Hub toolkit itself keeps its existing staff sign-in requirements.

Projects remain in IndexedDB on each device/browser. They are not connected to Faculty Hub classes, staff accounts, tracking data, or Supabase. Moving from localhost to the Hub's deployed origin does not transfer browser storage: export a portable project backup locally, then import it at the deployed URL.

An app hosted under the Hub shares the Hub's browser origin, although StageFeed uses its own database and does not read the Hub's storage. A dedicated pupil-only origin is a sensible future separation if the school needs stronger isolation between staff tools and pupil apps.

No production publishing or cloud database migration is part of the local source integration.
