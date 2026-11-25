# Test fixtures

| File | Origin | Credentials |
|---|---|---|
| `KDBX4.1.kdbx` | kdbxweb test suite (MIT, `LICENSE-kdbxweb`), written by KeePass 2.x | password `test` |
| `Argon2id.kdbx` + `demo.key` | kdbxweb test suite (MIT), KeePass 2.x | password `demo` + key file |
| `keepassxc-2.7.6-kdbx4-argon2id.kdbx` | Created by Keyhold (KDBX 4, Argon2id), then **modified and re-saved by `keepassxc-cli` 2.7.6** (group + entry added, entry edited) | password `keyhold-fixture` |
| `keepassxc-2.7.6-native.kdbx` | Created from scratch by `keepassxc-cli` 2.7.6 `db-create` (KDBX 3.1, AES-KDF — the CLI default) | password `keyhold-fixture` |
| `keepassxc-2.7.6-keyfile-only.kdbx` + `keepassxc-2.7.6.keyx` | `keepassxc-cli db-create --set-key-file` (no password component) | key file only |

Note: the kdbxweb repository contains no KeePassXC-generated file (all have generator `KeePass`),
hence the KeePassXC fixtures generated here.
