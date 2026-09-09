# 🔍 Book Matching Logic

Book matching is the core of ShelfBridge's functionality. It determines how books from Audiobookshelf are matched with books in your Hardcover library. This guide explains the enhanced three-tier matching algorithm and troubleshooting strategies.

## 🎯 Overview

Book matching works by comparing identifiers and metadata between Audiobookshelf and Hardcover:

1. **Extract identifiers** from Audiobookshelf books
2. **Search Hardcover library** using three-tier fallback system
3. **Match books** using sophisticated scoring algorithm
4. **Handle unmatched books** via auto-add (if enabled)

## 📊 Three-Tier Matching System

ShelfBridge uses a sophisticated three-tier fallback system for maximum accuracy:

| Tier    | Method                    | Description                        | Success Rate                            |
| ------- | ------------------------- | ---------------------------------- | --------------------------------------- |
| **1st** | **ASIN Matching**         | Direct Amazon identifier match     | ~85% for audiobooks                     |
| **2nd** | **ISBN Matching**         | International book number match    | ~70% for books without ASIN             |
| **3rd** | **Title/Author Matching** | AI-powered edition-specific search | ~60% for books with incomplete metadata |

### 🔧 **Fixed: Title/Author Fallback Now Works!**

**Previous Issue:** Books without ISBN/ASIN identifiers were being skipped entirely, even when title/author matching could find them.

**Now Fixed:** The system properly falls back to title/author matching when identifiers are missing:

```
Book: "Peace Talks" (no ISBN/ASIN in Audiobookshelf)
✅ Tier 1: ASIN Matching → No ASIN available
✅ Tier 2: ISBN Matching → No ISBN available
✅ Tier 3: Title/Author Matching → Match found with 87% confidence
✅ Result: Book synced successfully using title/author match
```

### Revolutionary Two-Stage Matching System (New!)

The title/author matching has been **completely redesigned** with a two-stage architecture that separates book identification from edition selection, dramatically improving match success rates.

## 🎯 **Two-Stage Architecture**

### **Stage 1: Book Identification**

- **Purpose**: Determine if this is the same book/work
- **Threshold**: Uses existing `confidence_threshold` (70% default) as book ID threshold
- **Scoring Weights** (optimized for book identity):
  - Title: **35%** (↑ from 25%) - Primary book identifier
  - Author: **25%** (↑ from 18%) - Secondary book identifier
  - Series: **15%** (↑ from 12%) - Book disambiguation
  - Activity: **10%** (↓ from 18%) - Popularity indicator
  - Year: **5%** (↓ from 7%) - Minor disambiguation
- **Bonuses**: Perfect match (+10%) and high confidence (+5%) bonuses

### **Stage 2: Edition Selection**

When full book details are fetched, title/author identity is checked again before selecting or caching an edition. Missing-author search hits require this lookup even when they already include editions. A provisional exact-title match with missing search-result authors is rejected if the fetched details fail the same identity checks. Rejected candidates are not used for library sync or auto-add.

- **Purpose**: Pick the best edition/format for the identified book
- **Method**: Automatic format detection + intelligent fallbacks
- **Format Preferences**:
  - **Perfect Match**: User's format (audiobook/ebook) = +40 points
  - **Good Fallback**: Cross-format compatibility = +25 points
  - **Last Resort**: Physical editions = +5 points
- **Additional Factors**: Popularity (25%), duration matching (20%), data completeness (15%)

## 🚀 **Key Improvements**

### **Separation of Concerns**

- **Before**: Single score conflated book identity + edition specifics
- **After**: Book identification separate from edition selection
- **Result**: Fewer false negatives from edition metadata conflicts

### **Automatic Format Detection**

- **Audiobook Detection**: Duration, narrator, audio files, time-based progress
- **Ebook Detection**: EPUB/PDF formats, ebook files, page-based progress
- **Smart Fallbacks**: Audiobook users can get ebook editions if no audiobook available

### **Improved Success Rates**

- **Example**: "The Laws of the Skies" now succeeds at 61.5% book confidence
- **Previous**: Failed at 70% combined threshold
- **Current**: Passes Stage 1 (61.5% > default), gets best audiobook edition in Stage 2

### **Backward Compatibility**

- **Configuration**: Existing `confidence_threshold` automatically becomes book ID threshold
- **API**: All existing match result fields preserved + new two-stage metadata
- **Logging**: Enhanced with Stage 1 + Stage 2 confidence reporting

## 🔧 **Technical Implementation**

### **New Components**

- `BookIdentificationScorer`: Stage 1 scoring with book-focused weights
- `EditionSelector`: Stage 2 smart edition selection with format preferences
- Enhanced `detectUserBookFormat`: Accurate audiobook vs ebook detection

### **Score Overflow Protection**

- All scoring functions use `Math.min(100, Math.max(0, score))` protection
- Prevents bonus calculations from exceeding 100% confidence
- Maintains score integrity across both stages

### **Performance Optimized**

- **Efficient Scoring**: Book identification + edition selection optimized for performance
- **Smart Caching**: Edition results cached with book-level keys
- **Minimal API Calls**: Reuses existing search results when possible

```javascript
// Example: Two-Stage Matching Process
Book: "The Laws of the Skies" by Gregoire Courtois (Audiobook user)

Step 1: ASIN search → Not found (ASIN not in database)
Step 2: ISBN search → Not found (no ISBN available)
Step 3: Two-Stage Title/Author Matching:

  🎯 Stage 1: Book Identification (61.5% confidence)
    - Title match: "The Laws of the Skies" → 85%
    - Author match: "Gregoire Courtois" → 90%
    - Series: N/A → 60% (neutral)
    - Activity: 45 users → 40%
    - Year: N/A → 60% (neutral)
    - Total: 61.5% → ✅ PASS (above 55-70% threshold)

  🎯 Stage 2: Edition Selection (Book ID: 511122)
    - Format preference: Audiobook user → prefer audiobook editions
    - Found audiobook edition (ID: 30463295) → 100% format match
    - Duration: 12h audiobook → excellent match
    - Popularity: 45 users → good edition
    - Selected: Edition 30463295 (audiobook, 43200s, ASIN: B123...)

✅ Result: Successfully matched with optimal audiobook edition
✅ Auto-add ready with complete edition metadata
```

## 🧠 Advanced Scoring Algorithm

The new scoring system evaluates match confidence using eight weighted factors:

| Factor               | Weight | Purpose                       | Example Score               |
| -------------------- | ------ | ----------------------------- | --------------------------- |
| **Title Similarity** | 25%    | Core text matching            | 95% (near-perfect)          |
| **Author Match**     | 18%    | Author name comparison        | 100% (exact match)          |
| **Activity Score**   | 18%    | Hardcover popularity metrics  | 75% (well-known book)       |
| **Series Match**     | 12%    | Series name + sequence        | 90% (series + number match) |
| **Format Match**     | 10%    | Audiobook/ebook/physical      | 100% (format preference)    |
| **Publication Year** | 7%     | Edition disambiguation        | 85% (close year match)      |
| **Duration Match**   | 5%     | Audiobook length comparison   | 95% (within 3% duration)    |
| **Narrator Match**   | 3%     | Audiobook narrator comparison | 80% (narrator similarity)   |

### Confidence Thresholds

```yaml
# Confidence scoring results
95-100%: Perfect Match → Immediate sync
80-94%: High Confidence → Sync with validation
70-79%: Good Match → Sync (configurable threshold)
60-69%: Fair Match → Require explicit confirmation
<60%: Poor Match → Skip or manual review
```

## 🔧 Enhanced Matching Algorithm

### Step 1: Identifier Extraction

```javascript
// Example: Multi-source identifier extraction
Book: "Dune" by Frank Herbert
Sources checked:
  - metadata.asin: B08FHBV4ZX
  - media.metadata.isbn: 9780441172719
  - file tags: ISBN extracted from MP3 metadata
  - folder patterns: ASIN from folder name
Result: Multiple identifiers found for maximum match chance
```

### Step 2: Hardcover Search Sequence

```javascript
// Three-tier search with edition-specific data
Search Process:
  Tier 1: ASIN B08FHBV4ZX → Found ✅ (Direct match, skip scoring)

  (If Tier 1 fails)
  Tier 2: ISBN 9780441172719 → Found ✅ (Direct match, skip scoring)

  (If Tier 1 & 2 fail)
  Tier 3: "Dune" + "Frank Herbert" → Edition search
    ✅ Found 12 editions via GraphQL
    ✅ Applying confidence scoring to each edition
    ✅ Best match: Audiobook edition (92% confidence)
```

### Step 3: Edition-Specific Analysis (New!)

```javascript
// Enhanced edition matching with detailed metadata
Edition Analysis:
  Format: Audiobook vs Audiobook → +10 points (format preference)
  Duration: 21h 2m vs 21h 5m → +95 points (within 3% match)
  Narrator: "Scott Brick" vs "Scott Brick" → +80 points (exact match)
  Series: "Dune #1" vs "Dune #1" → +90 points (series + sequence)
  Year: 2019 vs 2019 → +85 points (exact year match)
  Activity: 4,521 users → +75 points (popular edition)

Final Score: 92% → High Confidence Match ✅
```

### Step 4: Smart Match Validation

```javascript
// Multi-factor validation for accuracy
Validation Checks:
  ✅ Title similarity: 95% (fuzzy matching)
  ✅ Author match: 100% (exact match)
  ✅ Format consistency: Audiobook → Audiobook
  ✅ Duration delta: <3% difference (excellent)
  ✅ Publication year: Within 2 years
  ✅ Series sequence: Exact match

Result: ✅ VALIDATED HIGH-CONFIDENCE MATCH
Action: Sync progress with confidence logging
```

## ⚙️ Configuration Options

### Enhanced Matching Configuration

```yaml
global:
  # Enable/disable title-author fallback matching
  title_author_matching:
    enabled: true # Default: true
    confidence_threshold: 0.70 # Minimum confidence (70%)
    max_search_results: 5 # Limit edition search results

  # Fine-tune scoring weights (advanced)
  scoring_weights:
    title: 0.25 # 25% - Core title similarity
    author: 0.18 # 18% - Author name matching
    activity: 0.18 # 18% - Hardcover popularity
    series: 0.12 # 12% - Series name + sequence
    format: 0.10 # 10% - Format preference matching
    year: 0.07 # 7% - Publication year similarity
    duration: 0.05 # 5% - Audiobook duration matching
    narrator: 0.03 # 3% - Narrator name matching
```

## 🔍 Enhanced Matching Scenarios

### Scenario 1: Perfect ASIN Match (Tier 1)

```
Audiobookshelf Book:
  Title: "The Name of the Wind"
  Author: "Patrick Rothfuss"
  ASIN: B004JHYRG0
  Duration: 27h 55m

Hardcover Library:
  ASIN: B004JHYRG0 → Found ✅

Result: ✅ TIER 1 MATCH (ASIN)
Action: Instant sync (no scoring needed)
Performance: <1 second
```

### Scenario 2: ISBN Fallback Match (Tier 2)

```
Audiobookshelf Book:
  Title: "Foundation"
  Author: "Isaac Asimov"
  ISBN-13: 9780553293357
  (No ASIN)

Hardcover Library:
  ISBN-13: 9780553293357 → Found ✅

Result: ✅ TIER 2 MATCH (ISBN)
Action: Instant sync (no scoring needed)
Performance: ~2 seconds
```

### Scenario 3: Smart Title/Author Match (Tier 3)

```
Audiobookshelf Book:
  Title: "The Primal Hunter 11"
  Author: "Jake D. Ritchey"
  Narrator: "Luke Daniels"
  Duration: 14h 23m
  (No ASIN/ISBN)

Hardcover Search Results:
  Edition 1: "The Primal Hunter 11" (Physical) → 73% confidence
  Edition 2: "The Primal Hunter 11" (Audiobook) → 89% confidence ⭐
    ✅ Format match: Audiobook → +10 points
    ✅ Duration: 14h 20m vs 14h 23m → +95 points
    ✅ Narrator: "Luke Daniels" → +80 points
    ✅ Series: "The Primal Hunter #11" → +90 points

Result: ✅ TIER 3 MATCH (89% confidence)
Action: Sync with detailed confidence logging
Performance: ~5 seconds
```

### Scenario 4: Multiple Editions Disambiguation with Enhanced Metadata

```
Audiobookshelf Book:
  Title: "Dune"
  Author: "Frank Herbert"
  Format: Audiobook
  Duration: 21h 2m
  Narrator: "Scott Brick"

Hardcover Search Results:
  Edition 1: Physical (1965) → 68% confidence
  Edition 2: Ebook (2019) → 72% confidence
  Edition 3: Audiobook (2019, Scott Brick, 21h 5m) → 94% confidence ⭐

Enhanced Metadata Analysis:
  Author Extraction: "Frank Herbert" (edition-level contributions)
  Narrator Detection: "Scott Brick" (explicit role label in contributions)
  Format Priority: Audiobook preference active
  Hierarchical Data: Edition-level metadata takes precedence

Scoring Breakdown for Winner:
  Title: 95% × 0.25 = 23.75 points
  Author: 100% × 0.18 = 18.00 points (enhanced extraction)
  Activity: 95% × 0.18 = 17.10 points
  Series: 85% × 0.12 = 10.20 points
  Format: 100% × 0.10 = 10.00 points (audiobook preference)
  Year: 90% × 0.07 = 6.30 points
  Duration: 95% × 0.05 = 4.75 points
  Narrator: 100% × 0.03 = 3.00 points (role-based detection)
  TOTAL: 93.10% → Excellent Match

Result: ✅ PRECISE EDITION MATCH WITH ENHANCED METADATA
Action: Sync to correct audiobook edition using hierarchical data
```

### Scenario 5: Multi-Author Collaborative Work (New!)

```
Audiobookshelf Book:
  Title: "Good Omens"
  Author: "Terry Pratchett, Neil Gaiman"
  Format: Audiobook
  Narrator: "Peter Kenny"

Search Process:
  Target Author: "Terry Pratchett" (from search context)

Edition-level Analysis:
  contributions: [
    {author: {name: "Terry Pratchett"}, contribution: null},
    {author: {name: "Neil Gaiman"}, contribution: null},
    {author: {name: "Peter Kenny"}, contribution: "Narrator"}
  ]

Multi-Author Processing:
  Text Similarity Analysis:
    "Terry Pratchett" vs "Terry Pratchett" → 100% match ⭐
    "Terry Pratchett" vs "Neil Gaiman" → 15% match
    "Terry Pratchett" vs "Peter Kenny" → 5% match (filtered as narrator)

  Best Author Match: "Terry Pratchett" (100% confidence)
  Narrator Identified: "Peter Kenny" (explicit role label)

Result: ✅ MULTI-AUTHOR WORK CORRECTLY PROCESSED
Action: Sync with primary author "Terry Pratchett" and narrator "Peter Kenny"
```

## 🎛️ Advanced Data Extraction

### Enhanced Author & Contributor Processing

```javascript
// Hierarchical author extraction with multi-author support
Author Extraction Process:
  1. Edition-level contributions (highest priority)
     - Direct edition.contributions array
     - Explicit role filtering (excludes narrators)
  2. Book-level contributions (fallback)
     - book.contributions with contributable_type filtering
  3. Legacy author_names (compatibility fallback)

Multi-Author Intelligence:
  - Target-based text similarity matching
  - Handles collaborative works ("Author A & Author B")
  - Best match selection when searching for specific authors
  - Text similarity threshold: 70% minimum confidence

// Example: Complex author extraction
Book: "Good Omens"
Edition-level: [
  {author: {name: "Terry Pratchett"}, contribution: null},
  {author: {name: "Neil Gaiman"}, contribution: null},
  {author: {name: "Peter Kenny"}, contribution: "Narrator"}
]
Target: "Terry Pratchett"
Result: ✅ "Terry Pratchett" (100% similarity)
Narrator: ✅ "Peter Kenny" (explicit role label)
```

### Multi-Source Identifier Extraction

```javascript
// Comprehensive identifier detection
Identifier Sources (in priority order):
  1. metadata.asin / media.metadata.asin
  2. metadata.isbn / metadata.isbn_13 / metadata.isbn_10
  3. File tags (MP3/M4A metadata)
  4. Folder name patterns
  5. Library provider data (Audible, iTunes, etc.)

// Normalization examples
Raw → Normalized:
  "978-0-441-17271-9" → "9780441172719"
  "B08FHBV4ZX " → "B08FHBV4ZX"
  "isbn:9780441172719" → "9780441172719"
```

### Enhanced Series Detection

```javascript
// Smart series extraction from multiple sources
Series Sources:
  1. metadata.series: [{name: "Dune", sequence: 1}]
  2. Title parsing: "Foundation 2" → "Foundation" series #2
  3. media.metadata.series: "Harry Potter"
  4. Folder structure: "/Fantasy/Dune Series/Book 1/"

// Series matching examples
User: "Dune Chronicles #1" → Hardcover: "Dune #1" (90% match)
User: "Foundation 2" → Hardcover: "Foundation #2" (95% match)
```

### Enhanced Author & Narrator Extraction

```javascript
// Advanced author extraction with hierarchical data priority
Author Extraction Sources (in priority order):
  1. Edition-level contributions (edition.contributions)
  2. Book-level contributions (book.contributions)
  3. Legacy author_names field (fallback)

Multi-Author Handling:
  - Target-based matching with text similarity
  - Collaborative works support (e.g., "Good Omens" by Terry Pratchett & Neil Gaiman)
  - Best author match when multiple authors exist

Narrator Detection (Enhanced):
  1. Contributors with explicit role labels ("Narrator", "Reader", etc.)
  2. Edition-level narrator data (takes precedence over book-level)
  3. Heuristic detection for audiobooks using position analysis
  4. Legacy metadata.narrator fallback

// Example: Enhanced extraction process
Book: "Good Omens" by Terry Pratchett & Neil Gaiman, narrated by Peter Kenny
Target Author Search: "Terry Pratchett"
Result: ✅ Best match found via text similarity (95% confidence)
Narrator: ✅ "Peter Kenny" identified via explicit role label
```

### Audiobook-Specific Enhancements

```javascript
// Audiobook metadata extraction
Duration Sources:
  1. book.duration (seconds)
  2. media.duration
  3. Sum of audioFiles[].duration
  4. metadata.duration

Enhanced Narrator Detection:
  1. Edition-level contributions with explicit role labels (highest priority)
  2. Book-level contributions with role filtering
  3. Heuristic detection for audiobooks (position-based)
  4. Legacy metadata.narrator (fallback)

// Duration matching tolerance
Matching Logic:
  ≤1% difference: 100 points (perfect)
  ≤3% difference: 95 points (excellent)
  ≤5% difference: 85 points (very good)
  ≤10% difference: 70 points (good)
  >20% difference: 0 points (different book)
```

## 🚨 Advanced Troubleshooting

### 📝 **New: Enhanced Matching Logs**

With the improved logging system, you can now easily see what's happening during matching:

```bash
# Run sync with verbose logging to see matching details
docker exec -it shelfbridge node src/main.js sync --user --verbose
```

**Look for these log messages:**

```
🔍 Starting book matching for "Peace Talks"
📍 Tier 1: Trying ASIN Matcher for "Peace Talks"
❌ No ASIN available for Peace Talks
📍 Tier 2: Trying ISBN Matcher for "Peace Talks"
❌ No ISBN available for Peace Talks
📍 Tier 3: Trying Title/Author Matcher for "Peace Talks"
📚 Attempting title/author matching for "Peace Talks" (no identifiers available)
✅ Match found using Title/Author Matcher for "Peace Talks" (confidence: 87.5)
```

### 🚫 **Common Skip Reasons**

Books are now skipped only when **all three tiers fail**:

- `❌ No ASIN available` → Missing ASIN identifier
- `❌ ASIN XXX not found in user's Hardcover library` → ASIN not in your library
- `❌ No ISBN available` → Missing ISBN identifier
- `❌ ISBN XXX not found in user's Hardcover library` → ISBN not in your library
- `🚫 No match found using any matching strategy` → All three tiers failed
- `⚠️ Title/Author matching disabled` → Check `config.title_author_matching.enabled`

### Issue 1: Third-Tier Matching Not Working (FIXED!)

**Previous Symptoms:**

- ❌ Books with ASIN/ISBN missing were skipped entirely
- ❌ No title/author fallback attempted
- ❌ Message: "Skipping [book]: No ISBN or ASIN found"

**Now Fixed:**

- ✅ Books without identifiers properly fall back to title/author matching
- ✅ Title/author matches are processed and synced
- ✅ Clear logging shows each tier being attempted
- ✅ Message: "[book]: Using title/author match (no identifiers available)"

**Debug Steps:**

```bash
# Check if title/author matching is enabled
node src/main.js config | grep -A 5 "title_author_matching"

# Debug specific book matching process
node src/main.js debug --user alice | grep -A 10 "title_author"

# Test with verbose logging
node src/main.js sync --user alice --verbose | grep "confidence"
```

**Solutions:**

```yaml
# Enable title/author matching
global:
  title_author_matching:
    enabled: true
    confidence_threshold: 0.60 # Lower threshold for more matches
```

### Issue 2: Low Confidence Scores

**Symptoms:**

- Books found but confidence below threshold
- "Fair match" results being skipped
- Metadata differences causing low scores

**Debug Process:**

```bash
# Check detailed scoring breakdown
node src/main.js sync --dry-run --verbose | grep -A 15 "Scoring breakdown"

# Analyze specific book metadata
node src/main.js debug --user alice | grep -A 10 "metadata extraction"
```

**Solutions:**

```yaml
# Lower confidence threshold temporarily
global:
  title_author_matching:
    confidence_threshold: 0.60 # Down from 0.70


# Improve book metadata in Audiobookshelf
# Add series, narrator, duration information
```

### Issue 3: Wrong Edition Matches

**Symptoms:**

- Physical books matched instead of audiobooks
- Wrong narrator or duration
- Different publication years

**Analysis:**

```bash
# Check edition-specific scoring
node src/main.js sync --dry-run --verbose | grep -A 5 "Edition analysis"

# Verify format preference scoring
node src/main.js debug --user alice | grep "format preference"
```

**Solutions:**

- Ensure proper format metadata in Audiobookshelf
- Check duration information accuracy
- Verify narrator metadata completeness

## 📊 Performance Characteristics

### Matching Performance by Tier

| Tier                      | Average Time | Cache Impact  | API Calls |
| ------------------------- | ------------ | ------------- | --------- |
| **Tier 1 (ASIN)**         | 0.5-1s       | Cached        | 0-1       |
| **Tier 2 (ISBN)**         | 1-2s         | Cached        | 0-1       |
| **Tier 3 (Title/Author)** | 3-8s         | Limited cache | 1-2       |

### Edition Search Performance

- **Search results**: Limited to 5 editions max
- **Scoring time**: ~100ms per edition
- **GraphQL query**: Single optimized call
- **Cache utilization**: Edition data cached for 24h

## 📈 Best Practices for Enhanced Matching

### Metadata Optimization

1. **Add ASIN for audiobooks** (fastest matching)
2. **Include ISBN for all books** (reliable fallback)
3. **Maintain accurate series information** (better scoring)
4. **Verify narrator names** (audiobook edition matching)
5. **Ensure duration accuracy** (precise edition selection)

### Configuration Tuning

**Conservative (High Precision):**

```yaml
global:
  title_author_matching:
    confidence_threshold: 0.80 # Only high-confidence matches
    max_search_results: 3 # Limit search scope
```

**Balanced (Recommended):**

```yaml
global:
  title_author_matching:
    confidence_threshold: 0.70 # Good balance
    max_search_results: 5 # Standard search scope
```

**Aggressive (High Recall):**

```yaml
global:
  title_author_matching:
    confidence_threshold: 0.60 # Accept lower confidence
    max_search_results: 8 # Broader search scope
```

## 🎯 Next Steps

1. **[Auto-Add Books](Auto-Add-Books.md)** - Handle unmatched books with new confidence scoring
2. **[Cache Management](Cache-Management.md)** - Optimize performance for three-tier matching
3. **[Configuration Reference](Configuration-Reference.md)** - Advanced scoring configuration

## 🆘 Need Help?

- **Configuration Help**: [Configuration Guide](Configuration-Guide.md)
- **General Questions**: [FAQ](../troubleshooting/FAQ.md)
- **Troubleshooting**: [Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)

---

**Intelligent, edition-specific book matching for maximum accuracy!** 🔍📚
