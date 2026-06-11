# Metadata-First Architecture — Auto CKG

Upgrade arsitektur dari **DOM-Driven** ke **Metadata-Driven**. Dokumen ini
mencakup audit, desain, rencana migrasi, dan strategi backward-compatibility.

## Latar belakang (hasil riset)

Sumber kebenaran SATUSEHAT bukan DOM, melainkan metadata Form Builder yang
hidup di **React runtime state**:

```
Server → Encrypted Payload → Frontend Decrypt → React State → Survey Model → DOM
```

Metadata berisi identifier stabil: `FRM` (form), `PPM` (question), `PPV`
(pilihan jawaban). Label UI bisa berubah; PPV lebih stabil daripada label.

## Audit kondisi awal (sebelum Phase 1)

- `src/engine/schema_discovery.js`: **DOM-only** (`.sd-question`, `.sv-string-viewer`, dst).
- `src/background.js` `_contentExtractSchema()`: DOM scraping multi-strategi.
- Tidak ada interceptor `fetch`/`XHR` maupun pembaca React state.
- `schemas/*.json` punya `value` (PPV) kosong → mengandalkan label matching.

## Arsitektur target

```
                    ┌─────────────────────────────────────────┐
   Builder 🔍 scan  │  PRIORITY 1: React State Discovery        │
   ───────────────► │  react_state_discovery.js (MAIN world)    │
                    │  React Fiber → Survey Model → pages/...    │
                    │  → schema (PPV/PPM/FRM terisi)             │
                    └───────────────┬───────────────────────────┘
                                    │ ok
                                    ▼
                    ┌─────────────────────────────────────────┐
                    │  metadata_registry.js                     │
                    │  normalize → upsertMetadata → PPV Registry │
                    │  (version history: added/changed)         │
                    └───────────────┬───────────────────────────┘
                                    │ gagal (tidak ketemu)
                                    ▼
                    ┌─────────────────────────────────────────┐
                    │  PRIORITY 2 (fallback): DOM scraping       │
                    │  _contentExtractSchema() + enrich dari      │
                    │  metadata terakhir (mergeMetaIntoDom)      │
                    └───────────────────────────────────────────┘
```

## Struktur file (Phase 1)

```
src/engine/
  react_state_discovery.js   [BARU] classic IIFE, MAIN-world, no ESM export
  metadata_registry.js       [BARU] ESM, normalize + PPV registry + merge
  schema_discovery.js        [tetap] dipakai sebagai fallback
src/background.js            [ubah] extractReactMetadata() + ckg_extract_schema metadata-first
src/ui/popup_builder_quiz.js [ubah] tampilkan sumber data hasil scan
manifest.json                [ubah] daftarkan 2 modul baru di web_accessible_resources
tests/metadata_first.test.js [BARU] unit test logika murni (node tests/...)
```

## Bentuk schema (kontrak antar modul)

```jsonc
{
  "screen": "frm000044",
  "title": "Pemeriksaan Hepatitis",
  "fingerprint": "meta_xxxxxxxx",   // berbasis kode PPM/PPV, bukan teks
  "questions": [{
    "question": "Hasil Rapid Test Hepatitis B",
    "type": "radio",
    "name": "LPM000167|FRM000044|PPM00000022|text",
    "code": "PPM00000022",          // question code
    "form": "FRM000044",            // form code
    "options": [
      { "id": "", "value": "PPV00000024", "label": "HBsAg Non Reaktif" },
      { "id": "", "value": "PPV00000025", "label": "HBsAg Reaktif" }
    ]
  }],
  "_source": "react-state"          // "react-state" | "dom" | "dom+meta"
}
```

## Backward compatibility

- Bentuk schema **superset** dari schema lama (menambah `code`/`form`; `options`
  tetap `{id,value,label}`), sehingga `schema_autofill.js` & `field_mapper.js`
  tetap berjalan tanpa perubahan.
- Jika React state tidak ditemukan, alur otomatis kembali ke DOM lama.
- Schema statis lama (`schemas/*.json`) tetap valid; bila metadata pernah
  ditangkap, schema DOM diperkaya otomatis (`mergeMetaIntoDom`).

## Rencana migrasi (fase berikutnya)

- PHASE 2: PPV Registry UI + ekspor.
- PHASE 3: refactor `schema_discovery` agar memanggil metadata sebagai primary.
- PHASE 4: autofill match by `PPM`+`PPV` (label hanya fallback).
- PHASE 5: Auto-Learning (deteksi PPV/PPM baru/berubah/hilang → update mapping).
- PHASE 6: Metadata Inspector (tampilkan screen/question/PPV/perubahan).

## Verifikasi

Unit test (CI-friendly, tanpa browser):

```
node tests/metadata_first.test.js
```

Verifikasi manual di Chrome (perlu form SATUSEHAT live):

1. Load extension (chrome://extensions → Load unpacked).
2. Buka halaman kuesioner SATUSEHAT hingga form ter-render.
3. Builder → 🔍 Scan → beri nama → Scan.
4. Status harus menyebut **"Metadata Form Builder (React state)"** dan opsi radio
   punya `value` PPV (mis. `PPV00000024`), bukan kosong.
5. Cek `chrome.storage.local` key `ckg_ppv_registry` berisi entri PPV.
```
