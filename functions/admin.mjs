// Run with Application Default Credentials for your Firebase project, never a browser credential.
import {initializeApp} from 'firebase-admin/app';import {getFirestore} from 'firebase-admin/firestore';import {getAuth} from 'firebase-admin/auth';
initializeApp();const db=getFirestore();const [command,...args]=process.argv.slice(2);
if(command==='configure'){
 await db.doc('configuration/portal').set({guestApplicationsEnabled:true,studentRegistrationEnabled:false,emailEnabled:false},{merge:true});
 console.log('Portal configuration created; email and student accounts remain disabled.');
}else if(command==='approve-agent'){
 const [uid,agencyId,agencyName,recruiterUid,recruiterName]=args;
 if(![uid,agencyId,agencyName,recruiterUid,recruiterName].every(Boolean))throw new Error('approve-agent UID AGENCY_ID AGENCY_NAME RECRUITER_UID RECRUITER_NAME');
 if(!/^[A-Za-z0-9-]+$/.test(agencyId))throw new Error('Invalid agency ID');
 const user=await getAuth().getUser(uid);if(!user.emailVerified&&!user.phoneNumber)throw new Error('Verify identity first');
 const ref=db.doc('profiles/'+uid),p=(await ref.get()).data();if(p?.role!=='agent')throw new Error('Account must be a registered agency');
 const batch=db.batch();batch.set(db.doc('agencies/'+agencyId),{name:agencyName,recruiterUid,recruiterName},{merge:true});batch.update(ref,{status:'active',agencyId,approvedAt:new Date().toISOString()});batch.create(db.collection('audit').doc(),{action:'agency.approved',uid,agencyId,at:new Date().toISOString()});await batch.commit();console.log('Agency access approved');
}else if(command==='retry-email'){
 const [jobId]=args,ref=db.doc('emailOutbox/'+jobId),job=(await ref.get()).data();
 if(!job||!['failed','configuration_required'].includes(job.status))throw new Error('Only failed or unconfigured jobs can be retried. Review sending jobs manually before any resend.');
 await ref.update({status:'pending'});console.log('Email retry queued');
}else throw new Error('Use configure, approve-agent or retry-email');
