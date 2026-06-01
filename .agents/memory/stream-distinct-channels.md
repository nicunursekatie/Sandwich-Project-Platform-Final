---
name: Stream Chat distinct channels
description: Why group member-editing fails and how channel IDs must be assigned
---

Stream Chat `messaging` channels created with NO id but a member list become **distinct** channels (their identity is the sorted member set). Distinct channels CANNOT have members added/removed — `addMembers`/`removeMembers` throw error code 17 ("cannot add members to the distinct channel they don't belong to").

**Rule:** only 1:1 DMs should be distinct (no id → same pair always maps to one channel). Any group chat (3+ members, or a named group) MUST be created with an explicit channel id, or its membership is frozen forever.

**Why:** users hit "Failed to update group / error code 17" when adding members to groups that were created without an id. Existing distinct groups can never be fixed in place — must recreate.
