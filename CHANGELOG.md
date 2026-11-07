# Vault X — Changelog

All notable changes to Vault X, newest first. These notes match the in-app changelog shown by Check for Update.

## v1.106.0

- New look: your Library shelves are now a traditional real-wood bookcase in Classic Mahogany — the style you picked from the shelf mockups. Rounded crown trim with a dentil strip, fluted side posts, thick mahogany shelf boards, a base plinth, and a small brass LIBRARY nameplate at the base. Every shelf wears it — Lorcana chapters, promos, quests, the comics wall, Funko, and Legos — and nothing else about the Library changed: same signs, same owned-only binders, same tap, hold, and drag.

## v1.105.1

- Fixed: the Library no longer lets a shelf vanish in silence. If the Funko or Lego lookup is still loading, the signed shelf now stands with a loading note; if it could not load, the shelf says so and offers a Try again button that reloads just that shelf. The Comics wall likewise says when your saved wall choice could not load and lets you retry it, instead of quietly showing the default slabs. Your figures, sets, and slabs themselves are unchanged.

## v1.105.0

- New: the artwork hunt can now take on a whole collection at once. Disney Topps and Garbage Pail Kids each get a dedicated completion run - every set, in order, until every card front a collector source carries is loaded - starting with Disney Topps as soon as this update lands, with Garbage Pail Kids right behind it. Collection pages now show fronts loaded for the whole collection with a Load artwork for the whole collection button, set rows show their own front counts, and Settings Artwork coverage keeps the per-set score.

## v1.104.0

- New: Topps sets now show how many of their card fronts are loaded, with a Load the rest of this set's artwork button that sends the artwork hunt after that one set until every card front a collector source carries is in. First up is 2025 Topps Chrome Disney in Disney Topps, where only the first base fronts had loaded - a hunt dedicated to that set starts as soon as this update lands, and the morning hunt keeps resuming it until the set is done. Settings Artwork coverage now breaks the front counts down set by set as well.

## v1.103.0

- New: Collection Distribution in Portfolio now has its own rows for Legos and Funko, each with its owned value and percentage, worked into the collection total alongside Ungraded Cards, Sealed Products, and Graded Comics. The values are live from your catalog — tracked price times the copies you own, sealed Lego copies included — and an item with no tracked price yet counts as zero rather than a guess. The Portfolio and Home totals now include your Legos and Funkos too, so the totals and the breakdown always agree.

## v1.101.0

- Rebuilt: New Vision 2.0 Beta now follows the original UAT layout screen for screen, not just its colors and graph. Home opens with the UAT greeting header — the time of day over your big name, the Admin and Inbox buttons as circles beside it, and your handle and Collector ID on one pill with the yellow Update pill next to it. The Scan bar, the yellow-bordered one-line Price alert pill, and the Portfolio hero follow in the UAT order; the hero gained the UAT hide-values eye and its change chip now reads this week, from your real 7-day range. The UAT Quick Actions row is back — Add item, My Decks, Library, Trade, all working — Your Collections uses the UAT tiles (TCG Universe featured full-width with its title inside the art, the rest two-across, and the dashed Add collection slot at the end), and the Recently Added rail closes the page. Portfolio is the UAT page too: its hero with the bare cyan line at the UAT height, the three stat boxes, then Money Tracker, Track and Research, and Collection Distribution in the UAT order, with Movers and Most Valuable below. The bottom menu is the UAT floating glass pill with the cyan active tab and no filled highlight.
- New: Recently Added is real from today — whenever you add copies from a card page, the binder pockets, or a scan, the card lands on the rail with its real add time recorded as it happens. Cards from your November export were never given invented add dates, so the rail fills as you add, and says so plainly until then.
- Nothing changes in any other theme — switch away from New Vision 2.0 Beta and every screen is exactly as it was.

## v1.100.1

- Fixed: New Vision 2.0 Beta now matches the UAT exactly, graph included. Under that theme, Home shows the UAT hero card itself — your portfolio total, the bare cyan line graph at the UAT size, Paid / Net / Cards, and Top Movers as a ticker along the bottom of the card — and every value graph in the app (Portfolio Value, each card, sealed item, and comic Price history, Research, and watchlist trend lines) draws the UAT way: one clean cyan line, no fill underneath, no grid, no axes, at the exact heights the UAT used. Your numbers are the same real tracked values as before; only the drawing changed, and only in this theme — every other theme keeps its charts as they were.

## v1.100.0

- New: Money Tracker, inside Portfolio — your trader scoreboard. It adds up what everything you hold is worth now against what you actually paid, with your unrealised profit or loss and ROI, broken down by Lorcana cards, sealed products, your other games, slabs, and comics. The math only counts copies whose cost is really recorded — anything whose cost was never logged says so honestly instead of guessing.
- New: the Sold ledger — flip Money Tracker from Held to Sold and everything that has left your collection through a completed sale or trade is listed there: what it was, who it went to, when, the proceeds, and what you made on it where your cost is known. Sales and trades land in it automatically when they settle.
- New: record what you paid on any Pokémon, Magic, Star Wars, Funko, or Topps item — open the item and tap Record next to You paid; it shows your gain or loss against the current price right there and feeds Portfolio's totals. Lorcana cards already carry what you paid per finish under Card Performance, your Lego sets' Your copy record now counts in the totals too, and graded comics now say plainly that no paid amount was ever recorded for them.
- New: Insurance & Estate report — one tap (in Portfolio's Money Tracker, or in Settings next to your other exports) builds a real PDF of the whole vault: every item's identification and grading cert numbers, quantity, what you paid, current value, and where it lives, with your name, Collector ID, and the date on the cover, plus photos of your most valuable items appended. Options let you leave photos or paid amounts out, and a progress bar shows it being built.

## v1.99.0

- Speed pass — the whole app opens and scrolls faster. The pictures the app carries with it (collection tiles, set logos, sealed product photos, sports banners, comic slab photos) are now stored at the sizes the screens actually show instead of full camera size, so Home, the set picker, the Sealed shelf, and the Sports pages paint in a fraction of the downloads they used to need — the artwork itself is unchanged, just lighter.
- Grids got the same treatment the binder pockets already had: in the Pokémon, Magic, Star Wars, Funko, Lego, and Topps catalogs, tiles far off screen now skip their layout and paint work until you scroll near them, and tiles whose card did not change no longer re-draw when the page updates around them — revealing more of a set and typing in search stay smooth instead of re-drawing every tile on screen. Binder pockets got the matching fix, so moving around the app no longer re-renders pockets that did not change.
- The background picture-saving that fills in card art between visits now stands down while you are using the app: it waits for idle moments and pauses completely while the app is in the background, so it never competes with your scrolling or drains the battery while Vault X is closed.

## v1.98.11

- The Library shelves are fast now, and no shelf item ever sits in its white studio background again: the finished cut-outs of everything on your Funko and Lego shelves are pre-made and saved inside the app, so the shelf shows the finished figures the moment it opens — no waiting on full-size photo downloads and no background removal running while you watch. The A-Wing Starfighter was the piece stuck with its white background: its photo host will not let the app read the picture directly, and the rescue fetch that works around that failed outright when you opened the Library, so the raw photo stayed. Its stored cut-out is fixed now, along with the Millennium Falcon, Dr. Peter Venkman with Firehouse, the TIE Fighter, and the Batmobile Tumbler — all five audited and saved as finished cut-outs.
- The same rule now holds everywhere a catalog photo appears: an item with a saved cut-out shows that cut-out first, anywhere in the app — shelf, detail page, search — and any cut-out the app works out later is saved too, so it is instant from then on. An item with no artwork anywhere keeps the clean placeholder; nothing shows a broken or half-loaded picture.

## v1.98.10

- Disney Topps is fully imported, every card: all 9 sets from Topps official checklists, 4,412 cards in total — 2025 Chrome Disney 489, Chrome Disney Sapphire 306, Disney Wonder 585, Disneyland 70th Anniversary 792, Mint Disney 201, 2026 Chrome Disney 526, Disney Neon 703, 2026 Mint Disney 380, and Vault Disney 430.
- Set artwork was pulled in for all of Topps Alternate Universe, from Topps own pages: Disney Topps now shows real product photos on 8 of its 9 sets (Disneyland 70th Anniversary and Disney Neon are new), WWE Topps on 7 sets, Star Wars Topps on 3 sets, and Garbage Pail Kids keeps its 1. The rest have no product photo anywhere on a Topps source, so they show the clean placeholder instead — no artwork was invented for them.
- The Disney Topps thumbnail problem is fixed: every set row in the Alternate Universe areas now carries the same size box — the real product photo when there is one, the clean placeholder when there is not or while it loads — never a blank or broken box, and the counts line under the four sub-area tile names is gone, so the tiles are name only and all the same size.

## v1.98.9

- Refreshing on an item page in the game catalogs (the Batmobile Tumbler Lego set is the one you caught) no longer flashes the catalog underneath while the page reloads. The page you were on is now on screen from the very first frame of the refresh and stays there, with its fresh counts and price swapped in when they land — no detour to any other screen on the way back.

## v1.98.8

- Your other two Lego sets got the Tumbler treatment. The TIE Fighter 75095 and the A-Wing 75275 now show LEGO official photography of the complete display: the ship on its stand, the information plaque readable at its base, and its pilot minifigure beside it, the A-Wing in the same on-a-real-table style as your new Tumbler photo. The new pictures show everywhere the sets appear.
- The Beckett logo in the We Support row on Search is sharp now. The old one was a tiny 103-pixel picture stretched across the row, which is why it looked blurry; it is replaced with Beckett official wordmark at full resolution. All five grader logos now stand at exactly the same height, evenly spaced, centered as one row on the dark background with their glows underneath, just as directed.
- On Lego set pages, Your Copy and its red and green copies steppers moved up to the top of the Set details tab, right under the picture, so adding a copy no longer means scrolling past Set facts and the parts breakdown first.
- Library dragging got another pass at the inverted pattern you found: the Funko shelf moved but its figures would not, and Lego figures moved but their shelf would not. The dragged piece no longer animates its own movement (that made it trail your finger and look stuck), the held piece now locks the touch itself the way the Comics wall drag does, and shelf artwork can no longer grab the gesture away from the hold. Every shelf moves up and down and comics, Funko figures, and Lego sets all rearrange left and right; card binders still do not move.

## v1.98.7

- Batmobile Tumbler 76240 has a brand new photo. The old one sat on a glossy floor that looked wrong, and it showed no figures. The new photo is LEGO official photography of the finished set on a real dark table: the Tumbler on its rotating stand, the black information plaque standing upright and readable beside it, and both minifigures, Batman and The Joker, on their display stand in front. It shows everywhere the set appears, including its Library shelf and its own page.

## v1.98.6

- Library rearranging, rebuilt so it really moves this time. Hold a Lego set, a Funko figure, or a comic on its shelf a moment longer and it lifts - drag it left or right and the others slide out of the way, then let go and the new order saves. Hold a shelf itself (not an item on it) and drag up or down to move the whole shelf, its order saved the same way. Card binders do not move - by your call, only non-card items rearrange. The old drag only pretended to start: the page could scroll under your thumb and steal the gesture, and the shelf drag had no scroll lock at all. Both drags now lock the scroll the instant they lift and run on positions measured once at the lift, the same way your Home tiles drag.
- The We Support logos at the bottom of Search are in their dark format now - your pick, option three: the five grader logos stand right on the dark background with no tiles and no bar, the dark marks shown in their light editions, Beckett in its bright native colors, and a soft spotlight of each brand's own color pooled underneath it - red and blue under PSA.
- Three Home tile photos lost their baked-in wording: TCG Universe, Topps Alternate Universe, and Sports Cards now show the same artwork with no lettering in the picture at all. The tile names under the photos are the app's own labels and stay as they were.
- Catalog downloads no longer stop when you back out of a section: a download you started keeps running anywhere in the app, and when you come back it shows itself still going with the up-to-date count instead of offering Continue download. Applies to every catalog - Pokemon, Magic, Star Wars, Funko, Lego, and all the Topps ones.
- Batmobile Tumbler 76240 - its Financial tab tells the truth now. The old value graph was drawn from two old retail prices plus one current tracker value, with no sold data behind it at all. It now carries 17 real eBay sales from the last two months (11 sealed, 6 used, tracked through PriceCharting), a value history rebuilt from BrickRanker's published monthly values back to December 2021, and a line in The numbers with the last actual sale: sealed last sold at $446.49 on October 30, 2026, averaging $367.97 across the 11 sealed sales. Your A-Wing 75275 got its full research too - facts, barcodes, its one exclusive minifigure, values, 12 real sales, and the same sourced value history. The TIE Fighter's graph was checked against its 12 recorded sales and stands as it was.
- Lego item pages cleaned up: every section sits in the bordered card the rest of the app uses - stat tiles, Set facts, every Financial box, Your copy. Recent sold listings fold away behind a header showing the sale count, Set facts fold with an up-or-down arrow, and the value chart is spaced by real dates with its scale labeled and a marker on every point.

## v1.98.5

- No more name labels under anything in your Library - ever. The A-Wing and the Batmobile Tumbler on your Lego shelf and Dr. Peter Venkman with Firehouse on your Funko shelf were still wearing little name plaques under them; an earlier fix had only taken the plaque off the Millennium Falcon and the TIE Fighter, the two pieces named that time. The plaque is now removed from the shelf display itself, so no item of any kind - Lego, Funko, comics, sealed, or anything added later - can show a name under it in the Library. The graded comics on the display wall lost their under-slab titles the same way. Every piece still keeps its name where it belongs: tap a shelf piece to peek at its name, and its own page carries the full details

## v1.98.4

- Back button, fixed at the root this time: your profile, a friend profile, and moving between Lego areas used to replace the app's one history entry instead of adding their own, so the phone's Back had nothing in the app to land on and left Vault X entirely. Those screens now take their own entry like every window in the app - one back returns to the exact screen you came from, windows still close on back first, and three backs from anywhere still exit. Also in this build: Library shelves move now - hold anywhere on a shelf (not just its little sign) to lift and drag it up or down, and items drag too, because a resting thumb drifting a few pixels no longer cancels the hold before it lifts; dragging no longer scrolls the page. Your Lego shelf sits even: the sets share one level at one size instead of two up and one dropped below. Sports Cards has your picked art: the leather glove with the baseball for Baseball, the basketball on the dark court for Basketball. Dr. Peter Venkman with Firehouse: its studio photo defeated the background cut-out and kept its white box, because the set is three separate pieces in one photo - the Firehouse, the figure, and the box - and the cut-out's safety check only trusted a product in one piece. The check now accepts a product in a few solid pieces too (it still rejects a picture the cut-out would shatter), so the white is stripped and the Firehouse, Venkman, and the box stand on the dark page like everything else. And a Lego set page whose details fail to load now says so with a Retry button instead of sitting empty

## v1.98.3

- Two fixes from your phone checks. The grader logos at the bottom of Search: TAG, SGC, and Beckett now sit on light backing plates, one even size each, so their real colors read clearly on the dark background instead of washing out in black - the logos themselves are untouched, still the companies own artwork in its native colors. And the Funko Pop search flash: tapping the search field no longer flashes another screen - the tap used to make the browser scroll the page to lift the field above the keyboard, painting whatever it scrolled past for a few frames. The field now takes focus without any page movement, in Funko and in every other section search field, since they all share the same search bar

## v1.98.2

- Share Vault X opens fast now: tapping Share used to take about seven seconds before the share sheet came up, because the tap first tried one share, then drew the invite picture card on the spot, then tried up to three more shares in a row - and every refused try cost seconds before the next one started. The invite card is now drawn in the background as soon as Settings opens, and the tap makes exactly one share call with everything ready, so the sheet comes up right away - inside a second. If that one call is refused, the invite is saved as a file right then, with the reason shown, instead of after a chain of retries

## v1.98.1

- Fixed the catalog download cancelling itself: on the Pokémon page, tapping download started it, then about five seconds later the button flipped back to Continue download. The Pokémon source answers with a server error every so often for a page it served fine seconds earlier, and one failed chunk used to end the whole download. Failed chunks are now retried automatically - the app retries the page fetch on the server, and if a chunk still fails the download stays in its Downloading state, shows a retrying note, and tries again with a short wait instead of giving up. Progress already landed is never redone, and this covers every catalog download, not just Pokémon

## v1.98.0

- Share Vault X now opens your phone's own share menu - the same menu you get when sharing a photo - with the invite ready to send. The old in-app share menu is gone
- Only mine is now per section: turning it on in one place no longer turns it on everywhere else, and each section remembers its own setting. Disney Topps and Garbage Pail Kids have the toggle too
- Garbage Pail Kids in Topps Alternate Universe lists its sets again, and Disney Topps and Garbage Pail Kids sets now show official Topps product artwork where Topps publishes it
- Settings now stamps each version's go-live: under the green up-to-date line you will see the date and Central time the version you are running went live
- Your tickets in Settings: a completed ticket stays in your list for one week, then moves under the new Completed tickets pill next to the Your tickets heading - tap it for your full completed history. Nothing is deleted
- New tile art for Star Wars Topps and WWE Topps inside Topps Alternate Universe
- The Lego Batmobile Tumbler (set 76240-1) now shows the photo with its information plaque
- The We support grader logos at the bottom of the Search tab now appear in their official colors at one even size

## v1.97.0

- New: the Only mine toggle. Every list page with more than 15 sets or products now has an Only mine switch at the top of the list: flip it on and the page hides everything you own nothing from, so you only scroll through what you actually collect. Flip it off and everything shows again
- It is one shared choice everywhere: the Lorcana chapter page, every game catalog (Pokemon, Magic, Star Wars Unlimited, Funko, Lego), the Sports Cards manufacturers, the Topps Alternate Universe brands, and the Sealed shelf (whose old Owned and All switch is now this same toggle). Set it once and it is remembered on every page
- Lists of 15 or fewer never show the toggle, and nothing you own is ever hidden - a set where you own even one card always stays. Inside a set's own card grid nothing changes: missing cards still show ghostly as always

## v1.96.0

- Slab scanning now lives inside the card scanner: one scanner, two modes - Scan a card matches artwork as always, and Scan a slab (cert) reads the grading cert number only (QR code, barcode, a photo of the label, or typing). Shortcuts open it straight into slab mode: Scan a slab in the Search tab and Scan a PSA slab on the Sports Cards Baseball page
- After a cert is read, the app checks the grading company's own online record and fills in what it actually finds: PSA records come with the grade, their description, and a copy of the slab photo they host for that cert (front, and back when there is one), imported into the app. Beckett, CGC, and TAG records could not be read from here and SGC publishes none, so those stay label-only with a link to the company's own page - and when no company photo exists, the card's catalog art stands in, clearly labeled a stand-in, ready for your own photo
- New: the Card / Slab View - every saved slab now has its own page with its photo hovering and turning (flip it to see the back photo when there is one), a plus/minus stepper tied to that cert that saves right away, and its details and paid amounts in tabs. Saving a scan lands you right on it
- The Search tab now shows We support: with the real logos of PSA, Beckett, SGC, CGC, and TAG along the bottom
- Camera: card scans now also compare a second fingerprint taken from the card's artwork alone, and a scan that does not land at once takes two more quick frames and keeps the best read - foil insurance. The five-second stop is unchanged, counted from the moment the shutter fires

## v1.95.0

- New: graded cert scanning for the top five companies - PSA, Beckett (BGS), SGC, CGC Cards, and TAG. Every card catalog section (Sports Cards first) has a Scan graded cert button, and every card page has an Add a graded slab button: point the camera at the slab and the app reads the cert number from its QR code or barcode, or photograph the label and the printed cert, grade, and company are read off it, or type the number yourself
- Each company keeps its own cert shape and grade scale: PSA and TAG have no 9.5, TAG certs start with a letter, SGC has its hyphenated long format, and CGC and TAG have a Pristine 10 above Gem Mint
- You confirm the company, cert number, grade, and which card is in the slab before anything saves - then the slab lives on that card page drawn as a slab in that company's label colors, and counts as one owned copy. Paid price is optional
- Within a company, one cert number can only ever be saved once: scan a cert that is already in your vault and the app shows you the card it already sits on instead of adding it twice
- Each saved slab links out to the company's own record for that cert number. Vault X saves the number you scanned; it does not verify certs with the companies or price slabs from them

## v1.94.0

- Catalog downloads now keep downloading when you leave the page: the download runs at app level, so switching tabs never loses it, coming back shows the true live progress, and Continue can never start a second copy of the same download. Progress is saved chunk by chunk, so an interrupted download resumes where it stopped
- Admin opens instantly: it now paints at once with the last-known numbers saved on your device, labeled with their as-of time, and refreshes in the background instead of waiting on the slowest server computation. Detail views still load only when you open them
- Portfolio: the whole breakdown area below Movers is deleted - the Value by Set pills and the per-set table (value, Complete percent, dollars to Finish) are gone entirely. Most Valuable stays as its own section
- Sports Cards and Topps Alternate Universe Home covers toned down to the same calm level as TCG Universe: Sports keeps its graded slab wall under soft spotlights on a quiet dark background, and Alternate Universe keeps the castle, starship and chrome cards with big clear lettering on a calm night sky

## v1.93.1

- Library display pieces: the Millennium Falcon and the TIE Fighter no longer carry a name label on the Library shelf - just the two pieces, exactly as they sit. Their names still appear on their own detail pages and in the catalog
- Library Legos sign remade for clarity: a flat, fully saturated brick-red plaque with crisp white block letters and one hard shadow - no more blurry, washed-out lettering at shelf size
- TCG Universe tiles are uniform now: the counts line under each game (binders, sets, owned) is removed, so all four tiles are the same size with art and name only
- Pokemon back button: opening Pokemon from the TCG Universe page and pressing Back returns to the TCG Universe page - never Home, never out of the app - including while a catalog download is running

## v1.93.0

- Back button fixed at the root, app-wide: opening a game from TCG Universe or a brand from Topps Alternate Universe now takes a real step back in history, so one Back press lands on the universe page you came from instead of leaving the app. The same fix covers every set page inside Pokemon, Magic, Star Wars Unlimited, Funko, Legos, Baseball, Basketball, and the Alternate Universe brands - Back returns to the set list - and forum threads, which now return to the board. Popups and sheets still close on Back first, and three Back presses still exit to Muse
- Millennium Falcon Pop fixed: the background cut-out was mistaking the Falcon light gray hull for the photo shadow and fading the whole ship out, which is why his page showed a black silhouette. The cut-out now protects the product itself - a figure can never be faded or silhouetted by its own matte again - so the Falcon shows his true colors, and every other Funko and Lego cut-out gets the same protection
- TCG Universe cover toned down: the busy portal art is replaced with a calm, quiet version - same four characters in the four corners around the portal, a soft dark background, and big clear TCG Universe lettering
- Search now starts at the first letter, everywhere: the search boxes inside the game sections, Comics, the deck builder, Portfolio Research, and the scan fix-it search all match from the first letter you type and keep their suggestions on screen while you keep typing, the same as the main Search tab, which already searched every catalog including Sports Cards and Topps Alternate Universe
- Portfolio: Track and Research and the Movers section are now boxed with the same border as the rest of the Portfolio page

## v1.92.0

- Share Vault X rebuilt: tapping Share now calls your phone share sheet directly in the tap, the way sharing a photo works, so the sheet is the normal path. Copying is only a fallback now, and when it has to run, the button area says why the sheet did not open. If you cancel the sheet, nothing is copied behind your back
- Edit display moved: the Library page no longer carries the Edit display control. The Library Comics wall just shows your slabs; choosing which slabs hang there (up to five) now lives in the Comics section under Library display wall. Your wall still shows your two signed comics until you change it
- Baseball banner remade: a wide banner made for the shape, just the word Baseball in the same big purple lettering with the whole batter and bat inside the frame, no Vault X wording, at half the old banner height. The Basketball banner got the same remake after its check found the same cropping and wording problems
- Topps Alternate Universe tile fixed: new tile art with Topps Alternate Universe in large chrome lettering that reads clearly at tile size, and the tile itself is now exactly the same size as every other Home tile
- Back button re-audited across the whole app, with fixes where it failed: the phone Back from Baseball or Basketball now returns to the Sports Cards list instead of leaving the app, a comic opened from the Library wall now closes back to the Library in one press, the Library binder preview closes on Back first, and the Funko barcode scanner closes on Back first. The other named places were checked and already returned correctly: TCG Universe and back from each game, Sports Cards home, every Baseball and Basketball tab, Topps Alternate Universe and back from Disney, Star Wars, Garbage Pail Kids and WWE, Lego and Funko detail pages, Library shelves and flip binders, Search, card pages, Comics, Admin, and decks. Three Back presses still exit to Muse from anywhere

## v1.91.1

- Library figures stand bigger: the cut-out figures and sets on your Library shelves - your Millennium Falcon and your TIE Fighter included - are now about 30 percent bigger, still standing on the shelf with their studio backgrounds removed

## v1.91.0

- Sharing Vault X the phone way: the Share Vault X button in Settings now opens your phone's own share sheet — send the invite by text, email, Facebook, or whatever your phone offers, just like sending a photo. The message your friend gets needs only the Muse app: GitHub is gone from the invite completely, no accounts to create and nothing to be granted
- Baseball now breaks down by the name on the cards: ten tabs — Topps, Bowman, Fleer, Donruss, Upper Deck, Score, Pinnacle, Leaf, Panini, and Beckett. Topps and Bowman carry real catalogs from Topps official checklists (Bowman sets moved out of the Topps tab into their own); the other names do not publish a downloadable catalog, so their tabs say so plainly for now
- Basketball tabs reordered: Panini first (it held the NBA license for years), then Topps
- New on Home: Topps Alternate Universe — a sixth main area with Topps Disney, Star Wars, Garbage Pail Kids, and WWE cards inside, each with its full catalog downloading from Topps official checklists, data only with no artwork downloaded

## v1.90.0

- Sports Cards grows up: Baseball now has a Topps tab with the WHOLE Topps baseball catalog downloading into it — every Topps and Bowman baseball set from Topps' own official checklists (2018–2026), card by card with number, player, team, and subset. Data only, the way you asked: no artwork is downloaded, and the checklists carry no prices, so none are invented
- Basketball gets the same build-out: a Topps tab with Topps' official basketball checklists downloading the same way, and a Panini tab — Panini doesn't publish a downloadable checklist catalog and the big checklist sites forbid bulk downloads, so that tab says so plainly instead of filling with borrowed data
- Sports sets browse like your other collections: set groups, binder grids with missing cards ghosted, a page for every card, owned steppers, and search that finds sports cards too
- The catalog downloads run in chunks with a live progress bar and pick up where they stopped — tap Continue any time, and they also advance a little every morning on their own

## v1.89.0

- Home is condensed: your four trading-card games — Lorcana, Pokémon, Star Wars Unlimited, and Magic: The Gathering — now live behind ONE TCG Universe tile (the portal artwork you approved, with the Vault X wording removed). Tapping it opens a page with the four games as folders, each with its own artwork and counts; tapping a game opens it exactly as before, and its back returns to the TCG Universe page instead of Home. Nothing inside the games changed, and hiding or reordering still works — the eye window on Home now has an Inside TCG Universe group for the games.
- Sports Cards joins Home as the fifth main area, with the slab-wall artwork you approved. Inside are two sports for now — Baseball and Basketball, each with its own artwork and page. Their catalogs have not been added yet, so the sport pages say so plainly instead of showing invented sets; when the catalog lands they will fill with set groups, binder grids, and card pages just like the other collections.

## v1.88.0

- Lego set pages are rebuilt in the card pages' clothes: the set's photo floats over a blurred blow-up of itself, the tabs are the card pages' own segmented bar, facts and figures sit in stat tiles and styled inset rows instead of plain lists, the Your copy block carries the opened and sealed steppers and Where it lives the way the card pages do, and the watch button and price alert moved to the Financial tab with the rest of the numbers. Every fact, figure, and financial from before is still there — your TIE Fighter 75095 page included.
- Library: the Legos shelf sign is now a red brick plaque with a studded top edge and chunky brick-style lettering, sized to sit with the Lorcana, Comics, and Funko signs.
- Library: your Lego sets stand on the Legos shelf as themselves — the actual set's photo, starting with your TIE Fighter — never as a book spine. Tapping one still opens that set's page.
- Funko photos lose their baked-in white studio background everywhere they appear — the collection grid, search, the figure's own page, and the Library shelf — so a figure shows as just the figure or its box, nothing behind it, sized up on the shelf like a real figure standing there. The background cut-out is smarter about grey studio backdrops too, and when a photo host blocks the app from reading a picture, the app now fetches its own copy through the server and cuts that instead — your Millennium Falcon included.

## v1.87.0

- Share Vault X is simpler: the Muse invite link is gone. The Settings share section no longer asks you to paste a Muse invite link, and the message it sends no longer carries one — what the Muse Invite button copies is a whole block of text, not a link. The message still explains that your friend needs the Muse app first, then walks them through the install file, and your Vault X invite code still rides along so the app knows you sent them. Sharing works right away now, with nothing to paste in first.

## v1.86.0

- Lego set pages are built out in full, with two tabs. Set details carries theme and subtheme, release date, piece count, price per piece, ages, retired status and retirement date, dimensions, build time, UPC and EAN barcodes, the official LEGO description, and an openable minifigures and parts breakdown that names every figure, flags the ones exclusive to the set, and gives their combined value.
- A Your copy block sits on every Lego set: opened and sealed copies counted apart (sealed copies are valued separately), condition, completeness with a missing-pieces count, what you paid per copy, the date the set was added, and Where it lives.
- The Financial tab carries the retail price, the current market value split sealed vs used, growth against retail and annual growth, a value history chart, recent real sold listings with their dates and sources labeled, part-out value where a source publishes one, and the cheapest current listings for a sealed copy.
- The honesty rule stands: a field no Lego source publishes shows as unavailable, never a guess, and any forecast is labeled an estimate. A set that has not been researched yet offers a Research this set button, and Jarvis gathers its facts from Brickset, BrickLink, BrickEconomy, Rebrickable, and Brickfact. Your TIE Fighter 75095 is researched already: retail 199.99 dollars, worth 399.68 dollars sealed and 265.46 dollars used, with its exclusive TIE Fighter Pilot figure at 80.34 dollars.

## v1.85.0

- Back button, fixed app-wide: every screen was audited, and Back (the in-app control and the phone gesture) now returns to the page you came from instead of dropping you on Home. Fixed spots: Admin sub-tabs such as Users, Activity, Trades, Tickets, Catalog, and Server now return to the Admin page; the Admin photo review screen returns to Admin; an opened deck (its page, the builder, and the collection check) returns to your deck boxes; an Inbox message, a shared deck message, the tickets window opened from the Inbox, and the welcome review opened from Admin each return to the screen underneath them. Popups still close first on Back, and three Back presses from anywhere still leave Vault X for Muse.
- Library signs: the Quests shelf sign reads Lorcana Quests in full again — Lorcana in the same gold lettering as the other Lorcana signs, and Quests toned down to the Promos scale in a gold medieval serif. The Funko shelf sign is new: bubbly pop letters in pale sky on a deep blue plaque, with a little gold crown on the F.
- Funko on display: a Funko figure you display in the Library now stands on the shelf for real — the white background of its photo is removed, the figure is a bit bigger, and its base rests on the shelf board instead of floating in a framed picture. The same treatment applies on the figure detail page, which now shows the figure on the dark themed presentation like the cards.
- Comics: the 9.8 grade marker on a slab label moved to the left end of the label band, where it sits on a real CGC label. Nothing else about the comics changed.
- The Zelle icon is rebuilt round and bubbly, drawn in the same line style as the cash icon beside it — still an outline with no solid fill, so it sits quietly with the other payment icons. It updates everywhere Zelle appears: Settings payment info, the split button, and the pay-the-seller line on an order.
- Social: the avatar at the top of Friends is now the same smaller size as the Best Matches row avatars below it. The style is unchanged — only the size.

## v1.84.0

- Buy lists are back, by your call: on a set missing-cards sheet and on a deck collection check, tap Send buy list to my Muse and confirm — your Muse gets just the cards you are missing (their TCGplayer product IDs and quantities, nothing else from your collection) and builds the cart on TCGplayer under your sign-in, Near Mint, keeping single-card shipping at 3 dollars or under where it can. It never checks out or pays — you review the cart and approve payment yourself. Cards with no TCGplayer product ID are counted and named as not sent, and the per-card TCGplayer links are still there if you would rather shop by hand.

## v1.83.1

- Download progress, everywhere: the app-wide rule is now fully applied — every download control shows a live progress bar while it runs. The Settings artwork saver (Save artwork now) now shows a progress bar with the live count and percentage while the rest of your artwork saves, joining the catalog downloads in Pokémon, Magic, Star Wars Unlimited, Funko, and Legos and the up-front artwork download, which already showed theirs.

## v1.83.0

- One banner color everywhere: the top of the app is now the same deep dark blue on every tab and screen — Home no longer lightens it. The color you liked in Search is the color everywhere.
- Search back fix: open a card from Search, do your business, press Back — you land back on Search with your search still there, ready for the next one. No more dumping to Home.
- Search is now universal: the Search tab searches everything — Lorcana cards, Pokémon, Magic, Star Wars Unlimited, Funko, Legos, sealed products, and your graded comics — with matches grouped by type under the card results. The field reads Search all collectibles.
- Typeahead from the first letter: suggestions populate the instant you type the first letter and narrow on every keystroke — no waiting for two or three letters, no submit.
- Every set tile now wears the purple border: chapters, promos, Illumineer's Quests, and the set lists in Pokémon, Magic, Star Wars Unlimited, Funko, and Legos — one treatment everywhere, with the same selected ring.
- Marketplace examples are watermarked: the two example listings (Elsa and Stitch) now carry a big diagonal EXAMPLE SALE watermark across the card art, so an example can never be mistaken for a real listing. Real listings are untouched.
- Library: the Quests shelf sign is now a medieval knightly banner — iron, oak, and gold-leaf lettering — standing out the way the Promos sign does, in its own old-world style.
- Library arranging: on your own Library, hold a spine or a shelf sign a moment, then drag to reorder shelves and the binders and items on them. Your arrangement saves as your own preference. A plain hold still opens the binder, and a tap still peeks.
- Long-press count picker: buttons now run 1 through 6, with an open type-in box right after for any count — type 15, tap Set, done. The X still closes it.
- Hyperia City Full Puzzle Art fixed: the assembled picture was the wrong photo. It is now assembled from Hyperia City's own nine puzzle pieces, so the full picture is exactly what the pieces make. Chapter One's Full Puzzle Art is verified as the Mickey Mouse assembled image its pieces form.
- Funko Pop: your owned figures now greet you on entry — your shelf is the first thing in the section, starting with Han Solo in the Millennium Falcon. The header is its own bordered card with just your collection info, and the catalog description text is gone.
- Funko barcode scan: the scan button is now Scan barcode. Scan the UPC on a Funko box — where a barcode is linked or researched, the figure opens; where nothing matches yet, the app says so plainly and offers search by name, and you can link that box's barcode to its figure once so every later scan lands on it.
- Funko search suggestions now show three at a time, narrowing as you type.
- Funko market data: a Funko item's page now has a Market box — value history built from eBay SOLD listings (never asking prices), with current sold values out of box, in box, and new. The Millennium Falcon's sold values are recorded (in box $36.50, new $42.39, out of box $14.90, via PriceCharting's completed eBay sales, Nov 4, 2026), and Funko values now record daily alongside your cards' re-pricing so the history builds over time. Figures with no recorded sales say so plainly.
- Library Funko shelf: your Funko shelf in the Library now shows the actual figure — the real Millennium Falcon product photo — not a book. Books are for card binders.
- Funko catalog is toys only now: apparel, Pop! Home, Pop! Pins, Pop! Pez, Pop! Books, board games, and shirt and pint packs are removed and blocked from future catalog imports. Pop! Plush stays. Nothing you own was in those groups.
- Funko catalog images: pictures that fail to load now fall back to a clean styled placeholder — never a broken-image icon.
- Download buttons show their work now: tapping a catalog download (like Pokémon's Continue download) shows a live progress bar with set and card counts while it runs — never click-and-nothing.

## v1.82.3

- Removed the buy handoffs: the missing-cards sheet and the deck collection check no longer send your lists out to have a TCGplayer cart built for you. Nothing leaves the app. Every missing card still carries its own TCGplayer link — tap it to open that card on TCGplayer and shop there yourself, exactly as before.

## v1.82.2

- Epic cards fixed: an Epic has exactly ONE finish, and its line is labeled Epic. The card page for an Epic (like Tiana 220 from Hyperia City) used to offer Regular and Cold Foil steppers — both wrong, since Epics are foil-only. Now there is a single Epic stepper. Enchanted and Iconic printings, which are foil-only too, likewise show their single finish line only.

## v1.82.1

- Lorcana chapter tiles: every chapter tile now carries the purple border — before, only the selected chapter (Chapter One) had it, and it is a good look. The selected chapter still stands out with its extra ring.
- Library shelf, finished: Quest books now follow the same owned-only rule as chapters and promos — a Quest binder appears only when you own at least one card from it, so Quest 3 no longer shows on a shelf when nothing from it is owned.
- Back-button fix: a binder opened from the Library (promo, chapter, Quest, or the comics binder) now takes its own step in the back stack, so one press of the phone Back button closes the binder and lands you back on the Library — never straight out of the app. Three Backs still exit from anywhere, as before.
- Comics slabs: the grade — the 9.8 — now sits in the middle of the slab label instead of off to the side.

## v1.82.0

- The Marketplace is LIVE: the Coming Soon overlay is off and the Marketplace tab in Social opens the real thing — browse listings, visit a seller shop, list your own items, and Buy Now, all feeding into the same in-person confirmation and Trust as trades.
- Bug reports can now carry a screenshot: attach a photo from your phone in the Bug form and it travels with the ticket, so it sits right alongside your report. Circle the spot in your phone photo editor first — a note under the form reminds you; there are no drawing tools in the app.
- Share a deck by mail: open one of your decks in My Decks, tap Share this deck by mail, pick a connected collector, and the full deck list lands in their Inbox as plain text — deck name, inks, and every card with its quantity, number, and set.
- The Friends area on Social is trimmed down to just your friends and adding a friend — the Trust Score line and the other extra info blocks are out of that spot. Your Trust Score still lives on your profile and Collector ID as before.
- Letter avatars now look the same everywhere: the glowing-ring circle from Best Matches is the standard across the app — Friends, profiles, Forums, Marketplace, and Admin all render the same avatar.

## v1.81.0

- The Funko tile on Your Collections now shows the Crown artwork — the minimal glowing crown over the figure in dark Vault colors — replacing the shelf art, per the changed pick.
- Settings: the checkmark item Saved collection count is now labeled Save collection count confirmation — same switch, same job, clearer name.
- Settings, Sharing: the Total collection value on your profile switch was dead — it buzzed but never changed. It now flips the instant you tap it and stays flipped, and a real save failure shows a plain error line instead of failing silently. The neighboring sharing switches were tap-tested too.
- Social now opens on Trades, and the friends list below the Trades, Marketplace and Forums selector is gone — the pinned Friends area at the top stays the one friends spot.
- Back-button cleanup: moving around the app — tabs, set pages, card pages, scrolling — no longer stacks a history entry per action, so three Back presses from anywhere get you out of Vault X and back to Muse, every time. An open window still takes the first Back to close itself.
- Library slab wall, take two: both slabs now render with identical geometry — same outer size, same slim label height, same cover proportions — so Batman and Aliens line up evenly like real slabs side by side. Label print at this size is not meant to be read.
- Library shelf: a Lorcana chapter binder now appears only when you own at least one card from that set — a set with nothing owned simply has no binder on your shelf, and the binder appears on its own when you add your first card from it. Same for promo binders: no owned cards, no binder.

## v1.80.0

- Achievements on profiles moved: the achievement icons now sit UNDERNEATH your name and verified badge instead of beside them, on every profile — and the row stretches all the way across the profile card, icons spread out instead of clustered. The row shows as many achievements as fit across the card, and any beyond that roll into a +N chip at the end; tap the row and the full achievements list opens, earned and unearned alike.
- Trust Score pill fixed: the highlighted box inside the Trust Score segment of the profile stat strip ran too close to the divider on its right. It now stops the same distance from the divider as it does from the left edge, and the Confirmed connections and Joined segments got the same even spacing.
- Library slab wall proportions fixed: the yellow grading label on the displayed slabs stretched far too tall at wall size, because the label is built at fixed print size. The wall now renders each slab at natural size and scales the finished slab down, so the label is the slim band it is on a real slab. Down at that size the label print is not meant to be read — the proportion is the point, exactly as directed.
- Zero means zero, loudly: anywhere an owned count is 0 — binder pockets next to the steppers, the per-finish counts on a card page, the Copies owned bar, game copies, sealed items — the 0 now shows BOLD and in the exact red of the minus button, so an unowned item jumps out. Non-zero counts look exactly as before, and the plus and minus buttons themselves are untouched.

## v1.79.0

- The Vault X server registry moved out of Settings and into Admin, where it belongs. Open Admin, tap Server Health, and the registry sits right at the top: your Collector ID, the username the server holds, your registration status and date, and when registration was last verified — all read live from the server, exactly as before. Settings no longer carries it.

## v1.78.1

- Back now closes the window you have open — full stop. The verified-badge explanation window used to let the phone's back gesture fall through to the app behind it; it now closes first, like every other window in the app. The same fix was swept across the few other windows that were missing it: a game card's detail page (Pokemon, Magic, Star Wars, Funko, Legos), the welcome page when re-viewed from Admin, the artwork download choice on the opening screen, and the example price-alert explainer. If a window is open, Back closes the window before it ever touches the page underneath.

## v1.78.0

- The verified badge is here: a small glowing check beside a collector's name on their profile, in friends lists, on Marketplace listings, and in the Forums. It is earned one way only — a trade that fully completes, both sides confirmed and feedback done, with someone who was already verified — so trust chains down from the owner and can never be self-granted or bought. Tapping any badge opens the story: how the badge is earned, and that collector's own proof, which trade earned it, with whom, and when. Two accounts start verified: ARuikis as owner and root of the chain, and Jarvis as the built-in friend. The owner can also verify someone by hand from Admin — their proof then honestly reads Verified by the owner with the date — and can revoke a badge on a substantiated report. One honest limit, stated right in the explainer: verified means identity confirmed on the network, never safe to pay; the in-person QR handshake stays the safety step.
- Forums are LIVE in Social — no Coming Soon gate. The home defaults to the latest activity across all seven categories (Announcements, General Talk, Show-offs, Deck Talk, Grading and Pricing, Trading Corner, Help and Rules), with a category chip rail, search, and Latest, New, and Top this week sorts. Threads are flat and readable: avatar, name, role chip, verified check, and a trust strip showing confirmed trades on every post. Up to two threads can be pinned at the top. Forum roles — Moderator and Admin — are granted only by the owner, and only to verified collectors: lose the badge and the role is suspended with it, until verification is restored and the role is granted again.
- Admin is now the Hub: six big tiles — Users, Activity, Trades, Tickets, Catalog, Server Health — each with its headline number and a trend cue, and each opening the full detail view behind it, with everything Admin showed before and nothing dropped. Changed areas still light their tile until you look. Catalog finally gets its own detail view: printings cataloged, sets, the daily audit's last run, and every game catalog's progress. A new Photos needed for approval block appears whenever accessory photos are waiting, opening a one-by-one review screen.
- Invite lineage, owner-only: the Share Vault X message now carries your own invite code, and when a newcomer registers with it, Admin records who vouched them in and when — and each collector's Admin detail lists everyone they have vouched in, so a swarm under one name is visible at a glance. It never appears on any public profile, and it never grants or feeds the verified badge — an invite proves you know somebody, not that you are trustworthy.
- Marketplace grows behind its Coming Soon gate: selling is now verified-only, enforced on the server — browsing stays open to everyone. A new Other item listing type covers Lorcana accessories — playmats, oversized cards, lore counters, pins, deck boxes — with your own title, description, category, price, and a required photo of the actual item. There is no market comparison on accessories because nothing tracks one; your price stands alone. The listing goes live immediately, but the photo is gated: buyers see a Photo pending approval placeholder until the owner approves it in Admin, and a rejected photo can be replaced from Your Listings, which re-enters the review queue.
- Portfolio's value graph gets its own titled box — Portfolio Value, in the same title-bar style as Movers — with the range buttons reworked as a proper pill group inside the box, a smoother curve, and cleaner labels. Track and Research moved to directly below the graph, where it belongs.
- The plus and minus steppers are now split by color, everywhere in the app and in every theme: green glow for plus, red glow for minus — same hollow-glow rings, same size inside the pocket, same big touch area and hold-for-a-number dial. Only the colors changed, and they never change with the theme.
- Card pages are deduped: the Card tab is now only about the card itself — stats, your copies, Where it lives, steppers — and everything financial (the value graph, per-finish values, average market value, what you paid, price alerts) lives only under Card Performance. The one exception stays exactly where it was: the TCGplayer link on the Card tab, so you can still jump straight out to buy the card.
- Smaller polish: Home's Top Movers shrinks one more step with names and figures still fully legible and the equal spacing kept; the Home shield and envelope badges get the full gradient-and-glow theme treatment with their counts in the new pill style; and the intro screen now offers a choice when new caching is pending — download it all up front with a real progress bar in megabytes and percent, or opt out for good and let images cache as you scroll. Nothing is ever forced, and you are never locked out.
- Search refresh is fixed for good: pull-to-refresh while on the Search tab now shows Search from the very first frame, with zero flashes of Home. Search was the one tab the refresh cover missed — its saved view is now restored before the first paint and painted above everything else, so Home never gets a single frame.
- The full Lego catalog is downloading into Vault X from Rebrickable, the standard Lego catalog source: 28,565 sets with set numbers, names, themes, years, piece counts, and set photos, shelved under their top-level theme. It lands in resumable chunks like the other catalogs, and a daily schedule keeps it coming until it is complete. That source publishes no prices and no per-set minifigure counts, so neither is shown rather than guessed. Lego sets track Sealed copies apart from Opened copies, because that distinction drives Lego value — mark either from a set page, and your sealed sets gather on their own shelf in the Legos section.
- The Legos tile is live: its Coming Soon label is off, its artwork is the open vault of colorful bricks you picked, and tapping it opens the Legos section while the catalog keeps downloading in the background. The Lorcana tile gets the storybook artwork you picked — the open book with cards around it and golden light rising off the pages. The chapter artwork inside the Lorcana section is untouched.
- Library news: Funko and Legos each get their own signed shelf in the Library, with a spine for every line or theme you own at least one item in — opening a spine takes you to that line or theme in its section, with your owned items marked. This Library treatment for Funko and Legos is provisional: it gets revisited once you have added a few of your own items and seen it with real pieces in it.
- Library Comics is a display wall now instead of a binder: your chosen graded slabs hang on the wall as rendered slabs, up to five of them, and you control the lineup from Edit display. Yours starts with exactly your two signed comics — Aliens #1, signed by Sigourney Weaver, and Batman #136, signed with a sketch by Tyler Kirkham. Tapping a slab opens its detail view as before, and the Comics section itself is unchanged.
- Watchlist and Alerts now cover any cataloged item, not just cards: Funko figures, Lego sets, the other game catalogs, sealed products, and graded comics can all be watched from their detail views and managed in Portfolio. The honest limit: an item with no tracked price on TCGplayer or eBay sold can be watched but not alerted, and its page says so plainly instead of offering a button that could never fire.
- The long-press number picker is on theme at last: hold a plus button and the 1-to-9 dial now wears the shared Vault X panel treatment — dark surface, accent glow, generous rounding — in every theme including Rainbow, everywhere the picker opens. How it works is unchanged: pick a number and it saves, tap away or press back and nothing changes.
- Settings cleanup: About this app and App updates are one tile now. The version line and the Check for Update button live together at the top of Settings, everything the old updates tile showed sits behind the small i button beside it, and the separate App updates tile at the bottom of Settings is gone. Seeing the welcome page again moved, too — it lives in the Admin Hub now, as a View welcome page button.
- Social settles into its final layout: Friends is pinned at the top of Social with the friend rail and your Trust Score line, always in view, while Trades, Marketplace, and Forums swap in the space below. Tapping the Friends card header opens the full Friends view with the registry and the complete list.

## v1.76.0

- Portfolio grows the Track and Research block you approved, right under the Re-price pills: one pill dropdown — Watchlist, Alerts, Research — and the area below it swaps to your pick. Watchlist holds anything you are eyeing, owned or not, with its price, day change, and trend line; add items with the new Watch button on any card or sealed page, and tap the bell on a row to set an alert on it. Alerts is now the one home for every price alert you own, the same list the item pages create, with triggered ones flagged red and a red count badge on the menu when any have fired. Research is the homework page for one card: full price history chart, TCGplayer next to eBay with the last-sold figure and its date where sales are recorded, your position, every printing compared, and what finishing its set would cost.
- The color at the top of the app now holds your theme on every tab — Home, Search, Social, Portfolio, Settings — with no flip as you move around, and the trip into Search arrives in one smooth fade instead of a rough cut. Under the Rainbow theme, the last flat-blue stragglers (the change-request Bug and Idea toggle and its Send button, the About box buttons, Check for update, and every other gold primary button) now wear the blue-to-violet Trades gradient like the rest of the app.
- Hyperia City's Full Puzzle Art is fixed: it now shows the genuine assembled artwork photo from the set's own Set of 9 product, and this update also clears out stale saved artwork on your device so an old wrong image cannot linger. Every other set's Full Puzzle Art was re-checked against its own pieces the same way.
- The plus and minus stepper rings in the collection are smaller — same perfect hollow glow, now sitting fully inside the card pocket borders with room to spare, in two-across and four-across grids, on sealed items, and on item pages. The big invisible touch area and the hold-for-a-number picker are unchanged.
- Settings no longer carries a Your Collections section — that control lives in exactly one place now: the eye button beside Your Collections on Home, whose window holds all seven collection toggles, Funko included.
- The Funko tile gets the artwork you picked — the three cased figures on the shelf. One honest note on its label: the Funko catalog has actually landed (23,939 figures, browsable in the Funko section right now), so under the rule you set — label on until the catalog is live, off once it opens the real section — the Coming Soon label has graduated off. Tap the tile and the full catalog is there.

## v1.75.0

- Home launch, rebuilt for speed: Vault X now keeps a copy of your last-seen Home on this device and paints it whole in the very first frame when you open the app — your Collector ID pill, the portfolio pill, Top Movers, and Your Collections all at once. Fresh numbers then swap in quietly behind that same screen. No more bits and pieces popping in one at a time, and the opening cover now only appears on a true first-ever run with nothing saved yet.
- The Marketplace is built out to the design you approved, still behind its yellow Coming Soon gate in Social until you say launch: every seller gets their own shop page inside the Marketplace with their listings, Trust Score, and confirmed sales count; listings are fixed price with one-tap Buy Now right on the tile as well as on the listing page; offers exist only where a seller flips the per-listing Allow offers switch, which starts off; the Sell screen shows your typed price against the live market value as you type; and when a sale completes and both sides leave their thumbs feedback, the sold cards now settle into both collections automatically, the same way trades and cash sales already do. An Under $50 filter joins the browse chips too.

## v1.74.0

- Funko Pop! joins Your Collections as a seventh tile, with its own artwork and a yellow Coming Soon label like the Legos tile. The full collector catalog is built in: every Funko figure tracked by Pop Price Guide and HobbyDB, with variants like Chase and retailer exclusives as their own entries, browsable by Pop! line and searchable by name, with owned counts just like the other collections. The catalog downloads in resumable chunks from the Funko section, and the tile's Coming Soon label comes off once the download completes. One honest gap: the open catalog data was last updated in January 2021, so figures released since then are not in it yet, and it carries no prices, so none are shown.
- Vault X is now multi-language: Settings has a new Language section, in the same themed dropdown style as Theme, with English, Spanish, German, French, and Japanese. Pick one and menus, buttons, and labels across the app switch right away, with numbers, dates, and currency formatted for that language. Card names and your own content always stay exactly as printed and as written. Any text without a translation yet falls back to English instead of going blank.
- The plus and minus count buttons got their fix and their glow-up: every stepper now renders as a complete hollow glowing ring, lit like the profile pictures on the Trades page and following your theme, with the plus or minus clear in the center. No more clipped, half-drawn circles, in the set grids at both densities, on sealed items, and in item details. The big touch area and the long-press number dial work exactly as before.
- Opening the app no longer fills Home in piece by piece: a themed cover holds for the moment your data takes to land, then the whole Home screen appears in one finished paint, portfolio pill, Top Movers, and collections together.
- The last two plain system dropdowns in the app, the set and rarity filters on the trade board, now use the same themed dropdown as everything else. No generic dropdown remains anywhere in Vault X.

## v1.73.0

- Your profile now always spans FOUR deck boxes across, empty or full: whether you have four decks on display, one, or none at all, the row is four boxes, each in a different color from the Vault theme - deep cyan, royal blue, violet, and magenta violet. Your decks fill the first boxes with their names on them, and the rest stand as plain empty boxes in their slot colors. On your own profile an empty box taps through to your decks page so you can add one.
- The little display window on deck box fronts is gone: no more featured card showing through the box face. Every deck box - on your profile and on the My Decks shelves - is now one solid color straight through, with its deck name still embossed on top.
- Opening a deck box shows the FULL card now: the featured card rises out of the box whole, at its real card proportions, instead of the half card that showed before.

## v1.72.0

- Your profile deck boxes are plain deck boxes again: the photos of your most expensive cards that filled the empty slots are gone, and only your active deck boxes appear, each with its deck name on the box.
- The deck box opening animation is cleaned up: the lid now tips back on its hinge like a real box instead of flipping forward, and the deck inside rises as the lid opens.
- Back from the Comics section now takes ONE press and lands back on your profile, the way it should - the same one-press return now works for every section opened from your profile.
- The Lorcana row in My Collection opens the chapters page, not the Library - the Library still opens from its shelf picture, as before.
- The Sealed row in My Collection opens the standalone Sealed page again - the acrylic shelf with the Owned and All toggle, set filter, and sorting. The Sealed tab stays off the bottom menu; the page is reached from your profile row.

## v1.71.4

- The little deck boxes icon inside the Library window on your profile is gone - your deck boxes sit right below that window now, so the icon was just taking up space. The Library shelf keeps its new bigger fit and stays centered, and the deck boxes below are untouched.

## v1.71.3

- The Library picture on your profile is sized to fit its window now: the binder spines stand taller and spread wider so the shelf fills the space instead of sitting small in the middle - and the whole picture stays centered, just like before.

## v1.71.2

- Moving your collections on Home is smooth now: hold a tile until it lifts and drag it, and it follows your finger cleanly while the other tiles glide into their new places - no more stuttering or jumping while you rearrange them.

## v1.71.1

- Two-across scrolling in set pages is smoother: the bigger tiles now use a right-sized 640px copy of each card saved on your device (your own collection is cached first), they decode without blocking the scroll, and the grid reserves the right height per tile so the page no longer jumps around while you scroll.
- The themed background now fills the whole screen on every page: scroll all the way down (the profile included) and the background continues to the edge - no more empty void band at the bottom.

## v1.71.0

- Full Puzzle Art in Hyperia City finally shows the artwork: no assembled photo of that puzzle exists in any source, so the entry now joins the set's own nine piece cards together into the completed picture - in the grid and in the card view.
- Every other set's Full Puzzle Art was audited too: The First Chapter, Rise of the Floodborn, Ursula's Return, Azurite Sea, Fabled, Winterspell, Wilds Unknown, and Attack of the Vine! all show their real assembled artwork.
- Shimmering Skies, Archazia's Island, Reign of Jafar, and Whispers in the Well have no assembled artwork published and no complete piece scans to build one from - the lore sets' pictures live on the card backs, which no source scans - so those entries settle on their name plate instead of sitting on Loading art forever.

## v1.70.1

- Prices that come from eBay sold listings now say so right on the item in the missing list: recent sales read 'eBay sold median' with the dates they sold, and once the sale behind a price is more than about 90 days old the line switches to 'Last sold at that price on eBay' with the month - a stale price is never dressed up as a current one.

## v1.70.0

- Set pages now open two cards across by default, big enough to catalog by scrolling: the regular and foil pockets sit side by side, and each pocket has its own minus and plus stepper right on the grid - tap to add or remove a copy without opening the card, or hold the plus to pick a count.
- A 2 across / 4 across toggle sits at the top of every set page in every collection - Lorcana chapters and promos, Pokemon, Magic, and Star Wars Unlimited - and your choice is saved to your profile, so it follows you. Four across stays for fast hunting.
- Curator's Collection: Beauty and the Beast promos are priced now from recent eBay sold listings (median sale price): Be Our Guest $39.99, Belle $69.99, Lumiere $29.99, Gaston $28.99, and Beast $60.00 - so that set's cost to complete finally shows a real number.
- Mrs. Potts (2/CC2) has no recorded sale anywhere yet, and Promo Set 4, Ravensburger Play Hub, and Challenge Series 3 still have no eBay sales to price from - those stay honestly marked as having no tracked price rather than a made-up one.
- Prices now follow your hierarchy everywhere the app prices a card: TCGplayer first, and where TCGplayer has no price, the median of recent eBay sold listings - asking prices never count.

## v1.69.0

- The whole app now lives in the Trades world under Rainbow: every page sits in the same lit backdrop of soft blue and violet glows, cards read as raised panels with a lit top edge, and inset boxes like text fields share the same tones instead of sitting as flat dark patches.
- Portfolio joins that world too: the Total Value hero and the value chart card now use the raised Trades panel look with its top glow and hairline border, the chart grid is softer, and the Home Portfolio pill matches.
- Settings is fully in the theme now: Send a change request, Share Vault X, Username, and App updates - including their inner boxes and fields - all carry the same depth and glow as the rest of the app.
- Buttons and highlights everywhere now wear the blue-to-violet gradient with its glow, the exact treatment from the Trades page.
- Set complete now reads like the achievement it is: on finished chapter, promo, and Illumineer's Quest tiles, the label is rich gold with a warm glow instead of plain text.

## v1.68.0

- Your profile got the cleanup design you approved: your photo sits centered with a glowing ring and its edit button on the photo itself, your @username and bio centered under it, your Collector ID QR small in the corner of the card (tap it for the big scannable view), one full-width Edit Profile button, and one stat strip with Trust Score (tap it for the breakdown), Confirmed connections, and your joined month.
- Your profile now has four boxes under your Library picture: they are your deck boxes - each one shows the featured card you picked for that deck in its window - and any box without a deck showcases one of your most valuable cards instead, with its value stamped underneath. Tap a deck box to open that deck; if you ever have more than four decks, an All my boxes link opens the full My Decks page. Your Library picture itself stays your binders, exactly as before.
- Fixed the tile drag for real this time: the page was stealing the gesture - a held tile lifted, moved a millimeter, and then the whole page scrolled. Now, the moment a tile lifts, the page scroll is locked until you drop it, while a normal scroll starting anywhere else still works as always.
- Rainbow now carries the whole Trades look across every page: surfaces have that gradient depth, cards and pills take the rounder bubbly curvature, profile pictures glow, and buttons carry the blue-violet glow - the full treatment, everywhere.
- New My Collection section on your profile, built from the design you approved: the Lorcana row carries a big glowing completion bar with your unique-owned count and total cards, your chapter closest to finished gets its own row with its bar and exactly what it costs to finish, and Comics and Sealed rows sit beneath - every row taps straight into that part of your collection.

## v1.67.0

- Trades is rebuilt in the new design you approved: Best Matches shows each friend with what you can get and what they can get (exact printings, both ways) and a balance bar, and Browse Cards pools every available printing into one board with direction, set, foil, and rarity filters and sort by value. Tapping a card starts a trade with its owner. Trade Match itself stays on your friends profiles.
- New theme: Rainbow. The Trades colors - deep navy, blue and violet glows - now carry across the whole app when you pick Rainbow in Settings, and it is set as your theme. The other five themes are unchanged.
- Fixed the Your Collections tile drag: hold a tile until it lifts, drag it with your finger over another tile to swap places, and let go to drop it - the other tiles glide out of the way, and your order is saved.

## v1.66.0

- Your Collector ID page is display-only now: the photo changer box at the bottom of that screen is gone - it just shows your QR code, Collector ID, and username.
- Change your profile photo right on your profile: a small edit button now sits on the photo itself - tap it to pick a new one.
- New Edit profile on your own profile: change your photo, edit your bio line (it saves to your profile now), and manage your banner, all in one place. Username changes still live in Settings, where they can be changed once.

## v1.65.0

- The Home Portfolio pill graph is now a smooth, rounded curve - the bubbly line from the design you approved - instead of sharp straight segments, with the same soft gradient fill underneath it.
- Top Movers on Home tightened a little more: slightly shorter rows and smaller card thumbnails, while card names and their gains and losses stay full size and easy to read.
- Even spacing on Home: the gap between Top Movers and Your Collections now exactly matches the gap between the Portfolio pill and Top Movers, so the three blocks stack evenly and Your Collections rides up with the shorter movers.

## v1.64.0

- Home snapshot: a slim Portfolio pill now sits near the top of Home - a mini value graph with your total and its change across the tracked history; tap it to jump straight to Portfolio. Right under it, Top Movers lists the three cards in your own collection that moved the most in the last 24 hours, gain or loss; tap one to open that card.
- Portfolio Total Value box redesigned from the ground up: a deep dark hero block with a soft blue-purple glow along its top edge, the value big and fully formatted (commas and cents, the cents set smaller), your period change as one tinted chip under the value that follows the range selector, the stat strip below a hairline, and the priced-as-of line demoted to a small footer showing the actual latest reprice date instead of the old stale headline.
- Search in every section: Lorcana, Pokemon, Magic: The Gathering, Legos, Comics, and Star Wars Unlimited now share the same top row - a search bar styled to match the Scan pill with its own magnifier icon, and the Scan pill at the top right. Each bar searches its own section's catalog; the Lorcana bar hands off to the full catalog search, which hones in with name plus collector number.
- Smoother binder scrolling: card pockets far off screen now skip their layout and paint work until they approach the viewport, so long set grids scroll lighter. Nothing on screen changes.
- Buy handoffs confirm first: Buy missing cards and the deck buy list now show exactly what will be sent and where (TCGplayer, via Jarvis) before anything is handed off - nothing leaves the app until you tap Send on that confirmation.
- Home pill, final layout: the text group (label, total, and the change as a small tinted chip) is centered together, the mini graph starts right after the numbers and fills the rest of the pill to its right edge - never running behind the words - and the pill shows the same grand total as Portfolio.
- Home tidy-up: the Top Movers rows are condensed about 30 percent, Your Collections now sits snugly right under them, and the Collection Value figure beside the Your Collections heading is gone - the total now lives in the pill, shown once.
- Portfolio's value chart now wears the Total Value box's theme: the same deep dark block with the soft glow along its top edge.
- Reprice Force joins Re-price now in the Total Value box: the normal button runs the day's re-pricing (once a day), and Reprice Force starts a fresh run on the spot even when today's already ran.

## v1.63.0

- Fixed: the Home tab now always lands on the actual Home screen. It could greet you with your name and QR code instead - the big QR view now opens only from your profile (tap your name pill to open your profile, then the QR / Collector ID element there), and tapping Home closes anything stacked above Home.
- Fixed Trade Match: it matched cards by NAME, so cards a friend holds as a different printing - or a foil you only have in regular - never showed. It now compares exact printings (set, number, and finish) both ways, with the match counts shown. Jarvis's Elsa - Snow Queen Cold Foil and his Stitch - Rock Star printing now show next to his Mickey Mouse - Brave Little Tailor.
- Trades tidy-up: the moment a trade offer or purchase order is done - declined, withdrawn, or completed with feedback wrapped up - it files itself into the new History section at the bottom of Trades, and finished deals already on the books moved there too. History stays collapsed until you tap it, records are kept for good (they feed Trust Scores), and you can also archive any finished deal by hand with its Archive button. Active and pending deals never move.

## v1.62.0

- My Decks: the deck box is redesigned to look like a real deck box - a solid molded box in your chosen color with a lid seam under the embossed name and a small window in the front panel. The window shows a close-up of the featured card's face and art, not the whole card. Your Village Aggro box now features Mickey Mouse - Best in Town in its window, and you can change the featured card any time in the deck builder.
- Settings: the Username section now has its own icon beside its heading - a person mark in the same style as the other section icons. Nothing else about the username box changed.

## v1.61.2

- Home: the Your Collections section and the collection value beside it now sit noticeably lower on the page - a clear step down in the space above the section, with the value moved down to match. Nothing else on Home moved.

## v1.61.1

- Home polish: the Legos tile now reads Legos with Coming Soon beside it in smaller print on the same line, so the tile is the same height as every other tile and the row lines up evenly wherever the tiles are dragged.
- The Your Collections section sits a little lower on Home (about a fifth more space above it), and the collection value total beside it nudged down slightly to match.
- Your name and Collector ID oval at the top of Home is now pinned flush to the right edge, in line with everything else on that side of the page. It still opens your profile.
- Settings cleanup: the row of quick-jump icons under the About box is gone. Every section keeps the icon beside its own heading, and the Vault X server registry section has a new icon of its own - a server stack inside the Vault ring.

## v1.61.0

- Fixed: refreshing while on Search now stays on Search - it restores in place before the page paints, with no detour or flash through Home, and the keyboard still never opens on its own.
- Your name at the top of Home now opens your profile directly again - no page in between. The big scannable QR view opens from the QR / Collector ID element on your profile, and Back returns to your profile.
- The Trust Score breakdown has a new home: tap the Trust Score line on any profile (right under the joined date) to open the breakdown page - what the score is made of, verified events only. The QR view now shows just the number.
- Settings: Theme is now a proper drop-down in the Vault X style - tap it, pick from the themed menu, and it applies and saves as before. Your Collections in Settings is a matching drop-down box that expands to the same six show/hide switches.

## v1.60.0

- Three new collections open: Pokemon, Magic: The Gathering, and Star Wars Unlimited lose their Coming soon labels and each opens its own section - browsable by set and card number like Lorcana, cards ghosted until you mark copies owned, with search across the whole catalog. Their catalogs download in chunks from their official free sources (Pokemon TCG data, Scryfall, and Fantasy Flight for Star Wars), and each section shows the download progress honestly until it is complete.
- Friends is now a MySpace-style grid: just each friend photo with their name underneath, nothing else - tapping still opens their profile.
- Lego is now Legos, everywhere the collection label shows. The Legos section itself is untouched.
- Your identity page (tap your name at the top of Home) is now just your big QR code, your username, your Trust Score breakdown, and the link through to your profile. Username editing moved to Settings - and you can change your username one time only, so the Settings box says so plainly and locks after one change. Your server registry entry moved to Settings too.

## v1.59.0

- Admin: Registered Collectors is now called Registered Users everywhere in Admin, and that list is redesigned - clean, roomy rows with the avatar and username up top, the Collector ID underneath, and one tidy line for Trust Score, items collected, connections, and joined date.
- Search: the search box is back up at the top of the screen, right under the Search heading, where it looks right. It still only opens the keyboard when you tap the field.
- Social: Add a friend by code now sits right under the Social heading as a quick add - just the code field and the Add friend button, nothing else - and it is gone from down in the Friends list.

## v1.58.0

- New: rearrange your Home collections. Hold any Your Collections tile and drag it to a new spot - put Magic first, or any order you like - and the app remembers your order on your profile. Hidden tiles stay hidden and the rest reflow in your order; a normal tap still opens the collection as before.
- Removed the Marketplace from the bottom of the Home screen - it is gone from Home entirely. The Marketplace still lives in Social, exactly as before.

## v1.57.7

- Removed the Marketplace from the bottom of the Home screen - it is gone from Home entirely. The Marketplace still lives in Social, exactly as before.

## v1.57.6

- Removed the Two pockets for every card number note from the bottom of the Home screen - it is gone entirely, for you and for every other collector.

## v1.57.5

- Collection Distribution moved, as you directed: it is gone from Home entirely - no copy, no summary left behind - and now lives in Portfolio in your final order: the value graph, then the Collection Distribution, then the Movers. Same rows, same percentages, same total underneath it all.
- The Queen, diagnosed end to end this time instead of guessed at: her catalog entry is correct (Promo Set 3, printed 3/P3, your two Promo Cold Foils), she is in the scanner plan's priority list, and her artwork loads fine - those stages were never the problem. The drop was in the trust rule: your phone only trusted a sure on-device match if ALL roughly 3,700 card fingerprints had finished building, which takes a very long time, so her match kept being handed to the server read - the one measured at 18 to 25 seconds - and died at the time limit in every version. Now a sure match on a promo printing stands on its own as soon as the promo tier (which builds first) is complete, so scanning her can finish in about a second on the phone's own match. Please re-scan The Queen after updating and give the app a little open time first if the scanner still shows the index building - her tier is the first one it builds.

## v1.57.4

- Scanner, rebuilt around your five-second rule: a scan now NEVER runs longer than five seconds, period. Your last tests ran 30 and 31 seconds, and one of them ended with no suggestions at all - both of those are fixed at the root. The old build waited on the server read, which takes far longer than five seconds, and threw the wait away at the last moment; the scan now lands at about four and a half seconds with the best matches your phone itself found, so you always get picks to choose from instead of a spinner.
- The server check also starts the moment you take the photo - it is already running inside the first second or two, not at three or four seconds - and the server itself now stops at four seconds. A sure on-device match still answers in about a second, exactly as before. And if a scan ever does stop at the limit, the closest matches from your phone are shown below the note, never a bare empty list.
- Please re-scan The Queen (Promo Set 3, number 3) after updating: the scan should finish inside five seconds and offer her among the picks if your phone index has her artwork - and the search on the result screen (try The Queen 3) is there if it does not.

## v1.57.3

- Portfolio, aligned to the example you approved: the header is now exactly the mockup - Total value, its change line right beneath, then the five labeled figures (Paid, Net, Cards with unique count, Graded, Sealed) as clean cells. The extra text that had crept into the header is gone from there (the foil and spare-copies note now sits at the bottom of the page), the long explanation paragraph under the chart is one short line, and the breakdown choices are a simple row of pills like the example - so the page reads value, trend, movers, breakdowns, sets, in one scroll, the way the example showed it.
- Settings cleanup, as you directed: the Admin section is removed from Settings (your Admin still lives on Home behind the shield badge, with every statistic), and the Tickets list is removed from Settings too - tickets live in your Inbox only now. Send a change request stays in Settings; it is the form tickets are sent from. No Tickets icon was added anywhere - you decided that would be redundant with the Inbox.

## v1.57.2

- Scanner fix, after your Queen test failed again: this time the failure was measured, not guessed. The server read of a card photo actually takes about 20 seconds - the old scan gave up at about 14 seconds and showed you only your phone closest artwork guesses, which is why a bunch of cards appeared and The Queen was never one of them. The read itself was perfect when it was allowed to finish: exact title, and the collector line read as 3/P3.
- What changed: the server check now starts the moment you take the photo (not after the on-device match), the reading prompt is focused so the read comes back faster, and a scan that needs the server is allowed up to 32 seconds before it stops - the waiting screen now says the server route can take up to about half a minute. A sure on-device match still answers in about a second, exactly as before.
- Please re-scan The Queen (Promo Set 3, number 3) after updating: she is the test case. The scan should now land on her exact printing, or offer her among the printings to pick from.

## v1.57.1

- Portfolio check, after your report that the new layout still was not showing on your phone: the rebuilt Portfolio (one scroll, one range selector driving the change line, the chart, and Movers together) is confirmed in this version - tap Portfolio and you should see your total with its range change right beneath it, the 7d / 30d / 90d / 1y / All pills above the value chart, and Movers under the chart. If your copy still shows the old Portfolio, use Update now here rather than a pull-to-refresh - a plain refresh can be answered from your phone cache with the old version, while Update now fetches the fresh build first.
- Also fixed in the Portfolio per-set table: every set was showing 0.0 percent complete and Complete - nothing to buy, because the table was reading the Puzzle rows that share each set name instead of the set itself. It now shows each set real completion and cost to finish (for example Hyperia City at about 74 percent with its real cost to finish).

## v1.57.0

- Scanner rebuilt the internet way, the option you approved: when your phone is not sure about a card, it now sends the photo to the server with its closest artwork matches, and the server reads the tiny collector line at the bottom of the card (like 3/P3) and uses that exact line to pin the printing. That is the check that can find The Queen, Promo Set 3 number 3, even on a phone whose on-device card index has not finished building - her artwork twin in Fabled and the Epic share her name, but only her promo printing carries the line 3/P3.
- A sure match on a finished on-device index still answers in about a second with no server call. Anything less than sure now takes the server route, which can take a few seconds longer; the whole scan is allowed up to 15 seconds instead of 10 so that read is never cut off mid-check.
- When more than one printing still fits after the line check, the pick list now shows up to eight printings instead of four, so the right one is not cut off the bottom of the suggestions.

## v1.56.0

- Portfolio rebuilt to the layout you approved: one scroll, one range selector. The 7d / 30d / 90d / 1y / All pills above the value chart now drive everything together - the change line under your total, the chart window, and the new Movers list of your top gainers and losers (tap a mover to open the card).
- The header is tighter: your total, its change for the selected range right beneath it, and one stat strip - total paid, net, cards with unique printings, graded, sealed - plus an eye button that hides the money figures when you show the app to someone. The chart also gained an optional Paid line, off by default.
- Breakdowns now switch in place on the same page (no separate pages to back out of), with a new By Type pill - Singles / Graded / Sealed. The per-set table gained Complete % and $ to Finish and sorts by net or completion, and Most Valuable now shows each item's share of your portfolio.
- Two honest limits: prices are only tracked from Oct 25, 2026, so for now the longer ranges measure from that first tracked day (the page says so where it happens) and will separate on their own as daily history builds. And there is no Recently Added strip yet - the app doesn't record the day each card was added, so rather than invent dates, that strip waits until additions are tracked.

## v1.55.3

- Promo tiles checked family by family against the price sources: the Curator's Collection Heroines (CC1) tile and the PD1 tile said 'no tracked prices yet', but those cards do sell on TCGplayer - their prices were pulled in, so CC1 now shows a real cost to complete and PD1 shows the cost of the four missing cards TCGplayer sells (the other five PD1 cards you need are not sold there and still count as unpriced).
- The other four families that say 'no tracked prices yet' were verified one by one and genuinely have no tracked prices anywhere the app can see: Promo Set 4's last missing card, the Ravensburger Play Hub set, Challenge Series 3, and the Curator's Collection Beauty and the Beast set - no marketplace the app tracks sells them, so the label stays for those four, honestly.

## v1.55.2

- Scanner: The Queen, Promo Set 3 number 3, could still slip past when the on-device card index had not finished building on your phone. The index now builds in the background whenever the app is open, not only while the scanner is open, so promos and puzzle inserts are fingerprint-ready long before you scan.
- Any scan that is not a sure match on a finished index is now double-checked against the full catalog reader at the same time, inside the same 10-second limit, and the two answers are combined - a card your phone has not fingerprinted yet can still be found instead of never appearing.
- The catalog reader no longer throws away a good card name over a misread of the tiny bottom line: the number after EN is the set number, not the collector number, and a read number that fits no printing of that name now falls back to the name itself, so the right printing still shows up in the picks.
- The picks list has room for more close artworks, so the card in your hand is easier to spot in the list.

## v1.55.1

- Scanner fix for The Queen, Promo Set 3 number 3: she was in the catalog all along, but the scanner could not reach her. Every promo printing now jumps to the front of the on-device index build, with the puzzle inserts, instead of waiting behind thousands of main-set cards - so promos are ready to scan within the first stretch of the build.
- Until your on-device index has finished building, every scan is now also checked against the full catalog reader and the two results are combined. A card whose fingerprint is not built yet can still be found, instead of silently missing from the list - and the result screen now tells you when a scan ran while the index was still building.
- The picks list is wider: the nearest few artworks always appear as choices when they are anywhere close, so the right card is there to tap even when it is not the top match. That helps close calls like the legendary Tiana too.
- If a scan still cannot place a card, its closest on-device matches are shown as picks instead of an empty result.

## v1.55.0

- Puzzle sections checked for every set, and the pieces have their artwork now. Attack of the Vine! has its Puzzle section at last: 9 pieces that assemble the Winnie the Pooh and Hunny characters artwork, Winnie at the centre.
- Puzzle pieces and Lore cards across the sets now show their real scans, and most sets' Full Puzzle Art shows the assembled artwork - Hyperia City's nine pieces included. Two Full Puzzle Art entries (Hyperia City and Reign of Jafar) still show a name plate because no assembled photo exists for them yet; their pieces all have art.
- Counts corrected from TCGplayer's own catalog: Azurite Sea's puzzle is 9 pieces, not 6. Winterspell has two insert series - 9 Lore cards and a separate 9-piece Snowball Fight puzzle - and Wilds Unknown's inserts are puzzle pieces. Into the Inklands is confirmed as the one set with no puzzle (its packs carried rules cards).

## v1.54.3

- Scanner fix for the Ink Drop miss: your photo was clear enough - the matcher was not. It now compares the brightness pattern of the whole card as well as the fine detail, and it tries the card at more sizes and positions in the frame instead of only dead center, so a card sitting a little off-center still matches. On your exact Ink Drop photo the blue design now scores as the clear best match, with the gold design behind it.
- The Ink Drop counters and the other puzzle inserts now jump to the front of the scanner index build even when a build from an earlier open is still running, instead of waiting at the end of the queue.

## v1.54.2

- Ink Drop counters can be scanned now: the two Hyperia City Ink Drop counter cards are fingerprinted first when the scanner index builds instead of last, and the backup reader now knows Counter cards are real catalog items even though their printed text says the counter does not count as a card. When a scan reads an Ink Drop, you pick between the gold design and the blue design, so the exact one in your hand is the one that gets added.
- Auto capture is quicker: it fires after about half a second of a clear, steady card instead of a second or more, camera brightness shifts no longer count as movement, and one small tremor no longer restarts the wait from zero. It still will not fire on a blurry frame.

## v1.54.1

- Scanner screen fixed: the camera and the Capture button now come first, so the Capture button is always on screen when the scanner opens - no scrolling past a wall of text to reach it. The long how-it-works explanation and the on-device index status moved into a short How scanning works section under the buttons; tap it only if you want the details.

## v1.54.0

- Scanner rebuilt: matching now happens on your device. Your phone keeps a small fingerprint of every card artwork (built from the artwork already saved on the device, at no cost and with no outside service), and a scan compares your photo against all of them in about a second instead of sending it away and waiting.
- When several printings share the same artwork - reprints and promos a fingerprint cannot tell apart - you get the list and tap the exact printing in your hand. That tap is how the right printing is chosen, so a scan can no longer confidently name the wrong printing.
- The scanner shows its on-device index progress while it builds in the background. A photo the device cannot place at all (like a whole binder page) still uses the older slower reader, and the result says which one matched. Auto capture, the frozen snapshot, the 10-second stop, and search on the no-match screen all work as before. This is a first trial of the new matcher - scan some real cards and tell Jarvis how it does.

## v1.53.0

- New: Auto capture in the card scanner. Hold a card in the frame and the photo takes itself the moment the card is sharp, steady, and close enough to read - no button tap needed. The viewfinder tells you what it sees as you line up (too dark, glare, not sharp yet, hold still) and the frame turns gold, then green, as the card gets clear enough.
- Auto capture is on by default and can be switched off right above the Capture button - the manual Capture button and the photo button work exactly as before either way.

## v1.52.0

- Trades and cash purchases now settle themselves: when a deal is fully complete — both sides confirmed and both feedbacks in — the cards each side gave come out of their collection and the cards they received go in, automatically, using the deal's own agreed lists. No re-entering quantities anywhere.
- Every trade now carries a note at the very bottom: Once this trade is complete, the new quantities will be reflected in your sets — there's nothing further for you to do. Completed deals show a Settled into your sets line once their quantities have landed.
- Fixed: Back from an opened deck now returns to your deck boxes — only Back from the decks page itself returns to your profile.
- Fixed: refreshing while in your profile, Library, or My Decks no longer flashes the Home screen first — the page you were on is covered from the first frame and reloads in place.
- Admin: tapping a highlighted change now clears it immediately, in place. A new What changed panel at the top of Admin lists every change in plain words with its old and new values, and the changed tiles and roster rows carry the same readout, so the badge count maps to exactly that many readable changes.

## v1.51.0

- Swipe between tabs is gone: it worked, but Anthony did not like it, so tabs switch by tapping the bottom bar again and the slide animation went with it. The Library binder's finger-swipe page flipping is a different feature and is untouched.
- The active tab highlight in the bottom bar is now a boxier rounded rectangle instead of the in-between oval pill — same blue-purple glow, new shape.
- Fixed: tapping the empty space on the My Decks page no longer throws you back to your profile. Only the deck boxes and the real Back and Close buttons navigate now.
- The Library shelf on profiles is centered by construction now — its middle sits exactly halfway between your profile picture's edge and the deck box icon's edge, worked out by the layout itself instead of by nudges.
- Scanner: identification now has a hard 10-second stop — it can never spin for half a minute again — and when it stops it lands on the no-match screen with the catalog search right there. The reader now also understands promo collector lines like 20/C2.

## v1.50.0

- The daily catalog audit now shows its last run in Settings under Your data and backups - when it ran and how many printings it added.
- Promo tiles now carry the same progress bar with owned counts as the chapter tiles, and their Cost to complete uses real promo prices - families with no tracked prices say so instead of showing zero dollars.
- The Hyperia City Ink Drop counter cards are in the catalog and sit in the Puzzle section at the very end of the Hyperia City list.
- Refreshing on your own profile now reloads your profile in place - no more disappearing to Home and back.
- Every dropdown in the app has one clean modern look now - dark, rounded, with a check mark on the current choice - instead of the old grey system menus.
- Slab labels: the white box around the 9.8 is now an equal square like the real CGC labels, and White Pages no longer sits under the grade on Universal slabs.
- The Library shelf on profiles was nudged right so it sits truly centered between your photo and the deck box.
- Your Village Aggro deck is built and on display in My Decks: all 60 cards from your collection, with its value taken from your own inventory, and every copy in the deck marked in Where it lives as living in the Village Aggro deck box.
- Refreshing while you are in My Decks or your Library now reloads that page in place instead of bouncing you to Home.

## v1.49.0

- The card catalog is now complete: a full audit against every Lorcana card ever released added 40 missing promo printings, each with its real artwork, so every one can be scanned, searched by name and number, and added to your collection.
- Challenge C2 now runs all the way to number 20, including Minnie Mouse - Amethyst Champion 20/C2, the card that started the audit. Searching Minnie 20 finds her.
- Two whole promo families are new: Challenge Series 3 (C3, 17 cards including the serialized Hades - Dark Usurper prize printings) and the Beauty and the Beast Curator's Collection (CC2, 6 cards). Also filled in: the serialized Mickey Mouse - Brave Little Tailor 5/C1, Baymax - Lab Assistant 5/DIS and Creative Inspiration 19/DIS, Mickey Mouse - True Friend 15/P2, Elsa - Queen Regent 16/P2, Anna - Braving the Storm 17/P2, and Donald Duck - Taxi Driver 1/P4.
- A catalog audit now runs every day on its own: when a new set or promo printing is released and published by the card databases, it is added to the catalog automatically. Your existing cards, ownership counts, and prices are never touched by it.

## v1.48.1

- Fixed: the Collector ID card at the top of Home could get stuck on Generating when its saved profile photo could not be read back from storage. A photo or banner whose stored copy is missing now simply shows the plain initial-letter card instead of failing, and card artwork whose stored copy is missing is fetched fresh again rather than erroring.

## v1.48.0

- Scan a card, rebuilt for speed and accuracy, and this was the top-priority fix. Taking a photo now freezes the snapshot on screen with a shutter flash, so you can see the exact photo being identified, and Identifying shows a live timer and what stage it is on instead of a silent pause. If a scan runs long you can cancel it, and at 45 seconds the wait stops on its own with your photo kept and Try again and Retake options. Matching is stricter now: a card is only named for sure when the title, number, set, ink color and cost read from the photo agree — when a read could be more than one printing, you pick the right one from the candidates instead of being handed a wrong card, and every certain match shows what was actually read from your photo so a misread is easy to spot. A card outline in the viewfinder helps fit one card in the frame, and scanning another card now keeps the camera live instead of going black.

## v1.47.0

- New: copy a deck. Open a deck box on another collector profile and tap Copy to My Decks and check my collection: the deck lands in your My Decks marked Copied from that collector, and you get a check against your own collection — you have X of the deck, you need Y more — with a card-by-card breakdown, a buy list of just the missing copies, and what they would cost at current prices. On the buy list, Send buy list to my Muse (or Send on a single card) hands your own Muse the exact missing cards to build a TCGplayer cart under your sign-in; Vault X never buys anything itself and final payment approval stays with you. Your own decks get the same collection check from their deck page.

## v1.46.0

- Price alerts now have their own page: tap the Price alerts heading at the bottom of any card, sealed product, or graded comic and you get every alert you have set, all in one list, each with its picture, its current price, and the price you are watching for. You can edit any alert right there (change it to at or below or at or above a new price) or delete it, and Back takes you straight back to the item you came from. Graded comics can have price alerts now too, set from the Performance tab on a comic page, and a triggered comic alert banner on Home takes you to your comics.

## v1.45.3

- The Comics shelf sign in the Library got the comic-book treatment: Comics now sits on a deep-blue halftone-dot plaque in bold yellow block lettering with a black outline and a red offset shadow, tilted like a classic comic masthead. The Lorcana wordmark signs and the Promos sticker sign are unchanged.

## v1.45.2

- Refreshing on the Admin page now reloads Admin in place: refresh while Admin is open, or while the Registered Collectors page is open on top of it, and you land right back on that same page with everything as it was, instead of being thrown back to Home.

## v1.45.1

- Admin opens fast now: tapping the Admin badge shows the page right away with your last-known numbers, labeled with the time they were computed, while the fresh numbers load in the background and swap in when they land. The heavy server work behind Admin also runs in parallel now, so the refresh itself finishes much sooner too.

## v1.45.0

- Admin: the Registered collectors tile now opens its own full page — one detailed row per collector with their username, Collector ID, Trust Score, items collected, confirmed connections, and the date they joined, all live from the server. Anything the registry does not track is labeled as such instead of guessed. Back from that page — its Back button or the phone back gesture — always returns to Admin, never out of the app.

## v1.44.0

- All card artwork now saves to your device up front: after the welcome tour, a background pass downloads every card picture — your own collection first, then the whole catalog set by set — so browsing never waits for images to load. It never blocks the app, and Settings under Your data and backups shows exactly how many images are saved on this device. When an update brings new or refreshed artwork, the new copies save on their own and replace the old ones.

## v1.43.5

- The three Illumineer's Quest tiles — Deep Trouble, Palace Heist, and The Great Hunny Rescue — now carry the same rich, edge-to-edge key art as the premium chapter tiles like Hyperia City and Attack of the Vine!: Ursula with her trident and eels for Deep Trouble, Jafar wearing the Reforged Crown for Palace Heist, and Winnie the Pooh the Hunny Archmage with his friends in the Vine for The Great Hunny Rescue, all from the official high-resolution quest artwork. Tile size, names, and progress lines are unchanged, and the quest box art still shows on the quest pages themselves.

## v1.43.4

- Your Inbox now marks anything you have not opened yet with a bright blue NEW badge right next to its subject, so read and unread are easy to tell apart. Opening a message clears its badge the moment you open it, even if you have not answered yet — the Pending label stays exactly as it is until the order, trade, or ticket actually finishes. The number on the mail icon on Home now matches the number of NEW badges in your Inbox, and a new reply in a thread you already read makes it NEW again.
- Share Vault X in Settings has moved: it now sits directly underneath Send a change request, with nothing between them. The share sheet, the Muse-first note, and your saved Muse invite link all work exactly as before — only its spot in Settings changed.

## v1.43.3

- New in Settings, right under About this app: Share Vault X. Paste your own Muse invite link once (find it in the Muse app, under the Invite button) and it is saved; the Share button then opens the share sheet with a ready-made invite that starts by telling your friend they need the Muse app first, includes your invite link so the sign-up is credited to you, and walks them through getting the install file from you and the quick first-open tour. No link saved yet? Share asks you to paste it first instead of sending an invite without it, and if there is no share sheet the message is copied instead
- Bottom menu fix: going into Comics (or Lego) no longer adds an extra Comics tab to the bottom bar. The bar is now the same five tabs — Home, Search, Social, Portfolio, Settings — in the same order, in every section of the app

## v1.43.2

- Comics slabs rebuilt to look like real graded cases: the CGC label is now a slim band across the top of every slab — about a tenth of its height, the way a real holder runs — with all the same label information (grade 9.8, the signed line, WHITE Pages, cert number, credits) set in compact small print, and the cases themselves now wear the clear rigid acrylic look of the sealed cases: beveled edges, molded seams, and realistic light and reflections down the thick case walls. It applies everywhere the slab shows, including the Library comics binder pages

## v1.43.1

- Card alignment fixed in collection grids: the split buttons already lined up, and now the cards do too — every tile artwork starts at the exact same top height in its row (the taller tile no longer pushes its neighbours card down), with the buttons still pinned to their shared baseline
- The Zelle mark is toned down as you asked: no more solid purple square — it is now an outlined line-art Z in the same neutral style as the cash icon beside it, everywhere it appears (the cash segment of the split button and the Pay the seller line on an order)

## v1.43.0

- Admin change notifications: when any Admin number changes — a new collector registers, item counts climb, ticket counts move — the Admin shield on Home gets a blue count badge on its upper right, like the mail marker. Inside the Admin page, every item that changed glows translucent blue until you tap that item to clear it; just opening the page clears nothing, and the Home badge clears when the last changed item is tapped
- Library binder background fixed: opening a set binder now shows ALL of that set sealed products you own behind the binder — for Hyperia City that is the Booster Box, the Prerelease Box and the Booster Pack together — and their black studio backdrop is washed out, so only the acrylic-cased items float in the scene with no black rectangles
- Floating scroll arrows faded further, just as you asked: they are still there on both edges, same size and behavior, but barely visible now — a faint ghost until you look for them

## v1.42.4

- The standalone Sealed tab is gone from the bottom menu — the bar now runs Home, Search, Social, Portfolio, Settings, and tab swipes follow that same order. No sealed items or data were removed
- Set pages are reordered the way you asked: each set opens with its sealed products at the very top, then its cards, and the puzzle pieces and Full Puzzle Art now sit at the very, very bottom of the page

## v1.42.3

- Comics slabs: The Mandalorian #4 grade sits a little lower now, just as you asked, with nothing else on that slab changed
- Aliens #1 and Batman #136: their gold Signature Series label bands are condensed further toward real slab proportions, with smaller type, grade box, barcode and hologram, and Aliens gets a stronger case bevel, seams and acrylic-style light streaks on its case walls
- Slab turn view: comics now show real slab thickness as they turn — a thick molded clear edge and case back, so the slab reads as a rigid case turning in 3D instead of a flat card

## v1.42.2

- Library graded comics binder: each page now shows the rendered slab from the Comics section — the slab with the label band on top carrying the grade, title, cert and all label info over the real cover art — instead of the raw photo originally submitted for that comic. The binder open and flip animations are unchanged, and tapping a slab still opens its full page

## v1.42.1

- Library flip-through binders: pages now lay out 4 pockets across by 3 down — still 12 pockets per page, matching your physical Vault X binders. The cover open animation and finger-swipe page flipping are unchanged

## v1.42.0

- Hyperia City: the two Ink Drop counter cards are now in the binder — find both designs at the end of the set's Puzzle section, after the Full Puzzle Art, each with its real counter-card artwork. They start ghosted like any missing piece; tap one and use the count stepper to add the copies you own

## v1.41.4

- Library: the Lorcana shelf signs now wear the real Lorcana look — serif display lettering in gold, like the Disney Lorcana wordmark — and the Illumineer's Quest naming in the Library gets the same gold serif treatment, on the Quest shelf sign and on the Quest binder names (Deep Trouble, Palace Heist, The Great Hunny Rescue). Signs keep their size and place, and the promo artwork and icons are untouched

## v1.41.3

- Fixed: every Illumineer's Trove photo in Sealed had traces of its white studio backdrop baked into the picture — a white strip or halo around the box, and on Winterspell a white shadow puddle under it. All 14 Trove photos are cleaned down to the bare box, so the moment you mark one owned it shows as a clean cut-out in its acrylic case, exactly like the Quest boxes, with no white or ghostly border. Nothing else in Sealed changed

## v1.41.2

- Fixed: the Shimmering Skies and Ursula's Return chapter artwork now matches the rest of the Lorcana chapters — clean logo artwork on its own, like every other chapter tile, instead of the full banner pictures those two carried

## v1.41.1

- Fixed: the Admin shield badge on Home now appears right away, together with your Collector ID. It used to wait on the full app statistics loading from the server — the slowest check in the app — before it could show. The badge now uses the quick identity check, and the full statistics only load when you actually open Admin

## v1.41.0

- The graded comics get the flip-binder too: opening the Comics book in your Library lays the slab binder open on the table, one graded slab per page — flip through them and tap a slab to open its full page
- Chapter tiles show their completion again, in order: set name, a progress bar with how many of the set you own, then the cost to complete below it
- Chapter tile artwork gets a richer premium finish — a soft glow in each set's color and a gloss sweep — and the D23 and Illumineer's Quest tiles now present their art at the same clean size as the other tiles instead of blown up or cropped

## v1.40.0

- New: flip-through binders in the Library. Open any Lorcana binder spine and you are looking down at your own binder lying open on a table — the cover, carrying the set's artwork and name, swings open to pocket pages you flip through, with the page number and your pocket count at the top. Regular and foil sit side by side (regular first), owned cards in full color, missing cards ghosted with their real art, owned foils shimmering — and tap any card to open it. If you own that set's Illumineer's Trove or booster box, they stand on the table behind your binder too
- Library: the shelves are families now — shelf one is the Lorcana chapter binders, chapters 1 through 14 under a Lorcana sign; every promo binder stands together on the next shelf under Lorcana Promos, with Promos as a playful sticker; the Quest binders get their own shelf under those
- My Decks: every deck on display is now its own deck box, cartridge-style — its name embossed across the top, a tidy border around the front window, and one featured card showing in it. Pick the box's color and its featured card in the deck builder (until you pick, the window shows the deck's most valuable card). Tap a closed box and it opens — lid flips up, deck inside — then its page shows every card and how many copies
- Admin: the Registered collectors tile is tappable now — tap it to open the list of every registered collector's username, with test accounts labeled
- Profile: the little Library shelf is centered on the measured middle between your profile photo and the deck-box icon, and nudged down a touch — no change to its size, and the header spacing you approved is untouched

## v1.39.0

- Fixed: Update now actually updates. It used to bounce you back to Home still on the old version — the reload could be answered from the phone's saved copy. Now the update step fetches the new version and restarts onto it for real, and you will see an Updating note while it works
- Fixed: refreshing on the Library page reloads the Library right where you are — it no longer throws you back to Home
- Library: shelves are organized by universe now. All fourteen Lorcana chapters stand together on the first shelf, filled as full as it goes, and every shelf wears a little sign naming its universe — Lorcana, Comics, and any others as they arrive. Books slim down on a crowded shelf so everything fits
- My Decks: the deck box photo is gone. Your deck box is now yours to create — pick its color, type in a custom name, and it is drawn right there on its shelf with your name on the front, like the chapters on the Library page
- My Decks: your decks on display now stand as books on shelves below the deck box, Library-style — tap one to open its card list
- Profile: the stretch between your name and badges and your bio is tightened up, so the whole header reads as one block — the Library shelf stays dropped under your Value and Collected stats, just with less empty air

## v1.38.0

- Profile: the little Library shelf of books now sits underneath your Value and Collected stats — centered under those two — and dropped down a few lines from where it sat before
- New: value privacy. You can hide your total collection value from other collectors: use the switch in Settings under Sharing, or the little eye button right above the value figure on your own profile. Both places control the same setting and always agree, and you always see your own value
- Home: the little eye button next to Your Collections opens its own window with the same collection switches as Settings — show or hide the Home tiles right there, without going to Settings
- Owner only: an Admin shield badge now sits at the far left of Home's top row, on the same line as the mailbox icons. Nobody else ever sees it
- Admin rebuilt: tapping the Home shield opens a brand-new Admin window (not Settings) with a rebuilt analytics-style dashboard — headline numbers up top, an items-by-kind ring chart, collector growth line and bar charts, tidy tables of collectors and most-owned items, trades and cash orders, tickets by status, and storage against the Supabase free plan. The same rebuilt dashboard now fills the Admin section in Settings too. Real server numbers only, with test profiles labeled

## v1.37.4

- Profile: the little Library shelf of books is now properly centered — the whole picture (the books, the shelf they stand on, and the Library label) is sized to the books and centered as one piece across the full space under your Value, Collected, and Trust Score stats, instead of sitting off to the left in part of that space. The deck-box icon stays at the right edge, and crowded shelves use slightly slimmer books so the picture stays clear of it

## v1.37.3

- Removed: the Dummy Friend test profile is deleted from the app entirely — its profile, its little collection, and its entry in Friends are gone, and it no longer figures in any Admin counts. Only you and Jarvis remain

## v1.37.2

- Fixed: the Great Hunny Rescue sealed photo is restored — the box standing in its clear acrylic display case on its black stand, the look that was approved, with no white or ghostly border around the photo
- Profile: your @handle now sits right below your profile photo, and your bio sits one space below the handle
- Profile: the little Library shelf picture nudged down and to the right a touch, so it sits centered in its space under your stats

## v1.37.1

- Profile: the deck-box icon moved all the way over to the right — it now sits at the edge of the profile, lined up with everything else on the page, instead of centered under the Trust Score

## v1.37.0

- Page changes glide even more smoothly now — switching tabs (by swipe or by tapping the menu) drifts in over a longer, softer motion instead of sliding quickly
- The floating up and down scroll arrows are properly translucent now — a thin see-through frost, so the page ghosts through them as they float
- Chapter icons cleaned up: the first three sets (The First Chapter, Rise of the Floodborn, Into the Inklands) got genuinely higher-resolution official logos, and every chapter tile's artwork now stretches to fill its tile edge to edge — no more pasted-photo look, no dead band at the bottom of the tile
- Library: the binder info panel at the very bottom of the screen is gone. Tapping a spine now pops a small floating window in beside your tap — below it, or above it when that's what's clear, so your thumb never covers it — with the binder's name, chapter, and what you hold there
- The little shelf of books on your profile is centered properly now
- Profile: your handle (like @aruikis) moved down below your bio with more breathing room, centered under your profile photo
- Sealed count picker: the phone's back button now closes the 1-through-9 picker without saving, just like tapping elsewhere does

## v1.36.0

- New: the Library. Your profile now carries a little shelf under your stats — thin binders in Vault X colors, one book for every chapter you own at least one card in (no book for a chapter you have none of). It fills the last empty spot in the profile header, on every profile — yours and your friends' alike
- Tap the little shelf and your Library page opens: your whole shelf, one numbered spine per binder — every set, the promos, the Quests, and your graded comics — with the binders you have nothing in standing faded
- In the Library, light-tap a spine to peek at whose binder it is and which chapter, and see how much of it you hold. Press and hold a spine (or tap Open this binder in the preview) to open that binder itself — from your own profile it takes you straight into that section of your binder

## v1.35.3

- Profiles condensed: the huge empty stretches on profile pages are gone. The deck-box icon now sits right under the Trust Score inside the photo's own row, so the @handle follows directly under the photo instead of a whole empty row later — on every profile
- Your name and your achievement flags now sit together on the TOP line of your profile, up with the back button — not down at the lower right of your photo anymore. That goes for every profile: yours, your friends', Jarvis's, everyone's
- Fixed: the Great Hunny Rescue sealed photo no longer carries a white border. The photo is now just the box itself, cropped clean, sitting in the same acrylic case as the other Quest boxes — the case look you approved is unchanged

## v1.35.2

- Fixed: Search now takes over the whole screen. Swiping or tapping from Home to Search used to leave Home visible behind and around the search field — Search is now its own full page on a solid background, and Home does not show through anywhere
- Smoother page changes: moving between tabs — by swipe or by tapping the bottom menu — now glides in over about half a second with a soft slide and crossfade, instead of the quick sharp cut from before. Coming back from Search fades in gently the same way

## v1.35.1

- Swiping between tabs is animated now: the tab you swipe to slides in from the direction you swiped, with a quick crossfade as the old tab leaves — smooth and fast, no instant cut. It works through the whole bottom menu in both directions: swipe left for the next tab, right for the one before

## v1.35.0

- New: swipe between tabs. On the main screens, swipe left or right anywhere on the page to move to the next tab in the bottom menu's order — Home, Search, Sealed, Social, Portfolio, Settings — so from Home one swipe left lands you on Search without reaching down for the menu. Swiping right from Search closes it back to the screen underneath. It only fires on a clear sideways swipe, so normal scrolling up and down works exactly as before, and it stays out of the way while a card, window, or the scanner is open
- Fixed: the count dial on the Sealed shelf now shows the full 1 through 9. The shelf tiles are narrow and were cutting the dial off at 4 — it now opens as a full-width panel floating above the tile, so every number is reachable, same as on card pages
- Count dial: if you open it by accident, tapping anywhere else on the screen now closes it without changing the count — and that tap does nothing else, it just closes the dial. Works everywhere the dial appears: Sealed shelf, card pages, sealed and comic pages

## v1.34.1

- Fixed: the sideways count dial now opens ABOVE the + button instead of below it — holding the button no longer covers the dial with your thumb. That goes everywhere the dial appears: card finishes, the Copies owned bar on card, sealed, and comic pages, and the Sealed shelf tiles
- Settings: every section heading now carries its quick-jump symbol right beside it — the swatch next to Theme, the shield next to Admin, and so on — so the icons at the top and the sections they jump to read as the same thing

## v1.34.0

- Mail fixed: tapping a message in your Inbox now opens that message on its own page — Subject and who it's from up top, the order with its invoice, and its message thread with the reply box — and the X at the top takes you back to the Inbox list. It no longer throws you into Social to find it
- The Home mail icon now carries the same unread count as your Inbox, badge on the left of the envelope — no more arriving mail with no sign of it
- New: delete messages from your Inbox. The trash on a message (in the list, or next to the X on the message itself) removes it from YOUR Inbox only, after one confirm tap — the purchase order or trade itself is not cancelled or changed, the other person keeps their copy, and if they message in that order again the item comes back with the new message
- New: build your own decks. Open My Decks from your profile and tap Create a deck — name it, add cards from your own collection (up to the copies you own, at most 4 copies of any one card name, 60 cards to a deck), save it, and flip its On display switch to show it on your My Decks page where visitors can open its card list. Copies sitting in your decks count toward the decks hold-back in Trade availability
- New: a Welcome page for new collectors. On first open it introduces Vault X with the ring artwork pulling into focus, a new user registers their username right there (checked against the network so no two collectors share a name) and gets their Collector ID, and then the tour walks them through the whole app step by step — no skipping — before Home. Established collectors see it once and can dismiss it; anyone can see it again from Settings, About this app
- Count steppers: holding the + button now opens a sideways dial — 1 through 9 in a row — and tapping a number makes that the count, saved right away, no tapping nine times. It works on card pages, sealed pages, comics, and the Sealed shelf tiles too (the Illumineer's Quest Deep Trove long-hold that did nothing is fixed)
- Home tiles: Settings gains a Your Collections section with a switch for each of the six tiles — turn off the ones you don't collect and they disappear from Home while the rest reflow, still centered three across. Display only: nothing is deleted, no totals change, and you can bring a tile back any time
- The floating scroll arrows are translucent now — a quiet frost instead of solid buttons — and a set floats on BOTH edges of long pages, so either thumb can reach them
- Cleaned up: the Illumineer's Quest: The Great Hunny Rescue photo now sits in the same clear acrylic display case as the rest of the Sealed shelf
- Search: the heavy ghost pattern while the keyboard rises is fixed — opening the keyboard on the search field is one clean, stable motion, and it keeps the speed from the last fix

## v1.33.0

- New: your personal Inbox. The mail icon beside your name on Home opens it - every purchase order and trade offer involving you in one mail-style list, each with its Subject, who its From, the date, and a preview, unread ones marked. Opening one takes you straight to that order with its message thread open. Replies to your orders land here now, never silently inside Trades
- Owners Inbox: your change-request tickets land in the Inbox too, titled by their type - Change Request, Bug, or Idea - with who sent them. Opening one opens that ticket. Tickets still work exactly as before in their own window
- Opened orders now carry a mail-style header at the top: Subject: Purchase Order or Subject: Trade Offer, and From: the sender's name - above the invoice and the thread
- Send a change request: the type pick is now just Bug or Idea - the generic Change Request type is gone
- Fixed: the floating scroll arrows now actually appear on long pages - the Hyperia City set view, Settings, and everywhere else long. The first version measured the wrong thing and concluded no page was ever long, so they never showed
- New: Puzzle sections in the binder. Open a set and scroll past its cards: the set's puzzle or lore insert cards are there as their own pockets - every piece numbered (like 2 of 4), ghosted when you don't have it, ownable with the usual steppers - plus a Full Puzzle Art item for the assembled picture. Rise of the Floodborn's Full Puzzle Art shows the completed Minnie Mouse puzzle photo
- Puzzle counts, verified from listings and the Lorcana wiki: First Chapter 4, Rise of the Floodborn 4, Ursula's Return 9, Shimmering Skies 4, Azurite Sea 6, Archazia's Island 20 lore cards, Reign of Jafar 19 lore cards, Fabled 9, Whispers in the Well 18 lore cards, Winterspell 18 lore cards, Wilds Unknown 9, Hyperia City 9. Into the Inklands had rules cards instead of a puzzle, and Attack of the Vine! is not added yet - no verified piece count for it

## v1.32.0

- Zelle for cash purchases: save your Zelle handle once in Settings under Payment info. When you sell a card for cash, the buyer sees a Pay the seller line inside that purchase order - your handle with a Copy button - so they can pay you from their own bank app. It never appears on your profile
- The green cash side of the split button now pairs the cash icon with the Zelle mark, so the buy-outright side reads as cash / Zelle
- Order mail: when the other side replies inside one of your trade or purchase orders, you now get a mail indicator - beside your name on Home, on the Trades entry, and on the order itself with the number of new messages. Opening the thread clears it
- Purchase orders cleaned up to match the checkout invoice: who its with, the date, and the status up top, the card as an aligned line item, and a tidy totals block with the offer total next to the TCG suggested price
- Friend profiles tightened up: the stretch between the Friends / Trades / Marketplace / Forums bar and the Collection / Trade Match tabs is condensed - same content, less empty space
- Search smoothness: the page now rises in step with your keyboard instead of stuttering behind it

## v1.31.0

- New: a message with your order, right in the checkout - below the Send and Cancel buttons on the cash checkout there is now a Message with this order box. Write it before you send (need it tonight by 9? say so), hit Send purchase order, and the message travels with the order: the seller sees it right with the purchase and can answer in the same thread on that purchase. The trade checkout has the same box below its Send and Cancel buttons
- Order messages follow the same rules as trade messages: text only, no photos, no links - and the red note stays at the bottom: Vault X does not send push notifications, so you only see new messages when you open the app
- Search: the search window now sits low on the screen, about a quarter of the way up from the bottom, right in thumb reach - still centered side to side, and the keyboard still stays closed until you tap the field
- Friend profiles: the name strip - their name, badge, and achievement flags - now sits directly underneath the Trades tab at the top of Social. The rest of the profile is unchanged, deck-box icon included
- Home cleaned up: the note at the very bottom of Home - the one explaining the two pockets for every card number - now sits in a bordered window with a Hide button, like the other intro windows. The wording is unchanged
- Portfolio cleaned up: everything under the Portfolio title - the As of line, your collection total, total paid, gain/loss, items, and averages - is now tidied into one bordered window with neat aligned rows instead of loose text. The tabs and charts below are unchanged

## v1.30.0

- Change requests are tickets now: sending one from Settings opens a ticket, and you can follow it right there under Your tickets - its status (Open, In Progress, or Completed) and who it is assigned to
- The red envelope on Home is now just the envelope itself - no red circle or fill around it - sitting right next to your profile picture and name, with its count badge on the left side. Tapping it opens the ticket list in its own window, not the Settings page
- Fixed: Cancel this purchase on the cash checkout now cancels everything - the whole cart clears, every chosen quantity goes back to zero, and the checkout bar is gone. Cancel this trade does the same for the trade cart
- Fixed: the shield shortcut icon in Settings no longer flickers. It was the only jump icon that waited on data to exist, and its hold-on memory reset every time Settings closed, so it vanished until the slowest stats call returned and the row reshuffled. It now renders immediately like every other icon; the Admin section it points to stays owner-only
- Portfolio: the Portfolio title now sits in a clean bordered window like the other section headers
- Profiles: the collector name now sits on the same line as the deck-box icon, centered with it, instead of on its own line below the picture - and the deck-box icon border is toned down to a soft ring (the icon itself has not moved)

## v1.29.0

- The red envelope test, end to end: the TEST envelope sits on Home to the left of your name and photo, and tapping it takes you straight to your change-request inbox — the email-style inbox where requests list like emails with sender, kind, and date, unread ones bold with a red dot, and opening one reads like opening an email. A test message from Jarvis waits in the inbox; open it and tap Got it to finish the test
- Search: the keyboard no longer pops up on its own when you open Search — it stays closed until you tap the search field yourself
- Sealed: the intro (Your sealed Lorcana, kept mint in acrylic) now sits in a clean bordered window with a Hide button, like How trading works — hidden, it folds down to just the Sealed title with a Show button to bring it back, and your choice is remembered. The shelf and the Owned / All available switch are unchanged
- Social: the intro under Social gets the same bordered hideable window, and the Friends area below it is now tidied inside its own border as well — same friends, same everything, just cleaner

## v1.28.1

- Fixed: the red envelope on Home now has a one-time test, just like the Update available note — it shows marked TEST even when no change request is waiting, so you can try it. Tap it and it takes you to your change-request inbox, where a test message from Jarvis waits: open it like an email and tap Got it to finish the test, and the test envelope is gone for good. Real change requests still bring the envelope back, with their real count

## v1.28.0

- Fixed for real this time: Mickey Mouse - Brave Little Tailor now shows its price in the cash checkout - $18.43 - and the TCG suggested total adds up (the three test cards total $21.53). The checkout was only reading prices the daily re-pricing had saved to the database, and that save never landed for this card; prices now fall back to the app's Lorcast price snapshot whenever the database has none, on the checkout, on a friend's profile, and in trade totals alike
- New on the cash checkout: a red Cancel this purchase button sits next to Send purchase order - the red counterpart of that green. Tap it and you back out of the checkout; nothing is sent and no order is created
- New on the trade checkout: the same red treatment - Cancel this trade next to Send proposal, backing you out without sending anything

## v1.27.0

- New in Sealed: the sealed catalog is complete — every gift set (7, including the Stitch Collector's Gift Set and the new Hyperia City Beast gift box), every starter deck (21 decks for sets 1 to 10, plus the 2-Player Starter Sets for Wilds Unknown and Hyperia City — Winterspell and Attack of the Vine! never released starter decks), and the Lorcana Gateway learn-to-play box. All priced from TCGplayer, all starting at Owned ×0, and the Type filter now includes Gift sets, Starter decks, and Gateway
- Set pages: a set's sealed products now sit together at the very bottom of its page, after the last card — owned ones in full color, the rest ghosted like missing cards — and tapping one opens the sealed item to add your copy
- Fixed: products you don't own yet on the Sealed shelf (All available) are now truly ghostly — the same washed-out, translucent treatment as missing binder cards. The display case's shine was covering the ghost effect before
- The Sealed Type and Sort menus are redone in the app's own style — dark, rounded, blue-purple — instead of the phone's plain popup menu
- New on item pages: hold the + button on a card finish or a sealed item and a scrollable counter opens — pick how many copies you have and it sets the count and saves automatically, no tapping one by one
- New: ghost scroll arrows on long pages — a translucent down arrow floats at the right edge and rides to the bottom of the page, and an up arrow brings you back to the top. Settings has them too
- Profile tidy-up: the decks entry under the Trust Score is now a line-drawn deck of cards inside a thick-bordered circle, drawn like the Settings icons and colored by your theme, centered under the Trust Score
- Settings reshaped: About this app is the first section, the jump icons spread evenly across the full width, Send a change request sits near the top, and App updates moved to the very bottom of the page
- About this app: the Vault X name and version line now sits at the very top of the section
- Admin: the statistics are refined — bar charts for new collectors and new trades over the last 14 days, plus tiles for trades proposed, accepted, and completed, cash purchases, marketplace listings, and change requests waiting
- Owner only: when change requests are waiting, a little red envelope appears on Home to the left of your name and picture — tap it to jump straight to the Admin inbox
- Fixed: the Admin shortcut icon in Settings no longer flickers on and off
- Change requests are now an email-style inbox for the owner: requests list like messages with sender, type, date, and a preview, unread ones bold with a red dot, and opening one shows it like an opened email and marks it read

## v1.26.0

- The update view is now final: it stands on its own as App updates — nothing but the update, its changelog, and two buttons at the very bottom, Update now and Update at a later time. No separate Finish step: picking either button completes the walkthrough, and backing out leaves it for next time. The one-time Test note on Home is armed again so you can retest this version
- Fixed: refreshing the app now keeps you exactly where you are — a set view reopens on that set, an open card or sealed item reopens, your own profile page reopens, and a friend's profile reopens — instead of bouncing you back to a list or to Home
- Checkout page cleaned up: it is now the Checkout heading and the checkout itself — the trades list and the small duplicate checkout label that sat under the big title are gone. The heading and its tagline sit in a window like How trading works, with a Hide button that folds it to its title row
- Fixed: a cash checkout now shows only the cash invoice — the trade proposal panel no longer appears on a cash checkout by mistake, and the trade and cash flows stay separate
- Fixed: a card with no tracked price no longer blocks a purchase order. The yellow note is information only now — you can still send, since your offer total covers the whole order — and you can remove that card right on the checkout and send the rest
- The explanation paragraph at the top of Trades is removed — it repeated the How trading works window, which stays as the one explanation, the one you can hide
- Home: the Collection value moved onto the same line as Your Collections, offset to the right, and the per-collection breakdown lines under the total are deleted — Home now shows just the label and the grand total
- Fixed: going Back from My Decks now returns to the profile you came from, instead of landing on the Collector ID page. The My Decks entry on profiles is also smaller now: a round icon of your deck box, like an app icon, with no words on it, sitting under the Trust Score
- Settings is rearranged most-used first — App updates and change requests, Theme, and Sharing up top, Trade Availability further down — and a centered row of small icons under the Settings heading jumps you straight to each section
- Sealed shelf: new Owned and All available switch — Owned is your vault; All available shows the whole catalog, with the products you do not own yet faded like ghost cards so you can find and add them. There is also sorting by value, name, set, or date added, and a filter for Boxes, Packs, Quests, and Troves
- New in Sealed: an Illumineer's Trove for every set — all fourteen, from The First Chapter through Hyperia City — each priced from TCGplayer and starting at Owned ×0 until you add your own

## v1.25.0

- Fixed: refreshing the app while you are standing on the checkout page now keeps you right there, cart intact, instead of throwing you back to the friend's profile
- Fixed: Mickey Mouse - Brave Little Tailor now carries its real current TCGplayer price, so cash cart totals and the TCG suggested total add up for real — Jarvis's three test cards now total $21.53 together
- Fixed: a purchase order offered at $0.00 — a gift between friends — now sends like any other amount
- The Send purchase order button is now the brighter green, matching the checkout bar, so it stands out
- Cash checkout is now laid out like a clean invoice: one line per card with its quantity, price each, and line total, then the TCG suggested total and your offer total set apart at the bottom
- The trade checkout shows the same invoice-style totals for both sides, with the value difference between what you give and what you get
- Trade availability now lives only in Settings — it no longer appears in Trades or on the checkout page
- The How trading works section in Trades now has a Hide button: it collapses to its title row with a Show button, and your choice is remembered
- Sharing in Settings is now one switch per connected friend, each on by default: when sharing is on, that friend can see your collection — turn it off per friend if you don't want them to
- Tapping the Update available note on Home now opens the update view on its own instead of taking you to the Settings page: it shows the changelog with two choices, Update and Don't update at this time, and you can back out without deciding. The one-time Test note is armed again so you can run the corrected walkthrough
- Deleted: the pockets-filled collection header is gone from everywhere in the app — binder, set pages, everywhere it still showed. If you want it back, just say so
- New in Sealed: the first two Quest boxes are selectable catalog items too — Illumineer's Quest: Deep Trouble and Illumineer's Quest: Palace Heist, priced from TCGplayer, each starting at Owned ×0
- Every Illumineer's Quest set page in the binder now shows its sealed box at the top — tap it to open the sealed item and set how many unopened boxes you own
- New in Settings, right under App updates: Send a change request — pick Change request, Bug, or Idea, write your message, and it goes straight to the developer with your username and Collector ID on it
- Your Vault X username now shows as ARuikis — capital A, capital R, then lowercase — on your Collector ID and profile

## v1.24.0

- New: messages inside trades — every trade and cash purchase in the Trades area now carries its own private message thread between the two collectors on that deal, for working out the swap and the meetup. There are no direct messages anywhere else in the app, no friends-list chat and no group chat
- Trade messages are text only — no photos or attachments — and links are not allowed: a message with a link in it will not send until the link is removed. A thread closes to new messages when the deal ends, and the messages stay on the deal's record
- At the bottom of every trade thread, in red: Vault X doesn't send push notifications — you'll only see new messages when you open the app
- Trade Availability is now pick-and-mix: Keep one of each for the master set and Cards dedicated to my decks are two separate hold-backs you can switch on together, and both pools stay protected from trading. Everything I own and Nothing for now each stand alone
- Social now reads Friends, Trades, Marketplace, Forums — Trades moved up next to Friends
- The I want this split button is much slimmer now — same blue trade side and green cash side, squeezed down tight, then raised a touch (15 percent) from the tightest squeeze so it sits just right
- New: the moment you add a card to a cart on a friend's profile, a bright green checkout bar appears above the bottom menu and stays while you keep browsing — it shows your carts and the cash running total. Its Checkout button opens a full checkout page of its own, and the green bar is gone while you are on it
- Cash checkout now prices every card at its current-day TCGplayer value, and you can change the total before you send — the person receiving it sees your offered total right next to the TCG suggested market price, so they can check the offer before they accept
- New: the app checks for updates on its own when you open it — when a newer version is live, a yellow Update available note appears on Home, to the left of your username. Tap it to read what changed and choose to update; nothing ever updates by itself. This version also carries a one-time test of that note, marked Test — tap it to walk through the whole update flow the way another collector would, and it goes away once you finish
- Cash offers can be $0 — give a friend the cards as a gift. They still see the TCG suggested market price right next to the $0, so they know the value being handed over before they accept
- Sharing moved into Settings and is on by default: connected friends can see your collection unless you turn sharing off in Settings, under Sharing
- Scan a card: if a scan matches the wrong card — or no card at all — the results screen now carries a search: type the name, or the name and its number, pick the right printing, and add it from there. Matching is stricter too: when the collector number is readable, only that exact printing can match

## v1.23.0

- New in Sealed: Illumineer's Quest: The Great Hunny Rescue is now a selectable catalog item — find it on the Sealed shelf, open it for its price chart and Best Offer, and tap the plus stepper to add your own sealed copy. It is priced from TCGplayer and starts at Owned ×0, so nothing is added to your collection until you add it yourself
- Cleaned up: the pockets-filled collection header at the top of the Sealed section is deleted — Sealed now opens straight into the sealed shelf. The Binder view keeps its header

## v1.22.0

- New: carts for trades and cash — on a friend's cards, the blue side of the split button adds the card to your trade cart and the green cash side adds it to your cash cart, one tap per card as you browse their collection. A cart bar on their profile keeps count, and checkout waits for you in the Trades area
- The split button now only shows on cards the owner has copies of available to part with — when none are available, there is no button at all
- Trade checkout has a Fill my order button: it builds your side automatically from cards you own that the other collector does not have, balanced by value so your side totals the same or less — and you can review and change any of it before you send
- Cash checkout totals your cart at current market value as a pre-estimate before you send; sending puts one purchase request per card under Cash purchases for the owner to accept or decline, and you still settle the payment with them directly — no payment happens in the app

## v1.21.0

- New: the I want this button on a friend's cards is now split — the blue two-thirds still starts a card trade, and the green third with the cash symbol on it starts a cash purchase of that same card, right there
- Cash purchases follow the app's usual deal flow: the request goes to the owner at their asking price when they have one, or the card's current market value — you see the price and pick how many copies before anything is sent — then the owner accepts or declines, you both confirm once it is done in person, and each side leaves the required thumbs up or down that feeds Trust Scores
- Cash buying is a request arranged between collectors — you settle the payment with the seller directly, and no payment happens inside Vault X
- Your cash purchases live in Social, in the Trades area, under Cash purchases

## v1.20.4

- Fixed: Reload to update in Settings now actually lands the new version — it refreshes the saved copy of the app first and then reloads, so an update can no longer spin back to the version you were already running
- Moved: the Coming soon on the Home Marketplace entry is now an oval yellow pill on the same line as the word Marketplace, translucent and toned down, and the description line underneath is plain again
- Restyled: the I want this button on a friend's cards — richer color with depth and a soft glow, so it looks properly pressable instead of plain

## v1.20.3

- Moved: on the Home Marketplace entry, Coming soon no longer sits over the word Marketplace itself — it now sits over the words and comics at the end of Buy and sell cards, sealed products, and comics, still translucent and toned down so it is visible without shouting

## v1.20.2

- Toned down: the Coming soon on the Home Marketplace entry is no longer a solid bright yellow pill — the words now sit right over the Marketplace label, exactly as tall as that label, in a translucent softer yellow that is easy to see without shouting

## v1.20.1

- The decks page now fronts the one deck box picture picked from the custom deck-case photos: a high-resolution wooden deck box with a patterned magnetic top, credited to its Etsy listing under the image. The color choices work on it exactly the same way

## v1.20.0

- My Decks on profiles: a pressable My Decks button now sits on your profile and on a friend's profile, next to Trade Match and achievements, and it opens that collector's own decks page
- One deck box fronts the decks page: a single photo of a real custom laser-engraved wooden Lorcana deck box (credited to its Etsy seller under the image), instead of a row of different boxes
- Deck box color is yours to change: Natural wood, Walnut, Midnight, Royal blue, Crimson, Emerald, or Violet tints the box photo and saves on this device — and each deck can wear its own color once decks are built
- No decks are on display yet, and the page says so plainly rather than showing invented decks. Deck building and display stay in the workshop queue with the Binder and Deck copy-allocation design

## v1.19.0

- Held back: the Marketplace is not open yet — it needs more thought before collectors can buy and sell in it. Its doorway stays on Home and its tab stays in Social, with a big yellow Coming soon running diagonally across the area, and buying and selling are switched off until it opens
- Held back: Forums get the same treatment — the boards stay right where they are under a translucent yellow Coming soon, visible but not clickable, while the section is refined
- The Elsa and Stitch listing pictures are gone from the Marketplace area while it is held
- New: Trades is fully working — Trade Match with a friend, propose a trade with real cards from each side, accept or decline, both sides confirm in person, and the required thumbs up or down afterwards, which feeds Trust Scores
- New: tap I want this on a card in a friend's collection and it opens a new trade in the Trades area with that card ready — pick how many copies and what to give for it, then send
- New: Trade availability in Settings and in Trades — choose how many copies of a card you are willing to part with. Keep one of each holds one copy back for your master sets; what you can trade is separate from what you own

## v1.18.1

- Cleaned up: the Vault X ring and name at the very top of Home are gone — the app already shows its name right above the page, so that band was saying it twice and leaving a tall empty space. Home now opens straight into your Collector ID and alerts
- Cleaned up: the same duplicate ring and name in the middle of the profile header is gone too — the top of a profile is now just the back button and the menu, floating clean over the page
- Updated: the back button and the three-dots menu on profile pages got a modern, soft fabric-like look — light frosted-glass circles instead of the heavy grey discs, with the three dots running across instead of down. They tap exactly like before, just easier on the eyes

## v1.18.0

- Updated: Where it lives now sits inside the Copies owned bar on every item page — the bar is split in half, with Where it lives on the left and Copies owned on the right, and the old section at the bottom of the page is gone
- Tap Where it lives to open its menu: pick Binder, Deck box, Trade box, or Bulk box, pick a place you have used before, or create your own custom spot — custom spots are remembered and offered on your other items too
- Each spot still keeps its own copy count, and the line under the bar shows how many of your copies are placed
- New in Settings: Save collection count — leave it on for the Save button as always, or turn it off and every plus or minus tap on a card saves right away, no button needed

## v1.17.1

- Updated: Home now opens with the Vault X ring small and centered at the top, with Vault X right underneath it, in a tighter header with about a fifth less empty space at the top of the screen

## v1.17.0

- New: Where it lives — open any card, sealed product, or graded comic and you can record where the physical item sits: a binder with its page and pocket, a deck box, a trade box, or a bulk box with its row
- Add as many spots as you need, each with its own copy count, so copies in different places are all accounted for — and edit or remove them any time

## v1.16.0

- New: an example price alert now sits on Home for anyone who has not set one yet — clearly labeled as an example, and tapping it explains how price alerts work
- Tap Got it and the example is gone for good; your own alerts take its place the moment you set one

## v1.15.0

- New: your whole collection now backs up to the Vault X cloud server on its own — every card, sealed product, and graded comic, updated whenever your collection changes
- New: if you ever start fresh on a new phone, your collection restores from that cloud backup when you sign back in
- Settings: Your data and backups now shows your live backup status, with a Back up now button
- Admin: a new Storage panel shows your Supabase plan limits with bars for how much database and file storage is used

## v1.14.0

- New in Settings: Your data and backups — plainly explains that your collection is stored in the cloud with your account, not just on your phone
- New: export your whole collection from Settings — every card, sealed product, and graded comic — as an Excel spreadsheet, a CSV file, or JSON, to keep as your own backup
- Updated: your profile header now carries the Vault X ring in the middle with Vault X under it in a tighter band, and the back and menu buttons got a cleaner, modern look

## v1.13.0

- Updated: graded comic slabs now look like your real CGC holders — the 9.8 sits big in a white box on the left, the CGC banner runs across the top, and the label carries your real credits, cert number over a barcode, and the holographic sticker on the right
- The slab top stays tight like a real holder, and the cover now sits inset inside the case under the label, the way the actual slabs look

## v1.12.4

- Fixed: the Save the icon artwork button in Settings — it now works every time you tap it, sends the full-size artwork to your phone, and tells you where it went. You can also tap the artwork to see it full-size and save it from there

## v1.12.3

- New: your custom Vault X ring artwork is now in the app — find it at the top of Settings, in About this app, with a button to save a full-size copy

## v1.12.2

- Fixed: the pockets-filled collection header is now fully deleted from Settings and Portfolio — it no longer sits hidden at the top of those pages. Settings starts with its own sections and Portfolio opens with its title

## v1.12.1

- Fixed: the Japanese First Chapter pack now wears the same graded-slab look as every other sealed item — the whole Sealed shelf finally matches, pack by pack

## v1.12.0

- New: profile banners — tap the menu on your profile to add a banner photo. It sits behind your profile picture, which always stays whole and fully visible on top
- Banners are optional: profiles without one look just like before, and you can change or remove yours anytime

## v1.11.4

- Fixed: the holographic shimmer on foil cards was too cloudy — the white haze is gone and the art stays crisp and clear under the rainbow shine, on every foil in the binder and the big card view
- Fixed: the bottom menu now keeps the Search tab lit the whole time you are in Search — closing the keyboard no longer makes it jump back to Home

## v1.11.3

- Updated: every sealed item now wears the same approved graded-slab look — the Winterspell and Into the Inklands packs were the last two in the old display case, and they now match the Wilds Unknown and Hyperia City slab style exactly

## v1.11.2

- Fixed: the banner on profile pages is gone — it was cutting profile pictures in half. Your photo now sits whole at the top of your profile
- New: tap the QR code on a profile and it opens big and scannable — on your own profile it opens the same full Collector ID page as the button on Home

## v1.11.1

- Fixed: the bottom menu no longer blurs under Search — it stays sharp and tappable above the blur, so you can tap any tab to leave Search
- Fixed: graded comic slabs now use real-life proportions — the label at the top is a slim band like on an actual CGC holder, about 15 percent of the slab

## v1.11.0

- New: the Marketplace — find it in Social or from the Home page. Browse listings from other collectors, with the asking price next to a Buy Now button and a note showing how the price compares to market value
- Sell anything from your own collection — cards, sealed products like a booster box, and graded comics — and manage your listings any time
- Buy Now claims an item and notifies the seller (no payment in the app yet — you arrange the deal and meet in person). You can also make an offer instead
- Sales complete only when both sides confirm, and then each side must leave a thumbs up or down — ratings stay hidden until both are in, and finished deals feed Trust Scores

## v1.10.0

- New profile pages, styled after Shiny: banner, photo, stats, and your whole collection in a searchable grid — for you and for friends
- Achievements are here — earn badge icons next to your name from real collection milestones, like your first 100 items or a finished master set
- Trade Match on a friend's profile: one tap shows the cards they have that you need, and the cards you have that they need
- The plus and minus buttons now have much bigger touch areas, so they're easy to hit with a thumb
- The app gives a light tap back when you make a selection — haptics, with an on/off switch in Settings

## v1.9.0

- New Admin page in Settings, just for the app owner: live stats from the server — how many collectors, how many items logged, the most-owned cards, and more
- Aliens #1 now shows as the full graded slab in its case, gold label on top with the real label details
- Took the KEY badges off the comic covers
- Settings and Portfolio no longer show the pockets-filled header at the top
- Portfolio now starts with its own title at the top, like Settings and Social

## v1.8.1

- Fixed the Hyperia City booster box photo — it now shows the real booster display box, sealed in its case
- Most sealed packs now sit in a clean clear slab — like a graded holder, but with no label at the top
- Fresh official box art for the three Illumineer's Quest sets
- The set tiles in the binder are a little taller

## v1.8.0

- New in Settings: a Theme picker — Vault Dark, Light, Midnight Purple, Crimson Ember, and High Contrast
- Tap a theme and it applies everywhere right away, even the highlighted tab in the bottom menu
- Your theme choice saves to your profile, so it stays picked

## v1.7.0

- A new vault door app icon — the old book icon is gone
- The highlighted tab in the bottom menu now glows blue-violet to match the app, instead of green

## v1.6.0

- The app has a new name: Vault X — same collection, same everything, new name and a new vault icon
- Fixed the Owned count on sealed tiles so the words and the plus and minus buttons sit on one straight line

## v1.5.1

- Fixed the First Chapter pack mix-up — the English pack and the Japanese pack are two separate items again, each with its own photo
- The Hyperia City booster box now shows closed and sealed, and the acrylic cases on sealed items look thicker and clearer
- On the home page, Collection Distribution now shows the percentage first, and the extra three-dots button is gone
- The Owned count and its plus and minus buttons now line up neatly on item pages
- Added a note by the Re-price now button: prices refresh on their own once a day

## v1.5.0

- Set pictures in the Lorcana binder are bigger and much sharper
- Every item now floats and turns on its page — cards, sealed products, and graded comics. Drag to turn it yourself
- Update checks now tell you exactly what changed, right here in Settings

## v1.4.0

- Your username and Collector ID now save to the server, so friends can find you
- The Friends list reads from the server too — the Jarvis test user really lives there now
- Fixed the missing price graph on Fru Fru - VIP Guest and other card pages
- The Best Offer button now shows the TCGplayer logo
- New button on a friend's page: Cards They Have That I Need, with its own search and set filter
- Removed the extra Binders button from the bottom menu — tap a collection to open its binder
