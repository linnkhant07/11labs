@AGENTS.md

# Project: QueStory (working title)

## What We Are Building
An AI-powered interactive educational storybook web app specifically designed for kids with ADHD. Not a fable or children's tale — real educational content (science, history). Demo topics: tornadoes and pyramids.

A child picks a topic they want to learn and a narrator (3 preset animal characters OR their parent's cloned voice via ElevenLabs). The app generates a fully illustrated, narrated educational storybook. While reading, the child can do 4 things:
1. Circle objects in the illustration → AI explains what they circled
2. Make choices that branch the story (pre-generated)
3. Draw something on a canvas → gets incorporated into the next scene
4. Talk to the narrator character live (conversational AI)

The high interactivity is intentional and specific to ADHD — keeps attention, prevents passive consumption. The agent also proactively initiates conversation every ~30 seconds of inactivity to re-engage the child.

## Hackathon
LA Hacks 2026, April 24-26, UCLA Pauley Pavilion

## Team
3 developers + 1 designer

## Tracks & Prizes
- **PRIMARY TRACK:** Light the Way presented by Aramco (education equity + accessibility)
- **ElevenLabs MLH** (wireless earbuds) — voice cloning + conversational AI
- **MongoDB Atlas MLH** (IoT Kit) — story storage
- **Cloudinary MLH** ($500/member) — image storage + delivery

## Tech Stack
- Frontend: Next.js 14 (App Router) + Tailwind CSS + Framer Motion
- Backend: Next.js API routes (same repo)
- Story generation: Gemini
- Image generation: Gemini
- Image storage: Cloudinary
- Voice narration: ElevenLabs TTS Turbo v2.5
- Voice cloning: ElevenLabs Voice Cloning API
- Conversational character: ElevenLabs Conversational AI (WebSocket, full-duplex)
- Circle/draw understanding: Gemini Vision API
- Database: MongoDB Atlas
- Deployment: Vercel (frontend)
- Canvas: HTML5 Canvas API (browser native)
- Animations: Framer Motion (NO video generation)

**DO NOT** use video generation (Sora/Veo/Runway) — too slow, too unreliable for demo. Use Framer Motion parallax on still images instead.

## Story JSON Schema (contract — all devs use this)
```json
{
  "title": "string",
  "topic": "string",
  "narrator": {
    "type": "animal | custom",
    "character": "fox | owl | bear | custom",
    "voice_id": "string (ElevenLabs voice_id)"
  },
  "pages": [
    {
      "page_id": "string",
      "narration": "string",
      "image_prompt": "string",
      "image_url": "string (Cloudinary)",
      "audio_url": "string (ElevenLabs)",
      "hotspots": [
        {
          "object": "string",
          "bbox": [0, 0, 0, 0]
        }
      ],
      "choice": null | {
        "question": "string",
        "option_a": {
          "label": "string",
          "pages": ["page objects"]
        },
        "option_b": {
          "label": "string",
          "pages": ["page objects"]
        }
      }
    }
  ],
  "cyu": [
    {
      "type": "voice | drag | draw",
      "question": "string"
    }
  ]
}
```

## Context Object (pass on every Gemini/Claude call)
```json
{
  "topic": "string",
  "current_page": "string",
  "branch_taken": "string | null",
  "story_so_far": "string",
  "narrator_character": "string",
  "educational_facts_covered": ["string"],
  "adhd_mode": true
}
```

## API Routes
- `POST /api/generate` — takes topic + narrator, returns full story JSON with ALL branches pre-generated, ALL image prompts, ALL narration text
- `POST /api/circle` — takes cropped image + page context, returns explanation text + audio URL
- `POST /api/talk` — takes transcript + story context, returns response text + audio URL
- `POST /api/draw` — takes canvas PNG + story context, returns new page JSON + image URL + audio URL
- `POST /api/clone-voice` — takes audio recording, returns voice_id
- `GET /api/story/:id` — fetch saved story from MongoDB

## Phases

### Phase 1 (finish by ~4am)
1. LLM generates full story JSON with all branches
2. Gemini generates ALL page images in parallel (including all branches)
3. ElevenLabs TTS generates ALL narration audio in parallel
4. Everything saved to MongoDB
5. Frontend: onboarding form + storybook viewer renders page 1 with real data
6. Choose path works instantly (pre-loaded, zero latency)
- Target: one complete tornado story plays end to end

### Phase 2 (full day)
1. Circle/click: Canvas overlay → crop region → Gemini Vision → ElevenLabs speaks explanation
2. Talk to agent: mic button → ElevenLabs STT → Gemini (+ context) → ElevenLabs TTS responds
3. Proactive agent: fires every ~30s of inactivity, re-engages child with a relevant question
4. Draw feature: Canvas → PNG → Gemini Vision → Gemini → new page influenced by drawing
5. Polish all animations
6. Demo prep

## Team Split
- **Dev 1:** Story pipeline (/api/generate, Gemini, Cloudinary, MongoDB)
- **Dev 2:** ElevenLabs everything (TTS, voice cloning, conversational AI WebSocket, proactive agent)
- **Dev 3:** Frontend (Next.js pages, storybook viewer, Canvas overlay, choice modal, wiring)
- **Designer:** Figma prototype → assets → works with Dev 3 on UI → demo script → Devpost page

**KEY RULE:** Dev 3 is never blocked. Use hardcoded fake JSON until Dev 1 is ready. Use browser speechSynthesis until Dev 2 is ready.

## Demo Plan
Pre-generate 2 complete stories before demo (tornadoes + pyramids). Demo runs on these cached stories. Live generation is shown as the bonus at the end. A broken live generation with perfect cached demo still wins. A failed live demo loses.

## What NOT to Build
- Video generation
- User accounts / login / auth
- Mobile responsive design
- Hand gesture detection
- Perfect cross-session persistence
