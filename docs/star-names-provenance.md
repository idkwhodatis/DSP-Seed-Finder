# Deterministic Chinese star names

## Scope

Chinese display names are regenerated from the galaxy seed, star index, star type, and previously assigned Chinese names. They are not translations of the English label, and they do not alter the canonical `Star.name`, galaxy data, Rust/WASM engine, search rules, persistence, exports, or native protocol.

The public entry point is `getGalaxyDisplayNames(galaxy, locale)` in `web/src/lib/starNames.ts`. Compute it once from the full galaxy and current locale; look up names by immutable `star.index`. Only `zh-CN` selects the game's LCID 2052 algorithm. Other locales return canonical labels. Unknown seed ranges, missing types/indices, non-contiguous indices, or a mismatched English reconstruction signature fall back to canonical labels for the whole input. The function sorts an independent array by index, so presentation sorting cannot affect generation.

This implements star-system names. A whole galaxy is identified by its seed; the unused syllable-based `NameGen::randomName` function is not the star-name routine.

## Primary implementation source

- Project: [soarqin/DSPSeedCalc](https://github.com/soarqin/DSPSeedCalc)
- Pinned commit: [142cc01517060be96be77e687d44512d756de851](https://github.com/soarqin/DSPSeedCalc/commit/142cc01517060be96be77e687d44512d756de851), dated 2026-09-29
- [Naming implementation and exact ordered pools](https://github.com/soarqin/DSPSeedCalc/blob/142cc01517060be96be77e687d44512d756de851/dspugen/namegen.cc)
- [Legacy random-number implementation](https://github.com/soarqin/DSPSeedCalc/blob/142cc01517060be96be77e687d44512d756de851/dspugen/util/dotnet35random.hh) and [initialization](https://github.com/soarqin/DSPSeedCalc/blob/142cc01517060be96be77e687d44512d756de851/dspugen/util/dotnet35random.cc)
- [Star seed consumption](https://github.com/soarqin/DSPSeedCalc/blob/142cc01517060be96be77e687d44512d756de851/dspugen/star.cc)
- [Galaxy seed consumption](https://github.com/soarqin/DSPSeedCalc/blob/142cc01517060be96be77e687d44512d756de851/dspugen/galaxy.cc)
- [Reference-build record](https://github.com/soarqin/DSPSeedCalc/blob/142cc01517060be96be77e687d44512d756de851/AGENTS.md)
- [MIT license](https://github.com/soarqin/DSPSeedCalc/blob/142cc01517060be96be77e687d44512d756de851/LICENSE)

The pinned source identifies Steam build **25599610**, Mono, Unity **2022.3.62f3c1**, galaxy algorithm **20200403**, and Assembly-CSharp.dll SHA-256 **6C122E5443E6843979B4064050DFCB5E0D75577A0B64F6AE4111290238B33C12** (MVID **7c753b2c-7be8-45e8-ae2a-51c600ac1211**). Its version string is only `0.10.34.xxxxx`; the exact suffix is not supplied. Older documentation elsewhere in that project still refers to the superseded build 23109513 / version 0.10.34.28529.

This is a community reimplementation with a documented game-build reference, not an official game source release. The Chinese data and RNG branching are independently corroborated by [botany233/dsp_search_seed at 6575282e3b1e8b3aa4ee3241c900f635728c88c8](https://github.com/botany233/dsp_search_seed/blob/6575282e3b1e8b3aa4ee3241c900f635728c88c8/cpp_source_code/NameGen.hpp). That project is GPL-3.0; no code or tables were copied from it. The copied/adapted implementation and tables here come from the pinned MIT source above. The game and its original data remain attributable to their respective owners.

## Exact algorithm

1. Initialize the game's legacy `DotNet35Random` from the galaxy seed. Consume one pose seed and four stellar quota rolls. The position generator runs on a separate stream and does not change these five outer samples.
2. Each following outer `Next()` is a star's generation seed, in ascending star index. The first `Next()` of a fresh generator with that star seed is its `name_seed`.
3. Initialize a fresh name generator from `name_seed`. On each of at most 256 attempts, its `Next()` seeds a candidate generator. That generator draws a child seed and two branch probabilities. Candidate content uses another fresh generator from the child seed.
4. Normal stars and white dwarfs choose a raw-name pool below 0.60000002384185791, constellation plus Greek letter below 0.93000000715255737, or constellation plus number otherwise.
    - Raw pools differ: **425 English entries vs 548 Chinese entries**. The same random integer is reduced modulo a different count.
    - Chinese letter and number branches consume an **extra third random sample** for the constellation. They cannot translate the English constellation.
    - Chinese letter names concatenate the constellation and Greek letter with no space. Number names use a space and the number, 27 through 74.
5. Giant stars use raw names below 0.40000000596046448, constellation plus two literal capital letters below 0.699999988079071, and catalog formats otherwise. Both raw giant pools contain 60 entries; Chinese constellation selection uses the first random integer with no extra draw.
6. Neutron stars and black holes use unchanged NTR/DSR catalog formats. Giant catalog labels such as HD/HDE/HR/HV/LBV/NSV/YSC are also unchanged.
7. Test each Chinese candidate against **all previously accepted Chinese names**, retry on a collision, and use `XStar` only after 256 failed attempts. Chinese collisions and English collisions are independent, and may choose different candidate families.

Pool ordering, repeated values, unusual spellings, and untranslated values such as `Kat` and `WOH G64` are preserved intentionally. Replacing them with more familiar astronomical spellings would break parity.

## Compatibility signature and existing Rust differences

The display module reconstructs all English labels first and compares them with the supplied canonical labels. This detects unsupported or changed generators without silently assigning unrelated Chinese names. It does not require exposing or serializing additional Rust fields.

The compatibility-only English branch intentionally follows the existing Rust source:

- It uses the existing decimal branch thresholds (0.4, 0.7, 0.6, 0.93), rather than silently changing canonical behavior to the pinned source's promoted float constants
- Giant constellation labels preserve the existing sum of two character codes, e.g. `163 Telescopii`; Chinese uses the source's literal two-letter suffix
- `random_name` in the existing Rust engine consumes its prior-name iterator across collision attempts. English signature reconstruction preserves that iterator behavior. Chinese generation checks the full assigned-name set on every attempt

These are compatibility choices; no physical engine logic is changed or claimed to be newly corrected.

## Evidence and tests

`starNames.test.ts` verifies:

- All English pool entries correspond exactly to the existing Rust arrays
- Forty frozen name-seed vectors cover ordinary names, white dwarfs, every branch family, giant suffix/catalog names, and both NTR/DSR signs
- English reconstruction matches **50 live Rust/WASM galaxies**, spanning ten seeds and 32, 40, 48, 56, and 64 stars
- Frozen galaxy examples cover Chinese-only collision retries, including a two-retry case
- Chinese names are unique across the tested galaxies
- The 256-attempt limit, whole-set collision checks, immutable canonical input, shuffled presentation order, unsupported signatures, legacy missing fields, and repeated language switching

The frozen Chinese vectors were calculated with a separate Python implementation of the pinned source. They are **source-derived fixtures, not captures from a running game**. In-game verification against the user's specific DSP build has not been performed. They establish agreement with the pinned reimplementation, not an unconditional claim of correctness for every historical or future game version.

Illustrative source-derived galaxy results (64 stars):

| Galaxy seed | Star index (zero-based) | Canonical English  | Chinese display |
| ----------- | ----------------------: | ------------------ | --------------- |
| 0           |                       0 | Iota Sagittae      | 狮子座ι         |
| 1           |                       1 | 72 Comae Berenices | 金牛座 72       |
| 1           |                       9 | 163 Telescopii     | 望远镜座WL      |
| 1           |                      38 | Vega               | 青丘            |
| 42          |                      60 | λ Chamaeleontis    | 小犬座 57       |
| 12345678    |                       0 | AngelStern         | 天床三          |
| 99999999    |                       0 | AngelStern         | 天市左垣九      |

The last two rows show why a fixed English-to-Chinese dictionary would be incorrect.

## Retained upstream license

```text
MIT License

Copyright (c) 2022 Soar Qin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
