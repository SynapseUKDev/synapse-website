# SynapseUK Flashcard Scripts

This repository generates **Prescribing Recall** flashcards for EduSynapse.

It mirrors the structure of `synapse-question-scripts` but is focused on flashcards covering first-line, alternative/second-line drug management, safety checks, monitoring and common exam traps.

The student-facing flashcard does **not** show guideline labels. Source tracking is stored in hidden metadata for QA and version control.

## Directory structure

```text
synapse-flashcard-scripts/
├── scripts/
│   ├── flashcards/
│   │   ├── generate_flashcards.py      # Generate cards for one topic
│   │   ├── batch_generate.py           # Resume-safe generation across topics
│   │   ├── validate_flashcards.py      # Validate JSON/JSONL outputs
│   │   ├── export_flashcards.py        # Export JSONL to CSV or SQL
│   │   ├── schema.py                   # Shared normalisation/validation rules
│   │   └── prompts/
│   │       ├── flashcards_system.txt
│   │       └── flashcards_user.txt
│   └── run/
│       ├── run_quick.sh
│       ├── run_batch_generate.sh
│       └── windows/
│           ├── run_quick.bat
│           └── run_batch_generate.bat
├── data/
│   ├── topics_rows.json
│   ├── specialties_rows.json
│   └── subtopics_rows.csv
├── content/
│   └── flashcard-seeds/
│       └── example_seed.json
├── output/
│   └── flashcards/
├── docs/
│   ├── RUNBOOK.md
│   └── FLASHCARD_SCHEMA.md
├── requirements.txt
└── README.md
```

## Setup

```bash
pip install -r requirements.txt
```

Create a `.env` file in the repo root:

```env
OPENAI_API_KEY=sk-your-key-here
```

## Generate one topic

```bash
python scripts/flashcards/generate_flashcards.py \
  --specialty "Renal & Urology" \
  --topic "Urinary tract infection" \
  --topic-id "optional-topic-uuid" \
  --n 12 \
  --out output/flashcards/urinary-tract-infection.jsonl
```

## Batch generate from topics_rows.json

```bash
python scripts/flashcards/batch_generate.py \
  --out-dir output/flashcards \
  --n 12 \
  --model gpt-5.2 \
  --limit 5
```

The batch script writes completed topic UUIDs to:

```text
output/flashcards/done_topics.txt
```

This makes it resume-safe.

## Validate generated cards

```bash
python scripts/flashcards/validate_flashcards.py output/flashcards
```

Validation checks include:

- required fields
- clinically framed prompt and context
- mandatory safety check
- hidden source metadata
- no visible NICE/BNF/UKMLA labels in student-facing fields
- dose review requirement where required

## Export to CSV

```bash
python scripts/flashcards/export_flashcards.py output/flashcards \
  --format csv \
  --out output/flashcards/prescribing_flashcards.csv
```

## Export to SQL

```bash
python scripts/flashcards/export_flashcards.py output/flashcards \
  --format sql \
  --table prescribing_flashcards \
  --out output/flashcards/prescribing_flashcards.sql
```

Review table and column names before running SQL in Supabase.

## Clinical governance notes

Every generated card should be treated as `needs-review` until checked by a SynapseUK clinical reviewer.

The generator is designed to produce structured drafts, not final approved prescribing guidance.

Do not publish cards until the hidden `sourceMeta`, clinical answer, safety checks, and dose/duration have been reviewed against current UK guidance.
