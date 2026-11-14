# Mira — live demo script (about 4 minutes)

**Before you start:** go to Profile → **Reset demo learner**. Keep the Agent activity drawer in mind; it opens automatically during agent runs.

| # | Do | Say |
|---|---|---|
| 1 | Open **Overview** | "Learning platforms hand everyone the same courses and never check whether a skill is real. Mira treats every skill as a claim until there is evidence." |
| 2 | Click **Analyze my skills** and watch the drawer | "Five specialised agents. Skill Intelligence links Priya's certificate and project to skills. The deterministic engine computes readiness. Career Matching and the Learning Path Architect run in parallel (shown with ‖). Mira summarises. Each step shows its model, duration and tokens." |
| 3 | Open **Career Twin**, then expand SQL and JavaScript in the evidence ledger | "Every number traces back to its evidence. Self-reports count at 0.75, evidence-backed skills at 0.9, assessed skills at their verified level. JavaScript comes before React because React depends on it." |
| 4 | Open **Roadmap**, set *JavaScript* to **Done** | "Completing a course is a claim. Readiness rises a little, but it's still unverified." |
| 5 | Open **Assessments** → JavaScript Core Check and answer weakly (get the 2 type questions right) | "Graded against a fixed answer key, so 25% means verified level Basic." |
| 6 | Watch the drawer re-run 4 agents, then open **Career Twin** → *What changed in roadmap v2* | "Readiness drops, the JS estimate falls to 1, and remediation for closures, async, objects and the DOM goes in **before React**." |
| 7 | Open **Ask Mira** → "Why did my roadmap change?" | Mira cites the actual attempt and the before/after values. |
| 8 | In **Career Twin**, go to *Compare career goals* → Data Analyst → **Switch goal** | "Same evidence, new requirements. There's a new gap analysis and roadmap, and the Full Stack history and assessments are kept." |
| 9 | Refresh the browser | Everything persists (SQLite). |
| 10 | Open **Cohort insights** | "For universities and employers: the same engine across a cohort shows which gaps are real (assessed) versus only claimed, ranked by readiness impact." (Clearly labelled sample cohort.) |
| 11 | Close | "Universities and employers can aggregate *verified* gaps to prioritise training. Readiness is a transparent estimate, never a hiring probability." |
