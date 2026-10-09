import {createHash} from 'node:crypto';
import {allErrors} from './domain.js';
export class PolicyError extends Error {}
export function text(value,max=250){return typeof value==='string'?value.trim().slice(0,max):''}
export function verified(user){return Boolean(user.emailVerified||user.phoneNumber)}
export function assertActive(profile){if(!profile||profile.status!=='active'||!['agent','student','guest','admin'].includes(profile.role))throw new PolicyError('Your account is awaiting approval or is inactive.')}
export function scope(profile,uid){assertActive(profile);if(profile.role==='agent'){if(!profile.agencyId)throw new PolicyError('Agency assignment is missing.');return 'agency:'+profile.agencyId}return 'user:'+uid}
export function assertScope(record,profile,uid){if(!record||record.scopeId!==scope(profile,uid))throw new PolicyError('This record is not available to your account.')}
export function id(value){if(typeof value!=='string'||!/^[A-Za-z0-9-]{8,80}$/.test(value))throw new PolicyError('Invalid record reference.');return value}
export function sanitiseApplication(input,profile,user){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new PolicyError('Invalid application.');
 const fields=['firstName','lastName','email','phone','dob','country','nationality','address','conviction','programme','intake','qualification','board','year','grade','english','experience','sop','gaps'];
 const a=Object.fromEntries(fields.map(k=>[k,text(input[k],k==='gaps'?2000:k==='address'?1000:250)]));
 a.email=a.email.toLowerCase();a.channel=profile.role==='agent'?'B2B':'Direct';a.campus='RCL Mumbai';
 for(const k of ['declaration','privacy','authority','marketing'])a[k]=input[k]===true;
 a.docs={};for(const [key,value] of Object.entries(input.docs||{})){if(!['Passport','Academic certificates','Academic transcripts / mark sheets','English language document','Resume / CV','Experience letter','Statement of purpose'].includes(key)||!value?.id)throw new PolicyError('Invalid document reference.');a.docs[key]={id:id(value.id)}}
 if(Object.keys(a.docs).length>10)throw new PolicyError('Too many document references.');
 if(a.channel==='Direct'&&profile.role!=='guest'&&a.email&&(!user.emailVerified||a.email!==user.email?.toLowerCase()))throw new PolicyError('Use your verified account email for this application. Add and verify an email if you signed in by phone.');
 return a;
}
export function validateSubmission(a){const errors=allErrors(a);if(errors.length)throw new PolicyError(errors.join(' '))}
export function duplicateKey(a,scopeId){return createHash('sha256').update([scopeId,a.email.toLowerCase(),a.programme,a.intake].join('|')).digest('hex')}
export function validateFile(name,mime,bytes){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>10*1024*1024)throw new PolicyError('File must be between 1 byte and 10 MB.');
 const pdf=/\.pdf$/i.test(name)&&mime==='application/pdf'&&bytes.subarray(0,5).toString()==='%PDF-';
 const png=/\.png$/i.test(name)&&mime==='image/png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpg=/\.jpe?g$/i.test(name)&&mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(!(pdf||png||jpg))throw new PolicyError('Only valid PDF, JPG and PNG files are accepted.');
}
