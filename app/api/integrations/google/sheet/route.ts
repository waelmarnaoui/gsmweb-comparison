import {requireAdmin,apiError} from '@/lib/server';
import {connectionToken,sameOrigin,saveConnection} from '@/lib/connections';
import {IntegrationError} from '@/lib/integration-error';
export async function POST(request:Request){try{
 const {user}=await requireAdmin();sameOrigin(request);const {fileId}=await request.json();if(typeof fileId!=='string'||!/^[a-zA-Z0-9_-]{10,200}$/.test(fileId))throw new IntegrationError('Select a spreadsheet.');
 const {token,saved}=await connectionToken('google');const response=await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,trashed&supportsAllDrives=true`,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new IntegrationError('Selected file is not accessible. Reconnect Google and select it again.');
 const file=await response.json();if(file.trashed||file.mimeType!=='application/vnd.google-apps.spreadsheet')throw new IntegrationError('Select a Google Sheets spreadsheet, not an Excel file.');
 const sheet=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=spreadsheetId`,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(15000)});if(!sheet.ok)throw new IntegrationError('Selected spreadsheet could not be read. Verify Google Sheets API is enabled.');
 await saveConnection('google',saved.credentials,{sheet_id:file.id,sheet_name:file.name},user.id);return Response.json({name:file.name});
 }catch(error){return apiError(error);}}
