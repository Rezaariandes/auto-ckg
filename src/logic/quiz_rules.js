// quiz_rules.js - CKG Auto KlikPro v2.0
// Menentukan jawaban kuesioner berdasarkan data pasien (kolom Diagnosa, dll)
// Rules disimpan di chrome.storage.local dan bisa diedit via Settings UI
//
// v2 upgrade: rule questions now support three match strategies (all backwards-compatible):
//   titleContains       — substring match on question text (v1 behavior, default)
//   questionFingerprint — exact normalized match on full question text
//   semanticQuestion    — regex pattern for semantic equivalence

// ── Default Rules (sesuai kebutuhan CKG Sehat Indonesiaku) ────────────────
// Setiap rule punya:
//   condition : { field, operator, value } — cocokkan data pasien
//   questions : [ { titleContains, answer } ] — jawaban yang di-override
//
// Operator: 'contains' | 'equals' | 'gte' | 'lte' | 'truthy'
// answer: string teks opsi yang akan diklik (harus cocok dengan label di site)

const DEFAULT_QUIZ_RULES = [
  {
    ruleId: "DM_001",
    label: "Penderita Diabetes Melitus — jawab Ya riwayat DM",
    priority: 10,
    condition: { field: "Diagnosa", operator: "contains", value: "DM" },
    questions: [
      { titleContains: "kencing manis", answer: "Ya" },
      { titleContains: "diabetes", answer: "Ya" },
      { titleContains: "riwayat DM", answer: "Ya" },
      { titleContains: "gula darah", answer: "Ya" },
      { titleContains: "minum obat DM", answer: "Ya" },
      { titleContains: "minum obat kencing manis", answer: "Ya" }
    ]
  },
  {
    ruleId: "HT_001",
    label: "Penderita Hipertensi — jawab Ya riwayat HT",
    priority: 10,
    condition: { field: "Diagnosa", operator: "contains", value: "HT" },
    questions: [
      { titleContains: "hipertensi", answer: "Ya" },
      { titleContains: "darah tinggi", answer: "Ya" },
      { titleContains: "riwayat HT", answer: "Ya" },
      { titleContains: "minum obat HT", answer: "Ya" },
      { titleContains: "minum obat darah tinggi", answer: "Ya" }
    ]
  },
  {
    ruleId: "OBESITAS_001",
    label: "Penderita Obesitas",
    priority: 10,
    condition: { field: "Diagnosa", operator: "contains", value: "Obesitas" },
    questions: [
      { titleContains: "berat badan berlebih", answer: "Ya" },
      { titleContains: "obesitas", answer: "Ya" }
    ]
  },
  {
    ruleId: "KOLESTEROL_001",
    label: "Penderita Kolesterol Tinggi",
    priority: 10,
    condition: { field: "Diagnosa", operator: "contains", value: "Kolesterol" },
    questions: [
      { titleContains: "kolesterol", answer: "Ya" },
      { titleContains: "lemak darah", answer: "Ya" },
      { titleContains: "dislipidemia", answer: "Ya" }
    ]
  },
  {
    ruleId: "ROKOK_001",
    label: "Perokok Aktif",
    priority: 10,
    condition: { field: "Diagnosa", operator: "contains", value: "Rokok" },
    questions: [
      { titleContains: "merokok", answer: "Ya, saya merokok" },
      { titleContains: "rokok", answer: "Ya" }
    ]
  },
  {
    ruleId: "DEFAULT_TIDAK",
    label: "Default: jawab Tidak untuk semua yang tidak ada rule spesifik",
    priority: 1,
    condition: null,  // null = selalu aktif, sebagai fallback
    questions: [
      // list kosong — fallback answer dihandle di quiz engine
    ],
    defaultAnswer: "Tidak"
  },
  {
    ruleId: "DEFAULT_TIDAK_SAMA_SEKALI",
    label: "Default: jawab Tidak sama sekali untuk skala frekuensi",
    priority: 1,
    condition: null,
    questions: [
      { titleContains: "seberapa sering", answer: "Tidak sama sekali" },
      { titleContains: "berapa kali", answer: "Tidak pernah" }
    ],
    defaultAnswer: null
  }
];

// ── Engine ─────────────────────────────────────────────────────────────────

const QuizEngine = {

  /**
   * Load rules dari storage, fallback ke default jika belum ada
   */
  async loadRules() {
    const saved = await chrome.storage.local.get('ckg_quiz_rules');
    return saved.ckg_quiz_rules || DEFAULT_QUIZ_RULES;
  },

  /**
   * Simpan rules ke storage
   */
  async saveRules(rules) {
    await chrome.storage.local.set({ ckg_quiz_rules: rules });
  },

  /**
   * Reset ke default rules
   */
  async resetToDefault() {
    await this.saveRules(DEFAULT_QUIZ_RULES);
  },

  /**
   * Resolusi jawaban untuk satu pertanyaan berdasarkan data pasien
   *
   * @param {string} questionTitle - teks judul/label pertanyaan dari site
   * @param {Object} pasienData    - row Excel pasien
   * @param {Array}  rules         - array rules (sudah diload)
   * @returns {string|null}        - teks jawaban yang dipilih, atau null (skip)
   */
  resolveAnswer(questionTitle, pasienData, rules) {
    const titleLower = questionTitle.toLowerCase();
    const titleNorm  = titleLower.trim().replace(/\s+/g, ' ');

    // Sort rules by priority descending (higher priority checked first)
    const sorted = [...rules].sort((a, b) => (b.priority || 1) - (a.priority || 1));

    for (const rule of sorted) {
      // Cek apakah rule condition match dengan data pasien
      if (!this._matchCondition(rule.condition, pasienData)) continue;

      // Cek apakah ada question match dalam rule ini
      // Priority: questionFingerprint > semanticQuestion > titleContains
      const match = (rule.questions || []).find(q =>
        this._matchQuestion(q, titleNorm, titleLower)
      );

      if (match) return match.answer;

      // Jika rule punya defaultAnswer dan condition match
      if (rule.defaultAnswer !== undefined && rule.defaultAnswer !== null) {
        return rule.defaultAnswer;
      }
    }

    // Global fallback
    return "Tidak";
  },

  /**
   * Match a rule question entry against a question title using all available strategies.
   * Priority: questionFingerprint > semanticQuestion > titleContains
   *
   * @param {Object} q         — rule question entry
   * @param {string} titleNorm — normalized full question text
   * @param {string} titleLower— lowercase question text
   * @returns {boolean}
   */
  _matchQuestion(q, titleNorm, titleLower) {
    // 1. questionFingerprint: exact normalized match (most precise)
    if (q.questionFingerprint) {
      const fp = q.questionFingerprint.trim().toLowerCase().replace(/\s+/g, ' ');
      if (titleNorm === fp) return true;
    }

    // 2. semanticQuestion: regex pattern match
    if (q.semanticQuestion) {
      try {
        const re = new RegExp(q.semanticQuestion, 'i');
        if (re.test(titleLower)) return true;
      } catch (_) {
        // Invalid regex — fall through to titleContains
      }
    }

    // 3. titleContains: original v1 substring match (backwards-compatible)
    if (q.titleContains && titleLower.includes(q.titleContains.toLowerCase())) {
      return true;
    }

    return false;
  },

  /**
   * Match rule condition terhadap data pasien
   */
  _matchCondition(condition, pasienData) {
    if (!condition) return true; // null condition = always match

    const fieldVal = String(pasienData[condition.field] || '');

    switch (condition.operator) {
      case 'contains':
        return fieldVal.toLowerCase().includes(String(condition.value).toLowerCase());
      case 'equals':
        return fieldVal.toLowerCase() === String(condition.value).toLowerCase();
      case 'gte':
        return parseFloat(fieldVal) >= parseFloat(condition.value);
      case 'lte':
        return parseFloat(fieldVal) <= parseFloat(condition.value);
      case 'truthy':
        return !!fieldVal && fieldVal !== '0' && fieldVal.toLowerCase() !== 'tidak';
      default:
        return false;
    }
  },

  /**
   * Ambil semua active rules untuk pasien tertentu (untuk preview di UI)
   */
  getActiveRules(pasienData, rules) {
    return rules.filter(r => r.condition && this._matchCondition(r.condition, pasienData));
  }
};

// Export
if (typeof module !== 'undefined') {
  module.exports = { QuizEngine, DEFAULT_QUIZ_RULES };
}

// ── ESM Export (Phase 6) ──────────────────────────────────────────────────────
export { QuizEngine, DEFAULT_QUIZ_RULES };

/**
 * resolveQuizAnswers — fungsi standalone untuk kuesioner.js
 * Resolve semua jawaban berdasarkan data pasien.
 *
 * @param {Object} pasienData - row Excel pasien
 * @returns {Promise<Object>} map { titleContains_lower: answer }
 */
export async function resolveQuizAnswers(pasienData) {
  const rules = await QuizEngine.loadRules();
  const result = {};

  // Sort by priority descending
  const sorted = [...rules].sort((a, b) => (b.priority || 1) - (a.priority || 1));

  for (const rule of sorted) {
    if (!QuizEngine._matchCondition(rule.condition, pasienData)) continue;

    for (const q of (rule.questions || [])) {
      const key = (q.titleContains || '').toLowerCase().trim();
      // First match wins (highest priority rule)
      if (key && !(key in result)) {
        result[key] = q.answer;
      }
    }
  }

  return result;
}
