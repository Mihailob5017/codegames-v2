---
description: Review the current changes with code-reviewer, then write tests with test-writer once approved
argument-hint: "[base-branch | commit | range]"
---

Run the two-stage review for this repo.

**Scope argument:** `$ARGUMENTS`. If it's empty, the scope is the default: changes since the merge-base with `main`, plus uncommitted and untracked work.

**State file:** `.claude/review-state/last-review.md` (gitignored). It holds the last report that ended in CHANGES REQUESTED, so a rerun can check those findings again.

## Steps

1. **Load the previous report.** If `.claude/review-state/last-review.md` exists, read it. It's the previous report for this rerun.

2. **Run the review.** Launch the `code-reviewer` subagent with a prompt that contains:
   - the scope argument (or "default scope");
   - if there's a previous report, its full text and this instruction: "This is a rerun. Check every 🔴 Blocker and 🟠 Major from the previous report and fill in the Previous findings table."

3. **Read the verdict** from the last line of the reviewer's report.
   - **`NO CHANGES`:** tell me there's nothing to review, and stop.
   - **`CHANGES REQUESTED`**, or no verdict line:
     1. Save the full report to `.claude/review-state/last-review.md`, replacing what's there.
     2. Show me the full report exactly as the reviewer wrote it.
     3. Stop, and end with: "Fix these (or ask me to), then run `/review` again."

     Don't fix anything yourself in this command, and don't run test-writer.
   - **`APPROVED`:** if there was a previous report, check the reviewer's Previous findings table yourself. Every 🔴 and 🟠 item from the previous report must be listed and marked **Resolved**. If any is missing or not resolved, treat the result as CHANGES REQUESTED and follow that branch instead. Otherwise show me the report and continue.

4. **Write the tests.** Launch the `test-writer` subagent with a prompt that contains:
   - the full APPROVED report;
   - the full text of the previous report, if there was one, so it can add regression tests for the findings that were fixed;
   - the scope argument.

5. **Check the test-writer's work.** Run `git status --short` and confirm that the only new changes since step 2 are test files. If anything else changed, say so prominently.

6. **Clean up.** If the test-writer's status is `PASSED`, delete `.claude/review-state/last-review.md`.

7. **Report the final status.** Show the test-writer's summary exactly as written, then this:

   ```markdown
   ## /review result

   - **Review:** APPROVED (round <n>, where 1 means approved first time) · <n> minor, <n> questions still open
   - **Tests:** PASSED | FAILED | BUG FOUND · <n> test files added or changed
   - **Production code untouched:** ✅ / ❌
   - **Next step:** <commit, with a suggested message in the repo style `[feature|fix|config|refactor|test|docs] summary` | fix the failing tests | fix the bug, then run /review again>
   ```

## Rules

- Never stage, commit or push.
- Subagent reports aren't shown to me directly, so always relay them in full.
- If the test-writer reports `BUG FOUND`, show me the bug and stop. Don't fix production code unless I ask.
