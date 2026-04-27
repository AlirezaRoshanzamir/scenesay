# Scenesay

> Learn English the cinematic way — master vocabulary through movies and TV shows.

Scenesay lets you look up tricky words, phrases, and idioms episode by episode before or while watching your favorite shows. Each term comes with an IPA pronunciation, English definition, Persian translation, real usage examples, synonyms, and antonyms — plus optional pronunciation audio.

**100% free · Open source · No ads · No tracking**

---

## Features

- **Episode-level vocabulary** — browse terms organized by show → season → episode
- **Rich term data** — IPA pronunciation, part of speech, difficulty rating (1–10), categories (Idiom, Slang, Cultural, etc.)
- **Pronunciation audio** — playable voices for each term where available
- **Term images** — optional illustrations accompanying select terms
- **Persian support** — every term includes Persian translations
- **Show metadata** — year, genre, native language, word difficulty level, season/episode breakdown
- **Filter & sort** — search terms, filter by category or difficulty, sort A→Z or by difficulty
- **Dark theme** — easy on the eyes for late-night study sessions

---

## Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | React 19, Vite 6                                |
| Styling    | Plain CSS (custom properties, CSS Grid)         |
| Icons      | Font Awesome 7                                  |
| Select     | react-select                                    |
| Data       | Static JSON files built by a Node.js script     |
| Deployment | GitHub Pages (GitHub Actions)                   |

---

## Project Structure

```
scenesay/
├── src/
│   ├── frontend/               # React application
│   │   ├── index.html
│   │   ├── main.jsx
│   │   ├── App.jsx             # Home page + hash routing
│   │   ├── App.css
│   │   ├── ShowPage.jsx        # Show detail / episode browser
│   │   └── TermsPage.jsx       # Episode or movie vocabulary page
│   ├── content/                # Source vocabulary data
│   │   ├── shows/
│   │   │   └── {show_id}/
│   │   │       ├── meta.json           # Show metadata
│   │   │       ├── poster.{ext}        # optional poster image
│   │   │       └── seasons/
│   │   │           └── {n}/
│   │   │               └── episodes/
│   │   │                   └── {nn}/
│   │   │                       └── meta.json   # title + term ID list
│   │   └── terms/
│   │       └── {term_id}/
│   │           ├── meta.json           # Term data
│   │           ├── *.jpg / *.png       # optional images
│   │           └── *.mp3 / *.ogg       # optional pronunciation audio
│   └── scripts/
│       ├── build-api.js        # Aggregates src/content/ → dist/build/api/
│       └── optimize-media.js   # Optimises media assets
└── dist/
    └── build/
        ├── api/
        │   ├── shows/
        │   │   ├── meta.json                        # aggregated shows list
        │   │   └── {show_id}/
        │   │       ├── meta.json                    # movie terms (movies only)
        │   │       └── seasons/{n}/episodes/{nn}/
        │   │           └── meta.json                # episode vocabulary
        │   ├── images/                              # content-hashed images
        │   └── voices/                              # content-hashed audio
        └── ...                                      # Vite frontend assets
```

---

## Getting Started

### Prerequisites

- Node.js 18+

### Install & run

```bash
# 1. Clone the repository
git clone https://github.com/AlirezaRoshanzamir/scenesay.git
cd scenesay

# 2. Install dependencies
npm install

# 3. Build the API data and start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

The `dev` script runs `build:api` first (which writes JSON files into `dist/build/api/`), then starts Vite. The Vite dev server serves those files directly under `/api/` via a built-in middleware — no separate data server is needed.

### Build for production

```bash
npm run build   # outputs to dist/build/
```

The project is automatically deployed to GitHub Pages on every push to `main` via the included GitHub Actions workflow.

---

## Data Formats

### Source: show metadata — `src/content/shows/{show_id}/meta.json`

```json
{
  "title": "Friends",
  "genre": "Sitcom",
  "year": 1994,
  "description": "Six friends navigate life, love, and careers in New York City.",
  "nativeLanguage": "English (American)",
  "wordDifficulty": "Intermediate",
  "type": "series",
  "seasons": [
    { "number": 1, "year": 1994, "episodesCount": 24 }
  ]
}
```

`type` is either `"series"` or `"movie"`. Movies have no `seasons` array.

`wordDifficulty` is one of: `Beginner`, `Elementary`, `Intermediate`, `Upper-Intermediate`, `Advanced`.

The `available` flag is computed automatically by the build script — there is no need to set it manually.

### Source: episode metadata — `src/content/shows/{show_id}/seasons/{n}/episodes/{nn}/meta.json`

```json
{
  "title": "The One Without The Ski Trip",
  "terms": ["bad_time", "beam_me_up", "civil"]
}
```

`terms` is an array of term IDs (folder names under `src/content/terms/`). The build script resolves them into full term objects.

### Source: term data — `src/content/terms/{term_id}/meta.json`

```json
{
  "categories": ["Idiom", "Slang"],
  "difficultyLevel": "7",
  "term": "Bad time",
  "pronunciation": "/bæd taɪm/",
  "partOfSpeech": "Noun phrase",
  "englishDefinitions": ["An inconvenient moment to visit or call someone."],
  "persianTranslation": ["زمان بد", "موقع نامناسب"],
  "examples": [
    "I'm sorry, is this a bad time?",
    "It was a bad time to ask for a raise."
  ],
  "synonyms": ["inconvenient moment"],
  "antonyms": ["good time", "perfect timing"]
}
```

`difficultyLevel` is a string from `"1"` (easiest) to `"10"` (hardest).

Place any `.jpg`/`.png` images or `.mp3`/`.ogg` audio files alongside `meta.json` — they are picked up automatically by the build script and served as `pronunciationVoices` and `images` arrays in the built output.

### Built API: shows list — `dist/build/api/shows/meta.json`

The build script enriches each show entry with computed fields:

```json
[
  {
    "id": "friends",
    "title": "Friends",
    "genre": "Sitcom",
    "year": 1994,
    "available": true,
    "poster": "/api/images/{hash}.jpg",
    "gradient": "linear-gradient(135deg, #f6d365 0%, #fda085 100%)",
    "seasons": [
      {
        "number": 3,
        "year": 1996,
        "episodesCount": 25,
        "availableEpisodes": [
          { "number": 17, "title": "The One Without the Ski Trip" }
        ]
      }
    ]
  }
]
```

### Built API: episode vocabulary — `dist/build/api/shows/{id}/seasons/{n}/episodes/{nn}/meta.json`

```json
{
  "title": "The One Without The Ski Trip",
  "terms": [
    {
      "term": "Bad time",
      "pronunciation": "/bæd taɪm/",
      "partOfSpeech": "Noun phrase",
      "difficultyLevel": "7",
      "categories": ["Idiom", "Slang"],
      "englishDefinitions": ["An inconvenient moment to visit or call someone."],
      "persianTranslation": ["زمان بد", "موقع نامناسب"],
      "examples": ["I'm sorry, is this a bad time?"],
      "synonyms": ["inconvenient moment"],
      "antonyms": ["good time", "perfect timing"],
      "images": ["/api/images/{hash}.jpg"],
      "pronunciationVoices": ["/api/voices/{hash}.mp3"]
    }
  ]
}
```

---

## Contributing

Contributions are welcome — especially new shows and vocabulary data.

### Adding a new term

1. Create `src/content/terms/{term_id}/meta.json` following the term schema above.
2. Optionally place image (`.jpg`, `.png`) or audio (`.mp3`, `.ogg`) files in the same folder.

### Adding a new episode

Create `src/content/shows/{show_id}/seasons/{n}/episodes/{nn}/meta.json` with a `title` string and a `terms` array of term IDs. The episode is automatically listed as available once the file exists.

### Adding a new show

1. Create `src/content/shows/{show_id}/meta.json` with at minimum `{ "title": "..." }`.
2. Add a poster image to the same folder (optional but recommended).
3. Add episode data under `seasons/`.

The `available` flag is derived automatically — no manual step required.

---

## Support

Scenesay is free and will always remain so. If it's helped you learn even one new word, consider buying me a coffee:

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-orange?logo=ko-fi)](https://ko-fi.com/AlirezaRoshanzamir)

---

## License

[MIT](LICENSE) © 2026 [Alireza Roshanzamir](mailto:a.roshanzamir1996@gmail.com)
