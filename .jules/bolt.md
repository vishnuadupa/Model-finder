## 2024-05-19 - String to Number parsing bug breaking logic when doing math
**Learning:** `parseInt` or similar is required when performing math on values parsed from a string range (e.g., `tokPerSec` "20-30" / 500) since division will yield `NaN`, silently cascading `NaN` across calculations like sorting ranks.
**Action:** Always parse strings representing numeric metrics before applying math operations, especially when using bounds or ranges from text variables.

## 2024-05-19 - Mutating properties inside objects for sorting
**Learning:** Mutating objects by appending temporary properties (like `_rank`) inside functions pollutes the returned data and leaks internal sorting logic, leading to dirty state.
**Action:** Apply Schwartzian transform (map to `{ item, rank }`, sort, then map back to `item`) instead of attaching temporary sorting properties to objects directly.
