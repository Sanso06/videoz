# Videoz

A video-sharing web application built for CSC 317 (Introduction to Web Software
Development) at San Francisco State University. Users register an account, upload
videos, browse a feed of thumbnails, search, comment, and like.

Built as a server-rendered Express application with a MySQL database and
Handlebars templates — no front-end framework, no build step.

## Features

- **Accounts** — registration with server-side validation, bcrypt-hashed passwords, login by username *or* email, logout
- **Sessions** — cookie-based sessions that persist across navigation; the session ID is regenerated on login to prevent session fixation
- **Video posts** — upload with a size cap and MIME-type filter; a thumbnail is captured from the video in the browser and stored as a JPEG
- **Feed** — home page lists the newest posts as thumbnail cards with live like and comment counts
- **Search** — matches post titles, descriptions, and author usernames
- **Comments** — any logged-in user can comment on any post
- **Likes** — one like per user per post, enforced by a database constraint, toggleable
- **Deletion** — authors can delete their own posts; comments, likes, and the files on disk are cleaned up automatically
- **Profiles** — public profile pages showing a user's details and their videos

## Technologies

| Layer    | Choice                                       |
| -------- | -------------------------------------------- |
| Runtime  | Node.js                                      |
| Server   | Express 5                                    |
| Views    | Handlebars (`express-handlebars`) + partials |
| Database | MySQL 8 via `mysql2` (promise pool)          |
| Auth     | `bcryptjs`, `express-session`                |
| Uploads  | `multer` (disk storage)                      |
| Styling  | Hand-written CSS, no framework               |

## Requirements

- Node.js 18 or newer
- MySQL Server 8 or newer, running locally

## Installation

```bash
git clone https://github.com/Sanso06/videoz.git
cd videoz/application
npm install
```

## Configuration

Database settings live in `application/conf/config.js` and are read from
environment variables. Set them before running any of the commands below:

```bash
export DB_USER=root
export DB_PASSWORD=your-mysql-password
export SESSION_SECRET=a-long-random-string
```

See `application/.env.example` for the full list. The project does not load a
`.env` file automatically, so export the variables in your shell or prefix a
command with them:

```bash
DB_PASSWORD=yourpassword npm start
```

## Setup

Create the database and its tables. This is safe to re-run; it skips anything
that already exists.

```bash
npm run builddb
```

The same schema is also available as plain SQL at
[`database/init.sql`](database/init.sql) if you would rather load it directly:

```bash
mysql -u root -p < ../database/init.sql
```

Expected output:

```
Created Database!
Created Users Table!
Created Posts Table!
Created Comments Table!
Created Likes Table!
```

## Usage

```bash
npm start
```

Then open <http://localhost:3000>.

Register an account to post. Passwords must be at least 8 characters and include
an uppercase letter, a number, and a special character.

| Script            | Purpose                                    |
| ----------------- | ------------------------------------------ |
| `npm start`       | Run the server with nodemon (auto-restart) |
| `npm run builddb` | Create the database and tables             |
| `npm run grade`   | Install, build the database, and start     |

## Project Structure

```
application/
├── app.js                  Express setup: templating, middleware, routes, errors
├── bin/
│   ├── www                 HTTP server bootstrap (port binding, error handling)
│   └── dbloader            Creates the database and tables; `npm run builddb`
├── conf/
│   ├── config.js           All settings, overridable by environment variables
│   └── database.js         Shared mysql2 promise pool
├── helpers/
│   ├── debug/              Coloured console printers
│   ├── error/              AppError base plus UserError and PostError
│   ├── handlebars/         Custom template helpers
│   └── media/              ffmpeg thumbnail generation
├── models/
│   └── postQueries.js      Shared read queries for post cards
├── middleware/
│   ├── auth.js             Session-to-view binding and route guards
│   └── upload.js           Multer storage, size limit, MIME filter
├── routes/
│   ├── index.js            Home feed, search, static pages
│   ├── users.js            Register, login, logout, profiles
│   └── posts.js            Create, view, comment, like, delete
├── views/
│   ├── layouts/layout.hbs  Page shell
│   ├── partials/           navbar, banner, footer, postcard, comment, flash
│   └── *.hbs               One template per page
└── public/
    ├── css/style.css       All styling
    ├── js/                 Client-side validation and thumbnail capture
    └── videos/uploads/     Uploaded videos and generated thumbnails (gitignored)
```

## Database Schema

Four InnoDB tables with foreign keys that cascade on delete.

```
users     id, username (unique), email (unique), password (bcrypt hash), createdAt
posts     id, title, description, video, thumbnail, createdAt, fk_userId → users
comments  id, text, createdAt, fk_userId → users, fk_postId → posts
likes     id, createdAt, fk_userId → users, fk_postId → posts
          UNIQUE (fk_userId, fk_postId)  -- one like per user per post
```

## Implementation Notes

**Thumbnails are generated two ways, tried in order.**

1. **Server-side with ffmpeg.** On upload, the bundled `ffmpeg-static` binary
   grabs a frame one second into the clip and writes it to `public/images`.
   No system-wide ffmpeg install is needed — the package ships its own.
2. **Browser fallback.** If ffmpeg is unavailable or fails on a particular file,
   the app uses a frame that `public/js/postvideo.js` captured from a `<canvas>`
   before the form was submitted.

The fallback exists because of a real failure mode worth knowing about: an MP4
stores its index (the `moov` atom) either at the front or the back of the file.
When it sits at the back — common for camera and encoder output — a browser
streaming that file over HTTP cannot decode a single frame until the whole file
arrives, so a `<video>` element used as a thumbnail renders as a black rectangle.
Reading the file locally has no such limitation. Between the two paths, a post
effectively always ends up with a usable image.

## Security Notes

- Passwords are hashed with bcrypt at 12 salt rounds and never stored or logged in plain text
- Every SQL statement uses parameterised placeholders, so user input cannot alter a query
- Login failures return one generic message, so the form cannot be used to discover which accounts exist
- The session ID is regenerated on login; cookies are `httpOnly` and `sameSite=lax`, and `secure` in production
- Uploads are filtered by MIME type, capped in size, and stored under randomly generated filenames, so a crafted filename cannot escape the upload directory
- Post deletion verifies ownership on the server rather than relying on a hidden button
- Stack traces are rendered only outside production

## Future Improvements

- Move sessions into a MySQL-backed store so logins survive a server restart
- Paginate the home feed instead of capping it at 50 posts
- Generate thumbnails server-side with ffmpeg as a fallback for clients with JavaScript disabled
- Add CSRF tokens to state-changing forms
- Let users edit posts and delete their own comments
- Add automated tests and wire them into CI

## License

MIT — see [LICENSE](LICENSE).
