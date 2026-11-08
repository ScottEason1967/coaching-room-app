# The Coaching Room

Joe's coaching app. Game model, training programme, tactics board, drill designer, session plans, match plans, reviews, a UEFA C to Pro pathway, and private links for players and staff.

The loop: the game model (identity, principles by phase, each with a trigger, a picture and principles-of-play tags) sets what the team is trying to do. A training block puts four to six weeks behind one or two principles. Sessions are built from the block, name the players being coached and what Joe is looking for. Match plans test the model against the opponent (plan B, substitutions, the principles under test, what was trained that week, the file on that opponent). Reviews are compulsory and must be finished before anything new is planned; they ask whether the last change was made and what happened, measure ball rolling, analyse goals and in-game decisions, and feed the model, the opponent file and Joe's own strengths-and-development profile.

It's a website that installs like an app (a PWA). One version runs on Joe's phone, iPad and laptop.

"The Coaching Room" is a working title.

## What works straight away

Open `index.html` from a web address (see step 2) and everything works on that one device: teams, squad, game model, programme, boards, drills, sessions, matches, reviews, pathway, logbook, printing and images. Data is saved in that browser.

Two things need the one-off cloud setup in step 3:

1. The same data on every device (phone, iPad, laptop).
2. Player and staff links with PINs.

Until then, the backup button in More > Cloud sync downloads everything as one file. You can restore that file on another device.

## Step 1: Put the files on GitHub (about 5 minutes)

1. In GitHub Desktop: File > New repository. Name it `coaching-room`. Put it anywhere on your PC.
2. Copy everything in this folder into the new repository folder. `index.html` must sit at the top level, not inside another folder.
3. In GitHub Desktop, write a summary (e.g. "First version"), press **Commit to main**, then **Publish repository**.
4. Untick "Keep this code private" when publishing. On a free GitHub account, websites only work from public repositories. The code being public is fine: Joe's data never goes in the repository.

## Step 2: Switch on the website (about 2 minutes)

1. On github.com, open the `coaching-room` repository.
2. Settings > Pages.
3. Under "Build and deployment", Source: **Deploy from a branch**. Branch: **main**, folder **/ (root)**. Save.
4. Wait a minute or two. The address appears at the top of that page, something like `https://YOUR-NAME.github.io/coaching-room/`.

Open that address on Joe's phone to check it loads.

## Step 3: Cloud sync and links (about 15 minutes, once)

This uses Supabase, a hosted database with logins.

1. Go to supabase.com and sign in (or sign up, free).
2. **New project**, even if you already have one for something else: the app creates tables called `items` and `shares`, and a project of its own keeps Joe's data and its rules separate. Name: `coaching-room`. Set a database password and keep it somewhere safe (you won't need it day to day). Region: London (eu-west-2) if offered. The free plan allows two live projects; if you already have two, pause one first or it will ask you to pay.
3. When it's ready: **SQL Editor** > **New query**. Open `supabase/schema.sql` from this folder in Notepad, copy all of it, paste it in, press **Run**. It should say "Success". It's safe to run again.
4. **Authentication** > **Sign In / Providers** > **Email**: turn off **Confirm email**. Joe is the only user, and this means creating the account signs him straight in, with no confirmation link to go wrong. (If you'd rather keep confirmation on, set **Authentication** > **URL Configuration** > **Site URL** to your GitHub Pages address from step 2 first, so the link in the email comes back to the app.) Set the Site URL anyway once the site is up: password-reset emails use it.
5. **Project Settings** > **API** (may be under "Data API" and "API Keys"). Copy the **Project URL** and the key. Either the long **anon public** key or the newer **publishable** key (`sb_publishable_...`) works.
6. Open `js/config.js` in Notepad and paste them between the quotes:

   ```js
   export default {
     url: 'https://abcdefgh.supabase.co',
     anonKey: 'eyJhbGciOi...the long key...'
   };
   ```

   The anon key is designed to be public. The database rules (row level security) stop anyone reading data that isn't theirs, and the share table can only be read through the PIN check.
7. Commit and push in GitHub Desktop. The site updates in a minute or two.
8. On Joe's phone: open the app, tap **JE** (top right) > **Cloud sync and backup** > enter an email and password > **Create account**. With Confirm email off it signs in at once and the dot at the top turns green. (With it on, Supabase sends a confirmation email; tap the link, then sign in.)
   You can try this on your laptop first, before the site is on GitHub: fill in `js/config.js`, run the local server as in "What works straight away", and the Cloud screen should say **Not signed in** instead of **This device only**. Create the account there; that proves the database set-up worked.
9. Sign in with the same email and password on the iPad and laptop.
   Once cloud sync is set up, the app opens on a **sign-in screen** and shows nothing until someone signs in, so nobody can pick up a phone and edit a copy that never reaches the cloud. There is no Create account button on that screen: with sign-ups turned off (step 10), a new account is added in Supabase under **Authentication** > **Users** > **Add user**. A device that has signed in before still opens with no signal at the ground; changes upload when it reconnects.
10. Once Joe's account works: Supabase > **Authentication** > **Sign In / Providers** (or "Settings") and turn off **Allow new users to sign up**. Nobody else needs an account. Players and staff use links, not logins.

### Things to know about Supabase

- Sync keeps the last edit of a whole item (by the device's clock). If two devices edit the same plan before syncing, the later edit wins and the other is kept under More > Cloud sync > "Edits replaced by another device" to copy back by hand. If a device's clock is wrong the Cloud screen says so; fix the clock in the device settings.
- On the free plan, a project with no activity for 7 days is paused. If Joe uses the app most days this won't happen. If it does pause, his data is safe: open the Supabase dashboard and press Restore. The app keeps working on each device in the meantime.
- The paid plan (US$25 a month at the time of writing) removes pausing and adds daily backups. Not needed to start.

## Installing on each device

- **iPhone or iPad:** open the address in **Safari**, tap Share, then **Add to Home Screen**. Do install it: Safari can clear a website's saved data after seven days without use, and installed apps are exempt. Printing from the home-screen app may not work on iOS; use Safari for printing, or the Image buttons on boards and drills.
- **Android:** Chrome menu > **Install app**.
- **Laptop:** Chrome or Edge, the install icon at the right of the address bar.

It then opens full screen, has its own icon, and works without signal. Changes made offline sync when the device is back online.

## Using it

- Every screen has a **?** at the top right. Tap it for a short guide to that screen. Each step with a **Show me** button takes you to the control and flashes it.
- The first time you open the app, Home shows a **Start here** card: what the app is for, the order to set it up in, and the weekly loop. Tap **Got it** when you have finished with it.
- To see it again, go to More > **Start here**.

## Player and staff links

- **Players:** Squad > a player > **Create her link**. Each player gets her own link and 4-digit PIN. Her page shows her number, development goals, her own instruction for the next match, the keys to winning, the agreed principles and any boards marked "show on player pages". Never Joe's private notes or anyone else's profile.
- **Staff:** session plans, match plans and boards each have **Share with staff** (or **Link** on a board). Staff can comment; comments show in the same panel.
- Five wrong PINs locks a link for 15 minutes. Joe can change a PIN, turn a link off or delete it at any time.
- Links are a copy of what was shared. Session and match links update themselves when Joe leaves the plan (if the device is online at that moment; otherwise open and leave the plan again). Board links and player pages do not: after changing a board press **Update now** in its link sheet, and after changing a match plan press **Update player pages** on the Match day tab.
- A board marked "Show on player pages" sends every frame's coaching notes and the name and number of every player on it. Write those notes for the players, not about them.
- **Under-18s:** if any players are under 18, check the club's safeguarding policy before sending links (for example, send through a parent).

## Photos and the club badge

- **Your photo**: More > **Add photo**. It replaces the initials in the top right.
- **Club badge**: More > Teams > the team > **Add the club badge**. It shows on the team switcher, printouts and the player and staff pages.
- **Player photos** are the player's choice. Each player can add, change or remove her own photo from her player page (the link and PIN). You can't add one for her, and you can remove one from her page in the app if you need to. Photos live with her link: delete the link and the photo goes too. If any players are under 18, check the club's rules on photos before sending links.
- Pictures are shrunk on the phone before they're saved (a 320-pixel photo is about 30 KB), so they sync quickly.
- **Player photos need the database updated once** (November 2026): Supabase > **SQL Editor** > **New query**, paste all of `supabase/schema.sql` again, **Run**. It only adds what's missing and keeps everything already there. Until it's done, everything else works, but a player who tries to add a photo gets "Could not save".

## Updating the app later

Change the files, commit and push in GitHub Desktop. Devices pick up the new version the next time the app is opened with a connection.

## What's in this folder

| Path | What it is |
|---|---|
| `index.html` | The app |
| `view.html` | The page players and staff see from a link |
| `js/` | App code. `config.js` is the only file you edit |
| `css/`, `fonts/`, `icons/` | Look and feel (fonts are included, so it works offline) |
| `vendor/supabase.js` | The Supabase library (version 2.119.0), included so nothing loads from elsewhere |
| `sw.js`, `manifest.webmanifest` | Make it installable and work offline |
| `supabase/schema.sql` | Database setup for step 3 |

## Data and privacy

- No health data. Don't record medical, injury or menstrual information in player notes.
- Joe's data is in his own Supabase project, in the region chosen at setup. Nobody else has access.
- Backups: More > Cloud sync and backup > **Download backup** saves everything as one file.
