// Editable repair planning catalogue, not a Romanian sales or search-volume ranking.
// Model names checked against manufacturer catalogues, November 2026.
export const PMAX_MODEL_LIMIT=12000;
export const PMAX_MODEL_GROUPS=[
 ['Apple','iPhone 18 Pro, iPhone 18 Pro Max, iPhone Duo, iPhone 17, iPhone 17 Pro, iPhone 17 Pro Max, iPhone Air, iPhone 17e, iPhone 16, iPhone 16 Plus, iPhone 16 Pro, iPhone 16 Pro Max, iPhone 16e, iPhone 15, iPhone 15 Plus, iPhone 15 Pro, iPhone 15 Pro Max, iPhone 14, iPhone 14 Plus, iPhone 14 Pro, iPhone 14 Pro Max, iPhone 13 mini, iPhone 13, iPhone 13 Pro, iPhone 13 Pro Max, iPhone 12 mini, iPhone 12, iPhone 12 Pro, iPhone 12 Pro Max, iPhone 11, iPhone 11 Pro, iPhone 11 Pro Max, iPhone XS, iPhone XS Max, iPhone XR, iPhone X, iPhone 8, iPhone 8 Plus, iPhone 7, iPhone 7 Plus, iPhone SE (2022), iPhone SE (2020), iPhone SE (2016), iPhone 6s, iPhone 6s Plus, iPhone 6, iPhone 6 Plus, iPhone 5s, iPhone 5c, iPhone 5, iPhone 4s, iPhone 4, iPhone 3GS, iPhone 3G, iPhone (2007)'],
 ['Samsung Galaxy S','S26, S26+, S26 Ultra, S25, S25+, S25 Ultra, S25 Edge, S25 FE, S24, S24+, S24 Ultra, S24 FE, S23, S23+, S23 Ultra, S23 FE, S22, S22+, S22 Ultra, S21, S21+, S21 Ultra, S21 FE, S20, S20+, S20 Ultra, S20 FE, S10e, S10, S10+, S10 5G, S10 Lite, S9, S9+, S8, S8+, S8 Active, S7, S7 edge, S7 Active, S6, S6 edge, S6 edge+, S6 Active, S5, S5 mini, S5 Active, S5 Neo, S4, S4 mini, S4 Active, S4 zoom, S3, S3 mini, S3 Neo, S2, S2 Plus, S, S Plus, S Advance'],
 ['Samsung Galaxy A','A57, A37, A56, A36, A26, A17, A16, A06, A55, A35, A25, A15, A05s, A05, A54, A34, A24, A14, A04s, A04, A53, A33, A23, A13, A03s, A03, A52s, A52, A32, A22, A12, A02s, A72, A71, A51, A41, A31, A21s, A11, A01, A70, A50, A40, A30s, A30, A20e, A20, A10, A9 (2018), A8 (2018), A7 (2018), A6+ (2018), A6 (2018), A5 (2017), A3 (2017), A5 (2016), A3 (2016)'],
 ['OPPO','Reno14, Reno14 Pro, Reno14 F, Reno13, Reno13 Pro, Reno13 F, Reno12, Reno12 Pro, Reno12 F, Reno12 FS, Reno11 F, Reno10, Reno10 Pro, Reno8, Reno8 Pro, Reno8 T, Reno7, Reno6, Reno6 Pro, Reno5, Reno5 Lite, A5 Pro, A79, A78, A77, A76, A74, A73, A72, A60, A58, A57, A54, A53, A52, A40, A38, A18, A17, A16, Find X8 Pro, Find X5, Find X5 Pro, Find X3 Pro'],
 ['Xiaomi','15, 15 Ultra, 15T, 15T Pro, 14, 14 Ultra, 14T, 14T Pro, 13, 13 Pro, 13T, 13T Pro, 13 Lite, 12, 12 Pro, 12T, 12T Pro, 12 Lite, 11, 11T, 11T Pro, 11 Lite 5G NE, Mi 10, Mi 10T, Mi 10T Pro, Mi 9, Redmi Note 15, Redmi Note 15 Pro, Redmi Note 15 Pro+, Redmi Note 14, Redmi Note 14 Pro, Redmi Note 14 Pro+, Redmi Note 13, Redmi Note 13 Pro, Redmi Note 13 Pro+, Redmi Note 12, Redmi Note 12 Pro, Redmi Note 12 Pro+, Redmi Note 11, Redmi Note 11 Pro, Redmi Note 11S, Redmi Note 10, Redmi Note 10 Pro, Redmi Note 10S, Redmi Note 9, Redmi Note 9 Pro, Redmi Note 9S, Redmi Note 8, Redmi Note 8 Pro, Redmi 15, Redmi 15C, Redmi 14C, Redmi 13, Redmi 13C, Redmi 12, Redmi 12C, Redmi 10, Redmi 10C, Redmi 9, Redmi 9A, Redmi 9C, POCO F6, POCO F6 Pro, POCO F5, POCO X7, POCO X7 Pro, POCO X6, POCO X6 Pro, POCO X5 Pro, POCO X3 Pro, POCO M6, POCO M6 Pro'],
 ['OnePlus','15, 15R, 13, 13R, 12, 12R, 11, 10 Pro, 10T, 9, 9 Pro, 8, 8 Pro, 8T, 7, 7 Pro, 7T, Nord 5, Nord CE5, Nord 4, Nord 3, Nord 2T, Nord 2, Nord, Nord CE4 Lite, Nord CE3 Lite, Nord CE2 Lite, Nord CE2'],
 ['Huawei','Pura 80 Pro, Pura 70, Pura 70 Pro, Pura 70 Ultra, P60 Pro, P50 Pro, P50 Pocket, P40, P40 Pro, P40 Lite, P40 Lite E, P30, P30 Pro, P30 Lite, P20, P20 Pro, P20 Lite, P10, P10 Lite, Mate 50 Pro, Mate 40 Pro, Mate 30 Pro, Mate 20, Mate 20 Pro, Mate 20 Lite, Mate 10 Pro, Mate 10 Lite, nova 13, nova 13 Pro, nova 12s, nova 12 SE, nova 11, nova 11 Pro, nova 11i, nova 10, nova 10 Pro, nova 10 SE, nova 9, nova 9 SE, Y9 Prime (2019), Y7 (2019), Y6 (2019), Y5 (2019), P smart (2021), P smart (2019)'],
 ['Honor','Magic7 Pro, Magic7 Lite, Magic6 Pro, Magic6 Lite, Magic5 Pro, Magic5 Lite, Magic4 Pro, Magic4 Lite, 400, 400 Pro, 400 Lite, 200, 200 Pro, 200 Lite, 90, 90 Lite, 70, 50, X9c, X9b, X8c, X8b, X8a, X8, X7c, X7b, X7a, X7, X6b, X6a, X6, 20, 20 Pro, 20 Lite, 10, 10 Lite, 9X, 9X Lite, 8X'],
 ['Motorola','Edge 60, Edge 60 Pro, Edge 60 Fusion, Edge 50, Edge 50 Pro, Edge 50 Ultra, Edge 50 Fusion, Edge 50 Neo, Edge 40, Edge 40 Pro, Edge 40 Neo, Edge 30, Edge 30 Pro, Edge 30 Ultra, Edge 30 Fusion, Edge 30 Neo, Edge 20, Edge 20 Pro, Edge 20 Lite, Moto G86, Moto G85, Moto G84, Moto G82, Moto G75, Moto G73, Moto G72, Moto G71, Moto G62, Moto G60, Moto G56, Moto G55, Moto G54, Moto G53, Moto G52, Moto G51, Moto G50, Moto G42, Moto G41, Moto G35, Moto G34, Moto G32, Moto G31, Moto G30, Moto G24, Moto G23, Moto G22, Moto G20, Moto G15, Moto G14, Moto G13, Moto G10, Moto E40, Moto E32, Moto E22, Moto E20, Moto E13, Razr 60, Razr 60 Ultra, Razr 50, Razr 50 Ultra, Razr 40, Razr 40 Ultra']
] as const;
export const PMAX_DEFAULT_MODELS=PMAX_MODEL_GROUPS.map(([brand,models])=>brand+': '+models).join('\n');

// Round-robin through the entered brand lines so no brand crowds out another.
// Search themes are broad signals; the full editable model list stays in the draft.
export function pmaxModelThemes(value:string,term:string){
 const groups=value.split(/[\n;]+/).map(line=>{
  const colon=line.indexOf(':'),brand=colon<0?'':line.slice(0,colon).trim();
  return (colon<0?line:line.slice(colon+1)).split(',').map(m=>m.trim()).filter(Boolean).map(model=>{
   const full=brand==='Apple'||!brand?model:brand==='Samsung Galaxy S'?'Samsung Galaxy '+model:brand==='Samsung Galaxy A'?'Samsung Galaxy '+model:brand+' '+model;
   return term.toLowerCase()+' '+full;
  }).filter(theme=>theme.length<=80&&!/[{}<>]/.test(theme));
 });
 const result:string[]=[],seen=new Set<string>();
 for(let i=0;groups.some(g=>i<g.length)&&result.length<50;i++)for(const group of groups){const theme=group[i];if(theme&&!seen.has(theme.toLowerCase())){seen.add(theme.toLowerCase());result.push(theme);if(result.length===50)break;}}
 return result;
}
