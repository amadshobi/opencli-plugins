# opencli-plugin-gemini

Video generation for the Gemini App (`gemini.google.com`) from the terminal —
`opencli gemini video "..."` — with automation-grade failure semantics.

## Why this exists

The upstream `@jackwener/opencli` package ships `gemini ask/image/models/...`
but **no `video` command**. This plugin fills that gap, and fixes the failure
modes that broke automation runs:

- **Fail-fast on limits** — when Gemini reports a rate limit / quota / refusal
  in its error UI, the command throws immediately (exit code non-zero, message
  contains `Rate limit`) instead of spinning until the timeout.
- **Typed failures** — every failure path throws `CommandExecutionError`;
  automation can trust the exit code. No more "Timeout" rows with exit 0.
- **Download race protection** — the Downloads folder is snapshotted before
  the run; only a *new* `gemini_generated_video_*.mp4` whose size has stopped
  growing is accepted.
- **Verify-then-delete** — the source download is removed only after the copy
  was byte-for-byte verified.
- **Generous timeouts** — generation `900s` (real renders take 2–10 minutes),
  download `120s` (large files + browser "Keep" prompts).

## Install

```bash
opencli plugin install /path/to/opencli-plugin-gemini
```

## Usage

```bash
# Basic render (uses the connected browser profile)
opencli gemini video "an ant falling from a building in slow motion, 3D" \
  --output D:/projects/semut/shots/shot_001.mp4

# Rotation across Chrome profiles (4 clips x 10s per account bucket)
opencli --profile pro1 gemini video "..." --output shot_001.mp4
opencli --profile pro2 gemini video "..." --output shot_002.mp4
```

## Arguments

| Arg | Default | Description |
|---|---|---|
| `prompt` | (required) | Scene description; `Generate video:` prefix is added automatically |
| `output` | `./output.mp4` | Destination MP4 path |
| `timeout` | `900` | Max seconds waiting for generation |
| `downloadWait` | `120` | Max seconds waiting for the file to finish downloading |
| `new` | `false` | Start a fresh chat before sending |

## Requirements

- Browser profile logged into `gemini.google.com` with the OpenCLI Browser
  Bridge extension connected (`opencli doctor` to check).

## Tests

```bash
npm install
npm test
```
