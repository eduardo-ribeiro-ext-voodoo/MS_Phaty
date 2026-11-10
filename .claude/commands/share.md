# Share a Prototype

Publish a prototype so it appears on the Prototype Library landing page with
full documentation and a playable showcase level.

## Context

Prototypes only appear on the landing page if they have a `prototype.json` file
at the repo root. This command generates that file, commits it, and pushes.

The `prototype.json` format:

```json
{
  "name": "Human-readable name of the mechanic",
  "description": "One or two sentences explaining what the mechanic does.",
  "howToPlay": "Plain-language instructions for someone playing the showcase level.",
  "author": "Name of the person who created it",
  "showcaseLevel": { /* full level JSON from the editor */ }
}
```

When a user opens a prototype that has a `prototype.json` with a `showcaseLevel`,
they see a "Play Showcase" button on the start screen that launches directly
into that level — no editor or JSON pasting needed.

## Steps

1. **Check the current branch.** Run `git branch --show-current`. The prototype
   must be on a `prototype/` or `claude/` branch — never `main`.

2. **Understand the mechanic.** Read the prototype's code to understand what was
   built. Look at any existing `prototype.json` to see if one already exists.

3. **Ask for a showcase level.** Check if the user provided a level JSON in
   $ARGUMENTS. If not, ask the user:
   "Do you have a showcase level JSON to include? You can export one from the
   Level Editor (Export button), or I can leave the showcase level empty for
   now and you can add it later."

4. **Generate `prototype.json`.** Fill in all fields:
   - `name`: A clear, human-readable name for the mechanic
   - `description`: 1-2 sentences explaining the mechanic in plain language
   - `howToPlay`: Step-by-step instructions for the showcase level (e.g.,
     "Tap the green boxes first to crack the adjacent ice, then tap the
     revealed boxes to sort the marbles")
   - `author`: Ask the user if not obvious from context
   - `showcaseLevel`: The level JSON object (not stringified — embedded directly)

5. **Write the file.** Save `prototype.json` at the repo root.

6. **Validate and commit:**
   - Verify `prototype.json` is valid JSON: `node -e "JSON.parse(require('fs').readFileSync('prototype.json','utf8'))"`
   - `git add prototype.json`
   - `git commit -m "Add prototype.json for sharing"`
   - `git push -u origin <current-branch>`

7. **Construct the preview URL** using the pattern from CLAUDE.md:
   - Get SHA: `git rev-parse --short=8 HEAD`
   - Branch name with `/` replaced by `--`
   - URL: `https://eduardo-ribeiro-ext-voodoo.github.io/MS_Phaty/<branch>--<sha>/`

8. **Share with the user.** Provide:
   - The preview URL (playable link with showcase level)
   - The landing page URL: `https://eduardo-ribeiro-ext-voodoo.github.io/MS_Phaty/`
   - Confirm the prototype will appear on the landing page after deploy (~30-60s)
   - Remind the user they can share just the landing page URL with the team —
     everyone can browse and play all shared prototypes from there
