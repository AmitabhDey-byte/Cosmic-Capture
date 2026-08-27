# Stellar Arena: Cosmic Capture

An anime-inspired competitive space game for Stellar. Players collect Stellar Cores, activate tactical abilities, avoid the shrinking void, and build a persistent pilot identity without putting real-time movement on-chain.
## What is in this MVP

- Manga-panel responsive React experience with a generated cosmic key visual, Kyoto orbit, neon city, and winter arena styling.
- Direct, no-wallet Solo Practice: a 90-second local core run with movement controls, ability activation, result screen, and wallet-aware persistence when connected.
- Quest notebook, hidden quest, cosmetic hangar, crew/social page, rankings, badges, flight log, a readable paged manga prologue, and a small Tic-Tac-Toe arcade.
- A responsive 3D hangar bay. It lazy-loads a draggable GLB model when `VITE_HANGAR_MODEL_URL` is configured, keeping the initial web bundle lean.
- Kira, the in-world guide character, with Gemini through a key-safe FastAPI route and safe local fallback answers.
- Real Freighter and Albedo wallet connection flows; no private keys ever enter the application.
- Soroban contract MVP for player profiles, final verified match results, ranking points, and cosmetic ownership.
- PostgreSQL schema and API for player names, wallet identities, local match results, Soroban transaction hashes, and feedback; optional Sentry/PostHog initialization; GitHub Actions CI and Vercel deployment pipeline.

## Deployed Live Link

https://cosmic-capture.vercel.app/

## Pitch Deck / PPT

[Open the Stellar Arena pitch deck](https://docs.google.com/presentation/d/1RsyxEQOd4zu_VGgRSEI8FrMnVwZjv0lg/edit?usp=sharing&ouid=111294959728581501547&rtpof=true&sd=true)

## Admin Panel
<img width="1917" height="968" alt="Screenshot 2026-07-27 182906" src="https://github.com/user-attachments/assets/eeda838b-240c-4182-8841-f917db210207" />

<img alt="Stellar command console overview" src="public/readme/admin-panel/admin-overview.png" />
<img width="1917" height="866" alt="Screenshot 2026-08-28 014245" src="https://github.com/user-attachments/assets/ad084e49-37a5-4d52-99ae-9819cf37aad7" />
<img width="1917" height="872" alt="Screenshot 2026-08-28 014119" src="https://github.com/user-attachments/assets/1caa4c38-7319-476a-aea9-f88cb22d8b2c" />
<img width="1917" height="860" alt="Screenshot 2026-08-28 014055" src="https://github.com/user-attachments/assets/d8b70cec-2039-46f8-95e8-ba968f46a487" />
<img width="1901" height="866" alt="Screenshot 2026-08-28 013917" src="https://github.com/user-attachments/assets/c840d475-8dfc-4eb1-92e5-5d3be1602cbe" />


## Screenshots of Product
<img width="1896" height="922" alt="Screenshot 2026-07-27 183126" src="https://github.com/user-attachments/assets/efa17388-07c6-4bc3-8309-5f0e63674d22" />
<img width="1917" height="870" alt="Screenshot 2026-07-27 192318" src="https://github.com/user-attachments/assets/5aa6c47f-fb35-40bc-a07e-df78c7dc316d" />
<img width="1916" height="872" alt="Screenshot 2026-07-27 183241" src="https://github.com/user-attachments/assets/3743e453-bed3-486c-8e88-aa65379c506b" />
<img width="1917" height="870" alt="Screenshot 2026-07-27 192318" src="https://github.com/user-attachments/assets/1558069c-c63e-427d-a5d3-6d866032e1e0" />

## Mobile Responsive 

<img width="300" height="800" alt="WhatsApp Image 2026-07-27 at 6 35 43 PM" src="https://github.com/user-attachments/assets/e3d6d465-09fa-4b49-acb1-0187b4b7d331" />
<img width="300" height="800" alt="WhatsApp Image 2026-07-27 at 6 35 43 PM (2)" src="https://github.com/user-attachments/assets/e62205bb-56e3-4593-b2e7-c2aa9d24b662" />
<img width="300" height="800" alt="WhatsApp Image 2026-07-27 at 6 35 43 PM (1)" src="https://github.com/user-attachments/assets/52811aaa-d889-4a1a-9520-22a594952ae8" />
<img width="300" height="800" alt="WhatsApp Image 2026-07-27 at 6 35 44 PM" src="https://github.com/user-attachments/assets/56474cf1-26c9-4fbf-ad8f-2002349ef652" />


## Architecture

```mermaid
flowchart LR
  P["Player / Freighter or Albedo"] --> W["React game client"]
  W --> G["Realtime game service\nmatchmaking · WebSockets · anti-cheat"]
  G --> V["Result verifier"]
  V --> S["Soroban contract\nprofiles · results · badges · cosmetics"]
  W --> K["FastAPI game service\nprofiles · results · Kira"]
  K --> AI["Gemini"]
  W --> O["Sentry + PostHog"]
```

Gameplay is intentionally off-chain: movement, collisions, core spawns, and abilities need sub-second response. The server produces a signed/verified final result; only that compact outcome is committed with Soroban.

## Users onboarded

| Timestamp | Name | Email | Stellar wallet address | Rating | Feedback | Transaction hash |
| --- | --- | --- | --- | ---: | --- | --- |
| 7/27/2026 0:01:22 | seyit ali değirmen | degirmenseyit@gmail.com | `GDOCMYNNTH62NW37IZCN6BKQTM5Z73RW7OOFXRADLYXUABDN3UXWDTNC` | 5 | Great job, I really liked it. The chess game I noticed at the very end added a nice touch, too. |
| 7/27/2026 0:36:45 | Subhadip Dutta | subhadipduttasubha@gmail.com | `GAVNLCS3GSWLKXSLZ3ITSL7QNB5IGHEOELXAF6QTYACDLEJ7XRQKBBNO` | 5 | Great user interface and smooth experience. The game runs smoothly without issues. |
| 7/27/2026 0:43:16 | Sandipan Singh | alt@sandipansingh.com | `GDYIHXTUKLCPZHWGGD5B5ZPJZINZ3WUNC3PJCDAYEB4XY4LT2XNTQHTX` | 5 | Cool Game!!!! |
| 7/27/2026 13:27:50 | Pritam Mondal | proumg2@gmail.com | `GAEAB4UWRUODGUKBYGDXBZULSOI3HJ6HQKJNNLTY66IF3ATXMRYUCSNX` | 4 | WELL FANTASTIC INSANE |
| 7/27/2026 13:30:21 | RITESH GUPTA | kingofpirates451@gmail.com | `GDFSDPEEBZYQVG5JPPTJUOH4FID4M5XV45BKTWCIEIRYMCWJ6DQADBMB` | 3 | `53d222129692157e20e1e7d3b368c44a132b5ec61f6a85f3a7e9626e0613d934` — transaction bhi kiya hu 😂😂 |
| 7/27/2026 13:31:07 | Ankita | poulumidui@gmail.com | `GCV5X5CKYUAPQLE3OYQS3PDXKX4TRV767YUCJ66PWWGZD2BXE744T276` | 4 | Well played |
| 7/27/2026 13:32:11 | Papita | poppritu@gmail.com | `GACMLTEWZ23NGJ5WZ2THYGLODFYTEKECB7J2U33H3DCSW2PEAQUEIZED` | 5 | UIUX IS AWESOME |
| 7/27/2026 13:37:17 | Rishi Dey | dramitabh101dey@gmail.com | `GBO7BZSNAX6APJW32OE5LHXQZ6MTIHBTWRZZRCJL3VSILWCAZLGCPM4T` | 5 | very good ui and gameplay |
| 7/27/2026 13:49:02 | Amitabh Dey | amitabhdey101@gmail.com | `GBKYHWSL2MNUO73HWY6KWNOA64AKSUENCOBTR56M66HNLMMKMZHK5OAS` | 5 | its nice but the game still need some improvement |
| 7/27/2026 16:49:06 | taro | lucasdory05@gmail.com | `GDNLCRNGYZNS7TQ4K5TPPH7LAIXMPXTLR6GN46VFBJLBKC6DFS24JFAU` | 4 | overall experience pretty smooth. nice work |
| 7/27/2026 17:13:41 | Ankush Shaw | ankushshaw764@gmail.com | `GBBIG4HLPGTLG6BH6YREVWJXEQ4NX74HTD444JD6A6XYS7DOFL2J6DEI` | 5 | really good |
| 7/27/2026 19:34:53 | Nitin Raj | rajnitin793@gmail.com | `GARRE4DTEUJIQSXRACCL6X55RH42S7WBO32F5HB4DU32MT6IL5TL3B3N` | 5 | great work on ui, overall experience is great!! |
| 7/27/2026 19:44:48 | Arijit Debnath | arijitdebnath008@gmail.com | `GDBHMNAQ5CRSNNSHIVJRM3OGMIX3TS3VR2J5SHFUKPGDZDCMBXAVMONK` | 5 | Bolbo na | |
| 20/08/2026 0:03:51 | Arnav Mukherjee | arnav24mukherjee@gmail.com | `GCANO7NOW34S6GFEXABOX3DJ3UL2X5GR7HTZWXB2EZR5YO5TNFP7PAGY` | 4 | very good gameplay | `3d448d35e76dbcd482ff06190264ec33efd74f08e92ef5a05902614d145b5c3f` |
| 20/08/2026 4:00:47 | Shreya Sharma | shreyasharma582@gmail.com | `GD3WWKXWNBGHSK5LSF5GZ4CSXZIW7PPVS7WXQNBFI4PKQWDCSO6G7UBR` | 3 | great ui | `f914fe3d42d23b777358a206ff384faba38112790a3cd5b2281c3ed9e426188b` |
| 20/08/2026 4:39:48 | Bikram Sengupta | bikram91sengupta@gmail.com | `GACIMBDINSRQ3RALE3CU7AQR2E5BLDOPIEJKDBEBQFWHN4YYVVXGSAWE` | 5 | uiux is great | `e13e6fe60a82c6938f5372faac34e99a3327fe7fd29908ae17b210d90922f52a` |
| 20/08/2026 6:14:33 | Pooja Rathore | poojarathore149@gmail.com | `GAKTHD2N7UIHKXJYTF5SEYDPO2S2IOCADDZAWPPNB7MYIHUOP2PCPKDL` | 5 | nice game | `6101fec71c40a3836fc3f0f966bc3f9b3a5950ef45fa9b68bab23e6bc5bf26bd` |
| 20/08/2026 7:05:20 | Anirban Ganguly | anirban73ganguly@gmail.com | `GDNPJ6V7EF7QA6BADIJFCB7YOLR7S6FX2RWMBOLIDVYY65D5GVSOH6PJ` | 4 | bhalooo! | `7cdf3addcd0f88d7c8ff1e3cc7dbf1c79be2a0865891726e224433f2a1f3dd52` |
| 20/08/2026 9:28:23 | Sneha Kapoor | snehakapoor831@gmail.com | `GCCPT6NNSO22Z34MQ2JGHT3OLXJNCKE5CECEF3HIPENRRYFQGZGSSGIR` | 4 | awesome ui | `338536ad080e7b839c08f44de1242e8a96afd55ea6e7f2ea5e7c62b0c22a9ac0` |
| 20/08/2026 14:18:22 | Debjani Dasgupta | debjanidasgupta812@gmail.com | `GAMW5NO57DH3XTT27TGU2Q5CKLC5F6V3VKGEAPR7PCR2TSACSHS5GRD6` | 4 | nice game, I really liked it. | `a32fd4bca3d6a8c3368878eeef1583a462916194d824643ebb4365bcf2c316bc` |
| 21/08/2026 0:57:10 | Rohan Verma | rohanverma45@gmail.com | `GB7DORZBX2O2T24LJ3IB5MJYGVSJPSYXDXXZF5ATZQMSNWTKZIXTZWAZ` | 5 | Great job, I really liked it. The chess game added a nice touch. | `a9ba1307ef065740c36b637d55382c957df63836ed9dd80c26835bb929e147a1` |
| 21/08/2026 3:15:56 | Tanmoy Bhowmick | tanmoy619bhowmick@gmail.com | `GBD7LYZ6YLGKZVMXKGW47JCLPURFKIRPNADY62L27RJLQYMNAZWTTWGF` | 5 | darun.. | `0f0cfc56b39db278e2df6e12f069684626a0aa021aff31c73844171921cd1b54` |
| 21/08/2026 3:58:25 | Ananya Rastogi | ananyarastogi37@gmail.com | `GDQRPZHEKXQIPTZGYEGUMFYCVOJD7ZDDLUFRZ6KAA4JAHAS6WMC5OBJX` | 4 | nice uiux brooo | `726bfd7afe0469feb9693ecd4be9d51f90c4d6b126aacb2fb4c2401c300209ef` |
| 21/08/2026 5:58:38 | Swastika Banerjee | swastikabanerjee84@gmail.com | `GAUSQBPHNCPKK3KFSS2PACSJL74HBBZHE5IDV3FOATGB77RENC7SCZFZ` | 5 | pretty decent | `e78effbec51dd94b90f46f9a560b9ad20bf8d0ff5415a5a5cd5978dad2ae4bcc` |
| 21/08/2026 11:03:25 | Siddharth Malhotra | siddharthmalhotra902@gmail.com | `GADMX6UFXMEFX4UVKLPVS6OBETIENSYOW6OXU6JB7ADOANJ2GOE42SZC` | 4 | good game. | `bb9a0c6182619f4c756aeb9eca37bf61ea72a16acc239129fcc5fdcc9aab6799` |
| 21/08/2026 15:59:53 | Ritwik Ghoshal | ritwik15ghoshal@gmail.com | `GCJQLY77YBCGE4JEMLBOYVDRRK7A4Q37BHZ3JJI7ATSLMIGJKEQGMSZL` | 5 | bhalo game | `ce4023ef5b74d4ef32dc3e22656b38f752302c928ee30ce3050b211aa7212c2c` |
| 21/08/2026 22:40:19 | Ishita Bhatia | ishitabhatia471@gmail.com | `GCD6NNP6253FZCA4J3EEVL7HV7EIJCBR4LMTWSW2GN7X72LCQUOJZ2QA` | 5 | Great user interface and smooth experience. | `6508348f9548ff1ea74a451dd5071788dabd6325771ca437ee385c86b6b8bb69` |
| 08/2026-22 3:02:37 | Paramita Bose | paramitabose63@gmail.com | `GDMGQLDEINU6GGYNFYHEOBIXMWKUIGILDUKVOWDLXJ7RDKKQ3BOGRKUE` | 4 | awesome | `78a091b75200796f25c4d47cffc3479ca2f8af3054cd6cd2789f707168c2fdee` |
| 08/2026-22 4:59:10 | Kunal Tyagi | kunaltyagi82@gmail.com | `GCE3CRR3YKS4DG7ALWRATH6MB4L5LBOJ6BMGRTRWUDFPBZA5D5PCXGYQ` | 4 | noice brother | `d742b9187ba61d2e1b4c7a153d5033b17ce460210e675836bf8e0972d470e728` |
| 08/2026-22 9:43:32 | Tathagata Dutta | tathagatadutta504@gmail.com | `GA37VC34DNGTOYR2GJYZSZFRP74HXGGSJZLTY5W25WX3L5VEBG4QKML6` | 3 | really good | `85f04330fb96f74f38e8ef4ca3acaeeea9010af15689924c26e1311e0eb41c14` |
| 08/2026-22 16:19:07 | Meenakshi Saxena | meenakshisaxena319@gmail.com | `GBNNDXKC6PGQL2CEAM47M6Y6NEL6A3UQZGZCT4Y3T6POX442M4PWRPBG` | 4 | damn good | `5ca2916ba0813b38d2bee6c7f1c65f14fe85761ac18af20958129041ad2bd2da` |
| 08/2026-22 17:43:57 | Aparajita Sen | aparajitasen27@gmail.com | `GCBES64B7OLSL3T6WDJNUQG3AW5JAPJXA3DBXACXPVAJ4TPW24RQI32L` | 5 | great ui | `d83dba0bf70e5251b15da7dc6d5d879d0f0a1c60fee8098182daff88fbca770c` |
| 08/2026-22 18:19:43 | Harshvardhan Singh | harshvardhansingh764@gmail.com | `GDFHYQBJ32IAXD4RTDX4STEGVT2LKPK4RQJWQ7ZBUCT5ERK7H7FZ3LVX` | 3 | nice game | `6de12c3a6dea7a95c32327741553ab59d311a9d590d531a87094b1c9b894e597` |
| 08/2026-22 20:46:30 | Sourav Chakraborty | sourav48chakraborty@gmail.com | `GDTS6UM5OHKKQVWZQTCDUZTGAHXW6MPUFLXFR3HZZ5KJGSP7V4ENL42M` | 4 | t2y444u6yiuiiuyu6 | `a22501bd01e0e1f5155c0125f65224d89490eedae9be1154a61bda761d8f2bfb` |
| 23/08/2026 1:28:17 | Sunaina Agarwal | sunaina823agarwal@gmail.com | `GAM676ZUJG3V2XBUJYKCKZROZHEJMQF5KZGHBWWHONL2SXJDTJST362H` | 5 | good game. | `fc5eba1aea9c79f030e303d629a6758c385eeb8fb11f00f5d7ce227670e29c6d` |
| 23/08/2026 6:38:34 | Sudipto Roy | sudiptoroy159@gmail.com | `GBBXQ56T5OW4K45NYUSYZWSUHLKQDBMTL3UF7ZXGRUFAGUZD3OHBRQNC` | 5 | uiux is really great | `be87949cdc780e4e9f2fa4dfe4edb4a4a849c39c5d333e6bd414b340578ae319` |
| 23/08/2026 7:35:31 | Kavya Chauhan | kavyachauhan74@gmail.com | `GDFCQOJCZ6KNW5CAARENV7YLQWY5ZY5QGPVTCUNZ6NOJYF7UFWAZBE5Z` | 4 | very good game | `e6c9bc26d060c9bfb2b2249f3186dec35dcbf8da7cfd9ba067c4847337427d2f` |
| 23/08/2026 8:18:58 | Subhashish Mukhopadhyay | subhashish631mukhopadhyay@gmail.com | `GBDTRSDSLVBCIPCILWOAWKIOK4COYK2INU7COZMWI2TB54TCQGIML75B` | 5 | khub bhalo | `b201ee10515b1c2a4dc361251899d20784adcee9437f01dc54df42aca77cc587` |
| 23/08/2026 9:01:39 | Radhika Joshi | radhikajoshi92@gmail.com | `GBZMGZX4INA6TG6R4A46VLWMGDZRRGJOV4V3EIRONHMZCUJUHZTPUFQY` | 5 | the app looks good but still needs improvement in the AI section | `4977db439093327a4f57a46731dacd430f87b64aa1b88a9bd1d77410d39ffb2e` |
| 23/08/2026 10:02:16 | Trisha Pal | trisha418pal@gmail.com | `GDKZWRI3APYQ4YHGQWIAMU4QGF5XAJRGII6PICQREIKIGZXVEADLWXTE` | 4 | spaceships attacked one another instead of the player's ship | `34586d1fe6c0886c8105612d4edd7d8a1212db6796d7fad5f3d6571f5804d587` |
| 23/08/2026 11:08:17 | Devendra Grover | devendragrover53@gmail.com | `GB6LEAB57B2ZPT57WFQXBMQ2ICUBG4W7IBDRLFZJMN3JU4KMR2PLHLO5` | 4 | the physics is bad | `dffca1b927b03b9e18c0c9e19dc0c46993f0f529784b2652a49ea84125779e58` |
| 23/08/2026 12:34:57 UTC | Indranil Sarkar | indranil872sarkar@gmail.com | `GCAILDG257PP722UP2PTMIAI7EWECJSGJJBZS6QE5DB2GN4WHJXUCCUQ` | 5 | nice app; clean UI/UX; game needs to be better | `a7df49de9c891c8aa1b68730ab0ffba62b0235ec87795a1517ffd7c8dfaed3a3` |
| 23/08/2026 13:46:35 | Priyanka Biswas | priyankabiswas29@gmail.com | `GAIUMMIWDBSNAK7S2PCRBQKGP5UG2OPWWAYBAYDXLBQQBLMA2ZMNWWWL` | 4 | change the prologue | `6d2ef5f1c3f99d8eacdd2214367dc9eceb6c56618a6ab20d5f9424c4d79f7093` |
| 23/08/2026 19:58:21 | Shibaji Nandi | shibaji614nandi@gmail.com | `GBSGHZ3IYVSRTUZEYN3EBJKKLF4QXURXDYYQ2OV4UWOPMHXEN4FYK5N3` | 5 | kor bro kor chaliye jaa | `9d2ab69d4757bf77e870bd04226f40b08f689e52436c83ff3005bacb4e3efbed` |
| 23/08/2026 21:00:05 | Rajeshwar Sharma | rajeshwarsharma81@gmail.com | `GB4VDNEYS25AAFTRL72LQKYHYMQICKN3OEW3LOYAVG5KSN4RHFMDTOPG` | 5 | good good | `cc10b9dd3386499571e0fb20cb20daeab895e1c79ac6ee33a2b758d4819ac4a9` |
| 23/08/2026 22:17:24 | Arundhati Ghosh | arundhati735ghosh@gmail.com | `GB3NV4FTGI3WMY2GZ5GDVM4AEGAKAUOGPKR6O7PO6WCAGP5URLWX3INX` | 5 | no feedback provided | `31d9997d28b6a152f37a28b048dcd3534fa32576ca66c6aa7fbd2b50d7df436a` |
| 24/08/2026 3:24:43 | Vikramaditya Rathore | vikramadityarathore42@gmail.com | `GDD4RPKVG4JTPJCLFKQ7SZFJDUMZ3VHMULYIYC3NSQ7P4UTTDRSVJQWJ` | 4 | nice gameplay | `eb9d580982bdea44b585739fd5b4ca850cb15aecc9669509ef9ca4038bfc1cf3` |
| 24/08/2026 5:59:05 | Bodhisattva Mitra | bodhisattva903mitra@gmail.com | `GDFN3EZXSYNW6M6DE7Y4WOITEZ2ELNM4RAIZFXABJ2ML4XER5YJ3OTDU` | 5 | UI and assets are amazing | `7cc7a64d09c1dda75524ae04d76e03a55491b7a4c5c85c06c741b435658eaf4` |
| 24/08/2026 13:00:37 | Raima Choudhury | raimachoudhury67@gmail.com | `GBMFEKIX77EBUKOTJJEBEDPV7CY6IXVN5NQF4EQN5DBLN7OZSKIXSM3H` | 5 | damn good | `7843460ec95b6f858b063eb9c2e4967b512fa2e7702b917912c0bba550e84fd1` |
| 24/08/2026 13:08:20 | Aditya Verma | aditya382verma@gmail.com | `GB2KGLCFLTMYISMHF4WT7F32P5ZLWTC6KSZXMASPPWPCTPKLCLNEXNK3` | 4 | noice brother | `0a1ad7b2db0f1796c6b06146974bb61faa07369684b3a49f5632e533e697f75` |
| 24/08/2026 14:29:11 | Madhurima Mullick | madhurimamullick51@gmail.com | `GCH4YZITWUSTEPSME627YUKK2VA62HETBXTIEUDHB3JNP6XQKTO7E5HZ` | 3 | no feedback provided | `7581ad0ce14e03917a469d2a209ab63a2a4b7ec34f2e388eaaf622284a54edb5` |
| 24/08/2026 16:09:29 | Debashish Roy | debashish849roy@gmail.com | `GDTZQQAA4CZXQER5JJZ6G27ED2KO3BAVVLXGV6DXQ5TRRQLETWK2B3OR` | 4 | kor bhai chaliye ja | `12dfb3a7352613b343325521f1a7c1851fab1f0fd4b45bd608f6a3478b450d98` |
| 24/08/2026 16:57:41 | Moushumi De | moushumide72@gmail.com | `GAC57CUX4CVD7D232AM7Y7KV3HICIOSV2MWPIZX7PPXRJSFRFFIQWJQ7` | 5 | good game. | `c396f407190b8475b0564520259add57eed236c300bdf86bc0be0ea30b0b6d35` |
| 24/08/2026 19:04:14 | Piyush Chauhan | piyush916chauhan@gmail.com | `GATX7NGYRNSO6UZEUCDVG2ZI47MRWDVFR6IFHDP5FF2BKW6B4YP7YJ2H` | 4 | damn good uiux | `f3afa3000d0c29523f1b52767bc9a698e73d4d241a1d727369458f016f8d4da2` |
| 24/08/2026 21:01:18 | Rituparna Sengupta | rituparnasengupta44@gmail.com | `GB6ISGQXNXADHOKD2I66M2IHNGL4BD3PGXPUCKPAHO3I3WCG2FXMNOHH` | 5 | khub bhalo | `76a534826b93cee61abd7183269dd6644f0a260579b407837f105b96ca225060` |
| 24/08/2026 22:25:24 | Sabyasachi Das | sabyasachi628das@gmail.com | `GBOIO4D22HJTK73QEUNML6M3KZEYLCHYKOMCWYMSU6DGVQ7EMGXYNNOB` | 4 | darun.. | `d833909dcb9f0fe9bfd521032c4c42850dd7cdb44c97c65df34a2f7f8abefd42` |
| 25/08/2026 3:10:24 | Mahua Kar | mahuakar135@gmail.com | `GB7UYTT4NCLXZAOWERBEQRL5WDQBGPRWS6BGVT76WTCFDXKX4DC3NTRV` | 3 | Great job; the chess game added a nice touch. | `ae149035cc618642f0a8ed1207c44d31c4ba43ba766d0a1eb17dd1204c033516` |
| 25/08/2026 11:21:11 | Antara Kundu | antara89kundu@gmail.com | `GC2XD3GIXQ3JQQUQINKAGN3KVPGIMTGRQAAGDAPH7CSHJFKI26SV2QXW` | 4 | nice gameplay | `78c9a7003a5cf13a8e6ea9b1bc8d5428965bf7a83d88a1f1ce40457d1f97eee7` |
| 25/08/2026 12:39:50 | Kaushik Chatterjee | kaushikchatterjee472@gmail.com | `GAUJNUHI4OOWOH2QTRNWJSQPKCE4Z4PITBEOICNJMOS7RJ3SWKJ5L65K` | 5 | UI and assets are amazing | `7cd25e6bb6d7a40e9de16a0355666556905c92c9e13d8aa64a730711063cc158` |
| 25/08/2026 15:24:12 | Sharmila Basak | sharmila31basak@gmail.com | `GA6QAJYPDINSZP4JYXQXSBYMHQHP7JEDCZDID3YQV7WD2EKZR2E4XWFM` | 4 | u5t498yr398y3ry3y8y | `38687da143bae31424a9d97f13407419911d4575150f08075e60f05084f8bb25` |
| 25/08/2026 20:09:13 | Niladri Samanta | niladrisamanta854@gmail.com | `GDH5X3CEFNYTDUURTNSL2X4CUMQZ4KCQ4ITKTEQE5ZLUWW6Q6VDS6GAQ` | 3 | good game. | `bea9f9b53c2d4ed318193e2cdd5141710b24c2793b6004cf718c671701d15ce7` |
| 25/08/2026 21:17:46 | Suchitra Roy | suchitra93roy@gmail.com | `GBVF6OEOFJHBW3PLGZPAZTIIUDJJXKD7QCYVXXCMYLANRGCZQHUMGBWH` | 4 | decent | `59218926f1cbb8cb15ff96b9a6c9065c4fb1e51ca4074ea7d7803801137120e0` |
| 25/08/2026 21:24:29 | Koyel Poddar | koyelpoddar716@gmail.com | `GA5MLAMOPY2N2IT2D22HGL3XMJBE2ZX2YEY4ER4IUQLTWNTSF52E5UU5` | 5 | bhalo na.... | `c43364cd7eeb9f430eddbc4eef90541eb83235985f921d2b390ae95f6fd3937e` |
| 25/08/2026 22:16:50 | akansha dey | akansha43dey@gmail.com | `GAXKN6AZMO5XRRNIUSDNEAXG6HFVMO5OFJ6TQLEI6F6RY6X3CJEMEH7Z` | 4 | dammmm | `d5f1f9d7a56ff7ef0cbc60d8ef4970633c13472cb84580984b96eee8d01bb7c0` |

## User data spreadsheet

[Open the user data spreadsheet](https://docs.google.com/spreadsheets/d/1ZZj4TlG5uyUBylbOUT6-azJKUIOxFSF_c-opmwFxoGE/edit?usp=sharing)

## Feedback form link

[Open the feedback form](https://forms.gle/JogZinMtuEdXZvK7A)

## User iteration feedback

User testing surfaced an important combat issue: in Solo Practice, rival rockets could target and destroy one another instead of consistently engaging the player. This made the arena feel unpredictable and could end the dogfight before the player had a fair chance to participate.

We updated the combat loop so Solo rivals always select the player ship as their hostile target. Projectile collision handling now also ignores rival-to-rival hits in Solo mode, while Duo mode continues to use team-based hostile targeting. These changes keep rockets focused on the player during a Solo run, preserve a consistent challenge, and make combat outcomes easier to understand.

## Current playable arena

The **Play** route is a 90-second Canvas arena, not a mock-up. Pilot the supplied Sora interceptor with **WASD / arrow keys**, aim with a mouse or touch, and press/hold **Space** or the pointer to fire. Capture luminous Stellar Cores for points, take down rival scouts, and finish above the board to earn a Testnet result. Arena entry requires a connected Freighter or Albedo wallet plus a callsign and age (13+); the prologue, crew files, hangar, shop preview, and arcade remain public. A completed run is sent to FastAPI, which stores the public wallet, profile, match, and Stellar transaction hashes in PostgreSQL.

Each ship has one hull per round: a destroyed player is extracted and a destroyed rival stays out. **Space** now fires as well as pointer/touch input. The **Store** sells Aegis Bloom, Blink Shift, and EMP Bloom using wallet-signed native XLM on Testnet; the FastAPI service verifies the Horizon transaction, stores its receipt in PostgreSQL, and only then equips the module.

First place records a one-time **native XLM Testnet prize** and FastAPI sends it from a server-only winner treasury to the connected wallet. This feature is intentionally Testnet-only: the local Canvas MVP is not an anti-cheat authority and must not be used to release Mainnet value. Duo mode includes a durable, wallet-backed Postgres matchmaking lobby; a separate authoritative WebSocket game service is still required before combat can be synchronized between devices.

## Run locally

Requirements: Node 22+, Python 3.12+, PostgreSQL 16+ (or Docker), a Freighter extension and/or Albedo account for wallet testing, and Rust if you will work on the contract.

```bash
npm install
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
Copy-Item .env.example .env
docker compose up -d postgres
npm run db:migrate
npm run dev:full
```

Open `http://localhost:5173`. The client runs on `5173`; the game API runs on `3001`.

Solo Practice needs none of the external keys: click **Play → Launch Solo Practice** and it works entirely in the browser. Connect a wallet and start the API only when you want player and match data persisted to PostgreSQL.

Set `GEMINI_API_KEY` in `.env` to make Kira use Gemini through the API. The key never reaches the browser. Without it, the guide deliberately falls back to local answers so the game remains playable.

## Environment variables

| Variable | Location | Purpose |
| --- | --- | --- |
| `VITE_GAME_API_URL` | frontend | Optional API origin for local development. Leave empty on Vercel to use the same-origin FastAPI Function at `/api`. |
| `VITE_SOROBAN_CONTRACT_ID` | frontend | Stellar Testnet contract ID: `CCPBQGLTWINIHUIAR3G77CIXLDRCRQJB6JGVCTPKVCKG3J25FIKO2XBK`. |
| `VITE_SENTRY_DSN` | frontend | Optional browser error tracking. |
| `VITE_POSTHOG_KEY` | frontend | Optional product analytics. |
| `VITE_POSTHOG_HOST` | frontend | PostHog region endpoint. |
| `VITE_HANGAR_MODEL_URL` | frontend | Public HTTPS URL to a `.glb` asset generated/exported through To3D. Optional. |
| `VITE_STELLAR_HORIZON_URL` | frontend | HTTPS Stellar Testnet Horizon origin, normally `https://horizon-testnet.stellar.org`. Do not append `/api`. |
| `VITE_GAME_ASSET_CODE` | frontend | `ASTRA`. |
| `VITE_GAME_ASSET_ISSUER` | frontend | Project ASTRA Testnet issuer: `GDTHHFGEJKUXSKMFX6HRIDF7S7FN5CSIUFXU7T6K4UOFV7KI5DAT6UJN`. |
| `VITE_POWERUP_TREASURY_ADDRESS` | frontend | Public Stellar Testnet account that receives native-XLM power-up payments. |
| `DATABASE_URL` | server only | PostgreSQL connection URL. Required for the game API. |
| `DATABASE_SSL` | server only | Set `true` for managed Postgres that requires TLS. |
| `DATABASE_POOL_MIN` | server only | Minimum FastAPI/asyncpg connections to keep warm. |
| `DATABASE_POOL_MAX` | server only | PostgreSQL connection pool limit. |
| `GEMINI_API_KEY` | server only | Gemini access key; never expose it as a `VITE_` variable. |
| `GEMINI_MODEL` | server only | Optional Gemini model override. |
| `CLIENT_ORIGIN` | server only | CORS allow-list origin. |
| `PORT` | server only | FastAPI service port, defaults to `3001`. |
| `SOROBAN_RPC_URL` | server only | Stellar Testnet Soroban RPC endpoint used by the result verifier. |
| `STELLAR_GAME_ASSET_ISSUER` | server only | Must match the public ASTRA issuer configured in `VITE_GAME_ASSET_ISSUER`. |
| `STELLAR_REWARD_ISSUER_SECRET` | server only | Private secret for that same funded ASTRA issuer. Never expose it as `VITE_*`. |
| `RESULT_VERIFIER_SECRET` | server only | Secret for the backend-only result-verifier Stellar account. Never commit or prefix with `VITE_`. |
| `ADMIN_ACCESS_TOKEN` | server only | Long random bearer token required by the in-app **Ops** dashboard. It is never sent unless you unlock that dashboard. |
| `STELLAR_POWERUP_TREASURY_ADDRESS` | server only | Must match the public checkout destination; FastAPI verifies XLM payments to this address before granting a power-up. |
| `STELLAR_WIN_REWARD_TREASURY_SECRET` | server only | Secret key for a funded Stellar **Testnet** account that sends a one-time winner prize. Never expose it as `VITE_*`. |
| `STELLAR_WIN_REWARD_AMOUNT` | server only | Native XLM Testnet prize per first-place match; defaults to `1.0000000`. |

The FastAPI service exposes `GET /health`, `GET /api/health`, `GET /api/leaderboard`, and write routes for players, matches, transactions, power-up receipts, feedback, and Kira. It adds CORS, schema validation, connection pooling, safe error responses, and shutdown handling. The migrations store `display_name`, `wallet_address`, match result hashes, Stellar transaction hashes, and verified power-up ownership separately for auditability.

## Deploy on Vercel

This repository now deploys the Vite client and FastAPI API together. `api/index.py` exports the FastAPI app as a Vercel Function, while `vercel.json` keeps `/api/*` requests on that function and routes every other URL to the React SPA.

1. Push the repository to GitHub and import it into Vercel.
2. In **Project Settings → Environment Variables**, add the server-only values from `.env.example`: at minimum `DATABASE_URL`, `DATABASE_SSL=true`, `CLIENT_ORIGIN=https://your-domain.vercel.app`, and the Stellar/Gemini variables you plan to enable.
3. Add the public `VITE_` values there too. Leave `VITE_GAME_API_URL` empty so browser requests use the same Vercel domain. `VITE_POWERUP_TREASURY_ADDRESS` and `STELLAR_POWERUP_TREASURY_ADDRESS` must contain the same funded Stellar Testnet public address. Add `STELLAR_WIN_REWARD_TREASURY_SECRET` only to Vercel's server environment, fund its public account with Testnet XLM, and set `STELLAR_WIN_REWARD_AMOUNT=1.0000000` (or your chosen Testnet amount).
4. Run `npm run db:migrate` once against the production Neon database before enabling checkout, then deploy. The migration now includes player age and the Duo lobby tables. Vercel detects the Vite build and root `requirements.txt` automatically. The Vercel routing configuration explicitly sends `/api/*` to `api/index.py` before the React SPA fallback, so POSTs such as player registration and power-up verification reach FastAPI instead of returning `405` from the static site.

After deployment, set a long random `ADMIN_ACCESS_TOKEN` in Vercel. Open **Ops** in the app header and enter that value to see registered pilots, login activity, matches, purchases, Stellar transaction hashes, XLM prize totals, and feedback. The token stays only in that browser tab session.

For a CLI deploy after linking the project, run `npx vercel deploy --prod`. Vercel documents FastAPI Functions and Vite SPA rewrites in its [FastAPI guide](https://vercel.com/docs/frameworks/backend/fastapi) and [Vite guide](https://vercel.com/docs/frameworks/frontend/vite).

## Stellar wallets

`src/lib/wallets.ts` contains the real wallet connection layer:

- **Freighter** calls `setAllowed()` then `getAddress()` from `@stellar/freighter-api`.
- **Albedo** calls the `publicKey` intent from `@albedo-link/intent`.

Both flows ask the player to approve access in their wallet. The app only retains the public address in browser state. When a deployed contract and result API are connected, use the same wallet adapters to sign registration, badge, and cosmetic transactions.

## Soroban contract MVP

### Deployed contract

- **Network:** Stellar Testnet
- **Contract ID:** [`CCPBQGLTWINIHUIAR3G77CIXLDRCRQJB6JGVCTPKVCKG3J25FIKO2XBK`](https://lab.stellar.org/r/testnet/contract/CCPBQGLTWINIHUIAR3G77CIXLDRCRQJB6JGVCTPKVCKG3J25FIKO2XBK)

The contract source is at [`contracts/stellar-arena/src/lib.rs`](contracts/stellar-arena/src/lib.rs). It supports:

1. Admin initialization.
2. Player self-registration, authenticated by the player wallet.
3. Admin/server-authenticated recording of a unique final match result.
4. Aggregate matches, wins, cores, and ranking points.
5. Admin-gated cosmetic ownership minting.

The deployer should be the result-verifier account, or a narrowly scoped authorization account controlled by the backend. Do not give arbitrary clients permission to call `record_match`.

Local verification:

```bash
cargo fmt --manifest-path contracts/stellar-arena/Cargo.toml -- --check
cargo test --manifest-path contracts/stellar-arena/Cargo.toml
```

To deploy, compile with the Soroban-compatible `wasm32v1-none` target, use the Stellar CLI against Testnet, then place the resulting address in `VITE_SOROBAN_CONTRACT_ID`. A funded Testnet account and the project-specific verifier address are required, so deployment is deliberately not hard-coded here.

## Production checklist

- [x] Responsive frontend with loading, empty, and wallet rejection states.
- [x] Real Freighter and Albedo account-connection code.
- [x] FastAPI + asyncpg API that protects the Gemini key and maintains PostgreSQL pools.
- [x] PostgreSQL migration plus API routes for players, matches, transaction hashes, and feedback.
- [x] Locally playable Solo Practice with no wallet or secret requirement.
- [x] Soroban contract source and CI verification job.
- [x] Sentry and PostHog integration points.
- [x] CI and deployment workflow templates.
- [ ] Deploy the game API + WebSocket server and implement server-side anti-cheat.
- [x] Deploy the contract to Stellar Testnet and add its address to deployment environment variables.
- [ ] Configure Sentry/PostHog project keys and capture screenshots for the review package.
- [ ] Onboard ten real Testnet players and save their consented wallet-interaction evidence.
- [ ] Publish a live demo and record the requested walkthrough video.

## CI/CD

The CI workflow at [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every PR and `master` push. It installs with `npm ci`, lints and builds the Vite client, compiles the FastAPI package using the same root requirements Vercel uses, and formats/tests/builds the Soroban WASM target.

The release workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs only after a successful `master` CI run (or through manual dispatch). It rebuilds the Soroban WASM, deploys and initializes a fresh Testnet contract, passes that contract ID into the Vercel production build, deploys the exact prebuilt artifact, and verifies `GET /api/health`. It requires these GitHub repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `STELLAR_CONTRACT_DEPLOYER_SECRET` — funded Stellar **Testnet** `S...` key used only by GitHub Actions to deploy the contract.
- `STELLAR_CONTRACT_ADMIN_ADDRESS` — matching public Stellar `G...` address; it becomes the contract administrator.
- `VITE_SENTRY_DSN` and `VITE_POSTHOG_KEY` (optional)

Configure application runtime secrets (`DATABASE_URL`, Gemini, Stellar payout values, and `ADMIN_ACCESS_TOKEN`) in **Vercel**, not GitHub Actions. The Testnet contract deployer secret belongs only in GitHub Actions because it signs the deployment. The API and browser use the same deployment origin by default. Optional GitHub Environment protection rules on `production` can require your approval before the deployment job starts.

## Project map

```text
src/
  App.tsx                 Product surfaces and game UI
  lib/wallets.ts          Freighter + Albedo connections
  lib/observability.ts    Optional Sentry + PostHog setup
backend/app/main.py       FastAPI game API + Gemini guide endpoint
api/index.py              Vercel FastAPI Function entrypoint
backend/app/schemas.py    Validated API payloads
backend/scripts/migrate.py PostgreSQL migration runner
backend/requirements.txt  Pinned Python service dependencies
db/migrations/            Player, match, transaction, and feedback schema
Dockerfile                Production container for the game API
vercel.json               Vite SPA + same-origin API routing
requirements.txt          Vercel Python dependency entrypoint
contracts/stellar-arena/  Soroban contract MVP
public/art/               Generated project art
.github/workflows/        CI and guarded Vercel deployment
```

## Product notes

Stellar Arena is designed to validate whether players return for fast social matches, rather than speculative reward loops. Track queue conversion, match completion, repeat play, ability selections, and wallet-connect conversion before expanding tokenized rewards.

done
