#!/usr/bin/env node
// Session-length guard (mezo-lwsig, after the token diet mezo-hsc75).
//
// Runs on UserPromptSubmit and PostToolUse. Every API call re-reads the whole conversation, so a session that grew
// past ~250k tokens of context, or that has been running for more than a day, should wrap up and hand off
// (munkamenet skill, lezárás). The hook tells the agent so via additionalContext — at most once per WINDOW per
// session, never in subagents. It must never break a tool call: any error → silent exit 0.
//
// Reads only the head (first timestamp) and the tail (last usage) of the transcript, so it stays fast on 100 MB files.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CONTEXT_LIMIT = Number(process.env.MEZO_GUARD_CONTEXT ?? 250_000); // tokens in the latest call
const AGE_LIMIT_H = Number(process.env.MEZO_GUARD_AGE_H ?? 24); // hours since the session's first entry
const WINDOW_MIN = Number(process.env.MEZO_GUARD_WINDOW_MIN ?? 45); // repeat the reminder at most this often
const STATE_DIR = path.join(os.tmpdir(), 'mezo-session-guard');

function readSlice(file, start, length) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(length);
    const n = fs.readSync(fd, buf, 0, length, start);
    return buf.subarray(0, n).toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function firstTimestamp(file) {
  for (const line of readSlice(file, 0, 256 * 1024).split('\n')) {
    const m = line.match(/"timestamp":"([^"]+)"/);
    if (m) return Date.parse(m[1]);
  }
  return NaN;
}

function lastContextTokens(file, size) {
  const len = Math.min(size, 2 * 1024 * 1024);
  const lines = readSlice(file, size - len, len).split('\n').reverse();
  for (const line of lines) {
    if (!line.includes('"usage"') || !line.includes('"assistant"')) continue;
    try {
      const u = JSON.parse(line)?.message?.usage;
      if (u) {
        return (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
      }
    } catch {
      /* partial first line of the slice */
    }
  }
  return 0;
}

function main(raw) {
  const input = JSON.parse(raw || '{}');
  if (input.agent_id || input.agent_type) return; // subagents: short-lived, not ours to nag
  const file = input.transcript_path;
  const event = input.hook_event_name ?? 'UserPromptSubmit';
  if (!file || !fs.existsSync(file)) return;

  const size = fs.statSync(file).size;
  const ctx = lastContextTokens(file, size);
  const ageH = (Date.now() - firstTimestamp(file)) / 3_600_000;
  const tooBig = ctx > CONTEXT_LIMIT;
  const tooOld = Number.isFinite(ageH) && ageH > AGE_LIMIT_H;
  if (!tooBig && !tooOld) return;

  fs.mkdirSync(STATE_DIR, { recursive: true });
  const stamp = path.join(STATE_DIR, `${(input.session_id ?? 'x').replace(/[^\w-]/g, '')}.last`);
  const last = fs.existsSync(stamp) ? Number(fs.readFileSync(stamp, 'utf8')) : 0;
  if (Date.now() - last < WINDOW_MIN * 60_000) return;
  fs.writeFileSync(stamp, String(Date.now()));

  const why = [
    tooBig ? `the context is ~${Math.round(ctx / 1000)}k tokens (limit ${CONTEXT_LIMIT / 1000}k) — every step re-reads all of it` : null,
    tooOld ? `the session has been running for ~${Math.round(ageH)} hours (limit ${AGE_LIMIT_H}h)` : null,
  ]
    .filter(Boolean)
    .join('; ');
  const msg =
    `SESSION-LENGTH GUARD (mezo-lwsig): ${why}. At the next safe point (tests green or work committed — never ` +
    `mid-edit), switch to the munkamenet skill, mode "lezárás": if about 25 steps or fewer remain, finish here and ` +
    `archive this session; if more, push the branch, write the handoff into the bd issue, start ONE fresh session, ` +
    `detach it (detach_session) and archive this one at once — never wait for it, no Notion push before a handoff. ` +
    `Tell the owner in one Hungarian sentence that you are wrapping up to save tokens.`;

  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: msg } }));
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    main(raw);
  } catch {
    /* never block the session */
  }
  process.exit(0);
});
