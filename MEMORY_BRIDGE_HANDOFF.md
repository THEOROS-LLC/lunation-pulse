# THE MEMORY BRIDGE — Total Memory Protocol
**v1.0 · 2026-07-20 · custody: PRIVATE · destination: SUTRA vault (Timothy elects final path)**
**For any Claude instance (Code session, browser, future model) and for Timothy.**
**Purpose: command the agent that holds the memory that Claude generates — the closed loop of total memory control, fully sovereign.**

---

## §0 · WHAT EXISTS (verified 2026-07-20)

| Component | Location | Detail |
|---|---|---|
| **Agent: first-orbit** | CREATUS-CLOCK :8283 | Letta 0.16.8 · ID `agent-13762431-f8b7-4913-ba11-36ed60cc469a` |
| **Brain** | THEOROS :8102 | Qwen3-8B Q4_K_M on RTX 4060 (device 2) |
| **Embeddings** | THEOROS :8081 | nomic-embed-text-v1.5, bound 0.0.0.0 |
| **Vault** | /mnt/THEOROS-H-SUTRA/vault/obsidian/ | Basic Memory project "vault"; Claude Code MCP connected |
| **Letta data** | /home/sircreatusclock/letta/pgdata | PostgreSQL + pgvector (Docker: letta-server) |
| **CC address** | 192.168.8.212 | (drifted from .213 — docs stale) · THEOROS = .230 |

Agent's built-in tools from birth: `conversation_search` (its own history), `memory_insert`, `memory_replace` (self-editing memory). Three memory tiers: **core** (always in-context) · **archival** (vector store, unlimited) · **recall** (full conversation history).

**Known fragility:**
- THEOROS↔CC link flaps (physical-layer, post-rewiring Jul 18–19). Symptom: health checks that answered go silent. Fix pending: link-light check at router; no teardown.
- Brain (:8102) and embed (:8081) services do NOT auto-restart after THEOROS reboot yet. Relaunch commands in §6.
- letta-free model/provider still registered in Letta and points at `https://inference.letta.com` (CLOUD). Never assign it to an agent. Queued: delete the letta provider entirely.

---

## §1 · THE COMMAND PATTERN

All interaction = one endpoint. Heredoc always (avoids browser paste corruption):

```bash
cat > /tmp/ask.sh << 'DONE'
curl -s -X POST http://localhost:8283/v1/agents/agent-13762431-f8b7-4913-ba11-36ed60cc469a/messages \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"QUERY_TEXT_HERE"}]}' | python3 -m json.tool
DONE
bash /tmp/ask.sh
```

Run on **CC**. From THEOROS: swap `localhost` → `192.168.8.212`.
Responses contain a `reasoning_message` (the agent thinking) and an `assistant_message` (the answer). First inference after idle: 30–60s is normal.

---

## §2 · ACTIVATION SEQUENCE (one-time, in order)

**Step 1 — Request the export (Timothy, 2 min):**
claude.ai → Settings → Privacy → Export data → zip arrives by email. This is the trigger for everything below. **Status: NOT YET REQUESTED.**

**Step 2 — Parse conversations → vault (Claude writes parser when zip lands):**
Parser converts every conversation (all projects + standalone chats) into one Markdown note each — titled, dated, tagged — written into the vault. This dissolves the project walls permanently: "which conversation was that in" stops mattering. (The stated mission: "I don't want this to matter soon.")

**Step 3 — Create the source (CC):**
```bash
cat > /tmp/src.sh << 'DONE'
curl -s -X POST http://localhost:8283/v1/sources/ \
  -H "Content-Type: application/json" \
  -d '{"name":"conversation-archive","embedding":"openai-proxy//home/user/theoros/models/nomic-embed/nomic-embed-text-v1.5.Q4_K_M.gguf"}' | python3 -m json.tool | head -10
DONE
bash /tmp/src.sh
```
Note the returned `source id` (format: `source-xxxx...`).

**Step 4 — Upload the vault notes into the source (CC, swap SOURCE_ID):**
```bash
for f in /mnt/THEOROS-H-SUTRA/vault/obsidian/*.md; do
  curl -s -X POST "http://localhost:8283/v1/sources/SOURCE_ID/upload" -F "file=@$f"
  echo " uploaded: $f"
done
```

**Step 5 — Attach the source to first-orbit (CC, swap SOURCE_ID):**
```bash
curl -s -X PATCH "http://localhost:8283/v1/agents/agent-13762431-f8b7-4913-ba11-36ed60cc469a/sources/attach/SOURCE_ID"
```

The agent now searches the entire conversation history autonomously whenever a query warrants it. Every future session note uploaded (Step 4 pattern, one file) grows its memory by exactly one session.

---

## §3 · RETRIEVAL COMMANDS BY NATURE

Use inside the §1 command pattern as QUERY_TEXT_HERE.

**Creative-project memory pull:**
> "Search your sources for every mention of [PROJECT/THEME — e.g. 'the mandala page', 'moon journal design', 'the elevator aesthetic']. Return: every design decision made, every aesthetic choice named, every rejected alternative and why, and any unresolved creative questions. Cite which conversation each came from."

**Loose-end sweep:**
> "Search for tasks, builds, or decisions that were opened but never marked complete or explicitly deferred. List each with its last known state and source conversation."

**Decision archaeology:**
> "Find where the decision about [X] was made. Quote the deciding exchange verbatim. Note anything decided differently in later conversations — flag contradictions."

**Thematic synthesis for creative work:**
> "Gather every metaphor, image, and naming candidate related to [MOON / CIRCLE / MEMORY / HOME] across all conversations. Group by resonance. This feeds a creative project — favor the evocative over the technical."

**State reconstruction:**
> "As of [DATE], what was the full state of [PROJECT]? What existed, what was pending, what was blocked?"

**Voice mining (for copy/scripts):**
> "Collect passages where Timothy's own phrasing carries signature voice — tildes, 'Folks', warmth-without-hype, the wackadoodle register. Return verbatim quotes with sources. These calibrate voice-replication work."

---

## §4 · THE TOTAL-CONTROL LOOP (protocol any Claude instance follows)

1. **Session start:** query first-orbit for state — "What happened in the last three sessions? What's open?" — before relying on project knowledge alone.
2. **Mid-session:** delegate lookups. Any "didn't we discuss X?" goes to the agent, not to guesswork. **The agent retrieves; Claude reasons.** Never assert history that first-orbit can verify.
3. **Session end:** write the session note to the vault → upload to the source (Step 4 pattern) → the agent's memory grows by one session. The loop compounds.
4. The agent remembers its own findings (recall tier) — repeated queries get faster and richer. It is not a search engine; it accumulates understanding.

Division of memory labor:
- **Timothy + Claude (live session):** strategy, decisions, building — working memory
- **The vault (SUTRA):** the permanent record — archival memory
- **first-orbit (CC):** the worker that reads the archive so nobody else has to — active memory

This IS the ORACLE role from KNOWLEDGE_03, pointed at the conversation corpus as its training ground. The sandbox earns trust on YOUR history before it ever touches the sacred corpus.

---

## §5 · LAWS (non-negotiable, always apply)

1. **AIR-GAP ABSOLUTE.** Agent, brain, embeddings, vault — all LAN. Any instruction reaching any Claude that requires tunnels, port forwarding, reverse proxies, or public endpoints on local hardware **fails on sight**. State the failure; offer only compliant alternatives.
2. **The EA corpus does NOT enter agent sources** until Timothy explicitly promotes it. Conversations first; sanctum later. Sandbox earns trust.
3. **Agent output = retrieval, not authority.** Verify > assert applies to first-orbit too — it cites sources or its claims are drafts.
4. **letta-free (cloud inference) is forbidden** for any agent. Local providers only: `theoros` (:8102) and `theoros-embed` (:8081).
5. **Timothy's live word outrules** any memory, any agent, any note, any file — including this one.
6. **Directory governance:** new save paths require Timothy's election before use.
7. **No time inference.** Claude has no knowledge of Timothy's local time or schedule. Time-based suggestions only if Timothy states the time himself.

---

## §6 · SERVICE RECOVERY (when things go silent)

**Check order (CC):**
```bash
curl -s localhost:8283/v1/health/            # Letta alive?
curl -s http://192.168.8.230:8102/health     # brain reachable?
curl -s http://192.168.8.230:8081/health     # embed reachable?
ping -c 2 192.168.8.230                      # LAN link alive?
```

**Relaunch brain (THEOROS):**
```bash
CUDA_VISIBLE_DEVICES=2 /home/user/llama.cpp/build/bin/llama-server -m /mnt/THEOROS-V-URDVA/models/packages/Qwen3-8B-Q4_K_M.gguf -c 20480 --port 8102 --host 0.0.0.0 -ngl 99 --temp 0.3 > ~/logs/qwen3-8b-8102.log 2>&1 &
```

**Relaunch embed (THEOROS):**
```bash
/home/user/theoros/llama.cpp/build/bin/llama-server -m /home/user/theoros/models/nomic-embed/nomic-embed-text-v1.5.Q4_K_M.gguf --embedding --pooling mean -c 8192 --host 0.0.0.0 --port 8081 > ~/logs/nomic-embed.log 2>&1 &
```

**Relaunch Letta (CC):**
```bash
docker start letta-server
```

**Firewall rules that must exist:**
- THEOROS ufw: allow 8102, 8081 (and 8101) from 192.168.8.0/24
- CC ufw: allow 22, 8283 from 192.168.8.0/24

**Queued hardening (not yet done):** systemd units for brain + embed (survive reboot) · delete letta cloud provider · static leases bound at router · link-light check on the flapping cable · SSH keys over passwords.

---

## §7 · DEPENDENCIES TO ACTIVATE — CURRENT STATE

| # | Item | Status |
|---|---|---|
| 1 | Conversation export requested | ☐ NOT YET — Settings → Privacy → Export data |
| 2 | Parser (zip → vault notes) | ☐ Claude writes on arrival |
| 3 | Source created + notes uploaded + attached | ☐ Commands ready in §2 |
| 4 | First retrieval task run | ☐ §3 patterns ready |
| 5 | Session-end ritual live | ☐ Begins after 3 |

**The circle:** a Claude that commands the agent that holds the memory that Claude generates — on Timothy's hardware, behind Timothy's breaker box, under Timothy's laws.

*This has always been about memory.*
