# 0nya Approved Typography Asset Provenance

Asset-preservation inventory only. NOT product authority.

Preserved: 2026-08-31
Purpose: B04 typography sub-gate — official upstream open-source font binaries retained for later Android integration.

## Plus Jakarta Sans (English / Latin PRIMARY)

- Upstream project: tokotype/PlusJakartaSans (official)
- Source: `https://raw.githubusercontent.com/tokotype/PlusJakartaSans/master/fonts/ttf/`
- Licence: SIL Open Font License 1.1 (`OFL.txt`, unmodified)
- Reserved Font Name declared: NO

| File | Original filename | Weight | Size (bytes) | SHA256 |
| --- | --- | --- | ---: | --- |
| plus-jakarta-sans/PlusJakartaSans-Regular.ttf | PlusJakartaSans-Regular.ttf | 400 | 128972 | BD6276D4060E3B1EBC45047469E0BB86B08F301BA681CDF1CEB6245EA10478D2 |
| plus-jakarta-sans/PlusJakartaSans-Medium.ttf | PlusJakartaSans-Medium.ttf | 500 | 129180 | C77BAB757D7402EC6D9341D5F7DDAAFB2474E17026792697BA4624C7DC89CAF7 |
| plus-jakarta-sans/PlusJakartaSans-SemiBold.ttf | PlusJakartaSans-SemiBold.ttf | 600 | 129288 | 65DBCEDB6596A41C30869729EB31CB57D1F5EDFE365684314BBA8A1994EAA4CB |

Metadata verified: family/subfamily/usWeightClass match expected 400/500/600.

## Mukta (Hindi / Devanagari companion)

- Upstream project: EkType/Mukta (official)
- Source: `https://github.com/EkType/Mukta/releases/download/2.539/Mukta.Font.Family.2.539.zip` → `Mukta-Devanagari/`
- Release: Mukta Font Family 2.539 (official EkType release)
- Licence: SIL Open Font License 1.1 (`OFL.txt`, unmodified); `Copyright.txt` and `AUTHORS.txt` also retained
- Reserved Font Name declared: NO

| File | Original filename | Weight | Size (bytes) | SHA256 |
| --- | --- | --- | ---: | --- |
| mukta/Mukta-Regular.ttf | Mukta-Regular.ttf | 400 | 460700 | B110D0E831F99163C719074E2D7A5A700A01BA0947FF4B67ACDDCDD818FC4AF7 |
| mukta/Mukta-Medium.ttf | Mukta-Medium.ttf | 500 | 450192 | 82E277ED13CD0BEA930BDD8BDE70CA6EE9D06923C474C4E516D0E98AC433EC77 |
| mukta/Mukta-SemiBold.ttf | Mukta-SemiBold.ttf | 600 | 437344 | 36ECD72EB53A0A819FC817555B235DC8C0409069D51F327F94C7EAB9D73613BB |

Metadata verified: family/subfamily/usWeightClass match expected 400/500/600.

## Notes

- Upstream binaries preserved unmodified; no glyph/outline changes.
- No derivative "0nya Sans" or "0nya Sans Devanagari" generated.
- Android runtime integration (expo-font, tokens, ui) is OUT OF SCOPE for this milestone.
- No files staged, committed, or pushed.
