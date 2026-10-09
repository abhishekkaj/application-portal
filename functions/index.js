import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {defineString,defineSecret} from 'firebase-functions/params';
import {randomUUID,createHash} from 'node:crypto';
import nodemailer from 'nodemailer';
import {PolicyError,text,verified,scope,assertScope,id,sanitiseApplication,validateSubmission,duplicateKey,validateFile} from './policy.js';
import {requirements} from './domain.js';
initializeApp();
const db=getFirestore(),auth=getAuth(),bucket=getStorage().bucket();
const options={region:'asia-south1',enforceAppCheck:true,maxInstances:10,memory:'512MiB',timeoutSeconds:60};
const smtpHost=defineString('SMTP_HOST',{default:''}),smtpPort=defineString('SMTP_PORT',{default:'587'}),smtpUser=defineString('SMTP_USER',{default:''}),smtpPassword=defineSecret('SMTP_PASSWORD'),mailFrom=defineString('MAIL_FROM',{default:'info@rclmumbai.com'});
const now=()=>new Date().toISOString();
function callable(fn){return onCall(options,async req=>{try{if(!req.auth)throw new HttpsError('unauthenticated','Please sign in.');const user=await auth.getUser(req.auth.uid);if(user.disabled)throw new HttpsError('permission-denied','Account disabled.');return await fn(req,user)}catch(e){if(e instanceof HttpsError)throw e;if(e instanceof PolicyError)throw new HttpsError('failed-precondition',e.message);console.error('Portal operation failed',{code:e.code||'internal'});throw new HttpsError('internal','The request could not be completed. Please retry.')}})}
async function profile(user){const p=(await db.doc('profiles/'+user.uid).get()).data();scope(p,user.uid);if(p.role!=='guest'&&!verified(user))throw new HttpsError('permission-denied','Verify your email address first.');return p}
async function config(){return (await db.doc('configuration/portal').get()).data()||{}}
async function rate(req,kind,max){const day=now().slice(0,10);const hash=createHash('sha256').update(req.rawRequest.ip||'unknown').digest('hex');const keys=[req.auth.uid,hash];await db.runTransaction(async tx=>{const refs=keys.map(k=>db.doc('rateLimits/'+kind+'-'+day+'-'+k));const docs=await Promise.all(refs.map(r=>tx.get(r)));if(docs.some(d=>(d.data()?.count||0)>=max))throw new HttpsError('resource-exhausted','Daily request limit reached. Please contact Admissions.');refs.forEach((r,i)=>tx.set(r,{count:(docs[i].data()?.count||0)+1,expiresAt:new Date(Date.now()+3*86400000)}))})}
export const portalBootstrap=callable(async(req,user)=>{
 const ref=db.doc('profiles/'+user.uid),c=await config(),isGuest=user.providerData.length===0;
 await db.runTransaction(async tx=>{const old=await tx.get(ref);if(old.exists)return;
  const requested=req.data?.accountType;
  if(isGuest&&c.guestApplicationsEnabled===false)throw new PolicyError('Direct applications are currently unavailable.');
  if(requested==='student'&&c.studentRegistrationEnabled!==true)throw new PolicyError('Student accounts are not enabled. Use the direct application form.');
  const role=isGuest?'guest':requested==='student'?'student':'agent';
  tx.create(ref,{uid:user.uid,role,status:role==='agent'?'pending':'active',displayName:text(req.data?.name||user.displayName),organisation:role==='agent'?text(req.data?.organisation):'',created:now()});
 });
 const p=(await ref.get()).data();return {...p,email:user.email||'',phone:user.phoneNumber||'',verified:verified(user)||isGuest};
});
export const portalRecords=callable(async(req,user)=>{const p=await profile(user),s=scope(p,user.uid);const [a,m]=await Promise.all(['applications','messages'].map(c=>db.collection(c).where('scopeId','==',s).limit(500).get()));return {applications:a.docs.map(d=>({...d.data(),id:d.id})),messages:m.docs.map(d=>({...d.data(),id:d.id}))}});
export const portalSaveApplication=callable(async(req,user)=>{
 const p=await profile(user),s=scope(p,user.uid),refId=id(req.data?.id),a=sanitiseApplication(req.data?.application,p,user),submit=req.data?.submit===true,ref=db.doc('applications/'+refId);
 await rate(req,submit?'submit':'save',submit?(p.role==='guest'?5:100):300);
 const existing=await ref.get();if(existing.exists)assertScope(existing.data(),p,user.uid);
 if(existing.data()?.status&&existing.data().status!=='Draft')return existing.data();
 let agency=null;if(p.role==='agent'){agency=(await db.doc('agencies/'+p.agencyId).get()).data();if(!agency?.recruiterUid)throw new PolicyError('Admissions must assign an agency recruiter first.')}
 const docs={};for(const [type,d] of Object.entries(a.docs)){const snap=await db.doc('documents/'+id(d.id)).get(),meta=snap.data();assertScope(meta,p,user.uid);if(meta.application!==refId||meta.type!==type)throw new PolicyError('Document does not belong to this application.');docs[type]={id:d.id,name:meta.name,size:meta.size,version:meta.version,uploaded:meta.created,verification:'Awaiting verification'}}
 a.docs=docs;if(submit){validateSubmission(a);for(const t of requirements(a)){const meta=(await db.doc('documents/'+a.docs[t].id).get()).data();const [exists]=await bucket.file(meta.path).exists();if(!exists)throw new PolicyError('A required uploaded document is missing.')}}
 const stamp=now(),record={...a,id:refId,scopeId:s,ownerUid:user.uid,status:submit?'New Application':'Draft',agencyId:p.role==='agent'?p.agencyId:null,agency:agency?.name||'',recruiter:agency?.recruiterName||'',recruiterUid:agency?.recruiterUid||null,routing:p.role==='agent'?'Agency recruiter':'Direct Team Lead',created:existing.data()?.created||stamp,updated:stamp,history:[...(existing.data()?.history||[]).slice(-98),{action:submit?'Application submitted':'Draft saved',actor:p.displayName||'Applicant',at:stamp}],...(submit?{submitted:stamp}:{})};
 const auditRef=db.collection('audit').doc();
 await db.runTransaction(async tx=>{
  const fresh=await tx.get(ref);if(fresh.exists){assertScope(fresh.data(),p,user.uid);if(fresh.data().status!=='Draft')throw new HttpsError('already-exists','This application has already been submitted.')}
  if(submit){const dup=db.doc('submissionKeys/'+duplicateKey(a,s)),old=await tx.get(dup);if(old.exists&&old.data().application!==refId)throw new HttpsError('already-exists','An application for this email, programme and intake already exists.');tx.set(dup,{application:refId,created:stamp});tx.create(db.doc('emailOutbox/application-'+refId),{kind:'application-received',to:a.email,application:refId,firstName:a.firstName,programme:a.programme,intake:a.intake,status:'pending',created:stamp,attempts:0});}
  tx.set(ref,record);tx.create(auditRef,{actorUid:user.uid,application:refId,action:submit?'application.submitted':'application.draftSaved',at:stamp});
 });
 return record;
});
export const portalUpload=callable(async(req,user)=>{
 const p=await profile(user),s=scope(p,user.uid);await rate(req,'upload',p.role==='guest'?30:200);
 const application=id(req.data?.application),type=text(req.data?.type,80),name=text(req.data?.name,180),mime=text(req.data?.mime,80);
 const app=(await db.doc('applications/'+application).get()).data();if(app){assertScope(app,p,user.uid);if(app.status!=='Draft')throw new PolicyError('Submitted documents cannot be changed through this form.')}
 if(!['Passport','Academic certificates','Academic transcripts / mark sheets','English language document','Resume / CV','Experience letter','Statement of purpose'].includes(type))throw new PolicyError('Invalid document category.');
 if(typeof req.data?.base64!=='string'||req.data.base64.length>14000000)throw new PolicyError('Invalid file size.');
 const bytes=Buffer.from(req.data.base64,'base64');validateFile(name,mime,bytes);
 let version=1;if(req.data.previousId){const old=(await db.doc('documents/'+id(req.data.previousId)).get()).data();assertScope(old,p,user.uid);if(old.application!==application||old.type!==type)throw new PolicyError('Invalid document version.');version=old.version+1}
 const fileId=randomUUID(),path='documents/'+user.uid+'/'+application+'/'+fileId;
 await bucket.file(path).save(bytes,{resumable:false,contentType:mime,metadata:{cacheControl:'private, no-store',contentDisposition:'attachment'}});
 const meta={id:fileId,scopeId:s,ownerUid:user.uid,application,type,name,mime,size:bytes.length,path,version,created:now(),previousId:req.data.previousId||null};
 try{await db.doc('documents/'+fileId).create(meta)}catch(e){await bucket.file(path).delete().catch(()=>{});throw e}
 return {id:fileId,name,size:bytes.length,version,uploaded:meta.created};
});
export const portalFile=callable(async(req,user)=>{const p=await profile(user);await rate(req,'download',200);const meta=(await db.doc('documents/'+id(req.data?.id)).get()).data();assertScope(meta,p,user.uid);const [bytes]=await bucket.file(meta.path).download();return {name:meta.name,mime:meta.mime,base64:bytes.toString('base64')}});
export const portalSendMessage=callable(async(req,user)=>{const p=await profile(user);if(p.role==='guest')throw new PolicyError('Please contact your recruiter for follow-up.');await rate(req,'message',100);const message=text(req.data?.text,2000),appId=id(req.data?.application);if(!message)throw new PolicyError('Enter a message.');const app=(await db.doc('applications/'+appId).get()).data();assertScope(app,p,user.uid);const ref=db.collection('messages').doc();const m={id:ref.id,scopeId:scope(p,user.uid),ownerUid:user.uid,application:appId,text:message,created:now(),status:'received'};await ref.create(m);return m});
// Outbox is written only by server submission transactions, never by a public email endpoint.
export const deliverApplicationEmail=onDocumentWritten({document:'emailOutbox/{id}',region:'asia-south1',secrets:[smtpPassword],maxInstances:3},async event=>{
 const after=event.data?.after;if(!after?.exists||after.data().status!=='pending')return;
 const c=await config();if(c.emailEnabled!==true||!smtpHost.value()){await after.ref.update({status:'configuration_required'});return}
 const job=await db.runTransaction(async tx=>{const current=await tx.get(after.ref);if(current.data()?.status!=='pending')return null;const j=current.data();if(j.attempts>=5){tx.update(after.ref,{status:'failed',error:'Retry limit reached'});return null}tx.update(after.ref,{status:'sending',attempts:(j.attempts||0)+1,started:now()});return j});
 if(!job)return;
 const transporter=nodemailer.createTransport({host:smtpHost.value(),port:Number(smtpPort.value()),secure:smtpPort.value()==='465',requireTLS:smtpPort.value()!=='465',auth:{user:smtpUser.value(),pass:smtpPassword.value()},connectionTimeout:15000,socketTimeout:20000});
 try{const result=await transporter.sendMail({from:mailFrom.value(),to:job.to,subject:'RCL Mumbai application received - '+job.application,messageId:'<'+event.params.id+'@rclmumbai.com>',text:'Hello '+job.firstName+',\n\nWe have received your application for '+job.programme+' ('+job.intake+' intake) at RCL Mumbai.\n\nApplication reference: '+job.application+'\n\nOur recruitment team will review your application and contact you about the next steps. This acknowledgement is not an offer of admission.\n\nRCL Mumbai Admissions'});
 await after.ref.update({status:'sent',sent:now(),messageId:result.messageId});
 }catch(e){await after.ref.update({status:'failed',error:'Email delivery needs review',failedAt:now()});console.error('Application email delivery failed',{job:event.params.id,code:e.code||'smtp'})}
 finally{transporter.close()}
});
