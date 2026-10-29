import {pmaxCopySchema,pmaxSettingsSchema} from './model';
const copy={
 display:['Inlocuire Display Telefon','Inlocuire display'],
 glass:['Inlocuire Sticla Display','Inlocuire sticla display'],
 backglass:['Inlocuire Sticla Spate','Inlocuire sticla spate'],
 battery:['Inlocuire Baterie Telefon','Inlocuire baterie'],
 charging:['Inlocuire Mufa Incarcare','Inlocuire mufa incarcare'],
 camera:['Inlocuire Camera Telefon','Inlocuire camera'],
 other:['Diagnostic Telefon','Diagnostic telefon']
} as const;
export function pmaxTemplate(raw:unknown){
 const settings=pmaxSettingsSchema.parse(raw);
 const groups=settings.services.map(service=>{
  const [headline,term]=copy[service];
  return {service,name:'GSMWeb · '+headline,
   headlines:['GSMWeb',headline,'Drumul Taberei 138','Cere Oferta Pentru Telefon','Confirma Modelul Cu Echipa'],
   longHeadlines:[headline+' la GSMWeb in Drumul Taberei. Cere o oferta.'],
   descriptions:service==='glass'?['Pastreaza displayul original daca panoul si functia tactila permit schimbarea sticlei.','Confirma modelul si eligibilitatea cu echipa GSMWeb. Cere o oferta.']:['Confirma modelul si disponibilitatea cu echipa GSMWeb. Cere o oferta.','GSMWeb, Drumul Taberei 138. Evaluare in functie de model si defect.'],
   themes:['iPhone','Samsung S22','Samsung S23','Samsung S24','Motorola','Xiaomi','Oppo','OnePlus'].map(model=>term.toLowerCase()+' '+model)};
 });
 return {settings,copy:pmaxCopySchema.parse({groups})};
}
