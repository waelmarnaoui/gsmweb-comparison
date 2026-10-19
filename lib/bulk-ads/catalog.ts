export const BULK_SERVICES=[
 {id:'battery',label:'Battery replacement',part:'Baterie',keyword:'baterie',suffix:'batteries'},
 {id:'display',label:'Display replacement',part:'Display',keyword:'display',suffix:'displays'},
 {id:'camera',label:'Camera modules',part:'Modul Camera',keyword:'camera',suffix:'cameras'},
 {id:'charging',label:'Charging ports',part:'Port Incarcare',keyword:'mufa incarcare',suffix:'charging ports'},
 {id:'glass',label:'Display glass only',part:'Sticla Display',keyword:'sticla display',suffix:'display glass'},
] as const;
export type BulkService=typeof BULK_SERVICES[number]['id'];
export const BULK_FAMILIES=[
 {id:'iphone',label:'iPhone',models:['iPhone 7','iPhone 7 Plus','iPhone 8','iPhone 8 Plus','iPhone X','iPhone XR','iPhone XS','iPhone XS Max','iPhone 11','iPhone 11 Pro','iPhone 11 Pro Max','iPhone SE 2020','iPhone SE 2022',...[12,13].flatMap(n=>[`iPhone ${n}`,`iPhone ${n} mini`,`iPhone ${n} Pro`,`iPhone ${n} Pro Max`]),...[14,15,16].flatMap(n=>[`iPhone ${n}`,`iPhone ${n} Plus`,`iPhone ${n} Pro`,`iPhone ${n} Pro Max`]),'iPhone 16e','iPhone 17','iPhone 17 Pro','iPhone 17 Pro Max','iPhone Air','iPhone 17e','iPhone 18 Pro','iPhone 18 Pro Max','iPhone Duo']},
 {id:'samsung-s',label:'Samsung S series',models:[...[20,21,22,23,24,25].flatMap(n=>[`Samsung Galaxy S${n}`,`Samsung Galaxy S${n} Plus`,`Samsung Galaxy S${n} Ultra`]),'Samsung Galaxy S20 FE','Samsung Galaxy S21 FE','Samsung Galaxy S23 FE','Samsung Galaxy S24 FE']},
 {id:'samsung-a',label:'Samsung A series',models:['A12','A13','A14','A15','A16','A22','A23','A24','A25','A26','A32','A33','A34','A35','A36','A51','A52','A53','A54','A55','A56','A71','A72','A73'].map(m=>'Samsung Galaxy '+m)},
 {id:'xiaomi',label:'Xiaomi / Redmi',models:['Xiaomi 12','Xiaomi 12 Pro','Xiaomi 13','Xiaomi 13 Pro','Xiaomi 13T','Xiaomi 13T Pro','Xiaomi 14','Xiaomi 14T','Xiaomi 14T Pro','Xiaomi 15','Redmi Note 10','Redmi Note 10 Pro','Redmi Note 11','Redmi Note 11 Pro','Redmi Note 12','Redmi Note 12 Pro','Redmi Note 13','Redmi Note 13 Pro','Redmi Note 13 Pro Plus','Redmi Note 14','Redmi Note 14 Pro','Redmi Note 14 Pro Plus']},
 {id:'huawei',label:'Huawei',models:['P30','P30 Pro','P40','P40 Pro','P40 Lite','P50 Pro','P60 Pro','nova 9','nova 10','nova 11'].map(m=>'Huawei '+m)},
 {id:'motorola',label:'Motorola',models:['Moto G32','Moto G54','Moto G84','Moto G85','Edge 30','Edge 40','Edge 40 Neo','Edge 50','Edge 50 Neo','Edge 50 Fusion'].map(m=>'Motorola '+m)},
 {id:'honor',label:'Honor',models:['90','200','200 Pro','Magic5 Lite','Magic6 Lite','Magic6 Pro','X7','X8','X9'].map(m=>'Honor '+m)},
 {id:'oneplus',label:'OnePlus',models:['9','9 Pro','10 Pro','11','12','12R','Nord 2','Nord 3','Nord 4','Nord CE 3 Lite'].map(m=>'OnePlus '+m)},
 {id:'oppo',label:'Oppo',models:['A54','A57','A58','A78','A98','Reno8','Reno10','Reno11','Reno12'].map(m=>'Oppo '+m)},
] as const;
export type BulkFamily=typeof BULK_FAMILIES[number]['id'];
export const BULK_COPY_VERSION='bulk-replacement-exact-v2';
