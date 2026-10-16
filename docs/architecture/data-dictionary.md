# Data Dictionary

Table-by-table description of the Qaryati database. The diagrams are in [erd.md](erd.md), and
the reasoning behind provenance and verification is in
[ADR-0005](../adr/0005-data-provenance-and-verification.md).

## Conventions

- **Engine / charset:** InnoDB, `utf8mb4`, collation `utf8mb4_0900_ai_ci` (Arabic and English).
- **Primary keys:** `id INT UNSIGNED AUTO_INCREMENT` (`BIGINT` for `audit_logs`).
- **Timestamps:** every table has `created_at` and `updated_at` (`DATETIME(3)`), managed by Prisma.
- **Naming:** tables are `snake_case` and plural. Prisma models are `PascalCase` and mapped with `@@map`.
- **Foreign keys:** every FK column has an index. `ON DELETE RESTRICT` unless stated otherwise.
- **Fixed value sets:** MySQL `ENUM`, mirrored as Prisma enums.

## Shared blocks

### Provenance block (on every fact table)

Fact tables: `village_names`, `population_records`, `historical_events`, `landmarks`,
`cultural_traits`, `economic_activities`, `facilities`, `village_relations`.

| Column | Type | Null | Notes |
|---|---|---|---|
| source_id | INT FK → sources | NO\* | where the fact comes from (\*nullable only on `village_names`, for the current official name) |
| status | ENUM(`PENDING`,`VERIFIED`,`REJECTED`) | NO | default `PENDING` |
| submitted_by | INT FK → users | NO | contributor who added it |
| verified_by | INT FK → users | YES | verifier who decided |
| verified_at | DATETIME | YES | |
| rejection_reason | VARCHAR(500) | YES | required when `status = REJECTED` (service rule) |

Index on every fact table: `(status)`, used by the verifier queue.

### Preferred flag (only where values can conflict)

| Column | Type | Null | Notes |
|---|---|---|---|
| is_preferred | TINYINT(1) | YES | `1` = preferred, `NULL` = not preferred (never `0`) |

Only on `population_records` and `village_names`. A unique index that includes `is_preferred`
allows many `NULL` rows but only one `1` per conflict group (see each table).

---

## Geography and administration

### `governorates`
| Column | Type | Null | Notes |
|---|---|---|---|
| id | INT PK | NO | |
| name_ar | VARCHAR(100) | NO | UNIQUE |
| name_en | VARCHAR(100) | NO | UNIQUE |

Reference data, loaded by seed script.

### `municipalities`
Municipalities and village councils.
| Column | Type | Null | Notes |
|---|---|---|---|
| id | INT PK | NO | |
| governorate_id | INT FK → governorates | NO | indexed |
| name_ar | VARCHAR(150) | NO | |
| name_en | VARCHAR(150) | NO | |
| type | ENUM(`MUNICIPALITY`,`VILLAGE_COUNCIL`,`JOINT_COUNCIL`) | NO | |

Constraints: UNIQUE `(governorate_id, name_ar)`.

### `villages`
| Column | Type | Null | Notes |
|---|---|---|---|
| id | INT PK | NO | |
| name_ar | VARCHAR(150) | NO | current official name, copied from `village_names` for fast list/sort |
| name_en | VARCHAR(150) | NO | |
| name_origin | TEXT | YES | meaning and origin of the name |
| governorate_id | INT FK → governorates | NO | most common filter |
| municipality_id | INT FK → municipalities | YES | local authority, if known |
| latitude | DECIMAL(9,6) | NO | required; geocoded if the contributor does not provide it |
| longitude | DECIMAL(9,6) | NO | required |
| location | POINT SRID 4326 | NO | `GENERATED ALWAYS AS (ST_SRID(POINT(latitude, longitude), 4326)) STORED`. SRID 4326 is latitude-first in MySQL 8 |
| location_description | TEXT | YES | |
| elevation_m | INT | YES | |
| area_dunum | DECIMAL(10,2) | YES | |
| deleted_at | DATETIME | YES | soft delete: hidden from the API, restorable by an admin |

Indexes:
- `(governorate_id, name_ar)` for filter + sort
- `(municipality_id)`
- `SPATIAL (location)` for nearby villages
- `(deleted_at)`

Rules:
- If `municipality_id` is set, its governorate must equal `governorate_id` (service rule).
- Only `VERIFIER` and `ADMIN` can create villages, so villages themselves have no verification status.
- When a village is hidden, all of its facts are hidden too.

### `village_names`
All names of a village: current, English, historical, transliterations and alternatives.
| Column | Type | Null | Notes |
|---|---|---|---|
| id | INT PK | NO | |
| village_id | INT FK → villages | NO | indexed, `ON DELETE CASCADE` |
| name | VARCHAR(150) | NO | `FULLTEXT` index |
| language | ENUM(`AR`,`EN`,`OTHER`) | NO | |
| type | ENUM(`CURRENT`,`ENGLISH`,`HISTORICAL`,`TRANSLITERATION`,`ALTERNATIVE`) | NO | |
| period_note | VARCHAR(255) | YES | e.g. "Ottoman era" |
| + provenance block, + `is_preferred` | | | |

Constraints:
- UNIQUE `(village_id, name, type)`
- UNIQUE `(village_id, language, type, is_preferred)`, one preferred name per language and type

### `village_relations`
Non-distance relationships between villages.
| Column | Type | Null | Notes |
|---|---|---|---|
| id | INT PK | NO | |
| village_id | INT FK → villages | NO | |
| related_village_id | INT FK → villages | NO | indexed |
| type | ENUM(`SPLIT_FROM`,`MERGED_WITH`,`FORMERLY_PART_OF`,`OTHER`) | NO | read as "village *type* related village" |
| year | SMALLINT | YES | |
| + provenance block | | | |

Constraints:
- UNIQUE `(village_id, related_village_id, type)`
- `CHECK (village_id <> related_village_id)`

---

## Facts about a village

### `population_records`
One row means "according to source X, village Y had Z people in year N".
| Column | Type | Null | Notes |
|---|---|---|---|
| id | INT PK | NO | |
| village_id | INT FK → villages | NO | |
| year | SMALLINT | NO | |
| population | INT UNSIGNED | NO | |
| households | INT UNSIGNED | YES | |
| notes | TEXT | YES | |
| + provenance block (source required), + `is_preferred` | | | |

Constraints:
- UNIQUE `(village_id, year, source_id)`: one number per source per year
- UNIQUE `(village_id, year, is_preferred)`: one preferred number per village and year

Index: `(village_id, year)` for population-over-time reports.

### `historical_events`
| Column | Type | Null | Notes |
|---|---|---|---|
| id | INT PK | NO | |
| title | VARCHAR(255) | NO | |
| description | TEXT | NO | |
| category | ENUM(`POLITICAL`,`SOCIAL`,`ECONOMIC`,`CULTURAL`,`NATURAL`,`OTHER`) | NO | |
| year_from | SMALLINT | NO | |
| year_to | SMALLINT | YES | for ranges. `CHECK (year_to IS NULL OR year_to >= year_from)` |
| date_precision | ENUM(`EXACT`,`YEAR`,`DECADE`,`APPROXIMATE`) | NO | records how certain the date is |
| + provenance block (source required) | | | |

Index: `(year_from)`.

### `event_villages`
Links one event to one or more villages.
| Column | Type | Null | Notes |
|---|---|---|---|
| event_id | INT FK → historical_events | NO | composite PK, `ON DELETE CASCADE` |
| village_id | INT FK → villages | NO | composite PK, indexed |
| note | VARCHAR(255) | YES | e.g. "most affected" |

PK `(event_id, village_id)`, so the same village can't be linked to an event twice.
Index `(village_id, event_id)` for a village's timeline.

### `landmarks`
| Column | Type | Null | Notes |
|---|---|---|---|
| id | INT PK | NO | |
| village_id | INT FK → villages | NO | |
| name_ar | VARCHAR(150) | NO | |
| name_en | VARCHAR(150) | YES | |
| type | ENUM(`MOSQUE`,`CHURCH`,`SHRINE`,`SPRING`,`ARCHAEOLOGICAL_SITE`,`OLD_BUILDING`,`NATURAL`,`OTHER`) | NO | |
| description | TEXT | YES | |
| latitude / longitude | DECIMAL(9,6) | YES | optional, not every landmark has a known spot |
| period | VARCHAR(100) | YES | e.g. "Ottoman era" |
| condition | ENUM(`GOOD`,`DAMAGED`,`DESTROYED`,`UNKNOWN`) | NO | default `UNKNOWN` |
| + provenance block (source required) | | | |

Index: `(village_id, type)`.

### `cultural_traits`
| Column | Type | Null | Notes |
|---|---|---|---|
| id | INT PK | NO | |
| village_id | INT FK → villages | NO | |
| category | ENUM(`FOOD`,`CRAFT`,`DRESS`,`MUSIC_DANCE`,`FESTIVAL`,`DIALECT`,`CUSTOM`,`OTHER`) | NO | |
| title | VARCHAR(200) | NO | e.g. "Musakhan" |
| description | TEXT | YES | |
| + provenance block (source required) | | | |

Index: `(village_id, category)`.

### `economic_activities`
| Column | Type | Null | Notes |
|---|---|---|---|
| id | INT PK | NO | |
| village_id | INT FK → villages | NO | |
| type | ENUM(`AGRICULTURE`,`LIVESTOCK`,`TRADE`,`CRAFT`,`INDUSTRY`,`TOURISM`,`SERVICES`,`OTHER`) | NO | |
| name | VARCHAR(200) | NO | e.g. "Olive growing" |
| description | TEXT | YES | |
| importance | ENUM(`MAIN`,`SECONDARY`) | NO | |
| year_from / year_to | SMALLINT | YES | when the activity was practised |
| + provenance block (source required) | | | |

Index: `(village_id, type)`.

### `facilities`
Services in a village. Religious and historic buildings belong in `landmarks`.
| Column | Type | Null | Notes |
|---|---|---|---|
| id | INT PK | NO | |
| village_id | INT FK → villages | NO | |
| type | ENUM(`SCHOOL`,`CLINIC`,`HOSPITAL`,`POST_OFFICE`,`WATER_NETWORK`,`ELECTRICITY`,`COMMUNITY_CENTER`,`OTHER`) | NO | |
| name | VARCHAR(200) | NO | |
| status | ENUM(`ACTIVE`,`CLOSED`,`PLANNED`) | NO | operational status (not the verification status, which is `verification_status` here) |
| year_established | SMALLINT | YES | |
| latitude / longitude | DECIMAL(9,6) | YES | optional |
| + provenance block (source required) | | | |

Because `facilities` already has an operational `status`, its provenance column is named
**`verification_status`** in this table only.

Index: `(village_id, type)`.

---

## Sources

### `sources`
Shared by every fact table.
| Column | Type | Null | Notes |
|---|---|---|---|
| id | INT PK | NO | |
| type | ENUM(`BOOK`,`ARTICLE`,`CENSUS`,`ARCHIVE`,`WEBSITE`,`ORAL`,`OTHER`) | NO | `ORAL` = oral history / interview |
| title | VARCHAR(300) | NO | |
| author | VARCHAR(200) | YES | |
| publisher | VARCHAR(200) | YES | |
| year | SMALLINT | YES | |
| url | VARCHAR(500) | YES | |
| accessed_at | DATE | YES | for websites |
| created_by | INT FK → users | NO | |

Index: `(type)`.

---

## Accounts and audit

### `users`
Only contributors, verifiers and admins have accounts. Reading the API is public.
| Column | Type | Null | Notes |
|---|---|---|---|
| id | INT PK | NO | |
| email | VARCHAR(255) | NO | UNIQUE |
| password_hash | VARCHAR(255) | NO | bcrypt |
| full_name | VARCHAR(150) | NO | |
| role | ENUM(`ADMIN`,`VERIFIER`,`CONTRIBUTOR`) | NO | default `CONTRIBUTOR` |
| is_active | BOOLEAN | NO | default `true`; disabled accounts cannot log in |
| last_login_at | DATETIME | YES | |

Roles are a fixed list (an enum), not a table. Permissions:

| Role | Can do |
|---|---|
| CONTRIBUTOR | add facts and sources (facts start as `PENDING`), edit own pending facts |
| VERIFIER | everything a contributor can do, plus verify, reject, set preferred, create villages |
| ADMIN | everything, plus manage users and hide or restore villages |

### `refresh_tokens`
| Column | Type | Null | Notes |
|---|---|---|---|
| id | INT PK | NO | |
| user_id | INT FK → users | NO | indexed, `ON DELETE CASCADE` |
| token_hash | CHAR(64) | NO | UNIQUE, SHA-256 of the token |
| expires_at | DATETIME | NO | |
| revoked_at | DATETIME | YES | set on logout or rotation |

### `audit_logs`
Append-only change history. The application never updates or deletes rows.
| Column | Type | Null | Notes |
|---|---|---|---|
| id | BIGINT PK | NO | |
| user_id | INT FK → users | YES | `NULL` for system actions (e.g. seeding) |
| action | ENUM(`CREATE`,`UPDATE`,`DELETE`,`RESTORE`,`VERIFY`,`REJECT`,`SET_PREFERRED`) | NO | |
| entity_type | VARCHAR(50) | NO | e.g. `population_record` |
| entity_id | INT UNSIGNED | NO | |
| before | JSON | YES | `NULL` on create |
| after | JSON | YES | `NULL` on delete |
| ip_address | VARCHAR(45) | YES | IPv4 or IPv6 |
| created_at | DATETIME(3) | NO | |

Indexes:
- `(entity_type, entity_id, created_at)`: history of one record
- `(user_id, created_at)`: what a user changed

The audit row is written in the **same transaction** as the change it describes.
