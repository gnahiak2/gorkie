# Brokered git credentials

The sandbox holds no GitHub token at rest. `github_checkout` and
`github_push_branch` borrow one for the length of a single operation by writing
it into the sandbox's environment overlay as a git `http.extraheader`, then
removing it in a `finally`.

The header is scoped to `https://github.com/`, so git never sends it to another
host, and nothing lands in the remote URL or `.git/config`.

## Code

| gorkie | what it does |
| --- | --- |
| `tools/github/git.ts` | `git()` runs a command through the sandbox; `withCredential()` opens and closes the window |
| `tools/github/checkout.ts` | clones or fetches into `<working dir>/<owner__repo>` |
| `tools/github/push.ts` | pushes a committed branch from that checkout |

`GIT_CONFIG_COUNT=1`, `GIT_CONFIG_KEY_0=http.https://github.com/.extraheader`,
and `GIT_CONFIG_VALUE_0=Authorization: Basic base64(x-access-token:TOKEN)` are
set on the sandbox's runtime env overlay for the duration of `operation()`. The
overlay is merged per spawn, so every git call inside the window is
authenticated and the environment is clean again once the window closes.

Two deliberate differences from the previous E2B firewall brokering. There is no
network layer to attach the header to, so it travels in the process environment
instead. And cleanup cannot fail the way an `updateNetwork` call could, so there
is no retry or sandbox-kill path; the overlay is removed unconditionally.

## Residual risk

This bounds the token's lifetime, not what can use it. While the window is open,
anything the model runs in the same sandbox can make an authenticated git
request to github.com, including a concurrent `execute_command`, since the
credential sits in the process environment rather than on one command. The
`serialize()` lock only covers our own overlapping calls.

A checkout also outlives the turn in a directory the whole thread shares, so
anyone in that thread can later read the code it pulled down.
