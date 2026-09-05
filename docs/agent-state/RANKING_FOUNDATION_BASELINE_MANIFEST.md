# Ranking Foundation Baseline Manifest

## Baseline record

- Branch: `qa/netlify-api-e34ab5e`
- Pre-commit HEAD: `ac9e11676c3434cb16b4f33adc4208e1c7c4f1e5`
- Contract version: `0NYA Ranking Domain Contract v1.0`
- Freeze decision: `SOURCE FREEZE APPROVED: YES`
- Pending migrations: `034_home_editorial_ranking_provenance`, `035_ranking_behavior_events`, `ranking_decision_evidence` (recorded only; not applied)
- Runtime verification status: `NO`
- Autonomous modified: `NO`
- Constitution modified: `NO`

Hashes below are SHA-256 values of the exact staged file content. This manifest intentionally does not hash itself because embedding its own final digest would be self-referential.

| File path | Role | Originating phase | SHA-256 |
| --- | --- | --- | --- |
| `apps/android/src/components/BehaviorImpression.tsx` | ranking foundation source | RANK-01–05C | `11ca5ffd59f6aab400549703ba96b20e72fa589ecb108b128e5cf74ea3f5087a` |
| `apps/android/src/components/Screen.tsx` | behavioral evidence and replay continuity | RANK-05/05A | `31e5b95d9d2e4946b017b99d2ae4cefeefc5b43c825eb1079eddceea28562ca7` |
| `apps/android/src/lib/api.ts` | behavioral evidence and replay continuity | RANK-05/05A | `9ecb433b06125e4248e3eb4c99b8280fd5cf3172c8a808bf240ba5cc95e09aac` |
| `apps/android/src/lib/behaviorContext.ts` | behavioral evidence and replay continuity | RANK-05/05A | `3ecdf4084e7d3323c19df085b0d684bafb807fe579afbb2ed7d24f617681b30d` |
| `apps/android/src/lib/behaviorImpressionModel.ts` | behavioral evidence and replay continuity | RANK-05/05A | `be236601e575942ee60bbec2900310f8ed227f09ae5397a92979dd1e81d30cae` |
| `apps/android/src/lib/behavioralEvents.ts` | behavioral evidence and replay continuity | RANK-05/05A | `53c56f8572ad28efa7c00265565ff4326ff55fda4dc65bb55fa86e25ce187b86` |
| `apps/android/src/lib/discovery.ts` | deterministic Explore foundation | RANK-03 | `21439011abf569ab95f417e3c200a8b87d1b0869ed28a4d4c110df1ec7f10181` |
| `apps/android/src/lib/evidenceIdentity.ts` | behavioral evidence and replay continuity | RANK-05/05A | `876276548e32723cb2c850387103af6163508019b9c97095adea4016c1830e2b` |
| `apps/android/src/lib/rankingDecisionEvidence.ts` | ranking decision evidence | RANK-05B | `b8b2a2faa550ce862e597e7befa5650f470e51033d2348cbcee8ee43b6cde228` |
| `apps/android/src/lib/recentSearchModel.ts` | deterministic Search and attribution | RANK-04 | `5bbb9a888a9b4021a21240678467021fcc394b0318fc1327b28f686b2d1ca995` |
| `apps/android/src/lib/recentSearches.ts` | deterministic Search and attribution | RANK-04 | `e0cd71867e019aed18e75bbac9228025b3ce43d660a1225b88eae983bacd9ff5` |
| `apps/android/src/lib/search.ts` | deterministic Search and attribution | RANK-04 | `7a0dadac4774a0bbb4f7ba0296ceaa8c17718f5762fbb06050b63e2807fa5301` |
| `apps/android/src/lib/taxonomy.ts` | taxonomy and catalog foundation | RANK-01 | `7faa27e8d01839e496dbf6486064f927939564d8439047fd1717b3bdd1a50a2b` |
| `apps/android/src/lib/useDiscoveryCatalog.ts` | deterministic Explore foundation | RANK-03 | `d9ae7c41560ef4ad6b1546fa4eb02b4775202eda0f2c7077626710d6750483fa` |
| `apps/android/src/navigation/routeSerialization.test.ts` | deterministic Search and attribution | RANK-04 | `aa09dbf5f13e60f9748315c00881c884a6824f4707537bd4884bb7e88c1a4272` |
| `apps/android/src/navigation/routeSerialization.ts` | deterministic Search and attribution | RANK-04 | `4d4ca5fbf52d69837b07618e49f694009233c744df9ecbd16981a0ff3a670bd7` |
| `apps/android/src/navigation/types.ts` | deterministic Search and attribution | RANK-04 | `51a48b6baca665d663efa7ada3c4e5857d849fa570b6460e8095ed50c9c4abb0` |
| `apps/android/src/player/PlayerScreen.tsx` | behavioral evidence and replay continuity | RANK-05/05A | `2b5c44f1db1a1b06f9d4d7575b80ba978434cce38bf3a0a21cb4ea18521a9ca5` |
| `apps/android/src/screens/ExploreScreen.tsx` | deterministic Explore foundation | RANK-03 | `64238fc00a3a3dbb551c810a7ee0b1d1462814f17ac3610bb1e513ac1f187382` |
| `apps/android/src/screens/HomeScreen.tsx` | behavioral evidence and replay continuity | RANK-05/05A | `1c0674e9337c3cf115442ebf67800319723e46167ccf56e2be80ae3a4249ce3d` |
| `apps/android/src/screens/SearchResultsScreen.tsx` | deterministic Search and attribution | RANK-04 | `09d0b10564862c1a0a238e1ff4c58cbe70b7ed20295afca20c18e08545cd5208` |
| `apps/android/src/screens/SeriesEpisodesScreen.tsx` | deterministic Search and attribution | RANK-04 | `d42e846894c51b258be3c5f943b9401f5de928ccfdc72e5eb5902dff10e008aa` |
| `apps/android/src/screens/SeriesScreen.tsx` | deterministic Search and attribution | RANK-04 | `2dffda38a9ad458ab2761c0a8e0e5bdc90c7d469eb58a0b19b11a034ed0c9e13` |
| `apps/android/src/screens/ShortFilmDetailScreen.tsx` | deterministic Search and attribution | RANK-04 | `1998f0f4179b9669db4356c432ff89198196451a01fe1c6010fa6d18ac06b45f` |
| `apps/android/src/screens/ShortFilmPlaybackScreen.tsx` | behavioral evidence and replay continuity | RANK-05/05A | `913595e677d30f9ad65643a102b29da1787df5a2161ad098eb2ed493b3b58806` |
| `apps/android/src/screens/WatchScreen.tsx` | behavioral evidence and replay continuity | RANK-05/05A | `931bd24a6d1996fa958eb8a9ce53cf0788b6561c9bdee9be4b473ba4c71916cc` |
| `apps/android/src/types/api.ts` | taxonomy and catalog foundation | RANK-01 | `af1cd19b6aa95447af33e99c8fd074111c6f785e2dab3f34768ace48509b8a57` |
| `docs/0NYA_RANKING_DOMAIN_CONTRACT_v1.0.md` | canonical contract or pointer | RANK-01 | `2487195d12a0e4a6d811de33f251308fef9adbda01c96b296ce03ecd9ed7bec0` |
| `docs/agent-state/RANK-01_REPORT.md` | taxonomy and catalog foundation | RANK-01 | `837639557f597a67b5cfe2846c518fa4d418b96d8a27dee03a74b15333f21d82` |
| `docs/agent-state/RANK-02_REPORT.md` | editorial provenance foundation | RANK-02 | `416d825d789cc6ea78eccda8733556481a6c3d36d6f02461e892d208073eee46` |
| `docs/agent-state/RANK-03_REPORT.md` | deterministic Explore foundation | RANK-03 | `b287de79c760108e383315b731452742772f764c874a3ca95866ab6d98c9099d` |
| `docs/agent-state/RANK-04_REPORT.md` | deterministic Search and attribution | RANK-04 | `7d2cc4da795f70dbc4cb0d00a9aee625a2849a9bb5d811e7273e66e326480e0c` |
| `docs/agent-state/RANK-05A_REPORT.md` | behavioral evidence completion report | RANK-05A | `e0eafb65da0fe73e5add07c6fdde9fc04281690c5617ee4ae28d0d520c0bb17e` |
| `docs/agent-state/RANK-05B_REPORT.md` | ranking decision evidence | RANK-05B | `fd2be5c274149892dfeb33a4e59a8dbcf3d907276c1aba623e2a8d0257068aaf` |
| `docs/agent-state/RANK-05C_REPORT.md` | canonical observation adapter and privacy | RANK-05C | `9dfa67c7f582d21841bcfff4aad696416920073be76796b7cfa238336bb49d42` |
| `docs/agent-state/RANK-05_REPORT.md` | behavioral evidence and replay continuity | RANK-05/05A | `f1daf31dc35d6a60f8bcbc7ce1110e24fe685849b59adedf0f17c6c7d8551c9e` |
| `docs/agent-state/RANKING_DOMAIN_CONTRACT.md` | canonical contract or pointer | RANK-01 | `a62677c37f76f643c41a70ae0285890d921b9a6d741178cc32ad087040137b3b` |
| `docs/agent-state/RANKING_FOUNDATION_FREEZE_FINAL.md` | final freeze decision | FREEZE-FINAL | `1344c2b8d693cff39ec88cab6bad1c36443e4266b0ecf3ba8f854ec4043f268e` |
| `docs/agent-state/RANKING_FOUNDATION_FREEZE_REPORT.md` | freeze audit report | FREEZE | `29c4aa505b4de8e96f96020cbf000ca63f508e70bf0eda3e0bf434e71d753ad3` |
| `docs/agent-state/RANK_FREEZE_B1_BLOCKER_REMEDIATION_REPORT.md` | blocker remediation report | FREEZE-B1 | `fe4b7b5fbfa5995dfd23e4e28c808c9727b5a450f22a9589d82173188365f0de` |
| `package.json` | ranking test registration | RANK-01–05C | `70503931d724804ea3a23b4b5f15da7e48c8a50e6534dadc9ae15da47a350597` |
| `src/app/admin/home/page.tsx` | editorial provenance foundation | RANK-02 | `68746a87679ef53830547c1a33650bac2cba32e511986bd766f9bad23370a1d0` |
| `src/app/api/v1/catalog/route.ts` | editorial provenance foundation | RANK-02 | `f400d7eed5a93d2d0999ae516cbfba628a204c197a3ed6b0ad3dce450c9b99fa` |
| `src/app/api/v1/ranking/decisions/route.ts` | ranking decision evidence | RANK-05B | `212118e6ddf1034920b5ff4898164d81f65544195fbcc80d661d8a816fc8a39f` |
| `src/app/api/v1/ranking/events/route.ts` | behavioral evidence and replay continuity | RANK-05/05A | `96a2a95878bbb19f38c5331122b158fddb1d0a0931f274f509b2b57a12f4b7e0` |
| `src/components/cms/NewSeriesIntakeForm.tsx` | taxonomy and catalog foundation | RANK-01 | `5db9e118e5070b705b4fc74740d81e4f8f9d4ac40d36dca50a0bb241206da27e` |
| `src/components/cms/SeriesMetadataForm.tsx` | taxonomy and catalog foundation | RANK-01 | `e4b7ec2222600cc3a97306c39ad88b69a5b2e16f55f3e2c964768669cbaee4fe` |
| `src/components/home/HomePage.tsx` | pseudo-Trending blocker remediation | FREEZE-B1 | `008f267db44e7805e056bafc5fc9c99fa0458378fd3e8bb70fb9523567c66f3e` |
| `src/data/content.ts` | taxonomy and catalog foundation | RANK-01 | `c2f30431eb2072b757e306743092f502b0f0023ea19825b4e01f7b64ac6153d7` |
| `src/lib/api/serializers.ts` | taxonomy and catalog foundation | RANK-01 | `2161a8df81db498bb74bf28441874f30fcb94fa8e88a6522bc1fa9500c6706cc` |
| `src/lib/catalog-rules.ts` | taxonomy and catalog foundation | RANK-01 | `5371db7c9047af7e6bc870a99ea65ba573cb61aa1d2fa9ca318aa8d3347ff16f` |
| `src/lib/catalog-visibility.test.ts` | taxonomy and catalog foundation | RANK-01 | `ff5b6811379c7325e905057b3fb5397ae9855ef3e53b0bd27fbed28275f2c949` |
| `src/lib/catalog.ts` | taxonomy and catalog foundation | RANK-01 | `5351fa38ab40f881a141616fdc448a0dc3288f5c0764b2bc0a5ebb477d0ebf6e` |
| `src/lib/cms/home.ts` | editorial provenance foundation | RANK-02 | `65ba2d670e971b528c331af469cbb12dc42b2b3a6476160993b2795932b0fc33` |
| `src/lib/home.ts` | editorial provenance foundation | RANK-02 | `a9b4c752778b283c66cb36592c5cf166f355c10e68712815f3c288742a61d111` |
| `src/lib/new-releases.test.ts` | editorial provenance foundation | RANK-02 | `44840ef867ea7b9d9cb888945b6483ebb247f1ac384ce1e24e5879cae00b4140` |
| `src/lib/new-releases.ts` | editorial provenance foundation | RANK-02 | `442ea405c3cf798831878fe9e31f1b6dbfc8f4f02e12ed42d33ed212fecc7c1f` |
| `src/lib/ranking/behavior-events.test.ts` | behavioral evidence and replay continuity | RANK-05/05A | `fbffdbbc2d505605083e7226d5e286172d7357f3eed826723201dacf2a5a58e2` |
| `src/lib/ranking/behavior-events.ts` | behavioral evidence and replay continuity | RANK-05/05A | `1a52089e75ba75a06acede399406d6a1d3142d17c277e751fc9b5448d80b8001` |
| `src/lib/ranking/behavior-evidence-completion.test.ts` | behavioral evidence and replay continuity | RANK-05/05A | `5f036e909ad99741d5b2f39b864438137e05870fe15ba7889820b20d658a97d9` |
| `src/lib/ranking/decision-evidence.test.ts` | ranking decision evidence | RANK-05B | `dde0f575442d45507dc3b4cefc147902c00ca2cd45ff9b39b800dcbcae5e559e` |
| `src/lib/ranking/decision-evidence.ts` | ranking decision evidence | RANK-05B | `77d74faa0075cf807dd4a7d5c4b80fea645bd95882f7e759da89023093c584be` |
| `src/lib/ranking/editorial-provenance.test.ts` | editorial provenance foundation | RANK-02 | `63dc5b168aff88280a6fb73c8cb670a910ad9073967f5f1337550f56d4ac3354` |
| `src/lib/ranking/editorial-provenance.ts` | editorial provenance foundation | RANK-02 | `d32deaff9d6b33ef3c7799ef52655fa8b82906a3b37351615ad9f0a3abd68c19` |
| `src/lib/ranking/explore-discovery.test.ts` | deterministic Explore foundation | RANK-03 | `9f747586c66e85ed9cf972d55a0e94ccfc125bcd8a50882911ecebf56e6f180b` |
| `src/lib/ranking/observation-adapter.fixtures.ts` | canonical observation adapter and privacy | RANK-05C | `997ae70a1936512ad17617c9dd8bd24a0a922a2a92d766f9912671eb467500d7` |
| `src/lib/ranking/observation-adapter.test.ts` | canonical observation adapter and privacy | RANK-05C | `e807f51eced6cef400c4d0c547452fcb88766e6395edb465ff5cb3270e74e34c` |
| `src/lib/ranking/observation-adapter.ts` | canonical observation adapter and privacy | RANK-05C | `f238771a02485e85c19f2ce9c3463f92fdc571290f68ba516f81aae6905bd103` |
| `src/lib/ranking/privacy.ts` | canonical observation adapter and privacy | RANK-05C | `57331f187b7668cda688b2bb9de13022974a79d9f645dea10eaaa6cfa4a1929c` |
| `src/lib/ranking/search-metadata.test.ts` | deterministic Search and attribution | RANK-04 | `91e3ede73dd8218b4a71ecbac617729f5cce2fcc57001832228cf3a827f363dd` |
| `src/lib/taxonomy.test.ts` | taxonomy and catalog foundation | RANK-01 | `4425588a76f458c9e26189e4d2dcbe67d592f66e2fc235cba9df372ef55e6d61` |
| `src/lib/taxonomy.ts` | taxonomy and catalog foundation | RANK-01 | `4028459333e05df466e2cfbee91badebab4718817b660b21061a4e9ccd0dfd18` |
| `src/types/database.ts` | ranking persistence types | RANK-02–05B | `ab1e0b7a7de61a6c709fff2a6425dfb7b19c710cba74bff275615b71204642d9` |
| `supabase/migrations/20260905030000_034_home_editorial_ranking_provenance.sql` | prepared editorial provenance migration | RANK-02 | `877a0b2cdeb09de1a0aba63d12ac1485246f7f506a5709ff6bfa43bd8ffa9742` |
| `supabase/migrations/20260905040000_035_ranking_behavior_events.sql` | behavioral evidence and replay continuity | RANK-05/05A | `e5d212304ebeaf9f609f1e779b8888200ae1254d8c8f8e9946152231672138de` |
| `supabase/migrations/20260905162706_ranking_decision_evidence.sql` | prepared decision evidence migration | RANK-05B | `0beb3d38a46dab328e3fe6a07b1a4b9d6891fe77dc3c04d0836f62d0d5522596` |
